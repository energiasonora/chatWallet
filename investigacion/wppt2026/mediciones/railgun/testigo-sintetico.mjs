// Para circuitos sin entradas válidas a mano (POI): arma un .wtns del largo correcto con valores
// al azar y mide SÓLO groth16.prove. La prueba sale inválida a propósito; el tiempo de probar casi
// no depende del valor del testigo. Se calibra corriendo lo mismo sobre un JoinSplit con medición real.
import fs from 'fs'; import crypto from 'crypto';
const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
function headerZkey(buf) {          // zkey: "zkey", versión, nSecciones; sección 2 = cabecera groth16
  const dv = new DataView(buf.buffer, buf.byteOffset); let o = 12;
  for (let s = 0; s < dv.getUint32(8, true); s++) {
    const tipo = dv.getUint32(o, true); const largo = Number(dv.getBigUint64(o + 4, true)); o += 12;
    if (tipo === 2) { const n8q = dv.getUint32(o, true); let p = o + 4 + n8q; const n8r = dv.getUint32(p, true); p += 4 + n8r;
      return { nVars: dv.getUint32(p, true), nPublic: dv.getUint32(p + 4, true), domainSize: dv.getUint32(p + 8, true) }; }
    o += largo;
  }
}
export function armarTestigo(zkeyBuf, semilla = 1) {
  const { nVars } = headerZkey(zkeyBuf);
  const n8 = 32, out = Buffer.alloc(12 + 12 + 4 + n8 + 4 + 12 + nVars * n8);
  let o = 0; out.write('wtns', o); o += 4; out.writeUInt32LE(2, o); o += 4; out.writeUInt32LE(2, o); o += 4;
  out.writeUInt32LE(1, o); o += 4; out.writeBigUInt64LE(BigInt(4 + n8 + 4), o); o += 8;
  out.writeUInt32LE(n8, o); o += 4; let x = R; for (let i = 0; i < n8; i++) { out[o + i] = Number(x & 255n); x >>= 8n; } o += n8;
  out.writeUInt32LE(nVars, o); o += 4;
  out.writeUInt32LE(2, o); o += 4; out.writeBigUInt64LE(BigInt(nVars * n8), o); o += 8;
  let h = crypto.createHash('sha256').update(String(semilla)).digest();
  for (let i = 0; i < nVars; i++) {
    let v = i === 0 ? 1n : (h = crypto.createHash('sha256').update(h).digest(), BigInt('0x' + h.toString('hex')) % R);
    for (let j = 0; j < n8; j++) { out[o + j] = Number(v & 255n); v >>= 8n; } o += n8;
  }
  return out;
}
if (process.argv[1].endsWith('testigo-sintetico.mjs')) {
  for (const v of process.argv.slice(2)) {
    const z = fs.readFileSync(`art/${v}/zkey`); const hd = headerZkey(z);
    fs.writeFileSync(`art/${v}/sintetico.wtns`, armarTestigo(z));
    console.log(v, hd);
  }
}
