// Entradas VÁLIDAS para el circuito `transact` del pool EVM de Tacit (anon.wei), armadas a mano según
// circuito/transact.circom y circuito/btc_pool_templates.circom (z0r0z/tacit, dapp/circuits/evm-pool):
//   npk  = Poseidon(Ak.x, Ak.y, NK.x, NK.y)      Ak = clave EdDSA de la nota, NK = nk·Base8
//   leaf = Poseidon(asset, v, npk, rho)
//   nf   = Poseidon(nk, leaf, index)
//   firma EdDSA-Poseidon bajo Ak de M = Poseidon(asset, nf0, nf1, outLeaf0, outLeaf1, publicAmount, extDataHash)
//   árbol Poseidon(2) de profundidad 32, hoja vacía 0; las salidas se insertan en startIndex, startIndex+1.
// Caso: transferencia privada (publicAmount = 0) con DOS notas de entrada reales (índices 0 y 1) y dos salidas
// (pago + vuelto), que es el peor caso y el que cuesta lo mismo que cualquier otro (circuito fijo).
// Escribe ../railgun/art/TACIT_2x2/input.json, para que el banco del S9 (bench.html) lo tome como otra variante.
import { buildPoseidon, buildEddsa, buildBabyjub } from '../railgun/node_modules/circomlibjs/main.js';
import crypto from 'crypto';
import { ethers } from '../../../../node_modules/ethers/lib.esm/index.js';
import fs from 'fs';

const poseidon = await buildPoseidon(), eddsa = await buildEddsa(), bjj = await buildBabyjub();
const F = poseidon.F;
const P = (xs) => F.toObject(poseidon(xs.map(x => BigInt(x))));
const p = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const l = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;   // orden del subgrupo de BJJ
const rnd = (mod) => BigInt('0x' + crypto.randomBytes(32).toString('hex')) % mod;

const DEPTH = 32;
// ASSET_FIELD del pool de ETH nativo (leído de la cadena si hay red; si no, cualquier elemento sirve igual para la prueba).
let asset = 0n;
try {
  const data = ethers.id('ASSET_FIELD()').slice(0, 10);
  const r = await (await fetch('https://base-rpc.publicnode.com', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0x000000c2A20657CE25f2Ba99737933D031AFBEE9', data }, 'latest'] }) })).json();
  if (r.result && r.result !== '0x') asset = BigInt(r.result);
} catch {}
if (!asset) asset = rnd(p);

// Hashes de subárbol vacío: z[0] = 0, z[k+1] = Poseidon(z[k], z[k]).
const z = [0n]; for (let k = 0; k < DEPTH; k++) z.push(P([z[k], z[k]]));
const EMPTY_PAIR = 14744269619966411208579211824598458697587494354926760081771325075741142829156n;
if (z[1] !== EMPTY_PAIR) throw new Error('Poseidon(0,0) no coincide con EMPTY_PAIR del circuito');

// MerkleRoot del circuito: bit LSB-first; bit 0 → H(actual, hermano), bit 1 → H(hermano, actual).
const raiz = (hoja, indice, camino) => camino.reduce((cur, sib, i) => ((BigInt(indice) >> BigInt(i)) & 1n) ? P([sib, cur]) : P([cur, sib]), hoja);

// Dos notas de entrada, en las hojas 0 y 1.
const valores = [700000000000000000n, 300000000000000000n];   // 0,7 + 0,3 ETH (en wei; < 2^120)
const notas = valores.map((v, i) => {
  const prv = crypto.randomBytes(32);
  const A = eddsa.prv2pub(prv);                                  // Ak = clave pública EdDSA
  const nk = rnd(l);
  const NK = bjj.mulPointEscalar(bjj.Base8, nk);
  const Ak = [F.toObject(A[0]), F.toObject(A[1])];
  const npk = P([Ak[0], Ak[1], F.toObject(NK[0]), F.toObject(NK[1])]);
  const rho = rnd(p);
  const leaf = P([asset, v, npk, rho]);
  return { prv, Ak, nk, npk, rho, leaf, v, index: i };
});
const pathDe = (i) => [notas[1 - i].leaf, ...z.slice(1, DEPTH)];   // hermano en el nivel 0 = la otra hoja; arriba, vacío
const root = raiz(notas[0].leaf, 0, pathDe(0));
if (raiz(notas[1].leaf, 1, pathDe(1)) !== root) throw new Error('las dos hojas no dan la misma raíz');
const nf = notas.map(n => P([n.nk, n.leaf, n.index]));

// Salidas: pago 0,85 + vuelto 0,15. Transferencia privada: publicAmount = 0.
const outV = [850000000000000000n, 150000000000000000n];
const outNpk = [rnd(p), rnd(p)], outRho = [rnd(p), rnd(p)];
const outLeaf = outV.map((v, k) => P([asset, v, outNpk[k], outRho[k]]));
const publicAmount = 0n;
const extDataHash = rnd(p);

// Inserción en startIndex = 2 (par s = 1 del nivel de pares). Camino del par: hermano = H(hoja0, hoja1), arriba vacío.
const startIndex = 2n, s = 1n;
const insPath = [P([notas[0].leaf, notas[1].leaf]), ...z.slice(2, DEPTH)];
const oldRoot = raiz(EMPTY_PAIR, s, insPath);
if (oldRoot !== root) throw new Error('oldRoot ≠ root: el árbol de pares no reproduce el de hojas');
const newRoot = raiz(P([outLeaf[0], outLeaf[1]]), s, insPath);

// Firma de cada entrada sobre M.
const M = P([asset, nf[0], nf[1], outLeaf[0], outLeaf[1], publicAmount, extDataHash]);
const firmas = notas.map(n => eddsa.signPoseidon(n.prv, F.e(M)));
notas.forEach((n, i) => { if (!eddsa.verifyPoseidon(F.e(M), firmas[i], eddsa.prv2pub(n.prv))) throw new Error('firma inválida'); });

const S = (x) => x.toString();
const input = {
  root: S(root), oldRoot: S(oldRoot), newRoot: S(newRoot), startIndex: S(startIndex), publicAmount: S(publicAmount),
  extDataHash: S(extDataHash), asset: S(asset), nf: nf.map(S), outLeaf: outLeaf.map(S),
  inV: notas.map(n => S(n.v)), inRho: notas.map(n => S(n.rho)), inNk: notas.map(n => S(n.nk)),
  inAk: notas.map(n => n.Ak.map(S)), inIndex: notas.map(n => S(n.index)), inPath: [pathDe(0).map(S), pathDe(1).map(S)],
  sigR8: firmas.map(f => [S(F.toObject(f.R8[0])), S(F.toObject(f.R8[1]))]), sigS: firmas.map(f => S(f.S)),
  outV: outV.map(S), outNpk: outNpk.map(S), outRho: outRho.map(S), insPath: insPath.map(S),
};
const dir = new URL('../railgun/art/TACIT_2x2/', import.meta.url);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(new URL('input.json', dir), JSON.stringify(input));
console.log('asset', S(asset).slice(0, 20) + '…', '· root', S(root).slice(0, 16) + '…', '→ art/TACIT_2x2/input.json');
