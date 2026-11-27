// E2E del envío por ChatWallet: Worker local + squid falso + notificador (copia) en XMTP dev
// + dos identidades XMTP reales (autor y comprador) que leen lo que les llegó.
import { Client, IdentifierKind } from '../../poc/sales-notifier/node_modules/@xmtp/node-sdk/dist/index.js';
import { Wallet, getBytes } from 'ethers';
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const [, , N] = process.argv;
const B = 'http://127.0.0.1:8787', SQ = 'http://127.0.0.1:8799';
const ADM = { Authorization: 'Bearer admin-prueba', 'Content-Type': 'application/json' };
const CUENTA = 'g1XunorusCuentaDePrueba11111111111111111111111111';
let ok = 0, mal = 0;
const chk = (c, m) => { c ? ok++ : mal++; console.log(`${c ? '✔' : '✘'} ${m}`); };
const signer = (w) => ({ type: 'EOA', getIdentifier: () => ({ identifier: w.address.toLowerCase(), identifierKind: IdentifierKind.Ethereum }), signMessage: async (m) => getBytes(await w.signMessage(m)) });
const nuevo = async (w, nombre) => Client.create(signer(w), { env: 'dev', dbPath: `${N}/${nombre}.db3` });

const autor = Wallet.createRandom(), comprador = Wallet.createRandom();
const [cAutor, cComp] = await Promise.all([nuevo(autor, 'autor'), nuevo(comprador, 'comprador')]);
console.log('identidades XMTP dev listas');
writeFileSync(`${N}/.env`, `NOTIFIER_TOKEN=admin-prueba\nAPI_BASE=${B}\nXMTP_ENV=dev\nNOTIFY_TO=${autor.address}\nDIGEST_AT=off\n`);
writeFileSync(`${N}/state.json`, JSON.stringify({ since: Date.now() - 1000 }));

await fetch(B + '/admin/g1/config', { method: 'POST', headers: ADM, body: JSON.stringify({ cuenta: CUENTA, centimos: 15000, activo: true }) });
const p = await (await fetch(B + '/g1/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: 'es' }) })).json();
await fetch(B + '/g1/chatwallet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: p.codigo, s: p.s, wallet: comprador.address }) });
await fetch(SQ + '/_agregar', { method: 'POST', body: JSON.stringify({ toId: CUENTA, amount: 15000, remark: p.codigo }) });
const pagado = await (await fetch(`${B}/g1/pedido?codigo=${p.codigo}&s=${p.s}`)).json();
chk(pagado.pagado, `pedido ${p.codigo} pagado con ChatWallet ${comprador.address.slice(0, 8)}…`);

const r = spawnSync(process.execPath, ['sales-notifier.mjs', '--once'], { cwd: N, encoding: 'utf8', timeout: 120000 });
console.log((r.stdout + r.stderr).split('\n').filter(Boolean).map((l) => '   │ ' + l).join('\n'));

async function leer(c) {
  await c.conversations.syncAll();
  const out = [];
  for (const dm of c.conversations.listDms()) for (const m of await dm.messages()) if (typeof m.content === 'string') out.push(m.content);
  return out;
}
let deComp = [], deAutor = [];
for (let i = 0; i < 10 && (!deComp.length || !deAutor.some((t) => /Libro en junas/.test(t))); i++) {
  await new Promise((r) => setTimeout(r, 2000));
  [deComp, deAutor] = await Promise.all([leer(cComp), leer(cAutor)]);
}
const msg = deComp.find((t) => /Gracias por comprar/.test(t)) || '';
chk(msg.includes('https://libro.chatwallet.org/download?token=' + new URL(pagado.descarga).searchParams.get('token')) && msg.includes(p.codigo), 'al comprador le llegó por chat el enlace de descarga');
console.log('   comprador recibió:\n' + msg.split('\n').map((l) => '   > ' + l).join('\n'));
chk(deAutor.some((t) => /Venta en junas \(Ğ1\)/.test(t)), 'al autor: «💰 Venta en junas (Ğ1)…»');
chk(deAutor.some((t) => t.includes(`Libro en junas ${p.codigo} enviado por ChatWallet`)), 'al autor: «📲 … enviado por ChatWallet»');
// el remitente del comprador es la marca y mandó su perfil
const dmsComp = cComp.conversations.listDms();
let perfil = false;
for (const dm of dmsComp) for (const m of await dm.messages()) if (m.contentType?.typeId === 'profile') perfil = true;
chk(perfil, 'llegó primero el perfil de «Energía Sonora» (nombre + ícono)');
console.log(`\n${ok} ✔  ${mal} ✘`);
process.exit(mal ? 1 : 0);
