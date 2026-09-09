// ¿El sitio servido desde Cloudflare se comporta igual que el de Firebase?
//
// Carga cada página en un Chrome real y anota TODA petición que falle: es la única forma
// honesta de barrer los recursos, porque muchos los pide el JS en tiempo de ejecución y
// un grep del HTML no los ve (lo intenté: las plantillas `${...}` lo vuelven ruido).
// Además compara las cabeceras y los códigos de las rutas contra el hosting viejo, para
// que la mudanza no cambie el contrato de URLs sin que nadie se entere.
//
//   unset NODE_OPTIONS && node tests/hosting-cloudflare-cdp.mjs
//   BASE=https://chatwallet-web.chatwallet.workers.dev node tests/hosting-cloudflare-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.BASE || 'https://chatwallet-web.chatwallet.workers.dev').replace(/\/$/, '');
const VIEJO = (process.env.VIEJO || 'https://chatwallet.org').replace(/\/$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [];
const check = (n, ok, extra = '') => { res.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); return ok; };

// El contrato público de URLs, escrito como dato y no como "lo que devuelva el hosting
// viejo". Al principio esto comparaba contra Firebase en vivo, pero Firebase se está
// retirando: chatwallet.web.app es OTRO sitio (devuelve HTML de relleno para todo), así
// que como referencia mentía. Los valores de acá se tomaron del hosting viejo real,
// medidos por chatwallet.org antes del corte del 9/9/2026.
//
// /dapp.html no es una ruta más: es el start_url del PWA, lo que registra el service
// worker y el destino de los App Links del APK y de los links de invitación.
const RUTAS = [
    ['/', 200, 'text/html'],
    ['/index.html', 200, 'text/html'],
    ['/dapp.html', 200, 'text/html'],
    ['/dapp', 200, 'text/html'],
    ['/book.html', 200, 'text/html'],
    ['/book', 200, 'text/html'],
    ['/book-admin.html', 200, 'text/html'],
    ['/manifiesto.html', 200, 'text/html'],
    ['/manifiesto', 200, 'text/html'],
    ['/tools', 301, null],                     // a /tools/, por los links relativos de esas páginas
    ['/tools/', 200, 'text/html'],
    ['/tools/index.html', 200, 'text/html'],
    ['/tools/sign', 200, 'text/html'],
    ['/tools/sign.html', 200, 'text/html'],
    ['/tools/bip39', 200, 'text/html'],
    ['/.well-known/assetlinks.json', 200, 'application/json'],   // App Links del APK
    ['/service-worker.js', 200, 'text/javascript'],
    ['/manifest.webmanifest', 200, 'application/manifest+json'],
    ['/site.webmanifest', 200, 'application/manifest+json'],
    ['/chainsv1.json', 200, 'application/json'],
    ['/whitepaper_es.pdf', 200, 'application/pdf'],
    ['/noexiste.html', 404, null],             // lo que no está tiene que dar 404, no la portada
];

const PAGINAS = ['/index.html', '/dapp.html', '/book.html', '/manifiesto.html',
    '/book-admin.html', '/tools/index.html', '/tools/sign.html', '/tools/bip39.html'];

