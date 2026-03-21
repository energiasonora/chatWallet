const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { ethers } = require("ethers");
const crypto = require("crypto");

admin.initializeApp();
setGlobalOptions({ region: "us-central1" });

const db = admin.firestore();
const bucket = admin.storage().bucket();

// ════════════════════════════════════════════════
//  ⚙️  EDITÁ ESTOS VALORES
// ════════════════════════════════════════════════
const CONFIG = {
  PAYMENT_ADDRESS:      "0x1c87FDF8844cbEe5DC7f0F1681C44bF3c99A0e3d",           // tu wallet Arbitrum, en minúsculas
  BOOK_FILE_PATH:       "cryptoParaSoberanos-v23d.pdf",
  PRICE_USD:            10,
  CHAIN_ID:             42161,                         // Arbitrum One mainnet
  RPC_URL:              "https://arb1.arbitrum.io/rpc",
  CHAINLINK_FEED:       "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
  SLIPPAGE_TOLERANCE:   0.05,                          // 5% de tolerancia de precio
  SIGNED_URL_TTL_MS:    1000 * 60 * 60,               // link expira en 1 hora
};

const CHAINLINK_ABI = [
  "function latestRoundData() view returns (uint80, int256 answer, uint256, uint256, uint80)",
  "function decimals() view returns (uint8)",
];

// ── Helpers ──────────────────────────────────────

function generateToken(address) {
  const secret = process.env.TOKEN_SECRET || "cambia_esto_en_produccion";
  return crypto
    .createHmac("sha256", secret)
    .update(address.toLowerCase() + Date.now().toString())
    .digest("hex");
}

async function getMinAcceptableWei() {
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
  const feed = new ethers.Contract(CONFIG.CHAINLINK_FEED, CHAINLINK_ABI, provider);
  const [decimals, [, answer]] = await Promise.all([
    feed.decimals(),
    feed.latestRoundData(),
  ]);
  const ethPrice = Number(answer) / Math.pow(10, Number(decimals));
  const ethNeeded = CONFIG.PRICE_USD / ethPrice;
  const withTolerance = ethNeeded * (1 - CONFIG.SLIPPAGE_TOLERANCE);
  return ethers.parseEther(withTolerance.toFixed(8));
}

function send(res, status, data) {
  res.status(status).json(data);
}

// ── CORS ─────────────────────────────────────────

function cors(req, res, next) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");
  next();
}

// ════════════════════════════════════════════════
//  ENDPOINTS
// ════════════════════════════════════════════════

exports.api = onRequest({ timeoutSeconds: 60, memory: "256MiB" }, async (req, res) => {
  cors(req, res, async () => {
    const path = req.path.replace(/\/$/, "");

    // ── POST /api/verifyPayment ───────────────────
    if (req.method === "POST" && path === "/verifyPayment") {
      const { txHash, address } = req.body;

      if (!txHash || !address) {
        return send(res, 400, { error: "txHash y address son requeridos" });
      }

      const addr  = address.toLowerCase();
      const txH   = txHash.toLowerCase();

      // Anti-replay: ¿ya fue usado este txHash?
      const usedRef = db.collection("usedTxHashes").doc(txH);
      if ((await usedRef.get()).exists) {
        return send(res, 409, { error: "Este txHash ya fue canjeado" });
      }

      // Verificar tx on-chain
      let tx, receipt;
      try {
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        [tx, receipt] = await Promise.all([
          provider.getTransaction(txH),
          provider.getTransactionReceipt(txH),
        ]);
      } catch (e) {
        return send(res, 502, { error: "No se pudo consultar la blockchain" });
      }

      if (!tx || !receipt) {
        return send(res, 404, { error: "Transacción no encontrada. ¿Ya fue confirmada?" });
      }
      if (receipt.status !== 1) {
        return send(res, 400, { error: "La transacción falló en la blockchain" });
      }
      if (tx.to?.toLowerCase() !== CONFIG.PAYMENT_ADDRESS.toLowerCase()) {
        return send(res, 400, { error: "La transacción no va a la wallet correcta" });
      }
      if (tx.from?.toLowerCase() !== addr) {
        return send(res, 400, { error: "La address no coincide con el origen de la tx" });
      }
      if (Number(tx.chainId) !== CONFIG.CHAIN_ID) {
        return send(res, 400, { error: "La transacción no es en Arbitrum One" });
      }

      // Verificar monto con precio Chainlink
      let minWei;
      try {
        minWei = await getMinAcceptableWei();
      } catch (e) {
        return send(res, 502, { error: "No se pudo verificar el precio en Chainlink" });
      }

      if (tx.value < minWei) {
        return send(res, 400, {
          error: `Pago insuficiente. Enviaste ${parseFloat(ethers.formatEther(tx.value)).toFixed(6)} ETH`,
        });
      }

      // ✅ Todo ok — crear purchase y token
      const token = generateToken(addr);
      const now   = admin.firestore.FieldValue.serverTimestamp();

      const batch = db.batch();
      batch.set(db.collection("purchases").doc(token), {
        address:       addr,
        txHash:        txH,
        token,
        downloads:     0,
        amountEth:     ethers.formatEther(tx.value),
        blockNumber:   receipt.blockNumber,
        network:       "arbitrum-one",
        createdAt:     now,
        lastDownloadAt: null,
      });
      batch.set(usedRef, { address: addr, token, usedAt: now });
      await batch.commit();

      return send(res, 200, { success: true, token });
    }

    // ── GET /api/download?token=xxx ───────────────
    if (req.method === "GET" && path === "/download") {
      const { token } = req.query;
      if (!token) return send(res, 400, { error: "Token requerido" });

      const doc = await db.collection("purchases").doc(token).get();
      if (!doc.exists) return send(res, 404, { error: "Token inválido" });

      // Generar Signed URL (expira en 1h)
      const [signedUrl] = await bucket.file(CONFIG.BOOK_FILE_PATH).getSignedUrl({
        action:              "read",
        expires:             Date.now() + CONFIG.SIGNED_URL_TTL_MS,
        responseDisposition: 'attachment; filename="Crypto-para-Principiantes-Cap1.pdf"',
      });

      // Incrementar contador
      await db.collection("purchases").doc(token).update({
        downloads:      admin.firestore.FieldValue.increment(1),
        lastDownloadAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.redirect(302, signedUrl);
    }


// ── GET /api/purchases?address=0x... ──
if (req.method === "GET" && path === "/purchases") {
    const { address } = req.query;
    if (!address) return send(res, 400, { error: "address requerida" });

    const snapshot = await db
        .collection("purchases")
        .where("address", "==", address.toLowerCase())
        // .orderBy("createdAt", "desc")
        .get();

    const purchases = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        token: undefined, // no exponer el token
    }));

    return send(res, 200, { purchases });
}


    return send(res, 404, { error: "Endpoint no encontrado" });
  });
});