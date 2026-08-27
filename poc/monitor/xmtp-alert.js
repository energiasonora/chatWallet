#!/usr/bin/env node
/**
 * xmtp-alert.js — Envía un DM XMTP al jefe desde el monitor.
 * Usa su propia identidad burner (state.json en la misma carpeta).
 *
 * Uso:
 *   node xmtp-alert.js "💀 IPFS caído, reinicio falló"
 *   echo "texto" | node xmtp-alert.js
 *
 * Variables de entorno:
 *   XMTP_ENV        — "production" (default) | "dev"
 *   NOTIFY_TO       — address XMTP destino (default: la del jefe)
 */

import { Client, IdentifierKind } from "@xmtp/node-sdk";
import { Wallet, getBytes } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(HERE, "alert-state.json");
const XMTP_ENV = process.env.XMTP_ENV || "production"; // la app se mudó el 27/8/2026
const NOTIFY_TO = (process.env.NOTIFY_TO || "0x7a38722ff7d1139dca52dbbc368378a178e6d572").toLowerCase();

// ── Estado persistente (burner PK) ──
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return {}; }
}
function saveState(s) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

const state = loadState();
if (!state.pk) {
  state.pk = Wallet.createRandom().privateKey;
  saveState(state);
  console.error("🔑 Nueva identidad burner generada");
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

// ── XMTP ──
const wallet = new Wallet(state.pk);
console.error(`Notificador: ${wallet.address} → ${NOTIFY_TO} (${XMTP_ENV})`);

const signer = {
  type: "EOA",
  getIdentifier: () => ({ identifier: wallet.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }),
  signMessage: async (msg) => getBytes(await wallet.signMessage(msg)),
};

let client;
async function send() {
  client = await Client.create(signer, {
    env: XMTP_ENV,
    dbPath: join(HERE, `xmtp-alert-${XMTP_ENV}.db3`),
  });
  await client.conversations.sync();

  const conv = await client.conversations.createDmWithIdentifier({
    identifier: NOTIFY_TO,
    identifierKind: IdentifierKind.Ethereum,
  });

  await conv.sendText(text);
  console.error(`📨 ${new Date().toISOString()} → ${text.split("\n")[0]}`);
}

send()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ XMTP falló:", err.message);
    process.exit(1);
  });
