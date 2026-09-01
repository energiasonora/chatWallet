// Tras aparear por QR/enlace, el chat tiene que abrir con UN solo renglón, que cada lado lee
// en su idioma y desde su punto de vista. Dos Chrome headless contra XMTP real, sin mocks.
//
//   unset NODE_OPTIONS && node tests/handshake-un-solo-renglon-e2e.mjs
//   BASE=http://127.0.0.1:8831/dapp node tests/handshake-un-solo-renglon-e2e.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp';
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
    // Abre el chat con `addr` y devuelve los renglones dibujados.
    async renglones(addr) {
        await this.eval(`(async () => {
            let c = contacts.find(x => (x.address||'').toLowerCase() === ${JSON.stringify(addr)}.toLowerCase());
            if (!c) { c = { name: 'peer', address: ${JSON.stringify(addr)}, unreadCount: 0, status: 'offline' };
                      contacts.push(c); await saveContacts(); }
            await startChatWithContact(c);
            return true;
        })()`);
        for (let i = 0; i < 40; i++) {
            await sleep(1500);
            const n = await this.eval(`document.querySelectorAll('#messagesContainer > *').length`);
            if (n) break;
        }
        return await this.eval(`[...document.querySelectorAll('#messagesContainer > *')]
            .map(e => ({ clase: e.className, txt: (e.innerText||'').replace(/\\s+/g,' ').trim() }))
            .filter(x => x.txt)`) || [];
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const A = new Dev('duenio', 9371);
const B = new Dev('invitado', 9372);

try {
    // A = dueño del QR, en español. B = el que escanea, en INGLÉS a propósito: así se ve si el
    // idioma del renglón lo pone quien mira o quien lo mandó.
    console.log('── A (dueño del QR, español) ──');
    await A.launch();
    await A.navigate(BASE + '.html');
    await A.eval(`localStorage.setItem('chatwallet-lang','es');
                  localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await A.navigate(BASE + '.html');
    ok(!!(await A.waitXmtp()), 'A tiene identidad XMTP');
    const addrA = await A.eval(`currentWallet.address`);
    const pkA = await A.eval(`(typeof myCompressedPubKey === 'function' ? myCompressedPubKey() : '') || ''`);

    console.log('\n── B (escanea el QR, inglés) ──');
    await B.launch();
    await B.navigate(BASE + '.html');
    await B.eval(`localStorage.setItem('chatwallet-lang','en')`);
    await B.navigate(`${BASE}.html?address=${addrA}` + (pkA ? `&pk=${pkA}` : ''));
    for (let i = 0; i < 40 && !(await B.eval(`!!currentWallet`)); i++) await sleep(1500);
    const addrB = await B.eval(`currentWallet && currentWallet.address`);
    ok(!!addrB, 'a B se le creó la wallet');
    ok(!!(await B.waitXmtp()), 'B tiene identidad XMTP');

    console.log('\n── el chat de A, que es quien recibió el saludo ──');
    await sleep(25000);
    const filasA = await A.renglones(addrB);
    filasA.forEach(f => console.log(`   [${f.clase}] ${f.txt.slice(0, 90)}`));

    ok(filasA.length === 1, `un solo renglón, no dos (${filasA.length})`);
    ok(filasA.every(f => /handshake/.test(f.clase)), 'y es la línea del handshake, no una burbuja');
    const txtA = filasA.map(f => f.txt).join(' ');
    ok(!/id: [0-9a-f]{6}/i.test(txtA), 'sin inbox ids a la vista');
    ok(!/👋/.test(txtA), 'el saludo de texto no se dibuja');
    ok(/Escaneó tu QR|Entró por tu enlace/.test(txtA),
        'dice que fue el OTRO quien lo inició, en español (idioma de A)');

    console.log('\n── el mismo evento, visto por B ──');
    const filasB = await B.renglones(addrA);
    filasB.forEach(f => console.log(`   [${f.clase}] ${f.txt.slice(0, 90)}`));
    const txtB = filasB.map(f => f.txt).join(' ');
    ok(filasB.length === 1, `también un solo renglón (${filasB.length})`);
    ok(/You scanned their QR|You came in through their invitation link/.test(txtB),
        'desde SU punto de vista y en inglés — el renglón lo dibuja quien mira, no quien lo mandó');

    console.log('\n── y el saludo igual viajó (es lo que dispara la notificación) ──');
    const enXmtp = await A.eval(`(async () => {
        const out = [];
        for (const c of await chatwalletxmtp.conversations.list())
            for (const m of await c.messages())
                if (typeof m.content === 'string') out.push(m.content);
        return JSON.stringify(out);
    })()`);
    ok(/👋/.test(enXmtp || ''), 'el mensaje sigue existiendo en XMTP, sólo que no se dibuja');
} finally { A.kill(); B.kill(); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
