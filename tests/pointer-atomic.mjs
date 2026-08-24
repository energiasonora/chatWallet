// Verifica los cambios del upload-server: escritura atómica/coalescida del padrón
// de punteros y los contadores de /metrics. No necesita Kubo (no toca /api/ipfs/upload).
import { Wallet } from 'ethers';
import { readFileSync, existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';

const HERE = '/Users/xunorus/xunserver/chatWallet/poc/ipfs-node';
const PTR = `${HERE}/backup-pointers.json`;
const BAK = `${PTR}.testbak`;
const BASE = 'http://127.0.0.1:3199';

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Resguardar el padrón real antes de tocar nada.
if (existsSync(PTR)) copyFileSync(PTR, BAK);

const srv = spawn(process.execPath, [`${HERE}/upload-server.mjs`], {
  env: { ...process.env, UPLOAD_PORT: '3199' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
srv.stdout.on('data', d => process.stdout.write(`  [srv] ${d}`));
srv.stderr.on('data', d => process.stderr.write(`  [srv!] ${d}`));

const publish = async (wallet, cid, ts) => {
  const signature = await wallet.signMessage(`chatwallet-backup:${cid}:${ts}`);
  const r = await fetch(`${BASE}/api/backup/pointer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: wallet.address, cid, ts, count: 1, signature }),
  });
  return r.status;
};
const readPtrs = () => JSON.parse(readFileSync(PTR, 'utf8'));

try {
  // Esperar a que levante.
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { }
    await sleep(100);
  }

  const w = Wallet.createRandom();
  const addr = w.address.toLowerCase();

  // 1. Publicación simple → se persiste YA (sin esperar la ventana de coalescencia).
  ok(await publish(w, 'bafkreitest001', 1000) === 200, 'pointer nuevo aceptado (200)');
  await sleep(50);
  ok(readPtrs()[addr]?.cid === 'bafkreitest001', 'primera publicación persistida de inmediato');

  // 2. ts viejo → 409 y el padrón NO cambia.
  ok(await publish(w, 'bafkreitest000', 999) === 409, 'ts retrasado rechazado (409)');
  ok(readPtrs()[addr]?.cid === 'bafkreitest001', 'el 409 no pisó el pointer bueno');

  // 3. Ráfaga: 6 publicaciones seguidas se agrupan, pero el ESTADO FINAL tiene que quedar.
  for (let i = 2; i <= 7; i++) ok(await publish(w, `bafkreitest00${i}`, 1000 + i) === 200, `ráfaga ${i} aceptada`);
  await sleep(1300);
  ok(readPtrs()[addr]?.cid === 'bafkreitest007', 'tras la ráfaga quedó persistido el último CID');

  // 4. Firma ajena → 401 (no se puede pisar el pointer de otro).
  const intruso = Wallet.createRandom();
  const sigMala = await intruso.signMessage('chatwallet-backup:bafkreievil:9999');
  const rMala = await fetch(`${BASE}/api/backup/pointer`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: w.address, cid: 'bafkreievil', ts: 9999, count: 1, signature: sigMala }),
  });
  ok(rMala.status === 401, 'firma de otra wallet rechazada (401)');
  ok(readPtrs()[addr]?.cid === 'bafkreitest007', 'el intento ajeno no tocó el padrón');

  // 5. El JSON en disco siempre parsea y no queda basura .tmp.
  ok(!existsSync(PTR + '.tmp'), 'no quedó archivo temporal colgado');

  // 6. Métricas.
  const m = await (await fetch(`${BASE}/metrics`)).text();
  ok(/chatwallet_pointer_publishes_total 7/.test(m), 'métrica de publicaciones = 7');
  ok(/chatwallet_pointers_current \d+/.test(m), 'métrica de punteros actuales presente');
  ok(/chatwallet_uploads_total 0/.test(m), 'métrica de subidas presente en cero');
  console.log('  --- /metrics ---\n' + m.split('\n').map(l => '  ' + l).join('\n'));

  // 7. SIGTERM: lo pendiente en la ventana de coalescencia tiene que llegar al disco.
  await publish(w, 'bafkreifinal', 20000);
  srv.kill('SIGTERM');
  await sleep(600);
  ok(readPtrs()[addr]?.cid === 'bafkreifinal', 'el apagado ordenado hizo flush de lo pendiente');
} finally {
  try { srv.kill('SIGKILL'); } catch { }
  // Restaurar el padrón original.
  if (existsSync(BAK)) { copyFileSync(BAK, PTR); unlinkSync(BAK); }
  console.log(fails ? `\n❌ ${fails} chequeos fallaron` : '\n✅ todos los chequeos pasaron');
  process.exit(fails ? 1 : 0);
}
