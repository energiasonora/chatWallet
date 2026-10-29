// CW Connect v2.1 — implementación de referencia (ver SPEC.md, que es lo normativo).
//
// La usan las dos puntas:
//   · la billetera (ChatWallet) para leer pedidos, armar respuestas y reconocer apps;
//   · las apps, con conectarConChatWallet(), para no reescribir el protocolo cada una.
// Sin dependencias: el Client de XMTP (@xmtp/browser-sdk v5 o v6) y ethers v6 se reciben.

export const VERSION = 2;
export const CANAL_FIRMA = 1;
export const CANAL_PAGO = 2;

// §4.1 — tipo de contenido de XMTP.
// toString()/sameAs() como el ContentTypeId oficial: el SDK v5 guarda los codecs por
// contentType.toString(), y un objeto plano quedaba registrado como "[object Object]" (el mensaje
// llegaba con content undefined). No son enumerables: no cambian el JSON del tipo.
export const CW_TIPO = Object.freeze(Object.defineProperties(
    { authorityId: 'chatwallet.org', typeId: 'cw', versionMajor: 2, versionMinor: 0 },
    {
        toString: { value() { return `${this.authorityId}/${this.typeId}:${this.versionMajor}.${this.versionMinor}`; } },
        sameAs: { value(o) { return !!o && o.authorityId === this.authorityId && o.typeId === this.typeId && o.versionMajor === this.versionMajor; } },
    }));

// §4.3
export function fallbackDe(m) {
    if (!m || typeof m !== 'object') return 'ChatWallet: mensaje de protocolo';
    if (m.cw === CANAL_PAGO) return 'ChatWallet: resultado de un pago';
    if (m.type === 'connect') return 'ChatWallet: vinculación con una app';
    if (m.type === 'bye') return 'ChatWallet: fin de la sesión con una app';
    if (m.type === 'rpc') {
        return m.method === 'eth_sendTransaction'
            ? 'ChatWallet: pedido de transacción de una app'
            : 'ChatWallet: pedido de firma de una app';
    }
    return 'ChatWallet: respuesta a una app';
}

export class CwCodec {
    get contentType() { return CW_TIPO; }
    encode(m) {
        return {
            type: CW_TIPO,
            parameters: {},
            fallback: fallbackDe(m),
            content: new TextEncoder().encode(JSON.stringify(m)),
        };
    }
    decode(enc) { return JSON.parse(new TextDecoder().decode(enc.content)); }
    fallback(m) { return fallbackDe(m); }
    // Sólo un pedido merece despertar a alguien; respuestas y cierres no.
    shouldPush(m) { return !!m && m.type === 'rpc'; }
}

export function esTipoCw(ct) {
    return !!ct && ct.authorityId === CW_TIPO.authorityId && ct.typeId === CW_TIPO.typeId;
}

// ── §3 — el URI de vinculación ──────────────────────────────────────────────────
const RE_DIR = /^0x[0-9a-fA-F]{40}$/;
const RE_HOST = /^[a-z0-9.-]{1,253}$/;

function limpiarMeta(app, name, kind) {
    const a = typeof app === 'string' ? app.trim().toLowerCase() : '';
    const crudo = typeof name === 'string' ? name : '';
    const n = /[\u0000-\u001f\u007f]/.test(crudo) ? '' : crudo.trim();
    return {
        app: RE_HOST.test(a) ? a : '',
        // Ni recortar ni "arreglar": un nombre que no cumple se descarta entero (§3).
        name: n && [...n].length <= 40 ? n : '',
        kind: kind === 'session' ? 'session' : 'once',
    };
}

// §3.2 — texto a firmar al vincular (login en un paso). Se descarta entero si no cumple,
// igual que `name`: nada de recortar lo que la persona va a firmar.
export const MAX_LOGIN = 500;
export function limpiarLogin(texto) {
    if (typeof texto !== 'string' || !texto) return '';
    if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(texto)) return '';   // control, salvo \n
    return [...texto].length <= MAX_LOGIN ? texto : '';
}

export function armarUriVinculacion({ inbox, chainId = 0, app = '', name = '', kind = 'once', v = VERSION, login = '' }) {
    const q = new URLSearchParams();
    q.set('v', String(v));
    q.set('inbox', String(inbox).toLowerCase());
    q.set('chain', String(Number(chainId) || 0));
    const meta = limpiarMeta(app, name, kind);
    if (meta.app) q.set('app', meta.app);
    if (meta.name) q.set('name', meta.name);
    q.set('kind', meta.kind);
    const l = limpiarLogin(login);
    if (l) q.set('login', l);
    // URLSearchParams codifica los espacios como '+'; la spec pide encodeURIComponent.
    return 'chatwallet://wc?' + q.toString().replace(/\+/g, '%20');
}

