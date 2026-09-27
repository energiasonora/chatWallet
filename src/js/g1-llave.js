// Llave Ğ1 derivada de la MISMA frase semilla que la wallet EVM.
//
// Tiene que dar la misma cuenta que ve el usuario en Ğecko o Cesium²; si no, sería una
// cuenta fantasma. Los dos clientes hacen lo mismo (leído en su código, 27/9/2026):
//   - la frase se lleva a su entropía (la frase en francés o español que muestran es solo
//     la cara: por dentro usan la inglesa de la misma entropía),
//   - mini-secreto Substrate: PBKDF2-SHA512(entropía, "mnemonic", 2048)[0..32],
//   - par ed25519 desde ese secreto; cuenta principal = raíz, y además derivaciones
//     duras //0 … //29 (las que escanean al importar).
// Vectores de prueba en tests/g1-llave.mjs, sacados con @polkadot/keyring.
//
// Sin polkadot: solo @noble (ya viene con ethers) para que se pueda cargar a demanda
// cuando se activa la red Ğ1, sin engordar la app de quien no la usa.
import { ed25519 } from '@noble/curves/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { pbkdf2 } from '@noble/hashes/pbkdf2';
import { sha512 } from '@noble/hashes/sha512';
import { Mnemonic, wordlists } from 'ethers';

export const PREFIJO_G1 = 4450;
// Las listas con las que ChatWallet crea frases (en/es/fr) y las que ofrecen los clientes Ğ1.
const LISTAS = ['en', 'es', 'fr', 'it', 'pt'];

const utf8 = (s) => new TextEncoder().encode(s);
const concatenar = (...partes) => {
    const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let i = 0;
    for (const p of partes) { out.set(p, i); i += p.length; }
    return out;
};

// Entropía de la frase, en la lista que sea. null si no es una frase BIP39 válida.
export function entropiaDeFrase(frase) {
    const limpia = String(frase || '').trim().toLowerCase().replace(/\s+/g, ' ');
    for (const l of LISTAS) {
        try { return Mnemonic.fromPhrase(limpia, undefined, wordlists[l]).entropy; } catch (e) { /* otra lista */ }
    }
    return null;
}

function bytesDeHex(hex) {
    const h = hex.replace(/^0x/, '');
    return Uint8Array.from(h.match(/../g).map((b) => parseInt(b, 16)));
}

// SCALE compact de un largo chico (< 64): un byte, largo << 2.
const conLargo = (bytes) => concatenar(Uint8Array.of(bytes.length << 2), bytes);
const HDKD = conLargo(utf8('Ed25519HDKD'));

// Código de cadena de una juntura, igual que DeriveJunction de polkadot: número → u256 LE;
// texto → SCALE (largo + utf8), y si pasa de 32 bytes, blake2b-256.
function codigoDeJuntura(j) {
    let c;
    if (/^\d+$/.test(j)) {
        let n = BigInt(j);
        c = new Uint8Array(32);
        for (let i = 0; i < 32; i++) { c[i] = Number(n & 0xffn); n >>= 8n; }
        return c;
    }
    c = conLargo(utf8(j));
    if (c.length > 32) return blake2b(c, { dkLen: 32 });
    const out = new Uint8Array(32);
    out.set(c);
    return out;
}

// Semilla ed25519 de 32 bytes para `frase` + `ruta` ('' = raíz, '//0', '//1'…).
// Solo junturas duras: ed25519 no admite blandas.
export function semillaG1(frase, ruta = '') {
    const entropia = entropiaDeFrase(frase);
    if (!entropia) throw new Error('frase');
    let semilla = pbkdf2(sha512, bytesDeHex(entropia), utf8('mnemonic'), { c: 2048, dkLen: 64 }).slice(0, 32);
    const partes = String(ruta).split('//').slice(1);
    if (String(ruta) && (!String(ruta).startsWith('//') || partes.some((p) => !p || p.includes('/')))) {
        throw new Error('ruta');
    }
    for (const p of partes) semilla = blake2b(concatenar(HDKD, semilla, codigoDeJuntura(p)), { dkLen: 32 });
    return semilla;
}

// SS58: prefijo (2 bytes para ids ≥ 64) ‖ llave ‖ blake2b-512("SS58PRE"‖…)[0..2], en base58.
const ALFABETO = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    let s = '';
    while (n > 0n) { s = ALFABETO[Number(n % 58n)] + s; n /= 58n; }
    for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
    return s;
}
export function direccionG1(publica, prefijo = PREFIJO_G1) {
    const pre = prefijo < 64
        ? Uint8Array.of(prefijo)
        : Uint8Array.of(((prefijo & 0xfc) >> 2) | 0x40, (prefijo >> 8) | ((prefijo & 3) << 6));
    const cuerpo = concatenar(pre, publica);
    const suma = blake2b(concatenar(utf8('SS58PRE'), cuerpo), { dkLen: 64 }).slice(0, 2);
    return base58(concatenar(cuerpo, suma));
}

// La cuenta Ğ1 de una frase: { ruta, semilla, publica, direccion }.
export function cuentaG1(frase, ruta = '') {
    const semilla = semillaG1(frase, ruta);
    const publica = ed25519.getPublicKey(semilla);
    return { ruta, semilla, publica, direccion: direccionG1(publica) };
}

// Las mismas candidatas que escanean Ğecko y Cesium² al importar: raíz y //0 … //(n-1).
export function candidatasG1(frase, n = 30) {
    const rutas = ['', ...Array.from({ length: n }, (_, i) => '//' + i)];
    return rutas.map((r) => cuentaG1(frase, r));
}

export function firmarG1(cuenta, mensaje) {
    return ed25519.sign(mensaje, cuenta.semilla);
}
