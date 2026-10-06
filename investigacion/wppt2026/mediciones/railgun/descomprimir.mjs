// Descomprime los .br y compara el sha256 con los hashes publicados en el SDK de Railgun.
import zlib from 'zlib'; import fs from 'fs'; import crypto from 'crypto';
const HASHES = JSON.parse(fs.readFileSync(new URL('./hashes-sdk.json', import.meta.url)));
for (const v of fs.readdirSync('art')) for (const k of ['zkey', 'wasm']) {
  const br = `art/${v}/${k}.br`; if (!fs.existsSync(br)) continue;
  const d = zlib.brotliDecompressSync(fs.readFileSync(br)); fs.writeFileSync(`art/${v}/${k}`, d);
  const h = crypto.createHash('sha256').update(d).digest('hex');
  const ok = h === HASHES[v]?.[k];
  console.log(v, k, (fs.statSync(br).size / 1e6).toFixed(2), 'MB comprimido,', (d.length / 1e6).toFixed(2), 'MB,', ok ? 'hash OK' : 'HASH DISTINTO');
  if (!ok) process.exitCode = 1;
}
