// Las cuatro quejas del chat, contra XMTP real con dos navegadores:
//   · responder tiene que llegar COMO respuesta (con la cita), no como mensaje suelto
//   · copiar y reenviar tienen que existir en el picker
//   · los emojis de la barrita tienen que ser editables
// El bug de la respuesta era que se mandaba el contenido ya codificado en vez del objeto
// más su content type: el receptor no veía typeId 'reply' y dibujaba una burbuja pelada.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8840/dapp';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

class Dev {
    constructor(label, port) { this.label = label; this.port = port; this.id = 0; this.pending = new Map(); }
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
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error(`[${this.label}] ` + (ex.exception?.description || ex.text).slice(0, 300));
        return r.result?.result?.value;
    }
    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(3000); }
    async waitXmtp(ms = 180000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            const v = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (v) return v;
            await sleep(2000);
        }
        return null;
    }
    async abrirChat(addr) {
        await this.eval(`(async () => {
            let c = contacts.find(x => (x.address||'').toLowerCase() === ${JSON.stringify(addr)}.toLowerCase());
            if (!c) { c = { name: 'peer', address: ${JSON.stringify(addr)}, unreadCount: 0, status: 'offline' };
                      contacts.push(c); await saveContacts(); }
            await startChatWithContact(c);
            return true;
        })()`);
        for (let i = 0; i < 40; i++) { await sleep(1500); if (await this.eval(`!!currentConversation`)) break; }
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const A = new Dev('ana', 9381);
const B = new Dev('beto', 9382);

try {
    console.log('── dos identidades ──');
    for (const d of [A, B]) {
        await d.launch();
        await d.navigate(BASE + '.html');
        await d.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
        await d.navigate(BASE + '.html');
        ok(!!(await d.waitXmtp()), `${d.label} tiene identidad XMTP`);
    }
    const addrA = await A.eval(`currentWallet.address`);
    const addrB = await B.eval(`currentWallet.address`);
    await A.abrirChat(addrB);
    await B.abrirChat(addrA);

    console.log('\n── el picker tiene lo que faltaba ──');
    const picker = await A.eval(`(() => {
        // Se construye sin depender del long-press, que no se puede simular fiable por CDP.
        const p = ensureReactionPicker();
        const botones = [...p.querySelectorAll('button')];
        return { total: botones.length,
                 titulos: botones.map(b => b.title).filter(Boolean),
                 emojis: botones.filter(b => /\\p{Emoji}/u.test(b.textContent) && !b.title).map(b => b.textContent) };
    })()`);
    ok(picker.titulos.some(x => /Copiar|Copy/i.test(x)), 'hay botón de copiar', JSON.stringify(picker.titulos));
    ok(picker.titulos.some(x => /Reenviar|Forward/i.test(x)), 'hay botón de reenviar');
    ok(picker.titulos.some(x => /emojis/i.test(x)), 'hay botón para editar los emojis');

    console.log('\n── los emojis de la barrita se pueden cambiar ──');
    const emo = await A.eval(`(() => {
        const antes = emojisRapidos();
        guardarEmojisRapidos(['🔥','🚀','🧉']);
        const despues = emojisRapidos();
        const enPicker = [...ensureReactionPicker().querySelectorAll('button')].map(b => b.textContent);
        guardarEmojisRapidos([]);                       // volver al defecto
        return { antes, despues, enPicker, vuelta: emojisRapidos() };
    })()`);
    ok(emo.despues.join('') === '🔥🚀🧉', 'se guardan los elegidos', emo.despues.join(''));
    ok(emo.enPicker.includes('🧉'), 'y el picker se reconstruye con ellos');
    ok(emo.vuelta.length === 6, 'vaciarlo restaura los de fábrica, no deja el picker mudo', emo.vuelta.join(''));

    console.log('\n── responder: el bug ──');
    await A.eval(`(async () => { await currentConversation.sendText('mensaje original de ana'); })()`);
    await sleep(20000);
    const idEnB = await B.eval(`(async () => {
        for (let i = 0; i < 30; i++) {
            const m = [...msgTextById.entries()].find(([, v]) => v.text === 'mensaje original de ana');
            if (m) return m[0];
            await new Promise(r => setTimeout(r, 1500));
        }
        return null;
    })()`);
    ok(!!idEnB, 'beto recibió el mensaje original');

    // Beto responde usando el mismo camino que la UI.
    await B.eval(`(async () => {
        const enc = new window.ReplyCodec().encode(
            { reference: ${JSON.stringify(idEnB)}, content: 'esto es una respuesta', contentType: window.ContentTypeText },
            { codecFor: () => new window.TextCodec() });
        await currentConversation.send(enc);
    })()`);
    await sleep(22000);

    // Lo que importa: ¿le llega a Ana COMO respuesta?
    const enAna = await A.eval(`(async () => {
        for (let i = 0; i < 30; i++) {
            // Sin sync(): el worker WASM puede no volver nunca y colgar el test entero.
            // messages() pega en la base local, que el stream ya viene llenando.
            const ms = await currentConversation.messages({ limit: 50n });
            const r = ms.find(m => m.contentType?.typeId === 'reply');
            if (r) return { tipo: r.contentType.typeId, ref: r.content?.reference || r.content?.referenceId || null,
                            texto: typeof r.content?.content === 'string' ? r.content.content : null };
            await new Promise(res => setTimeout(res, 1500));
        }
        const ms = await currentConversation.messages({ limit: 50n });
        return { tipos: ms.map(m => m.contentType?.typeId) };
    })()`);
    ok(enAna.tipo === 'reply', 'llega con content type "reply", no como texto suelto', JSON.stringify(enAna));
    ok(enAna.ref === idEnB, 'y apunta al mensaje original');
    ok(enAna.texto === 'esto es una respuesta', 'con el texto correcto adentro');

    // Y la cita se dibuja en pantalla.
    const cita = await A.eval(`(async () => {
        for (let i = 0; i < 20; i++) {
            const q = document.querySelector('#messagesContainer .reply-quote');
            if (q) return (q.innerText || '').replace(/\\s+/g, ' ').trim();
            await new Promise(r => setTimeout(r, 1500));
        }
        return null;
    })()`);
    ok(!!cita, 'y en pantalla se dibuja la cita del original', String(cita).slice(0, 60));
} finally { A.kill(); B.kill(); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
