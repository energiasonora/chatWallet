// Billetera Monero de ChatWallet (autocustodia).
//
// La llave de gasto sale de la llave EVM que la app ya guarda: quien restaura su ChatWallet con
// la frase recupera también su Monero. Para no depender de ChatWallet, la cuenta se puede
// exportar como las 25 palabras estándar de Monero (Feather, Cake, Monerujo…).
//
// Todo corre en el dispositivo: la billetera completa de Monero (WASM) baja los bloques de un
// nodo y los revisa con la llave de lectura, que nunca sale del teléfono. Cada operación abre
// la billetera, hace lo suyo, guarda su estado y CIERRA el worker: el WASM no devuelve la
// memoria (medido en el S10+: la pestaña llegaba a ~640 MB), así que el worker no queda vivo.
//
// Se empaqueta con ./build.sh a src/static/monero/ y queda en window.cwMonero.

import moneroTs from 'monero-ts';
import { keccak_256 } from '@noble/hashes/sha3';

const RED = moneroTs.MoneroNetworkType.MAINNET;
export const ATOMICAS = 1000000000000n;                 // 1 XMR = 10^12 piconero
const L = 2n ** 252n + 27742317777372353535851937790883648493n;   // orden del grupo ed25519

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const deHex = (h) => Uint8Array.from(String(h).replace(/^0x/, '').match(/../g).map((x) => parseInt(x, 16)));
const unir = (...partes) => {
    const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
    let i = 0; for (const p of partes) { out.set(p, i); i += p.length; }
    return out;
};
const texto = (s) => new TextEncoder().encode(s);

// sc_reduce32: un hash de 32 bytes (little endian) llevado a un escalar válido de ed25519.
function reducir(bytes) {
    let n = 0n;
    for (let i = 31; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
    n %= L;
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) { out[i] = Number(n & 255n); n >>= 8n; }
    return out;
}

/** Llave privada de gasto de Monero que corresponde a una llave EVM. Determinística. */
export function llaveDeGasto(privEvm) {
    return hex(reducir(keccak_256(unir(texto('chatwallet:monero:gasto:v1'), deHex(privEvm)))));
}
// Contraseña con la que la billetera cifra su estado guardado en el dispositivo.
function contrasena(privEvm) {
    return hex(keccak_256(unir(texto('chatwallet:monero:estado:v1'), deHex(privEvm))));
}

/** baseUrl = carpeta donde están cw-monero.js y monero.worker.js. */
export function configurar(baseUrl) {
    moneroTs.LibraryUtils.setWorkerDistPath(new URL('monero.worker.js', baseUrl).href);
}

/** Altura actual de la cadena según el nodo. */
export async function altura(nodo) {
    const d = await moneroTs.connectToDaemonRpc({ uri: nodo });
    return d.getHeight();
}

async function liberar(w) {
    try { if (w) await w.close(); } catch (e) { }
    try { await moneroTs.LibraryUtils.terminateWorker(); } catch (e) { }
}

const aBytes = (d) => d instanceof Uint8Array ? d.slice()
    : d && d.buffer ? new Uint8Array(d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength))
    : new Uint8Array(d || []);

/** Dirección principal y las 25 palabras. Sin red. */
export async function cuenta(privEvm) {
    let w;
    try {
        w = await moneroTs.createWalletFull({ networkType: RED, password: contrasena(privEvm), privateSpendKey: llaveDeGasto(privEvm) });
        return { direccion: await w.getPrimaryAddress(), palabras: await w.getSeed() };
    } finally { await liberar(w); }
}

/**
 * Pone la billetera al día contra `nodo`.
 *   datos: { keys, cache } guardados de la vez anterior (o null: se crea desde `nacimiento`).
 *   alProgreso(fraccion, faltan): durante la sincronización.
 * → { total, desbloqueado (strings en piconero), altura, direccion, datos: { keys, cache } }
 */
export async function sincronizar({ privEvm, nodo, nacimiento, datos, alProgreso }) {
    let w;
    try {
        const base = { networkType: RED, password: contrasena(privEvm), server: { uri: nodo } };
        if (datos && datos.keys && datos.keys.length) {
            try { w = await moneroTs.openWalletFull({ ...base, keysData: datos.keys, cacheData: datos.cache }); }
            catch (e) { console.warn('[monero] estado guardado ilegible, se rehace:', e?.message || e); w = null; }
        }
        if (!w) w = await moneroTs.createWalletFull({ ...base, privateSpendKey: llaveDeGasto(privEvm), restoreHeight: nacimiento });
        await w.sync(new class extends moneroTs.MoneroWalletListener {
            async onSyncProgress(h, inicio, fin, fraccion) {
                if (alProgreso) { try { alProgreso(fraccion, Math.max(0, fin - h)); } catch (e) { } }
            }
        });
        const [keys, cache] = await w.getData();
        return {
            total: String(await w.getBalance()),
            desbloqueado: String(await w.getUnlockedBalance()),
            altura: await w.getHeight(),
            direccion: await w.getPrimaryAddress(),
            datos: { keys: aBytes(keys), cache: aBytes(cache) },
        };
    } finally { await liberar(w); }
}

/** piconero (string/bigint) → "1,234567" con hasta `dec` decimales, sin ceros de más. */
export function formato(atomicas, lang = 'es', dec = 6) {
    const n = BigInt(atomicas || 0);
    const entero = n / ATOMICAS;
    let frac = (n % ATOMICAS).toString().padStart(12, '0').slice(0, dec).replace(/0+$/, '');
    const sep = (1.1).toLocaleString(lang).charAt(1);
    const ent = Number(entero).toLocaleString(lang, { useGrouping: 'always' });
    return frac ? `${ent}${sep}${frac}` : ent;
}

/** ¿Es una dirección de Monero mainnet válida? (estándar, subdirección o integrada) */
export function esDireccion(s) {
    return /^[48][1-9A-HJ-NP-Za-km-z]{94}$/.test(s || '') || /^4[1-9A-HJ-NP-Za-km-z]{105}$/.test(s || '');
}
