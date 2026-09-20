// Las dos puntas de un chat tienen que terminar viendo lo mismo.
//
// XMTP entrega una vez: si a un dispositivo le borran la base (el navegador lo hace cuando
// falta disco), lo que llegó mientras no estaba queda ilegible PARA SIEMPRE y el hilo queda
// con agujeros en silencio. El que sí lo tiene es el que lo escribió. cw:4 compara las dos
// puntas con una huella por día y completa lo que falte.
//
// Este test lo prueba de verdad: A le escribe a B, se le BORRA la base a B (IndexedDB + OPFS,
// como hace el navegador), B vuelve con una instalación nueva… y los mensajes reaparecen.
// El respaldo soberano se bloquea a propósito, para que la recuperación sólo pueda venir del
// otro dispositivo.
//
//   BASE=http://localhost:8846/dapp.html node tests/sincronia-hilos.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// ── 1. Reglas del protocolo, leídas del código ────────────────────────────────
const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');
ok(/__cw\.cw === 4[\s\S]{0,260}syncAtenderLote\(message, __cw\) : syncAtenderResumen/.test(src),
    'cw:4 se intercepta en el stream, antes de la UI');
ok(/sender: message\.senderInboxId,\s*\/\/ el autor es quien reenvía/.test(src),
    'lo reenviado se atribuye SIEMPRE a quien lo reenvía (nadie inyecta historia ajena)');
ok(/if \(esMensajeDeSincronia\(messageContent\)\) return;/.test(src), 'no se dibuja como burbuja');
ok(/if \(esMensajeDeSincronia\(content\)\) return null;/.test(src), 'no entra al store ni al respaldo');
ok(/if \(esMensajeDeSincronia\(content\)\) continue;/.test(src), 'no cuenta como no leído');
ok(/const SYNC_MAX_LOTE = 200;/.test(src) && /slice\(0, SYNC_MAX_LOTE\)/.test(src), 'hay tope por lote');
ok(/if \(Date\.now\(\) - \(syncUltimoLote\.get\(clave\) \|\| 0\) < SYNC_LOTE_MIN_MS\) return;/.test(src),
    'no se contestan lotes en ráfaga');
ok(/if \(!\(contacts \|\| \[\]\)\.some\(c => \(c\.address \|\| ''\)\.toLowerCase\(\) === clave\)\) return;/.test(src),
    'sólo con contactos tuyos');
ok(/ya\.has\('received\|' \+ ts\)/.test(src), 'dedupe por marca de tiempo (no duplica burbujas)');
ok((src.match(/"sync_recuperados":/g) || []).length === 3, 'el aviso está en los tres idiomas');

// ── 2. El circuito completo, con dos identidades reales ──────────────────────
class Dev {
    constructor(label, port) { this.label = label; this.port = port; this.id = 0; this.pending = new Map(); this.logs = []; }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + `/cw-${this.label}-`);
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
            '--no-default-browser-check', `--remote-debugging-port=${this.port}`,
            `--user-data-dir=${this.dir}`, '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                const page = list.find(t => t.type === 'page');
                if (page) { await this.connect(page.webSocketDebuggerUrl); return; }
            } catch { }
        }
        throw new Error(`${this.label}: Chrome no levantó`);
    }
    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => { await this.rpc('Page.enable'); await this.rpc('Runtime.enable'); resolve(); };
            this.ws.onerror = reject;
            this.ws.addEventListener('message', e => {
                const m = JSON.parse(e.data);
                if (m.method === 'Runtime.consoleAPICalled') {
                    const s = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
                    if (s) this.logs.push(s.slice(0, 200));
                }
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
            });
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result?.exceptionDetails) return '__ERR__ ' + String(r.result.exceptionDetails.exception?.description || '').slice(0, 120);
        return r.result?.result?.value;
    }
    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(3000); }
    async waitXmtp(ms = 180000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            const v = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (v && typeof v === 'string') return v;
            await sleep(2000);
        }
        return null;
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const enviar = (txt) => `(async () => {
    messageInput.value = ${JSON.stringify(txt)};
    sendMessageForm.dispatchEvent(new Event('submit', { cancelable: true }));
    await new Promise(r => setTimeout(r, 3500));
    return 'ok';
})()`;
const burbujas = `JSON.stringify([...document.querySelectorAll('#messagesContainer .message-bubble')].map(e => (e.innerText||'').replace(/\\s+/g,' ').trim().slice(0,60)))`;
const enElStore = (peer) => `(async () => (await msgStoreGetByPeer(${JSON.stringify(peer)})).map(r => r.dir + '|' + new Date(r.ts).toISOString().slice(0,16) + '|' + String(r.content).slice(0,40)))()`;

const A = new Dev('escribe', 9431);
const B = new Dev('borrada', 9432);
const MARCA = randomBytes(3).toString('hex');
const MSGS = [`uno-${MARCA}`, `dos-${MARCA}`, `tres-${MARCA}`];

