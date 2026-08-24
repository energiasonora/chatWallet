// Verifica el respaldo incremental (manifiesto v2 + segmentos inmutables) contra un
// upload-server y un Kubo REALES. No reimplementa la lógica: extrae el texto de las
// funciones de src/dapp.html y lo ejecuta, para que lo probado sea el código que se
// deploya y no una copia que se desincroniza.
//
// Uso (Node 22, con Kubo y upload-server ya levantados — ver run-backup-segments.sh):
//   UPLOAD_PORT=3199 GATEWAY=http://127.0.0.1:8080/ipfs/ node tests/backup-segments.mjs
import { readFileSync } from 'node:fs';
import { Wallet, hexlify, getBytes } from 'ethers';

const PORT = process.env.UPLOAD_PORT || '3199';
const CHATBK_UPLOAD_URL = `http://127.0.0.1:${PORT}/api/ipfs/upload`;
const CHATBK_POINTER_URL = `http://127.0.0.1:${PORT}/api/backup/pointer`;
const CHATBK_GATEWAY = process.env.GATEWAY || 'http://127.0.0.1:8080/ipfs/';

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };

// ── Extraer del HTML el texto real de las funciones bajo prueba ────────────────
const html = readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');

function extractFn(name) {
    const start = html.indexOf(`async function ${name}(`);
    if (start === -1) throw new Error(`No encontré ${name}() en dapp.html`);
    // Recorrer llaves hasta cerrar la función.
    let i = html.indexOf('{', start), depth = 0;
    for (let j = i; j < html.length; j++) {
        if (html[j] === '{') depth++;
        else if (html[j] === '}') { depth--; if (depth === 0) return html.slice(start, j + 1); }
    }
    throw new Error(`No pude cerrar ${name}()`);
}

function extractBetween(startMark, endMark) {
    const a = html.indexOf(startMark);
    const b = html.indexOf(endMark, a);
    if (a === -1 || b === -1) throw new Error(`No encontré el bloque ${startMark.slice(0, 40)}…`);
    return html.slice(a, b);
}

const SRC_UPLOAD = extractFn('chatBackupUploadBlob');
const SRC_FETCH = extractFn('chatBackupFetchBlob');
const SRC_DOWNLOAD = extractFn('chatBackupDownload');
// El corazón del cambio: el bucle que sube sólo el delta + la compactación.
const SRC_SEGMENT = extractBetween(
    '// ── Subir SOLO lo que ningún segmento cubre todavía ──',
    '// Contactos: solo lo restaurable');

console.log(`  (extraídas ${[SRC_UPLOAD, SRC_FETCH, SRC_DOWNLOAD, SRC_SEGMENT].reduce((n, s) => n + s.split('\n').length, 0)} líneas reales de dapp.html)`);

// ── Entorno mínimo que esas funciones esperan ─────────────────────────────────
const bk = new Uint8Array(32).fill(7);            // clave de respaldo fija para el test
const ptrWallet = new Wallet(hexlify(new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode('semilla-test-pointer')))));
const currentWallet = { address: ptrWallet.address, privateKey: ptrWallet.privateKey };

const CHATBK_SEG_MAX = 500;
const CHATBK_SEG_COMPACT = 40;

async function chatBackupSecret() { return { raw: bk, wallet: ptrWallet }; }
async function chatBackupKey(usages) {
    return crypto.subtle.importKey('raw', bk, { name: 'AES-GCM' }, false, usages);
}

const scope = {
    fetch, crypto, TextEncoder, TextDecoder, JSON, Math, Promise, Array, Set, console, Uint8Array,
    ethers: { Wallet, hexlify, getBytes },
    CHATBK_UPLOAD_URL, CHATBK_GATEWAY, CHATBK_SEG_MAX, CHATBK_SEG_COMPACT,
    chatBackupSecret, chatBackupKey, currentWallet,
};

const build = new Function(...Object.keys(scope), `
    ${SRC_UPLOAD}
    ${SRC_FETCH}
    ${SRC_DOWNLOAD}
    // El bloque de segmentación depende de 'messages' y 'state' del scope de chatBackupNow:
    // se envuelve tal cual para poder ejercitarlo con distintos estados.
    async function runSegmentation(messages, state) {
        ${SRC_SEGMENT}
        return state;
    }
    return { chatBackupUploadBlob, chatBackupFetchBlob, chatBackupDownload, runSegmentation };
`);
const api = build(...Object.values(scope));

// ── Helpers del test ──────────────────────────────────────────────────────────
const mkMsgs = (n, offset = 0) => Array.from({ length: n }, (_, i) => ({
    id: `msg-${offset + i}`, peer: '0xpeer', ts: 1700000000000 + offset + i, body: `hola ${offset + i}`,
}));

const publishPointer = async (cid, ts, count) => {
    const signature = await ptrWallet.signMessage(`chatwallet-backup:${cid}:${ts}`);
    const r = await fetch(CHATBK_POINTER_URL, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: ptrWallet.address, cid, ts, count, signature }),
    });
    if (!r.ok) throw new Error(`pointer ${r.status}`);
};

const uploadManifest = (state, extra = {}) => api.chatBackupUploadBlob({
    v: 2, segments: state.segments, address: currentWallet.address.toLowerCase(),
    exportedAt: Date.now(), contacts: [], tombstones: {}, ...extra,
});

