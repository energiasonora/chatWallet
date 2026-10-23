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

// Abre la billetera (desde lo guardado, o la crea desde `nacimiento`) y la pone al día.
async function abrirAlDia({ privEvm, nodo, nacimiento, datos, alProgreso, regtest }) {
    // regtest (sólo pruebas): sin worker, porque al reabrir desde lo guardado el proxy del worker
    // no le pasa la marca regtest a wallet2 (monero-ts 0.11.20) y falla con bloques nuevos.
    // En el navegador el WASM sólo vive en el worker: en regtest se rehace desde cero cada vez.
    const enNode = typeof window === 'undefined';
    const base = { networkType: RED, password: contrasena(privEvm), server: { uri: nodo }, ...(regtest ? { regtest: true, ...(enNode ? { proxyToWorker: false } : {}) } : {}) };
    if (regtest && !enNode) datos = null;
    let w = null;
    if (datos && datos.keys && datos.keys.length) {
        try { w = await moneroTs.openWalletFull({ ...base, keysData: datos.keys, cacheData: datos.cache }); }
        catch (e) { console.warn('[monero] estado guardado ilegible, se rehace:', e?.message || e); w = null; }
    }
    if (!w) w = await moneroTs.createWalletFull({ ...base, privateSpendKey: llaveDeGasto(privEvm), restoreHeight: nacimiento });
    try {
        await w.sync(new class extends moneroTs.MoneroWalletListener {
            async onSyncProgress(h, inicio, fin, fraccion) {
                if (alProgreso) { try { alProgreso(fraccion, Math.max(0, fin - h)); } catch (e) { } }
            }
        });
    } catch (e) { await liberar(w); throw e; }
    return w;
}

async function foto(w) {
    const [keys, cache] = await w.getData();
    return {
        total: String(await w.getBalance()),
        desbloqueado: String(await w.getUnlockedBalance()),
        altura: await w.getHeight(),
        direccion: await w.getPrimaryAddress(),
        datos: { keys: aBytes(keys), cache: aBytes(cache) },
    };
}

/**
 * Pone la billetera al día contra `nodo`.
 *   datos: { keys, cache } guardados de la vez anterior (o null: se crea desde `nacimiento`).
 *   alProgreso(fraccion, faltan): durante la sincronización.
 * → { total, desbloqueado (strings en piconero), altura, direccion, datos: { keys, cache } }
 */
export async function sincronizar(opciones) {
    const w = await abrirAlDia(opciones);
    try { return await foto(w); } finally { await liberar(w); }
}

// Los errores de wallet2 vienen en inglés técnico: se les pone un código para traducirlos.
function conCodigo(e) {
    const m = String(e?.message || e);
    const err = new Error(m);
    err.codigo = /unlocked/i.test(m) ? 'bloqueado'
        : /not enough money|not enough outputs|balance/i.test(m) ? 'sin_fondos'
        : /invalid.*address|address.*invalid|Invalid destination/i.test(m) ? 'direccion'
        : /dust|amount.*(zero|0)|too small/i.test(m) ? 'monto'
        : 'otro';
    return err;
}

/**
 * Prepara un envío SIN mandarlo: abre la billetera, la pone al día y arma (y firma) la
 * transacción. Devuelve lo que hay que mostrar para confirmar y dos funciones:
 *   confirmar() → la manda al nodo y devuelve { hashes, claves, ...foto }
 *   cancelar()  → la descarta.
 * La billetera queda abierta mientras se decide (5 minutos como mucho).
 *   monto: piconero (string) — o todo: true para mandar todo lo desbloqueado.
 */