// Acepta las tres formas (§3). → { inbox, chainId, v, app, name, kind } o null.
export function leerUriVinculacion(texto) {
    if (typeof texto !== 'string') return null;
    const txt = texto.trim();
    const corto = txt.match(/^CWW([12])\|(0x[0-9a-fA-F]{40})(?:\|(\d+))?$/);
    if (corto) {
        return { inbox: corto[2].toLowerCase(), chainId: Number(corto[3] || '0'), v: Number(corto[1]), app: '', name: '', kind: 'once' };
    }
    if (!/^chatwallet:\/\/wc/i.test(txt) && !/[?&]wc=1(&|$)/.test(txt)) return null;
    let q;
    try { q = new URLSearchParams(txt.split('?')[1] || ''); } catch (_) { return null; }
    const inbox = (q.get('inbox') || '').toLowerCase();
    if (!RE_DIR.test(inbox)) return null;
    const chainId = Number(q.get('chain') || '0');
    const v = Math.max(1, Math.floor(Number(q.get('v') || '1')) || 1);
    const login = limpiarLogin(q.get('login'));
    return {
        inbox, chainId: Number.isFinite(chainId) && chainId > 0 ? chainId : 0, v,
        ...limpiarMeta(q.get('app'), q.get('name'), q.get('kind')),
        ...(login ? { login } : {}),
    };
}

// Metadatos de una app declarados en un pedido de pago (§6).
export function leerMetaDePago(q) {
    const v = Math.max(1, Math.floor(Number(q.get('v') || '1')) || 1);
    return { v, ...limpiarMeta(q.get('app'), q.get('name'), 'once') };
}

// ── §4 — leer y mandar ──────────────────────────────────────────────────────────
// Un mensaje de XMTP → { m, version } si es de protocolo (canales 1 y 2), o null.
// version 2 = llegó con el tipo propio; 1 = JSON en un texto.
export function leerMensaje(message) {
    if (!message) return null;
    if (esTipoCw(message.contentType)) {
        let m = message.content;
        // Un cliente sin el codec (o que no lo encontró) deja content vacío pero trae los bytes.
        if ((m == null || typeof m !== 'object') && message.encodedContent && message.encodedContent.content) {
            try { m = JSON.parse(new TextDecoder().decode(Uint8Array.from(message.encodedContent.content))); } catch (_) { m = null; }
        }
        return m && typeof m === 'object' && (m.cw === CANAL_FIRMA || m.cw === CANAL_PAGO) ? { m, version: 2 } : null;
    }
    const c = message.content;
    if (typeof c !== 'string' || c[0] !== '{') return null;
    let m; try { m = JSON.parse(c); } catch (_) { return null; }
    return m && (m.cw === CANAL_FIRMA || m.cw === CANAL_PAGO) ? { m, version: 1 } : null;
}

const codec = new CwCodec();
// v6 manda EncodedContent armado; v5 codifica con los codecs del cliente (hay que registrarlo).
export async function enviar(conv, m, version) {
    if (version >= 2) {
        if (typeof conv.sendText === 'function') return conv.send(codec.encode(m));
        return conv.send(m, CW_TIPO);
    }
    const texto = JSON.stringify(m);
    return typeof conv.sendText === 'function' ? conv.sendText(texto) : conv.send(texto);
}

// ── Lado app ────────────────────────────────────────────────────────────────────
// v5 nombra el tipo de identificador con texto ('Ethereum'); v6, con el enum numérico (0).
// v6 se reconoce por Client.fetchInboxStates, que v5 no tiene.
const tipoEthereum = (Client) => (typeof Client.fetchInboxStates === 'function' ? 0 : 'Ethereum');

function firmanteXmtp(wallet, kind) {
    return {
        type: 'EOA',
        getIdentifier: async () => ({ identifier: wallet.address.toLowerCase(), identifierKind: kind }),
        signMessage: async (msg) => {
            const hex = (await wallet.signMessage(msg)).slice(2);
            return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
        },
    };
}

const uuid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);

/**
 * Abre una sesión con ChatWallet. Resuelve cuando la billetera se conectó.
 *
 * opts:
 *   Client, ethers           — @xmtp/browser-sdk y ethers v6 (alcanza con { Wallet, getAddress })
 *   app, name, kind, chainId — lo que la app declara (§3)
 *   login                    — texto a firmar en el mismo paso de vincular (§3.2); la firma vuelve
 *                              en `firmaLogin` (null si la billetera no lo soporta: firmar aparte)
 *   env                      — 'production' (por defecto) o 'dev'
 *   identidad                — { privateKey, dbKey } para reusar la de una sesión anterior (kind 'session')
 *   onUri(uri, identidad)    — para pintar el QR; `identidad` es lo que hay que guardar para reconectar
 *   onEstado(texto)          — pasos legibles
 *   esperaMs                 — cuánto esperar a que escaneen (300 s)
 *   appVersion               — lo que se le informa a XMTP
 *
 * → { address, chainId, version, pedir(method, params, ttl?), firmar(msg), mandarTx(tx), cerrar(), alCerrar(fn) }
 */
