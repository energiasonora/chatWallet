// Cliente de prueba: simula el browser (dapp) contra el endpoint autenticado.
//   1. wallet efímera (en la app = wallet/DID del usuario)
//   2. sha256 de los bytes (size-agnóstico, sin chunking IPFS)
//   3. firma "ipfs-upload:<sha256>:<size>"
//   4. POST bytes con headers de auth
//   5. verifica respuesta y baja por gateway (IPFS ya garantiza bytes==CID)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ethers } from 'ethers';

const UPLOAD = process.env.UPLOAD_URL || 'http://127.0.0.1:3100/api/ipfs/upload';
const file = process.argv[2] || '/tmp/doc-publico.txt';

const bytes = new Uint8Array(readFileSync(file));
const wallet = ethers.Wallet.createRandom();

const sha = createHash('sha256').update(bytes).digest('hex');
const message = `ipfs-upload:${sha}:${bytes.length}`;
const signature = await wallet.signMessage(message);

console.log('address :', wallet.address);
console.log('sha256  :', sha, `(${bytes.length} bytes)`);

const res = await fetch(UPLOAD, {
  method: 'POST',
  headers: {
    'content-type': 'application/octet-stream',
    'x-address': wallet.address,
    'x-signature': signature,
    'x-sha256': sha,
    'x-size': String(bytes.length),
  },
  body: bytes,
});
const json = await res.json();
console.log('respuesta:', res.status, json.cid ? `cid=${json.cid} pinned=${json.pinned}` : json);

// Verificación de tercero: bajar por gateway y confirmar que los bytes coinciden (sha256).
if (json.gateway) {
  const g = await fetch(json.gateway);
  const back = new Uint8Array(await g.arrayBuffer());
  const shaBack = createHash('sha256').update(back).digest('hex');
  console.log('gateway  :', g.status, `${back.length} bytes`, shaBack === sha ? '✓ sha256 coincide' : '✗ NO coincide');
}

// Prueba negativa: firma inválida (otra wallet firma el mismo sha) → 401.
const attacker = ethers.Wallet.createRandom();
const badSig = await attacker.signMessage(message);
const bad = await fetch(UPLOAD, {
  method: 'POST',
  headers: {
    'content-type': 'application/octet-stream',
    'x-address': wallet.address, 'x-signature': badSig,
    'x-sha256': sha, 'x-size': String(bytes.length),
  },
  body: bytes,
});
console.log('firma inválida:', bad.status, (await bad.json()).error);