class Chr {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); this.handlers = []; }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-host-');
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
            '--no-default-browser-check', `--remote-debugging-port=${this.port}`,
            `--user-data-dir=${this.dir}`, '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const l = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                const p = l.find(t => t.type === 'page');
                if (p) return this.connect(p.webSocketDebuggerUrl);
            } catch { }
        }
        throw new Error('Chrome no levantó');
    }
    connect(url) {
        return new Promise((ok, bad) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => {
                await this.rpc('Page.enable'); await this.rpc('Runtime.enable');
                await this.rpc('Network.enable'); ok();
            };
            this.ws.onerror = bad;
            this.ws.addEventListener('message', e => {
                const m = JSON.parse(e.data);
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
                else if (m.method) this.handlers.forEach(h => h(m));
            });
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(r => { this.pending.set(id, r); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async evaluar(expression) {
        const r = await this.rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        return r.result?.result?.value;
    }
    kill() { try { this.proc.kill(); } catch { } }
}

const cab = async (url) => {
    const r = await fetch(url, { redirect: 'manual' });
    return { code: r.status, tipo: r.headers.get('content-type') || '', loc: r.headers.get('location') || '' };
};

(async () => {
    // ── 1. El contrato de URLs ──
    console.log(`\n── Rutas: ${BASE}\n`);
    for (const [r, codigo, tipo] of RUTAS) {
        const n = await cab(BASE + r);
        const ok = n.code === codigo && (tipo === null || n.tipo.split(';')[0] === tipo);
        check(`${r}`, ok, `${n.code} ${n.tipo.split(';')[0]}${n.loc ? ' → ' + n.loc : ''}` +
            (ok ? '' : `  ← esperaba ${codigo}${tipo ? ' ' + tipo : ''}`));
    }

    // ── 2. Cada página en un navegador de verdad, mirando qué peticiones fallan ──
    console.log('\n── Recursos que fallan al cargar cada página\n');
    const c = new Chr(9411);
    await c.launch();
    for (const p of PAGINAS) {
        const fallos = [];
        const urls = new Map();
        const h = m => {
            if (m.method === 'Network.requestWillBeSent') urls.set(m.params.requestId, m.params.request.url);
            if (m.method === 'Network.loadingFailed') {
                const u = urls.get(m.params.requestId) || '?';
                // Un <video> con varios <source> aborta los que no eligió: eso NO es un fallo.
                if (u.startsWith(BASE) && !m.params.canceled) fallos.push(`${m.params.errorText} ${u.replace(BASE, '')}`);
            }
            if (m.method === 'Network.responseReceived') {
                const { url, status } = m.params.response;
                // /favicon.ico lo pide Chrome solo y falta también en el hosting viejo.
                if (status >= 400 && url.startsWith(BASE) && !url.endsWith('/favicon.ico'))
                    fallos.push(`${status} ${url.replace(BASE, '')}`);
            }
        };
        c.handlers = [h];
        await c.rpc('Page.navigate', { url: BASE + p });
        await sleep(6000);
        check(`${p} carga sin recursos rotos`, fallos.length === 0, fallos.slice(0, 6).join(' · '));
    }

    // ── 3. La dapp arranca de verdad (no basta un 200: el 11/8/2026 se sirvió una versión
    //       vieja con todo en 200). Se mira que el JS haya corrido y montado la UI.
    console.log('\n── La dapp arranca\n');
    const swLogs = [];
    c.handlers = [m => {
        if (m.method !== 'Runtime.consoleAPICalled') return;
        const t = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
        if (/ServiceWorker/i.test(t)) swLogs.push(t);
    }];
    await c.rpc('Page.navigate', { url: BASE + '/dapp.html' });
    await sleep(20000);
    const v = await c.evaluar(`document.documentElement.outerHTML.match(/v \\d+\\.\\d+ alpha/)?.[0] || ''`);
    check('dapp.html muestra su versión', /^v \d+\.\d+ alpha$/.test(v || ''), v);
    // OJO: navigator.serviceWorker.getRegistration() devuelve undefined desde el contexto de
    // la página en Chrome headless — también contra el hosting viejo, así que no prueba nada.
    // La evidencia buena es el scope que la propia app escribe en consola al registrarlo.
    const sw = swLogs.join(' ');
    check('service worker registrado en el scope raíz',
        sw.includes('successful') && sw.includes(BASE + '/'), sw || '(sin rastro en consola)');
    const nav = await c.evaluar(`!!document.querySelector('#appNav')`);
    check('la UI se montó (#appNav existe)', nav === true);

    // ── 4. El link de invitación conserva el query (la cache rule lo ignora en la key,
    //       pero la ruta corta tiene que llegar con los parámetros intactos al JS).
    await c.rpc('Page.navigate', { url: BASE + '/dapp?address=0xabc&pk=xyz' });
    await sleep(6000);
    const q = await c.evaluar('location.pathname + location.search');
    check('/dapp conserva el query y no redirige', q === '/dapp?address=0xabc&pk=xyz', String(q));

    c.kill();
    const mal = res.filter(x => !x).length;
    console.log(`\n${mal === 0 ? '✅ TODO OK' : `❌ ${mal} fallo(s)`} — ${res.length} chequeos\n`);
    process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
