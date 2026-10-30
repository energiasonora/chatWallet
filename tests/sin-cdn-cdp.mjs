// Librerías empaquetadas (3.96): la app ya no baja código de cdn.tailwindcss.com, unpkg ni cdnjs.
// Compara la versión vieja (CDN) contra la nueva en Chrome headless:
//   1. la nueva no pide nada a esos dominios (ni a ningún script externo),
//   2. las librerías quedan como antes (elliptic, QRCodeStyling, Html5Qrcode) y funcionan,
//   3. el estilo calculado de cada elemento es el mismo que daba la Tailwind de la CDN.
//
// Uso: servir un build con dapp.html (nueva) y dapp-cdnviejo.html (HEAD anterior) en :8818;
//      lo hace tests/run-sin-cdn.sh.
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9462;
const BASE = process.env.BASE || 'http://127.0.0.1:8818/';
const PK = '0x584bf778404a370bc90c7ef5c1aef766bc3aff5761a02d69d1294d843513b06c';
const EXTERNOS = /cdn\.tailwindcss\.com|unpkg\.com|cdnjs\.cloudflare\.com|jsdelivr\.net/;

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw-sincdn-${Date.now()}`,
    '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map(); let ws; let pedidos = [];
const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 60000);
});
const ev = (expr) => rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    .then(r => { if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result?.value; });

// Estilo calculado de todos los elementos (también los ocultos: getComputedStyle igual resuelve
// la cascada), indexado por id o por el camino en el DOM.
const FOTO = `(() => {
    const props = ['display','position','top','right','bottom','left','z-index','flex-direction','align-items',
        'justify-content','gap','grid-template-columns','margin-top','margin-right','margin-bottom','margin-left',
        'padding-top','padding-right','padding-bottom','padding-left','color','background-color','background-image',
        'border-top-width','border-top-color','border-top-left-radius','font-size','font-weight','line-height',
        'text-align','opacity','overflow-x','overflow-y','box-shadow','max-width','min-height','cursor',
        'transform','white-space','text-transform','letter-spacing'];
    const camino = (el) => { if (el.id) return '#' + el.id; const p = el.parentElement;
        if (!p) return el.tagName; return camino(p) + '>' + el.tagName + ':' + [...p.children].indexOf(el); };
    const out = {};
    for (const el of document.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|svg|path|circle|line|rect|polyline|g)$/i.test(el.tagName)) continue;
        if (el.closest('svg')) continue;
        const cs = getComputedStyle(el); const k = camino(el);
        out[k] = { cls: el.getAttribute('class') || '', s: props.map(p => cs.getPropertyValue(p)) };
    }
    return { props, out };
})()`;

async function cargar(pagina) {
    pedidos = [];
    await rpc('Page.navigate', { url: BASE + pagina }); await sleep(2000);
    await ev(`(async()=>{for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); localStorage.setItem('xmtp-chat-wallet', '${PK}');
        localStorage.setItem('xmtp-chat-wallet-backup-done', '1'); })()`);
    pedidos = [];
    await rpc('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`typeof currentWallet!=='undefined' && !!currentWallet`)) break; }
    await sleep(3000); // la CDN genera el CSS en un tick después de que el DOM cambia
}

try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
        try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        await sleep(300);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.id && pending.has(d.id)) { pending.get(d.id).resolve(d.result || d); pending.delete(d.id); }
        if (d.method === 'Network.requestWillBeSent') pedidos.push({ url: d.params.request.url, tipo: d.params.type });
    };
    await rpc('Page.enable'); await rpc('Runtime.enable'); await rpc('Network.enable');
    await rpc('Network.setCacheDisabled', { cacheDisabled: true });

    // ── Versión vieja: la referencia ──
    await cargar('dapp-cdnviejo.html');
    ok(pedidos.some(p => /cdn\.tailwindcss\.com/.test(p.url)), 'control: la vieja sí pedía la Tailwind de la CDN');
    const vieja = await ev(FOTO);

    // ── Versión nueva ──
    await cargar('dapp.html');
    const externos = pedidos.filter(p => EXTERNOS.test(p.url));
    ok(externos.length === 0, 'la nueva no pide nada a tailwindcss/unpkg/cdnjs/jsdelivr' + (externos.length ? ': ' + externos.map(p => p.url).join(', ') : ''));
    const scriptsAfuera = pedidos.filter(p => p.tipo === 'Script' && !p.url.startsWith(BASE) && !p.url.startsWith('blob:' + BASE));
    ok(scriptsAfuera.length === 0, 'ningún script se baja de otro dominio' + (scriptsAfuera.length ? ': ' + scriptsAfuera.map(p => p.url).join(', ') : ''));
    ok(await ev(`typeof elliptic === 'object' && typeof elliptic.ec === 'function'`), 'elliptic está como global');
    ok(await ev(`typeof QRCodeStyling === 'function' && typeof Html5Qrcode === 'function'`), 'QRCodeStyling y Html5Qrcode están como globales');
    // La cuenta stealth usa elliptic: P = S + G·s debe dar lo mismo que ethers.
    ok(await ev(`(() => { const e = new elliptic.ec('secp256k1');
        const k = e.keyFromPrivate('${PK.slice(2)}', 'hex');
        return '0x' + k.getPublic().encodeCompressed('hex') === ethers.SigningKey.computePublicKey('${PK}', true); })()`),
        'elliptic calcula la misma llave pública que ethers');
    ok(await ev(`(async () => { const d = document.createElement('div'); document.body.appendChild(d);
        new QRCodeStyling({ width: 200, height: 200, data: 'chatwallet.org', type: 'canvas' }).append(d);
        await new Promise(r => setTimeout(r, 500)); const c = d.querySelector('canvas'); const ok = !!c && c.width > 0;
        d.remove(); return ok; })()`), 'QRCodeStyling dibuja un QR');
    // El escáner de archivo (el de "subir foto del QR") lee un QR de verdad.
    ok(await ev(`(async () => { const d = document.createElement('div'); d.id = 'qrPruebaSinCdn'; document.body.appendChild(d);
        const q = new QRCodeStyling({ width: 300, height: 300, margin: 20, data: 'https://chatwallet.org/dapp?prueba=1', type: 'canvas',
            backgroundOptions: { color: '#ffffff' }, dotsOptions: { color: '#000000' } });
        const blob = await q.getRawData('png'); const f = new File([blob], 'qr.png', { type: 'image/png' });
        const txt = await new Html5Qrcode('qrPruebaSinCdn', { verbose: false }).scanFile(f, false);
        d.remove(); return txt; })()`) === 'https://chatwallet.org/dapp?prueba=1', 'Html5Qrcode lee un QR generado por QRCodeStyling');
    const nueva = await ev(FOTO);

    // ── Mismo aspecto ──
    const claves = Object.keys(vieja.out).filter(k => nueva.out[k] && nueva.out[k].cls === vieja.out[k].cls);
    ok(claves.length > 800, `elementos comparables: ${claves.length} de ${Object.keys(vieja.out).length}`);
    // La CDN y la CLI redondean distinto algún color con transparencia (138 vs 139): ±1 es lo mismo.
    const casiIgual = (a, b) => { const na = a.match(/[\d.]+/g) || [], nb = b.match(/[\d.]+/g) || [];
        return a.replace(/[\d.]+/g, '#') === b.replace(/[\d.]+/g, '#') && na.length === nb.length
            && na.every((x, i) => Math.abs(x - nb[i]) <= 1); };
    const difs = [];
    for (const k of claves) {
        vieja.props.forEach((p, i) => {
            const a = vieja.out[k].s[i], b = nueva.out[k].s[i];
            if (a !== b && !casiIgual(a, b)) difs.push(`${k} [${vieja.out[k].cls.slice(0, 60)}] ${p}: ${a} → ${b}`);
        });
    }
    ok(difs.length === 0, `estilo calculado idéntico en todos (${difs.length} diferencias)`);
    if (difs.length) console.log(difs.slice(0, 40).join('\n'));
} catch (e) {
    console.error('💥', e.message); fails++;
} finally {
    chrome.kill();
    console.log(fails ? `\n✗ ${fails} fallas` : '\n✓ todo bien');
    process.exit(fails ? 1 : 0);
}