try {
    await A.launch(); await A.navigate(BASE);
    await A.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await A.navigate(BASE);
    ok(!!await A.waitXmtp(), 'A arranca');
    const addrA = await A.eval(`currentWallet.address`);

    await B.launch(); await B.navigate(BASE);
    await B.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await B.navigate(BASE);
    ok(!!await B.waitXmtp(), 'B arranca');
    const addrB = await B.eval(`currentWallet.address`);

    // A le escribe a B.
    await A.navigate(`${BASE}?address=${addrB}`);
    for (let i = 0; i < 40; i++) { if (await A.eval(`!!currentConversation`)) break; await sleep(1500); }
    ok(await A.eval(`!!currentConversation`), 'A abre el chat con B');
    for (const m of MSGS) await A.eval(enviar(m));

    // B los recibe y abre el chat (así quedan en su store).
    let llegaron = false;
    for (let i = 0; i < 24; i++) {
        const st = await B.eval(`(async () => { const c = (contacts||[]).find(c => c.address.toLowerCase() === ${JSON.stringify(addrA.toLowerCase())}); if (c) await startChatWithContact(c); return document.body.innerText.includes(${JSON.stringify(MSGS[2])}); })()`);
        if (st === true) { llegaron = true; break; }
        await sleep(3000);
    }
    ok(llegaron, 'B recibe los tres mensajes');
    await sleep(4000);

    // ── el navegador le borra la base a B (deja localStorage, como pasa de verdad) ──
    const origen = new URL(BASE).origin;
    await B.rpc('Storage.clearDataForOrigin', { origin: origen, storageTypes: 'indexeddb,file_systems,cache_storage,websql' });
    // Y se bloquea el respaldo soberano: lo que vuelva tiene que venir del OTRO dispositivo.
    await B.rpc('Network.enable');
    await B.rpc('Network.setBlockedURLs', { urls: ['*backup.chatwallet.org*', '*gateway.chatwallet.org*'] });
    const instAntes = await B.eval(`String(chatwalletxmtp.installationId||'')`);

    await B.navigate(BASE);
    await B.rpc('Network.enable');
    await B.rpc('Network.setBlockedURLs', { urls: ['*backup.chatwallet.org*', '*gateway.chatwallet.org*'] });
    ok(!!await B.waitXmtp(), 'B vuelve a arrancar tras el borrado');
    const instDespues = await B.eval(`String(chatwalletxmtp.installationId||'')`);
    ok(instAntes && instDespues && instAntes !== instDespues, 'B estrena instalación (la base se perdió de verdad)');
    const storeVacio = await B.eval(enElStore(addrA.toLowerCase()));
    ok(Array.isArray(storeVacio) && storeVacio.length === 0, 'y su historial de ese chat quedó vacío',
        JSON.stringify(storeVacio || []).slice(0, 120));

    // ── la reconciliación hace su trabajo ──
    let recuperados = [];
    for (let i = 0; i < 30; i++) {
        recuperados = await B.eval(enElStore(addrA.toLowerCase()));
        if (Array.isArray(recuperados) && recuperados.length >= MSGS.length) break;
        await sleep(3000);
    }
    const textos = JSON.stringify(recuperados || []);
    ok(MSGS.every(m => textos.includes(m)), 'los tres mensajes vuelven al historial de B', textos.slice(0, 200));
    ok((recuperados || []).every(r => String(r).startsWith('received|')), 'vuelven como recibidos, no como propios');
    const hoy = new Date().toISOString().slice(0, 10);
    ok((recuperados || []).every(r => String(r).includes(hoy)), 'con su fecha original');
    ok(B.logs.some(l => /\[sync\] recuperé/.test(l)), 'B lo deja anotado en la consola',
        (B.logs.filter(l => /\[sync\]/.test(l))[0] || '').slice(0, 90));
    ok(A.logs.some(l => /\[sync\] le reenvié/.test(l)), 'A fue quien los reenvió',
        (A.logs.filter(l => /\[sync\]/.test(l))[0] || '').slice(0, 90));

    // ── y se ven en el hilo, en su lugar ──
    await B.eval(`(async () => { const c = (contacts||[]).find(c => c.address.toLowerCase() === ${JSON.stringify(addrA.toLowerCase())}); if (c) await startChatWithContact(c); await new Promise(r => setTimeout(r, 6000)); return 'ok'; })()`);
    const vistas = await B.eval(burbujas);
    ok(typeof vistas === 'string' && MSGS.every(m => vistas.includes(m)), 'y se ven en el chat de B', String(vistas).slice(0, 200));
    const repetidos = (String(vistas).match(new RegExp(MSGS[0], 'g')) || []).length;
    ok(repetidos === 1, 'sin duplicados', `apariciones de ${MSGS[0]}: ${repetidos}`);
    ok(!/"cw":4|cw.:4/.test(String(vistas)), 'y ningún mensaje de plomería a la vista');

    // El resumen no se manda en ráfaga: al reabrir el chat no hay un segundo intercambio.
    const antes = A.logs.filter(l => /le reenvié/.test(l)).length;
    await B.eval(`(async () => { const c = (contacts||[]).find(c => c.address.toLowerCase() === ${JSON.stringify(addrA.toLowerCase())}); if (c) await startChatWithContact(c); await new Promise(r => setTimeout(r, 5000)); return 'ok'; })()`);
    await sleep(5000);
    ok(A.logs.filter(l => /le reenvié/.test(l)).length === antes, 'reabrir el chat no vuelve a mover historial');
} finally { A.kill(); B.kill(); }

console.log(`\n${fails === 0 ? '✅ las dos puntas quedan sincronizadas' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
