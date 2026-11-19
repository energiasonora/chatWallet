#!/usr/bin/env node
/**
 * xmtp-alert.js — Manda un DM por XMTP desde el monitor de la caja.
 * Usa su propia identidad (alert-state.json en la misma carpeta).
 *
 * Antes del primer aviso a cada destino (y cada vez que cambian el nombre o el ícono) manda el
 * perfil soberano firmado de ChatWallet (xmtp.chatwallet/profile:1.0), igual que la marca del
 * notificador de ventas: así en la app el chat aparece como «Monitor de la caja», con su ícono,
 * y no como una dirección 0x… suelta.
 *
 * Uso:
 *   node xmtp-alert.js "💀 IPFS caído, reinicio falló"
 *   echo "texto" | node xmtp-alert.js
 *
 * Variables de entorno (las pone monitor.py desde el .env de esta carpeta):
 *   XMTP_ENV        — "production" | "dev" (default dev, por compatibilidad con el monitor viejo)
 *   NOTIFY_TO       — address destino
 *   ALERT_ALIAS     — nombre que muestra ChatWallet (default «Monitor de la caja»)
 */

import { Client, IdentifierKind } from "@xmtp/node-sdk";
import { Wallet, getBytes } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, "alert-state.json");
const AVATAR_FILE = join(HERE, "alerta-avatar.webp");
const XMTP_ENV = process.env.XMTP_ENV || "dev";
const NOTIFY_TO = (process.env.NOTIFY_TO || "0x7a38722ff7d1139dca52dbbc368378a178e6d572").toLowerCase();
const ALIAS = process.env.ALERT_ALIAS || "Monitor de la caja";
const LINKS = "https://uso.chatwallet.org";

// ── Estado persistente (PK propia + a quién ya se le mandó el perfil) ──
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

const state = loadState();
if (!state.pk) {
  state.pk = Wallet.createRandom().privateKey;
  saveState(state);
  console.error("🔑 Nueva identidad generada");
}

// ── Mensaje desde argv o stdin ──
let text = process.argv.slice(2).join(" ").trim();
if (!text) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  text = chunks.join("").trim();
}
if (!text) {
  console.error("Uso: node xmtp-alert.js <mensaje>");
  process.exit(1);
}

const wallet = new Wallet(state.pk);
console.error(`Notificador: ${wallet.address} → ${NOTIFY_TO} (${XMTP_ENV})`);

const signer = {
  type: "EOA",
  getIdentifier: () => ({ identifier: wallet.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
  signMessage: async (msg) => getBytes(await wallet.signMessage(msg)),
};

// Perfil v1 de ChatWallet. La cadena firmada tiene que ser idéntica a profileCanonical() de la
// dapp: [1, did, alias, links, avatar, updatedAt]. avatarHash va aparte, sin firmar (lo deriva el receptor).
async function perfil() {
  const avatar = existsSync(AVATAR_FILE) ? "data:image/webp;base64," + readFileSync(AVATAR_FILE).toString("base64") : "";
  // updatedAt fijo mientras no cambie: si cambia el nombre o el ícono, se vuelve a mandar a todos.
  const sello = JSON.stringify([ALIAS, LINKS, avatar.length, createHash("sha256").update(avatar).digest("hex")]);
  if (state.perfilSello !== sello) {
    state.perfilSello = sello; state.perfilAt = Date.now(); state.perfilEnviado = {};
    saveState(state);
  }
  const p = { v: 1, did: wallet.address, alias: ALIAS, links: LINKS, avatar, updatedAt: state.perfilAt };
  p.sig = await wallet.signMessage(JSON.stringify([1, p.did.toLowerCase(), p.alias, p.links, p.avatar, p.updatedAt]));
  if (avatar) p.avatarHash = createHash("sha256").update(avatar).digest("hex");
  return {
    type: { authorityId: "xmtp.chatwallet", typeId: "profile", versionMajor: 1, versionMinor: 0 },
    parameters: {},
    fallback: `[Perfil de ${ALIAS}]`,
    content: new TextEncoder().encode(JSON.stringify(p)),
  };
}

async function send() {
  const client = await Client.create(signer, {
    env: XMTP_ENV,
    dbPath: join(HERE, `xmtp-alert-${XMTP_ENV}.db3`),
  });
  await client.conversations.sync();

  const conv = await client.conversations.createDmWithIdentifier({
    identifier: NOTIFY_TO,
    identifierKind: IdentifierKind.Ethereum,
  });

  const encoded = await perfil();   // también resetea perfilEnviado si cambió el perfil
  const clave = `${XMTP_ENV}:${NOTIFY_TO}`;
  state.perfilEnviado = state.perfilEnviado || {};
  if (!state.perfilEnviado[clave]) {
    try {
      await conv.send(encoded);
      state.perfilEnviado[clave] = Date.now();
      saveState(state);
      console.error("🪪 perfil enviado");
    } catch (e) {
      // Sin perfil el aviso igual tiene que salir: se reintenta la próxima vez.
      console.error("⚠️ no se pudo mandar el perfil:", e.message);
    }
  }

  await conv.sendText(text);
  console.error(`📨 ${new Date().toISOString()} → ${text.split("\n")[0]}`);
}

send()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ XMTP falló:", err.message);
    process.exit(1);
  });
