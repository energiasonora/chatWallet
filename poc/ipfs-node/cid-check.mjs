// POC: reproducir el CID del lado del cliente (browser) sin depender del nodo.
// Valida que el CID que va en la atestación del DID es content-addressing puro y
// coincide con lo que pinea Kubo (`ipfs add --cid-version=1` para archivos < 256KB,
// que usan un único bloque raw). Para archivos grandes hay que replicar el chunking
// UnixFS de Kubo (256KB, balanced) — ver README.
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { CID } from 'multiformats/cid';
import * as raw from 'multiformats/codecs/raw';
import { sha256 } from 'multiformats/hashes/sha2';

async function cidRaw(bytes) {
  const hash = await sha256.digest(bytes);
  return CID.createV1(raw.code, hash); // bafkrei... (mismo que `ipfs add --cid-version=1` para 1 bloque)
}

const file = process.argv[2] || '/tmp/doc-publico.txt';
const bytes = new Uint8Array(readFileSync(file));

// 1. CID público (bytes tal cual) — debe coincidir con Kubo.
const pub = await cidRaw(bytes);
console.log('PUBLICO  cid:', pub.toString());

// 2. Path privado: cifrar en el cliente (AES-256-GCM), pinear SOLO el ciphertext.
//    El nodo/gateway nunca ve el plaintext; la clave viaja por XMTP.
const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
const envelope = new Uint8Array(iv.length + ct.length);
envelope.set(iv); envelope.set(ct, iv.length);   // [iv(12) | ciphertext]
const priv = await cidRaw(envelope);
const rawKey = new Uint8Array(await webcrypto.subtle.exportKey('raw', key));
console.log('PRIVADO  cid:', priv.toString(), '(ciphertext', envelope.length, 'bytes)');
console.log('PRIVADO  key(hex→XMTP):', Buffer.from(rawKey).toString('hex'));

// exportar el envelope cifrado para pinearlo con ipfs y probar retrieval opaco
writeEnvelope(envelope);
function writeEnvelope(buf) {
  import('node:fs').then(fs => fs.writeFileSync('/tmp/doc-privado.enc', buf));
}
