// Reproduce el caso reportado: compartís tu QR y lo escanea alguien que NO tiene ChatWallet.
// A ese recién llegado se le crea la wallet sola… ¿y al dueño del QR le llega el saludo?
//
// Dos Chrome headless contra el sitio EN VIVO, sin mocks:
//   A = dueño del QR (wallet ya inicializada, como tu APK)
//   B = recién llegado (perfil limpio, sin wallet, entra por ?address=…&pk=…)
//
//   unset NODE_OPTIONS && node tests/saludo-invitado-nuevo-e2e.mjs
//   BASE=http://127.0.0.1:8830/dapp.html node tests/saludo-invitado-nuevo-e2e.mjs
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
                // La pista del bug se grita por consola y se pierde: hay que quedársela.
                if (m.method === 'Runtime.consoleAPICalled') {
                    const s = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
                    if (s) this.logs.push(s.slice(0, 160));
                }
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
            });
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async eval(expr, { awaitPromise = true } = {}) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
        return r.result?.result?.value;
    }
    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(3000); }
    async waitXmtp(timeoutMs = 180000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const v = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (v) return v;
            await sleep(2000);
        }
        return null;
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

// La verdad es lo que XMTP tiene, no el store local ni la UI.
const textosEnXmtp = `(async () => {
    try { await chatwalletxmtp.conversations.syncAll(); } catch (e) {}
    const cs = await chatwalletxmtp.conversations.list();
    const out = [];
    for (const c of cs) {
        try { for (const m of await c.messages())
            out.push(typeof m.content === 'string' ? m.content : (m.content && m.content.content) || ''); } catch (e) {}
    }
    return JSON.stringify(out.filter(Boolean));
})()`;

const A = new Dev('duenio', 9351);
const B = new Dev('invitado', 9352);

try {
    console.log('── A: el dueño del QR ──');
    await A.launch();
    await A.navigate(BASE.replace(/\/dapp.*/, '/dapp.html'));
    await A.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await A.navigate(BASE.replace(/\/dapp.*/, '/dapp.html'));
    const inboxA = await A.waitXmtp();
    ok(!!inboxA, 'A tiene identidad XMTP en producción');
    const addrA = await A.eval(`currentWallet.address`);
    const pkA = await A.eval(`(typeof myCompressedPubKey === 'function' ? myCompressedPubKey() : '') || ''`);
    console.log(`   A = ${addrA}`);

    // El QR de A codifica exactamente esta URL (ver renderAddressQr / PUBLIC_INVITE_BASE).
    const urlDelQr = pkA ? `${BASE}.html?address=${addrA}&pk=${pkA}` : `${BASE}.html?address=${addrA}`;

    console.log('\n── B: escanea el QR sin tener ChatWallet ──');
    await B.launch();
    await B.navigate(urlDelQr.replace('/dapp.html.html', '/dapp.html'));

    ok(await (async () => { for (let i = 0; i < 40; i++) { if (await B.eval(`!!currentWallet`)) return true; await sleep(1500); } return false; })(),
        'a B se le crea la wallet sola');
    const addrB = await B.eval(`currentWallet && currentWallet.address`);
    console.log(`   B = ${addrB}`);

    // Acá está la pregunta del reporte: ¿salió el saludo?
    const inboxB = await B.waitXmtp();
    ok(!!inboxB, 'B termina teniendo identidad XMTP');

    const seRindio = B.logs.some(l => /sendPairGreeting: la conversación no quedó lista/.test(l));
    const convLista = await B.eval(`!!currentConversation`);
    console.log(`   currentConversation en B: ${convLista} · warn de "no quedó lista": ${seRindio}`);

    console.log('\n── ¿le llegó el saludo a A? ──');
    let recibido = false;
    for (let i = 0; i < 24; i++) {
        const txt = await A.eval(textosEnXmtp);
        const arr = JSON.parse(txt || '[]');
        if (arr.some(m => /te escane|scanned|escaneó|invitación|invit/i.test(m))) { recibido = true; break; }
        if (arr.length) { console.log('   mensajes en A:', JSON.stringify(arr).slice(0, 160)); }
        await sleep(2500);
    }
    ok(recibido, 'A recibe el saludo automático de quien escaneó su QR');

    if (!recibido) {
        console.log('\n── consola de B (las últimas líneas que importan) ──');
        B.logs.filter(l => /saludo|greeting|conversac|createDm|XMTP|error/i.test(l)).slice(-12)
            .forEach(l => console.log('   ' + l));
    }
} finally {
    A.kill(); B.kill();
}

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