export async function prepararEnvio({ destino, monto, todo, ...opciones }) {
    if (!esDireccion(destino) && !opciones.regtest) { const e = new Error('dirección inválida'); e.codigo = 'direccion'; throw e; }
    const w = await abrirAlDia(opciones);
    let txs;
    try {
        txs = todo
            ? await w.sweepUnlocked({ accountIndex: 0, address: destino, relay: false })
            : [await w.createTx({ accountIndex: 0, address: destino, amount: BigInt(monto), relay: false })];
    } catch (e) { await liberar(w); throw conCodigo(e); }
    const suma = (f) => txs.reduce((n, tx) => n + BigInt(f(tx) || 0), 0n);
    let abierta = true;
    const cerrar = async () => { if (!abierta) return; abierta = false; clearTimeout(reloj); await liberar(w); };
    const reloj = setTimeout(cerrar, 5 * 60 * 1000);
    return {
        comision: String(suma(tx => tx.getFee())),
        monto: String(suma(tx => tx.getOutgoingAmount())),
        transacciones: txs.length,
        async confirmar() {
            if (!abierta) { const e = new Error('se venció: prepará el envío de nuevo'); e.codigo = 'vencido'; throw e; }
            try {
                const hashes = await w.relayTxs(txs);
                const claves = [];
                for (const h of hashes) { try { claves.push(await w.getTxKey(h)); } catch (e) { claves.push(null); } }
                return { hashes, claves, ...(await foto(w)) };
            } catch (e) { throw conCodigo(e); }
            finally { await cerrar(); }
        },
        cancelar: cerrar,
    };
}

/**
 * Subdirección (cuenta 0, índice `indice`) — una por contacto: quien te paga ve una dirección
 * que no se puede unir con las que les diste a otros. Sin red. wallet2 detecta los pagos a las
 * primeras 200 sin hacer nada (su "lookahead"); igual se pueden pasar como `subdirecciones`.
 */
export async function subdireccion(privEvm, indice) {
    let w;
    try {
        w = await moneroTs.createWalletFull({ networkType: RED, password: contrasena(privEvm), privateSpendKey: llaveDeGasto(privEvm) });
        return await w.getAddress(0, indice);
    } finally { await liberar(w); }
}

/**
 * Verifica un pago que alguien dice haberte hecho: que `direccion` sea TUYA (principal o una
 * subdirección) y, con la clave de la transacción, cuánto llegó a esa dirección y con cuántas
 * confirmaciones. → { mia, bueno, recibido (piconero), confirmaciones, enPool }
 * Sin "mia" alguien podría mostrarte un pago real hecho a otra persona.
 */
export async function verificarPago({ privEvm, nodo, hash, clave, direccion, regtest }) {
    let w;
    try {
        const enNode = typeof window === 'undefined';
        w = await moneroTs.createWalletFull({ networkType: RED, password: contrasena(privEvm), privateSpendKey: llaveDeGasto(privEvm),
            server: { uri: nodo }, ...(regtest ? { regtest: true, ...(enNode ? { proxyToWorker: false } : {}) } : {}) });
        let mia = false;
        try { await w.getAddressIndex(direccion); mia = true; } catch (e) { }
        if (!mia) return { mia: false, bueno: false, recibido: '0', confirmaciones: 0, enPool: false };
        const c = await w.checkTxKey(hash, clave, direccion);
        return { mia: true, bueno: !!c.getIsGood(), recibido: String(c.getReceivedAmount() || 0n), confirmaciones: c.getNumConfirmations() || 0, enPool: !!c.getInTxPool() };
    } finally { await liberar(w); }
}

/** "1,5" / "1.5" → piconero (string). null si no es un monto válido. */
export function aAtomicas(texto) {
    const t = String(texto || '').trim().replace(',', '.');
    if (!/^\d+(\.\d{0,12})?$/.test(t)) return null;
    const [ent, frac = ''] = t.split('.');
    const n = BigInt(ent) * ATOMICAS + BigInt((frac + '000000000000').slice(0, 12));
    return n > 0n ? String(n) : null;
}

/** "monero:4…?tx_amount=1.5" o una dirección suelta → { direccion, monto (texto) } | null */
export function leerUri(texto) {
    const t = String(texto || '').trim();
    const m = /^monero:([1-9A-HJ-NP-Za-km-z]+)(\?.*)?$/i.exec(t);
    const dir = m ? m[1] : t;
    if (!esDireccion(dir)) return null;
    const q = new URLSearchParams((m && m[2]) || '');
    return { direccion: dir, monto: q.get('tx_amount') || '' };
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
