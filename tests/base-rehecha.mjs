// El navegador puede borrar el almacenamiento de un sitio cuando falta espacio en disco.
// Cuando eso pasa, XMTP estrena instalación y todo lo que te mandaron con la app cerrada
// queda ilegible para siempre — y la app no decía NADA (medido: 6 instalaciones en una Mac
// con el disco al 98%, y dos mensajes perdidos sin ningún aviso).
//
// Este test verifica las dos mitades del arreglo:
//   1) se pide almacenamiento persistente ANTES de crear la base
//   2) si la instalación cambió sin que la hayamos cambiado nosotros, se avisa y se restaura
//
//   BASE=http://localhost:8845/dapp.html node tests/base-rehecha.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// ── 1. Lo que tiene que decir el código ────────────────────────────────────────
const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');

const iPersist = src.indexOf('await asegurarAlmacenamientoPersistente()');
const iClient = src.indexOf('await Client.create(walletSigner');
ok(iPersist > -1 && iClient > -1 && iPersist < iClient,
    'se pide almacenamiento persistente ANTES de crear el cliente XMTP');
ok(/navigator\.storage\.persist\(\)/.test(src), 'se llama a navigator.storage.persist()');
ok(/navigator\.storage\.persisted\(\)/.test(src), 'no se vuelve a pedir si ya estaba concedido');
ok(/detectarBaseRehecha\(wallet\.address, String\(chatwalletxmtp\.installationId/.test(src),
    'la instalación se compara contra la guardada');
ok(/force: forceRestore \|\| baseRehecha/.test(src),
    'si la base se rehizo, el respaldo soberano se restaura aunque el store no esté vacío');
ok(/avisarBaseRehecha\(persistente\);/.test(src), 'y se le avisa a la persona');
ok(/syncReconciliarTodo\(\)/.test(src), 'y se le pide a los contactos el historial que falta');
ok(/const linkForzado = localStorage\.getItem\('cw-link-force-restore'\)/.test(src),
    'vincular el chat de otra wallet no se confunde con un borrado');
for (const clave of ['store_wiped_warn', 'store_persist_denied', 'inst_casi_lleno']) {
    const n = (src.match(new RegExp(`"${clave}":`, 'g')) || []).length;
    ok(n === 3, `"${clave}" está traducida en los tres idiomas`, `${n}/3`);
}

// ── 2. Lo que hace la app de verdad ───────────────────────────────────────────
class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); this.logs = []; }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-rehecha-');
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
        throw new Error('Chrome no levantó');
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
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const D = new Dev(9421);
try {
    await D.launch();
    await D.navigate(BASE);
    await D.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await D.navigate(BASE);
    ok(!!await D.waitXmtp(), 'arranca XMTP');
    await sleep(6000);

    const addr = await D.eval(`currentWallet.address.toLowerCase()`);
    const inst = await D.eval(`String(chatwalletxmtp.installationId || '')`);
    const guardada = await D.eval(`localStorage.getItem('cw-xmtp-instalacion-' + currentWallet.address.toLowerCase())`);
    ok(!!inst && guardada === inst, 'la instalación queda anotada para la próxima vez');
    ok(D.logs.some(l => /Almacenamiento persistente|NO concedió almacenamiento/.test(l)),
        'se pidió la persistencia al arrancar', D.logs.filter(l => /persistente|persistent/i.test(l))[0] || '');

    // Arranque normal: la instalación es la misma y no se molesta a nadie.
    await D.navigate(BASE);
    ok(!!await D.waitXmtp(), 'vuelve a arrancar');
    await sleep(8000);
    const textoNormal = await D.eval(`document.body.innerText`);
    ok(!/borró los chats guardados/.test(textoNormal || ''), 'en un arranque normal NO avisa nada');

    // Ahora sí: la base se rehizo (instalación distinta a la anotada).
    await D.eval(`localStorage.setItem('cw-xmtp-instalacion-' + currentWallet.address.toLowerCase(), 'instalacion-vieja-que-ya-no-existe')`);
    D.logs.length = 0;
    await D.navigate(BASE);
    ok(!!await D.waitXmtp(), 'arranca con la base "rehecha"');
    await sleep(12000);
    ok(D.logs.some(l => /La base local de XMTP se rehizo/.test(l)), 'lo detecta y lo deja en la consola');
    const texto = await D.eval(`document.body.innerText`);
    ok(/borró los chats guardados/.test(texto || ''), 'y se lo dice a la persona en pantalla');
    const reanotada = await D.eval(`localStorage.getItem('cw-xmtp-instalacion-' + currentWallet.address.toLowerCase())`);
    ok(reanotada === inst, 'y vuelve a anotar la instalación buena (no avisa dos veces)');
} finally { D.kill(); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
