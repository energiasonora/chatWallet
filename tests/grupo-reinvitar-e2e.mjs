// E2E: salir de un grupo y que te vuelvan a invitar. Antes la marca de salida (lápida `left`)
// ocultaba el grupo PARA SIEMPRE: el admin te reagregaba y el grupo nunca reaparecía.
// Dos Chrome headless, XMTP real: A (admin) crea el grupo con B, B sale, A reagrega a B,
// y B tiene que volver a ver el grupo y sus mensajes nuevos.
//
//   unset NODE_OPTIONS && node tests/grupo-reinvitar-e2e.mjs    (BASE=… para otro build)
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

const A = new Dev('A', 9496);
const B = new Dev('B', 9497);
const GRUPO_EN_B = (gid) => `contacts.some(c => c.groupId === ${JSON.stringify(gid)})`;

try {
    await Promise.all([A.launch(), B.launch()]);
    for (const [dev, k] of [[A, pk()], [B, pk()]]) {
        await dev.navigate(BASE);
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(k)})`);
        await dev.reload();
    }
    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    await A.waitXmtp(); const inboxB = await B.waitXmtp();

    const gid = await A.eval(`(async () => { const r = await createGroupChat('Casa prueba', [${JSON.stringify(addrB)}]); return r.conv.id; })()`);
    check('A crea el grupo con B', !!gid);
    check('a B le aparece el grupo', !!await pollFor(B, GRUPO_EN_B(gid), 40));

    // B sale (el botón «Salir del grupo» llama a esto).
    await B.eval(`(async () => { const c = contacts.find(c => c.groupId === ${JSON.stringify(gid)}); await leaveGroupChat(c); })()`);
    check('B salió: el grupo ya no está en su lista', !await B.eval(GRUPO_EN_B(gid)));
    check('…y queda la marca de salida', await B.eval(`!!tombstones['group:${gid}'.toLowerCase()]?.left`));

    // Un mensaje cualquiera de A NO lo resucita (la salida es definitiva salvo reinvitación).
    await A.eval(`(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)}); await c.sendText('hola a todos'); })()`);
    await sleep(15000);
    check('un mensaje común del grupo NO lo hace reaparecer', !await B.eval(GRUPO_EN_B(gid)));

    // ¿A procesó la baja pedida por B? (si B no era admin, la baja la ejecuta el admin)
    const miembros = await pollFor(A, `(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)}); await c.sync(); const m = await c.members(); return m.some(x => x.inboxId === ${JSON.stringify(inboxB)}) ? false : 'fuera'; })()`, 15);
    console.log('   (B fuera del grupo en XMTP según A: ' + (miembros ? 'sí' : 'no, sigue de miembro') + ')');
    // La lista de «Añadir» sólo ofrece a quien ya no es miembro: para reinvitarlo, primero tiene que
    // quedar afuera (el admin procesa la baja, o lo quita con la ✕). Se hace eso si hace falta.
    if (!miembros) {
        await A.eval(`(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)}); await c.removeMembers([${JSON.stringify(inboxB)}]); })()`);
        await sleep(8000);
    }
    check('B quedó afuera del grupo y A lo tiene como candidato para agregar',
        await A.eval(`(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)}); await c.sync(); return !(await c.members()).some(x => x.inboxId === ${JSON.stringify(inboxB)}); })()`));

    // A vuelve a invitar a B, como desde la info del grupo.
    const reinv = await A.eval(`(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)});
        try { await c.addMembersByIdentifiers([{ identifier: ${JSON.stringify(addrB.toLowerCase())}, identifierKind: 0 }]); return 'ok'; } catch (e) { return 'error: ' + e.message; } })()`);
    check('A vuelve a invitar a B', reinv === 'ok', reinv);

    const volvio = await pollFor(B, GRUPO_EN_B(gid), 45);
    check('a B le reaparece el grupo tras la reinvitación', !!volvio);
    check('…y se levantó la marca de salida', !await B.eval(`!!tombstones['group:${gid}'.toLowerCase()]`));

    await A.eval(`(async () => { const c = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)}); await c.sendText('bienvenido de nuevo'); })()`);
    await B.eval(`(async () => { const c = contacts.find(c => c.groupId === ${JSON.stringify(gid)}); if (c) await startChatWithContact(c); })()`);
    const msg = await pollFor(B, `/bienvenido de nuevo/.test(document.getElementById('messagesContainer')?.innerText || '')`, 30);
    check('B abre el grupo y ve el mensaje nuevo', !!msg);
} catch (e) {
    check('sin excepciones', false, e.message);
} finally {
    A.kill(); B.kill();
}
const mal = results.filter(r => !r.ok).length;
console.log(mal ? `\n${mal} fallas` : '\nTodo verde');
process.exit(mal ? 1 : 0);