// ── Los casos ─────────────────────────────────────────────────────────────────
try {
    // 1. Primer respaldo: 300 mensajes → un segmento.
    let state = { segments: [], covered: new Set() };
    const m1 = mkMsgs(300);
    state = await api.runSegmentation(m1, state);
    ok(state.segments.length === 1, `primer respaldo: 1 segmento (${state.segments.length})`);
    ok(state.covered.size === 300, `cubre los 300 mensajes (${state.covered.size})`);

    const man1 = await uploadManifest(state);
    await publishPointer(man1.cid, 1000, 300);
    ok(man1.size < 400, `el manifiesto es chico: ${man1.size} bytes para 300 mensajes`);

    // 2. Segundo respaldo con 5 mensajes nuevos: sube SOLO el delta.
    const m2 = [...m1, ...mkMsgs(5, 300)];
    const before = state.segments.length;
    state = await api.runSegmentation(m2, state);
    ok(state.segments.length === before + 1, 'el delta agregó exactamente 1 segmento');
    ok(state.segments[before].count === 5, `el segmento nuevo lleva 5 mensajes (${state.segments[before].count})`);

    // 3. Un mensaje VIEJO que llega tarde (resync XMTP) entra sin re-segmentar todo.
    const tardio = { id: 'msg-tardio', peer: '0xpeer', ts: 1699999999000, body: 'llegué tarde' };
    const m3 = [tardio, ...m2];
    const before3 = state.segments.length;
    state = await api.runSegmentation(m3, state);
    ok(state.segments.length === before3 + 1, 'el mensaje tardío agregó 1 segmento, no re-subió el historial');
    ok(state.segments[before3].count === 1, 'ese segmento contiene sólo el mensaje tardío');

    // 4. Reconstrucción: el manifiesto v2 se baja y devuelve la forma v1 completa.
    const man3 = await uploadManifest(state, { profile: { alias: 'probador' } });
    await publishPointer(man3.cid, 2000, m3.length);
    const restored = await api.chatBackupDownload(man3.cid);
    ok(restored.messages.length === m3.length, `restore reconstruyó ${restored.messages.length}/${m3.length} mensajes`);
    const ids = new Set(restored.messages.map(m => m.id));
    ok(m3.every(m => ids.has(m.id)), 'no falta ningún id tras reensamblar los segmentos');
    ok(restored.profile?.alias === 'probador', 'el perfil viaja en el manifiesto');
    ok(Array.isArray(restored._segments) && restored._segments.length === state.segments.length,
        'el restore expone los segmentos para heredar el estado');

    // 5. Un dispositivo que hereda ese estado NO re-sube nada.
    const heredado = { segments: restored._segments, covered: new Set(restored._coveredIds) };
    const antes5 = heredado.segments.length;
    const after5 = await api.runSegmentation(m3, heredado);
    ok(after5.segments.length === antes5, 'el segundo dispositivo no re-subió mensajes ya cubiertos');

    // 6. Compactación: pasando el umbral, todo vuelve a un solo segmento.
    let many = { segments: [], covered: new Set() };
    let msgs = [];
    for (let i = 0; i <= CHATBK_SEG_COMPACT; i++) {
        msgs = [...msgs, ...mkMsgs(2, 10000 + i * 2)];
        many = await api.runSegmentation(msgs, many);
    }
    ok(many.segments.length === 1, `tras superar el umbral quedó 1 segmento (${many.segments.length})`);
    ok(many.covered.size === msgs.length, `la compactación cubre los ${msgs.length} mensajes`);
    const manC = await uploadManifest(many);
    const restC = await api.chatBackupDownload(manC.cid);
    ok(restC.messages.length === msgs.length, `el respaldo compactado restaura ${restC.messages.length}/${msgs.length}`);

    // 7. Compatibilidad hacia atrás: un snapshot v1 se sigue leyendo igual.
    const v1 = await api.chatBackupUploadBlob({
        v: 1, address: currentWallet.address.toLowerCase(), exportedAt: Date.now(),
        messages: mkMsgs(4, 900), contacts: [], tombstones: {},
    });
    const restV1 = await api.chatBackupDownload(v1.cid);
    ok(restV1.messages.length === 4 && !restV1._segments, 'un respaldo v1 viejo se restaura sin tocar nada');

    // 8. Un segmento ilegible no rompe el respaldo ni desaparece del manifiesto.
    const roto = { segments: [...many.segments, { cid: 'bafkreiinexistente0000000000000000000000000000000000000000', count: 1 }], covered: many.covered };
    const manR = await uploadManifest(roto);
    const restR = await api.chatBackupDownload(manR.cid);
    ok(restR.messages.length === msgs.length, 'los segmentos legibles se recuperan igual');
    ok(restR._failedSegments.length === 1, 'el segmento ilegible queda anotado, no silenciado');
    ok(restR._segments.length === roto.segments.length, 'sigue referenciado en el manifiesto (no se pierde)');
} catch (e) {
    console.error('💥', e);
    fails++;
}

console.log(fails ? `\n❌ ${fails} chequeos fallaron` : '\n✅ todos los chequeos pasaron');
process.exit(fails ? 1 : 0);
