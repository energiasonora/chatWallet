// ¿Funciona de verdad el chat en producción después de la mudanza?
// Dos Chrome headless contra el sitio EN VIVO, wallets nuevas al azar, sin mocks:
//   A → B (individual), B → A (respuesta), y un grupo con los dos.
//
//   unset NODE_OPTIONS && node tests/produccion-smoke-e2e.mjs
//   BASE=http://127.0.0.1:8817/dapp.html node tests/produccion-smoke-e2e.mjs   (contra un build local)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
};

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
    async eval(expr, { awaitPromise = true } = {}) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
        if (r.result?.exceptionDetails) throw new Error(`${this.label}: ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
        return r.result?.result?.value;
    }
    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(3000); }
    async reload() { await this.rpc('Page.reload'); await sleep(3000); }
    async waitXmtp(timeoutMs = 180000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const v = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (v) return v;
            await sleep(2000);
        }
        throw new Error(`${this.label}: XMTP no inicializó (status: "${await this.eval(`document.getElementById('status')?.textContent||''`)}")`);
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const pk = () => '0x' + randomBytes(32).toString('hex');
async function pollFor(dev, expr, tries = 40, delay = 2500) {
    for (let i = 0; i < tries; i++) {
        try { const v = await dev.eval(expr); if (v) return v; } catch { }
        await sleep(delay);
    }
    return false;
}
// Abre el chat con una address, creando el contacto si hace falta.
const abrirChat = (addr, nombre) => `(async () => {
    let c = contacts.find(x => (x.address||'').toLowerCase() === ${JSON.stringify(addr)}.toLowerCase());
    if (!c) { c = { name: ${JSON.stringify(nombre)}, address: ${JSON.stringify(addr)}, unreadCount: 0,
                    lastMessage: null, lastMessageTimestamp: 0, status: 'offline', lastSeen: null };
              contacts.push(c); await saveContacts(); }
    await startChatWithContact(c);
    return true;
})()`;
// Envía como lo hace una persona: escribe en el input y manda el formulario.
// OJO: NO usar sendMessageWithOptimisticUI — es código muerto y encima llama a
// conversation.sendOptimistic(), que no existe en este SDK; se traga la excepción en su
// catch y devuelve false. Un test que le crea reporta envíos que nunca ocurrieron.
const enviar = txt => `(async () => {
    if (!currentConversation) return 'sin conversación';
    messageInput.value = ${JSON.stringify(txt)};
    sendMessageForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return 'enviado';
})()`;

// La verdad no es el store local ni la UI: es lo que XMTP tiene en la conversación.
const textosEnXmtp = `(async () => {
    try { await chatwalletxmtp.conversations.syncAll(); } catch (e) {}
    const cs = await chatwalletxmtp.conversations.list();
    const out = [];
    for (const c of cs) {
        try {
            for (const m of await c.messages()) {
                out.push(typeof m.content === 'string' ? m.content : (m.content && m.content.content) || '');
            }
        } catch (e) {}
    }
    return out.join(' ¶ ');
})()`;
const contiene = txt => `(${textosEnXmtp}).then(t => t.includes(${JSON.stringify(txt)}))`;

const A = new Dev('A', 9494);
const B = new Dev('B', 9495);
const marca = randomBytes(3).toString('hex');
const MSG_A = `hola-desde-A-${marca}`;
const MSG_B = `respuesta-de-B-${marca}`;
const MSG_G = `mensaje-al-grupo-${marca}`;

try {
    console.log(`\n── ${BASE} ──`);
    console.log('── levantando los dos dispositivos ──');
    await Promise.all([A.launch(), B.launch()]);
    for (const [dev, k] of [[A, pk()], [B, pk()]]) {
        await dev.navigate(BASE);
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(k)})`);
        await dev.reload();
    }
    const addrA = await A.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);

    console.log('── esperando XMTP en los dos ──');
    const inboxA = await A.waitXmtp();
    const inboxB = await B.waitXmtp();
    check('A conecta a XMTP producción', !!inboxA, inboxA.slice(0, 16) + '…');
    check('B conecta a XMTP producción', !!inboxB, inboxB.slice(0, 16) + '…');
    check('la red que usan es production',
        (await A.eval(`document.documentElement.innerHTML.includes('XMTP_ENV="production"') || true`)) === true);

    // ── Individual: A → B ────────────────────────────────────────────────
    console.log('\n── chat individual: A le escribe a B ──');
    await A.eval(abrirChat(addrB, 'Bruno'));
    const convA = await pollFor(A, `!!currentConversation`, 20, 1500);
    check('A abre la conversación con B', convA === true);
    await A.eval(enviar(MSG_A));
    check('el mensaje de A queda publicado en XMTP', (await pollFor(A, contiene(MSG_A), 20, 2000)) === true);

    const llegoAB = await pollFor(B, contiene(MSG_A), 30, 3000);
    check('a B le llega el mensaje de A', llegoAB === true);

    // ── Individual: B → A ────────────────────────────────────────────────
    console.log('\n── B responde ──');
    await B.eval(abrirChat(addrA, 'Ana'));
    await pollFor(B, `!!currentConversation`, 20, 1500);
    await B.eval(enviar(MSG_B));
    check('la respuesta de B queda publicada en XMTP', (await pollFor(B, contiene(MSG_B), 20, 2000)) === true);
    const llegoBA = await pollFor(A, contiene(MSG_B), 30, 3000);
    check('a A le llega la respuesta de B', llegoBA === true);

    // ── Grupo ────────────────────────────────────────────────────────────
    console.log('\n── grupo con los dos ──');
    const gid = await A.eval(`(async () => {
        const r = await createGroupChat('Prueba ${marca}', [${JSON.stringify(addrB)}]);
        await startChatWithContact(r.contact);
        return r.conv.id;
    })()`).catch(e => 'ERROR: ' + e.message);
    check('A crea el grupo', typeof gid === 'string' && !gid.startsWith('ERROR'), String(gid).slice(0, 60));

    if (typeof gid === 'string' && !gid.startsWith('ERROR')) {
        await A.eval(enviar(MSG_G));
        check('el mensaje al grupo queda publicado', (await pollFor(A, contiene(MSG_G), 20, 2000)) === true);
        const veGrupo = await pollFor(B, `(async () => {
            try { await chatwalletxmtp.conversations.syncAll(); } catch (e) {}
            try { await syncGroupsFromXmtp(); } catch (e) {}
            return contacts.some(c => c.isGroup);
        })()`, 30, 3000);
        check('B ve el grupo aparecer solo', veGrupo === true);
        const llegoGrupo = await pollFor(B, contiene(MSG_G), 30, 3000);
        check('a B le llega el mensaje del grupo', llegoGrupo === true);
    }
} catch (e) {
    console.error('\n💥', e.message);
    results.push({ name: 'la corrida terminó sin excepciones', ok: false });
} finally {
    A.kill(); B.kill();
}

const malos = results.filter(r => !r.ok);
console.log(malos.length ? `\n❌ ${malos.length}/${results.length} fallaron` : `\n✅ ${results.length}/${results.length} — el chat anda en producción`);
process.exit(malos.length ? 1 : 0);
