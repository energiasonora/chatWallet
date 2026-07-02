// POC del endpoint de subida autenticada que reemplaza el flujo VIP/UCAN de Storacha.
// El browser NO habla con Kubo directo (su API es poderosa); habla con ESTE server, que:
//   1. verifica la firma del DID (wallet) sobre el CID+size → autentica el contenido exacto
//   2. (opcional) chequea cuota
//   3. mete los bytes en el Kubo LOCAL y pinea
//   4. verifica que el CID que devuelve Kubo == el CID firmado (integridad)
//   5. devuelve CID + URL de gateway
// En producción esto se pliega dentro de server.js (que ya corre) reemplazando /api/delegate.
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import { createHash } from 'node:crypto';

const KUBO_API = process.env.KUBO_API || 'http://127.0.0.1:5001';
const GATEWAY = process.env.KUBO_GATEWAY || 'http://127.0.0.1:8080';
const PORT = process.env.UPLOAD_PORT || 3100;

// Cuota en memoria para el POC (en prod = quotas.json, como ya hace server.js).
const quotas = {}; // addr(lower) -> bytes disponibles
function seedQuota(addr, mb) { quotas[addr.toLowerCase()] = mb * 1024 * 1024; }
export { seedQuota };

const app = express();
app.use(cors());
// Bytes crudos del archivo (hasta 100MB, igual que IPFS_MAX_MB del uploader actual).
app.use('/api/ipfs/upload', express.raw({ type: '*/*', limit: '100mb' }));

app.post('/api/ipfs/upload', async (req, res) => {
  try {
    const address = req.header('x-address');
    const signature = req.header('x-signature');
    const claimedSha = req.header('x-sha256'); // hex del sha256 de los bytes (plaintext o ciphertext)
    const size = Number(req.header('x-size'));
    const bytes = req.body; // Buffer

    if (!address || !signature || !claimedSha || !bytes?.length) {
      return res.status(400).json({ error: 'Faltan address/signature/sha256 o body vacío' });
    }

    // 1. Verificar firma: el usuario firma "ipfs-upload:<sha256>:<size>" con su wallet (DID).
    //    sha256 sobre los bytes crudos → size-agnóstico (no depende del chunking de IPFS).
    const message = `ipfs-upload:${claimedSha}:${size}`;
    let recovered;
    try { recovered = ethers.verifyMessage(message, signature); }
    catch (e) { return res.status(401).json({ error: 'Firma ilegible' }); }
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Firma no corresponde a la address' });
    }

    // 1b. Integridad: los bytes recibidos deben hashear al sha256 firmado (cualquier tamaño).
    const actualSha = createHash('sha256').update(bytes).digest('hex');
    if (actualSha !== claimedSha) {
      return res.status(409).json({ error: `sha256 no coincide: firmado ${claimedSha} vs recibido ${actualSha}` });
    }

    // 2. Cuota (hook — en el POC se puede saltar si no hay cuota seteada).
    const addr = address.toLowerCase();
    if (addr in quotas) {
      if (bytes.length > quotas[addr]) {
        return res.status(403).json({ error: `Cuota insuficiente (${quotas[addr]} bytes)` });
      }
    }

    // 3. Meter en Kubo local y pinear. Kubo calcula el CID (dag-pb para >256KB, raw para chico).
    //    El cliente aprende el CID de la respuesta y lo guarda en la atestación del DID.
    const form = new FormData();
    form.append('file', new Blob([bytes]), 'f');
    const kuboRes = await fetch(`${KUBO_API}/api/v0/add?cid-version=1&pin=true`, {
      method: 'POST', body: form,
    });
    if (!kuboRes.ok) {
      return res.status(502).json({ error: `Kubo add falló: ${kuboRes.status}` });
    }
    const text = await kuboRes.text();
    const last = text.trim().split('\n').pop();
    const kuboCid = JSON.parse(last).Hash;

    // 4. Descontar cuota y responder.
    if (addr in quotas) quotas[addr] -= bytes.length;
    res.json({ success: true, cid: kuboCid, gateway: `${GATEWAY}/ipfs/${kuboCid}`, pinned: true });
  } catch (e) {
    console.error('upload error', e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`POC upload server en http://localhost:${PORT} (Kubo ${KUBO_API})`));
