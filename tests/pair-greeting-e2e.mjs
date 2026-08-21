// E2E del saludo automático al estrenar un par (escaneo de QR / enlace de invitación).
// Dos Chrome headless con perfiles separados: A escanea a B y B tiene que enterarse SOLO,
// sin que nadie escriba nada. Corre contra XMTP dev real — no hay mocks.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf .parcel-cache-ui   ← con caché Parcel reordena los <script> y Tone queda tarde
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/pair-greeting-e2e.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, extra = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
}

class Dev {
    constructor(label, port) { this.label = label; this.port = port; this.id = 0; this.pending = new Map(); }

    async launch() {
        const dir = fs.mkdtempSync(os.tmpdir() + `/cw-${this.label}-`);
        this.dir = dir;
        this.proc = spawn(CHROME, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${dir}`,
            '--ignore-certificate-errors', '--window-size=900,1400', 'about:blank',
        ], { stdio: 'ignore' });
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
            this.ws.onopen = async () => {
                await this.rpc('Page.enable'); await this.rpc('Runtime.enable');
                this.ws.addEventListener('message', e => {
                    const m = JSON.parse(e.data);
                    if (m.method === 'Runtime.consoleAPICalled' && process.env.VERBOSE) {
                        console.log(`  [${this.label}]`, m.params.args.map(a => a.value ?? a.description).join(' '));
                    }
                });
                resolve();
            };
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

    async eval(expr, { awaitPromise = true } = {}) {
        const r = await this.rpc('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise, allowUnsafeEvalBlackholeing: false,
        });
        if (r.result?.exceptionDetails) throw new Error(`${this.label}: ${r.result.exceptionDetails.text} ${r.result.exceptionDetails.exception?.description || ''}`);
        if (r.result?.result?.subtype === 'error') throw new Error(`${this.label}: ${r.result.result.description}`);
        return r.result?.result?.value;
    }

    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(2500); }
    async reload() { await this.rpc('Page.reload'); await sleep(2500); }

    async waitXmtp(timeoutMs = 120000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const st = await this.eval(`(() => {
                if (!window.chatwalletxmtp) return null;
                try { return window.chatwalletxmtp.inboxId; } catch (e) { return null; }
            })()`);
            if (st) return st;
            await sleep(2000);
        }
        const status = await this.eval(`document.getElementById('status')?.textContent || ''`);
        throw new Error(`${this.label}: XMTP no inicializó en ${timeoutMs}ms (status: "${status}")`);
    }

    kill() { try { this.proc.kill(); } catch { } }
}

const pk = () => '0x' + randomBytes(32).toString('hex');

// Reintenta una expresión hasta que devuelva algo truthy (XMTP tarda en propagar).
async function pollFor(dev, expr, tries = 25, delay = 2000) {
    for (let i = 0; i < tries; i++) {
        try { const v = await dev.eval(expr); if (v) return v; } catch (e) { }
        await sleep(delay);
    }
    return false;
}

const A = new Dev('A', 9454);
const B = new Dev('B', 9455);

try {
    console.log('\n── Levantando los dos dispositivos ──');
    await Promise.all([A.launch(), B.launch()]);

    for (const [dev, k] of [[A, pk()], [B, pk()]]) {
        await dev.navigate(BASE);
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(k)})`);
        await dev.reload();
    }

    const addrA = await A.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    console.log(`   A = ${addrA}\n   B = ${addrB}`);

    console.log('\n── Esperando XMTP en los dos ──');
    await A.waitXmtp();
    await B.waitXmtp();

    // A se llama "energiasonora": el saludo tiene que ir firmado con el alias, no con la address.
    await A.eval(`(() => { localStorage.setItem('chatwallet-user-profile', JSON.stringify(
        { alias: 'energiasonora', links: '', avatar: '' })); updateUserProfile(); })()`);

    // ── Paso 1: A escanea el QR de B ─────────────────────────────────────
    console.log('\n── Paso 1: A escanea el QR de invitación de B ──');
    const inviteB = await B.eval(`(() => {
        const el = document.getElementById('receiveAddress');
        return 'https://chatwallet.org/dapp?address=' + currentWallet.address + '&pk=' + myCompressedPubKey();
    })()`);
    await A.eval(`window.handleScannedData(${JSON.stringify(inviteB)})`);

    const contactInA = await pollFor(A, `(() => {
        const c = contacts.find(c => c.address.toLowerCase() === ${JSON.stringify(addrB.toLowerCase())});
        return c ? (c.lastMessage || 'SIN-MENSAJE') : null;
    })()`, 30, 2000);
    check('A da de alta el contacto y deja el saludo como último mensaje',
        typeof contactInA === 'string' && contactInA.includes('inició este contacto'), String(contactInA));

    // ── Paso 2: B se entera SOLO, sin que nadie escriba ──────────────────
    console.log('\n── Paso 2: B recibe el aviso sin que nadie escriba ──');
    const msgInB = await pollFor(B, `(() => {
        const c = contacts.find(c => c.address.toLowerCase() === ${JSON.stringify(addrA.toLowerCase())});
        return c ? (c.lastMessage || null) : null;
    })()`, 40, 2000);
    check('a B le llega el aviso de contacto iniciado', typeof msgInB === 'string' && msgInB.includes('inició este contacto'), String(msgInB));
    check('el aviso lleva el alias de A, no su address', typeof msgInB === 'string' && msgInB.includes('energiasonora'), String(msgInB));

    const unreadB = await A.eval(`1`) && await B.eval(`(() => {
        const c = contacts.find(c => c.address.toLowerCase() === ${JSON.stringify(addrA.toLowerCase())});
        return c ? (c.unreadCount || 0) : -1;
    })()`);
    check('B lo cuenta como no leído (badge + notificación)', unreadB >= 1, `unread=${unreadB}`);

    // ── Paso 3: reencontrarse NO vuelve a saludar ────────────────────────
    console.log('\n── Paso 3: volver a escanear el mismo QR no saluda de nuevo ──');
    const beforeCount = await B.eval(`(async () => (await msgStoreGetAll()).filter(m =>
        (m.content || '').includes('inició este contacto')).length)()`).catch(() => null);
    await A.eval(`window.handleScannedData(${JSON.stringify(inviteB)})`);
    await sleep(12000);
    const afterCount = await B.eval(`(async () => (await msgStoreGetAll()).filter(m =>
        (m.content || '').includes('inició este contacto')).length)()`).catch(() => null);
    if (beforeCount === null || afterCount === null) {
        check('el segundo escaneo no manda un segundo saludo (por store)', false, 'no se pudo leer el store');
    } else {
        check('el segundo escaneo no manda un segundo saludo', afterCount === beforeCount, `${beforeCount} → ${afterCount}`);
    }

} catch (e) {
    console.error('\n💥', e);
    results.push({ name: 'el test terminó sin explotar', ok: false });
} finally {
    A.kill(); B.kill();
    const ok = results.filter(r => r.ok).length;
    console.log(`\n──────────\n${ok}/${results.length} checks en verde`);
    process.exit(ok === results.length ? 0 : 1);
}
