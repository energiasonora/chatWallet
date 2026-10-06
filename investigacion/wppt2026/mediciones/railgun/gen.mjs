// Genera entradas VÁLIDAS para el JoinSplit de Railgun (nIn x nOut), siguiendo joinsplit.circom.
import { buildPoseidon, buildEddsa } from 'circomlibjs';
import fs from 'fs';
const poseidon = await buildPoseidon(); const eddsa = await buildEddsa(); const F = poseidon.F;
const H = (...xs) => F.toObject(poseidon(xs.map(BigInt)));
const DEPTH = 16;
const [nIn, nOut] = process.argv[2].split('x').map(Number);
const priv = Buffer.alloc(32, 7);
const pub = eddsa.prv2pub(priv); const Ax = F.toObject(pub[0]), Ay = F.toObject(pub[1]);
const nullifyingKey = 123456789n;
const mpk = H(Ax, Ay, nullifyingKey);
const token = BigInt('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'); // USDC en Base
const valueIn = Array.from({ length: nIn }, (_, i) => BigInt(1_000_000 * (i + 1)));
const randomIn = Array.from({ length: nIn }, (_, i) => BigInt(1000 + i));
const leaves = valueIn.map((v, i) => H(H(mpk, randomIn[i]), token, v));
const leavesIndices = leaves.map((_, i) => BigInt(i));
// árbol de profundidad 16 con ceros = 0 (el circuito no impone el valor cero)
let level = leaves.slice(); const levels = [level];
for (let d = 0; d < DEPTH; d++) {
  const next = []; for (let i = 0; i < Math.max(1, Math.ceil(level.length / 2)); i++) next.push(H(level[2*i] ?? 0n, level[2*i+1] ?? 0n));
  levels.push(next); level = next;
}
const merkleRoot = level[0];
const pathElements = leaves.map((_, idx) => { let k = idx; return Array.from({ length: DEPTH }, (_, d) => { const s = levels[d][k ^ 1] ?? 0n; k >>= 1; return s; }); });
const nullifiers = leavesIndices.map(i => H(nullifyingKey, i));
const total = valueIn.reduce((a, b) => a + b, 0n);
const valueOut = Array.from({ length: nOut }, (_, i) => i < nOut - 1 ? total / BigInt(nOut) : total - (total / BigInt(nOut)) * BigInt(nOut - 1));
const npkOut = valueOut.map((_, i) => H(BigInt(9000 + i), 1n));
const commitmentsOut = valueOut.map((v, i) => H(npkOut[i], token, v));
const boundParamsHash = 42n;
const msg = H(merkleRoot, boundParamsHash, ...nullifiers, ...commitmentsOut);
const sig = eddsa.signPoseidon(priv, F.e(msg));
const input = { merkleRoot, boundParamsHash, nullifiers, commitmentsOut, token, publicKey: [Ax, Ay],
  signature: [F.toObject(sig.R8[0]), F.toObject(sig.R8[1]), sig.S], randomIn, valueIn, pathElements,
  leavesIndices, nullifyingKey, npkOut, valueOut };
fs.writeFileSync(`art/${process.argv[2]}/input.json`, JSON.stringify(input, (k, v) => typeof v === 'bigint' ? v.toString() : v));
console.log('ok', process.argv[2]);