export async function conectarConChatWallet(opts) {
    const { Client, ethers } = opts;
    const onEstado = opts.onEstado || (() => {});
    const esperaMs = opts.esperaMs || 300000;
    const meta = limpiarMeta(opts.app, opts.name, opts.kind);

    onEstado('Abriendo sesión…');
    const wallet = opts.identidad?.privateKey ? new ethers.Wallet(opts.identidad.privateKey) : ethers.Wallet.createRandom();
    const dbKey = opts.identidad?.dbKey ? Uint8Array.from(opts.identidad.dbKey) : crypto.getRandomValues(new Uint8Array(32));
    const identidad = { privateKey: wallet.privateKey, dbKey: Array.from(dbKey) };
    const kindEth = tipoEthereum(Client);
    const cliente = await Client.create(firmanteXmtp(wallet, kindEth), {
        env: opts.env || 'production', dbEncryptionKey: dbKey,
        appVersion: opts.appVersion || 'CW-Connect/2', codecs: [new CwCodec()],
    });
    const login = limpiarLogin(opts.login || '');
    const uri = armarUriVinculacion({ inbox: wallet.address, chainId: opts.chainId || 0, ...meta, login });
    onEstado('Escaneá con ChatWallet');
    if (opts.onUri) opts.onUri(uri, identidad);

    await cliente.conversations.sync();
    const stream = await cliente.conversations.streamAllMessages();
    const pendientes = new Map();
    const alCerrarFns = [];
    let dm = null, version = 1, direccion = null, chainId = 0, cerrada = false, firmaLogin = null;
    let conectada, fallo;
    const conexion = new Promise((res, rej) => { conectada = res; fallo = rej; });

    const terminar = (motivo) => {
        if (cerrada) return;
        cerrada = true;
        for (const [, p] of pendientes) { clearTimeout(p.timer); p.reject(new Error(motivo)); }
        pendientes.clear();
        try { stream.return?.(); } catch (_) {}
        try { cliente.close?.(); } catch (_) {}
        for (const f of alCerrarFns) { try { f(motivo); } catch (_) {} }
    };

    (async () => {
        for await (const message of stream) {
            if (!message || message.senderInboxId === cliente.inboxId) continue;
            const leido = leerMensaje(message);
            if (!leido || leido.m.cw !== CANAL_FIRMA) continue;
            const m = leido.m;
            if (m.type === 'connect' && !dm) {
                // La sesión habla lo que habló el connect (§4.2).
                version = leido.version >= 2 && Number(m.v) >= 2 ? 2 : 1;
                direccion = ethers.getAddress(m.address);
                chainId = Number(m.chainId) || 0;
                // §5.1: la firma del login viene en el connect si la billetera lo soporta.
                if (login && typeof m.login === 'string' && /^0x[0-9a-fA-F]{130}$/.test(m.login)) firmaLogin = m.login;
                // Contestar por la misma conversación: es el DM con la identidad que firma.
                dm = await cliente.conversations.getConversationById(message.conversationId);
                if (!dm) {
                    const id = { identifier: direccion.toLowerCase(), identifierKind: kindEth };
                    const convs = cliente.conversations;
                    await convs.sync();
                    dm = await (convs.createDmWithIdentifier || convs.newDmWithIdentifier).call(convs, id);
                }
                onEstado('ChatWallet conectada');
                conectada();
            } else if (m.type === 'bye') {
                terminar('ChatWallet cerró la sesión');
                return;
            } else if ((m.type === 'result' || m.type === 'error') && pendientes.has(m.id)) {
                const p = pendientes.get(m.id);
                pendientes.delete(m.id); clearTimeout(p.timer);
                if (m.type === 'result') p.resolve(m.result);
                else { const e = new Error(m.error || 'rechazado en ChatWallet'); e.code = m.code; p.reject(e); }
            }
        }
        terminar('se cortó la conexión con XMTP');
    })().catch((e) => { fallo(e); terminar(String(e?.message || e)); });

    const corte = setTimeout(() => { if (!dm) { fallo(new Error('se acabó el tiempo: nadie escaneó el QR')); terminar('sin escanear'); } }, esperaMs);
    try { await conexion; } finally { clearTimeout(corte); }

    const pedir = (method, params, ttl = 180000) => new Promise((resolve, reject) => {
        if (cerrada) return reject(new Error('la sesión está cerrada'));
        const id = uuid();
        const timer = setTimeout(() => { pendientes.delete(id); reject(new Error(method + ': sin respuesta de ChatWallet')); }, ttl);
        pendientes.set(id, { resolve, reject, timer });
        enviar(dm, { cw: CANAL_FIRMA, type: 'rpc', id, method, params, ttl }, version)
            .catch((e) => { clearTimeout(timer); pendientes.delete(id); reject(e); });
    });

    return {
        address: direccion, chainId, version, identidad, firmaLogin,
        pedir,
        firmar: (msg) => pedir('personal_sign', [msg, direccion.toLowerCase()]),
        mandarTx: (tx) => pedir('eth_sendTransaction', [tx]),
        alCerrar: (fn) => { alCerrarFns.push(fn); },
        async cerrar() {
            if (cerrada) return;
            // bye no existe en v1 (§9).
            if (version >= 2) { try { await enviar(dm, { cw: CANAL_FIRMA, type: 'bye' }, 2); } catch (_) {} }
            terminar('sesión cerrada');
        },
    };
}
