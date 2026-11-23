// Prueba los topes de upload-server.mjs contra un Kubo FALSO (no toca ningún nodo real).
//   unset NODE_OPTIONS; node poc/ipfs-node/test-limites.mjs
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const tmp = mkdtempSync(join(tmpdir(), 'cw-limites-'));
const PLANES = join(tmp, 'espacio-planes.json');
const KPORT = 45001, UPORT = 43100;
const MB = 1024 * 1024;

// Kubo falso: add devuelve un CID inventado; repo/stat devuelve el % que diga `repoPct`.
let repoPct = 10, adds = 0;
const kubo = createServer((req, res) => {
  const chunks = []; req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    if (req.url.startsWith('/api/v0/add')) { adds++; res.end(JSON.stringify({ Hash: 'bafkfake' + adds }) + '\n'); }
    else if (req.url.startsWith('/api/v0/repo/stat')) res.end(JSON.stringify({ RepoSize: repoPct * 1e8, StorageMax: 100e8 }));
    else { res.statusCode = 404; res.end(); }
  });
}).listen(KPORT);

const srv = spawn(process.execPath, [join(DIR, 'upload-server.mjs')], {
  env: { ...process.env, KUBO_API: `http://127.0.0.1:${KPORT}`, UPLOAD_PORT: String(UPORT), ESPACIO_PLANES: PLANES },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stderr.on('data', (d) => process.env.VERBOSE && process.stderr.write(d));
await new Promise((ok) => srv.stdout.on('data', (d) => String(d).includes('upload server') && ok()));

async function subir(wallet, n, { mentirSize, ip } = {}) {
  const bytes = randomBytes(Math.round(n));
  n = bytes.length;
  const sha = createHash('sha256').update(bytes).digest('hex');
  const size = mentirSize ?? n;
  const signature = await wallet.signMessage(`ipfs-upload:${sha}:${size}`);
  const headers = { 'content-type': 'application/octet-stream', 'x-address': wallet.address, 'x-signature': signature, 'x-sha256': sha, 'x-size': String(size) };
  if (ip) headers['cf-connecting-ip'] = ip;
  const r = await fetch(`http://127.0.0.1:${UPORT}/api/ipfs/upload`, { method: 'POST', headers, body: bytes });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, error: j.error };
}

let fallas = 0;
function esperar(nombre, got, want) {
  const ok = got.status === want;
  if (!ok) fallas++;
  console.log(`${ok ? '✓' : '✗'} ${nombre}: ${got.status}${ok ? '' : ` (esperaba ${want})`}${got.error ? ` — ${got.error}` : ''}`);
}
const W = () => ethers.Wallet.createRandom();
const espacio = (...args) => execFileSync(process.execPath, [join(DIR, 'espacio.mjs'), ...args], { env: { ...process.env, ESPACIO_PLANES: PLANES } }).toString().trim();

// ── Sin plan ──
const a = W();
esperar('respaldo chico (2 KB)', await subir(a, 2048), 200);
esperar('archivo de 6 MB sin plan', await subir(a, 6 * MB), 413);
esperar('firma de otra wallet', await (async () => {
  const bytes = randomBytes(100); const sha = createHash('sha256').update(bytes).digest('hex');
  const sig = await W().signMessage(`ipfs-upload:${sha}:100`);
  const r = await fetch(`http://127.0.0.1:${UPORT}/api/ipfs/upload`, { method: 'POST', headers: { 'x-address': a.address, 'x-signature': sig, 'x-sha256': sha, 'x-size': '100' }, body: bytes });
  return { status: r.status };
})(), 401);
esperar('firma un tamaño chico y manda más', await subir(a, 4 * MB, { mentirSize: 1000 }), 400);
for (let i = 0; i < 4; i++) await subir(a, 4.5 * MB);           // 18 MB + 2 KB
esperar('wallet pasa 20 MB en el día', await subir(a, 4.5 * MB), 429);

// Muchas wallets desde la misma conexión (IP del túnel): tope de 50 MB por IP.
let ultimo;
for (let i = 0; i < 12; i++) ultimo = await subir(W(), 4.5 * MB, { ip: '203.0.113.7' });
esperar('wallets nuevas desde una sola IP pasan 50 MB', ultimo, 429);
esperar('la misma IP, otra wallet nueva con 4,5 MB', await subir(W(), 4.5 * MB, { ip: '203.0.113.7' }), 429);
esperar('otra IP sigue pudiendo', await subir(W(), 2048, { ip: '198.51.100.9' }), 200);

// Una subida rechazada no consume el tope: la wallet nueva con un 413 sigue teniendo sus 20 MB.
const b = W();
await subir(b, 6 * MB, { ip: '192.0.2.1' });
esperar('tras un rechazo, la reserva se devolvió', await subir(b, 4.5 * MB, { ip: '192.0.2.1' }), 200);

// Tope global de 300 MB por día entre todas las IPs.
let g;
for (let i = 0; i < 80 && (!g || g.status === 200); i++) g = await subir(W(), 4.9 * MB, { ip: `10.9.${i}.1` });
esperar('tope global del día', g, 429);

// ── Con plan ──
const p = W();
console.log('  ' + espacio('dar', p.address, '0.05', '30', 'prueba'));   // ~51 MB
esperar('plan: archivo de 30 MB (con el tope global agotado)', await subir(p, 30 * MB), 200);
esperar('plan: otro de 30 MB no entra en los 51 MB', await subir(p, 30 * MB), 403);
console.log('  ' + espacio('lista'));
esperar('plan: archivo de 101 MB', await subir(p, 101 * MB), 413);

const v = W();
espacio('dar', v.address, '1', '2020-01-01');
esperar('plan vencido usa el tope gratis (6 MB → 413)', await subir(v, 6 * MB, { ip: '10.200.0.1' }), 413);

// ── Repo lleno ── (la caché del server es de 60 s: se espera a que venza en un server nuevo, no hace falta;
// se prueba con otro proceso que arranca con el repo ya lleno)
srv.kill();
repoPct = 85;
const srv2 = spawn(process.execPath, [join(DIR, 'upload-server.mjs')], {
  env: { ...process.env, KUBO_API: `http://127.0.0.1:${KPORT}`, UPLOAD_PORT: String(UPORT), ESPACIO_PLANES: PLANES }, stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((ok) => srv2.stdout.on('data', (d) => String(d).includes('upload server') && ok()));
esperar('repo al 85 %: sin plan no sube', await subir(W(), 2048), 507);
espacio('dar', p.address, '1', '30');
esperar('repo al 85 %: con plan sí', await subir(p, 2048), 200);

srv2.kill(); kubo.close(); rmSync(tmp, { recursive: true, force: true });
console.log(fallas ? `\n${fallas} FALLAS` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
