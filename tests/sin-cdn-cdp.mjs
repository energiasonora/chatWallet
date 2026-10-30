// Sin terceros (3.96): las páginas ya no bajan código ni fuentes de cdn.tailwindcss.com, unpkg,
// cdnjs, jsdelivr ni Google Fonts. Compara cada página vieja (HEAD con CDN) contra la nueva en
// Chrome headless:
//   1. la nueva no pide nada a esos dominios (ni scripts, estilos o fuentes de otro origen),
//   2. las librerías quedan como antes y funcionan (elliptic, QRCodeStyling, Html5Qrcode,
//      VanillaTilt, confetti, ethers),
//   3. el estilo calculado de cada elemento es el mismo (también la familia de letra), y las
//      fuentes que el navegador terminó cargando son las mismas que con Google.
//
// Uso: lo arma tests/run-sin-cdn.sh (buildea X.html y X-viejo.html y los sirve en :8818).
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9462;
const BASE = process.env.BASE || 'http://127.0.0.1:8818/';
const PK = '0x584bf778404a370bc90c7ef5c1aef766bc3aff5761a02d69d1294d843513b06c';
const EXTERNOS = /cdn\.tailwindcss\.com|unpkg\.com|cdnjs\.cloudflare\.com|jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/;
const PAGINAS = (process.env.PAGINAS || 'dapp,index,manifiesto,book,book-admin').split(',');

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
// la cascada), indexado por id o por el camino en el DOM. Más las fuentes que quedaron cargadas.
const FOTO = `(async () => {
    await document.fonts.ready;
    const props = ['display','position','top','right','bottom','left','z-index','flex-direction','align-items',
        'justify-content','gap','grid-template-columns','margin-top','margin-right','margin-bottom','margin-left',
        'padding-top','padding-right','padding-bottom','padding-left','color','background-color','background-image',
        'border-top-width','border-top-color','border-top-left-radius','font-family','font-size','font-weight',
        'font-style','line-height','text-align','opacity','overflow-x','overflow-y','box-shadow','max-width',
        'min-height','cursor','transform','white-space','text-transform','letter-spacing'];
    const camino = (el) => { if (el.id) return '#' + el.id; const p = el.parentElement;
        if (!p) return el.tagName; return camino(p) + '>' + el.tagName + ':' + [...p.children].indexOf(el); };
    const out = {};
    for (const el of document.querySelectorAll('body *')) {
        if (/^(SCRIPT|STYLE|svg|path|circle|line|rect|polyline|g)$/i.test(el.tagName)) continue;
        if (el.closest('svg')) continue;
        const cs = getComputedStyle(el); const k = camino(el);
        out[k] = { cls: el.getAttribute('class') || '', anim: el.getAnimations().length > 0, s: props.map(p => cs.getPropertyValue(p)) };
    }
    const fuentes = [...new Set([...document.fonts].filter(f => f.status === 'loaded')
        .map(f => f.family.replace(/["']/g, '') + ' ' + f.style + ' ' + f.weight))].sort();
    return { props, out, fuentes };
})()`;

async function cargar(pagina) {
    await rpc('Page.navigate', { url: BASE + pagina }); await sleep(1500);
    await ev(`(async()=>{for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); localStorage.setItem('xmtp-chat-wallet', '${PK}');
        localStorage.setItem('xmtp-chat-wallet-backup-done', '1'); })()`);
    pedidos = [];
    await rpc('Page.reload', { ignoreCache: true });
    if (pagina.startsWith('dapp'))
        for (let i = 0; i < 60; i++) { await sleep(500); if (await ev(`typeof currentWallet!=='undefined' && !!currentWallet`)) break; }
    await sleep(3000); // la CDN de Tailwind genera el CSS un tick después de que el DOM cambia
}

const casiIgual = (a, b) => { // la CDN y la CLI redondean distinto algún color con transparencia
    const na = a.match(/[\d.]+/g) || [], nb = b.match(/[\d.]+/g) || [];
    return a.replace(/[\d.]+/g, '#') === b.replace(/[\d.]+/g, '#') && na.length === nb.length
        && na.every((x, i) => Math.abs(x - nb[i]) <= 1);
};

async function comparar(pag) {
    console.log(`\n── ${pag}.html ──`);
    await cargar(`${pag}-viejo.html`);
    const viejosExternos = pedidos.filter(p => EXTERNOS.test(p.url)).length;
    ok(viejosExternos > 0, `control: la vieja sí pedía a terceros (${viejosExternos} pedidos)`);
    const vieja = await ev(FOTO);

    await cargar(`${pag}.html`);
    const externos = pedidos.filter(p => EXTERNOS.test(p.url) && !p.bloqueado);
    ok(externos.length === 0, 'la nueva no pide nada a CDN ni a Google Fonts' + (externos.length ? ': ' + externos.map(p => p.url).join(', ') : ''));
    const afuera = pedidos.filter(p => !p.bloqueado && ['Script', 'Stylesheet', 'Font'].includes(p.tipo)
        && !p.url.startsWith(BASE) && !p.url.startsWith('blob:' + BASE) && !p.url.startsWith('data:'));
    ok(afuera.length === 0, 'ningún script, estilo ni fuente viene de otro dominio' + (afuera.length ? ': ' + afuera.map(p => p.url).join(', ') : ''));
    const bloqueados = pedidos.filter(p => p.bloqueado && EXTERNOS.test(p.url));
    if (bloqueados.length) console.log(`   (frenados por la política de la página: ${bloqueados.map(p => p.url + ' [' + p.bloqueado + ']').join(', ')})`);
    const nueva = await ev(FOTO);

    ok(JSON.stringify(nueva.fuentes) === JSON.stringify(vieja.fuentes),
        `mismas fuentes cargadas: ${nueva.fuentes.join(', ') || '(ninguna)'}` +
        (JSON.stringify(nueva.fuentes) === JSON.stringify(vieja.fuentes) ? '' : ` — antes: ${vieja.fuentes.join(', ')}`));
    // Lo que está en plena animación cambia según el instante de la foto: no se compara.
    const claves = Object.keys(vieja.out).filter(k => nueva.out[k] && nueva.out[k].cls === vieja.out[k].cls
        && !vieja.out[k].anim && !nueva.out[k].anim);
    const total = Object.keys(vieja.out).length;
    ok(claves.length >= total * 0.95, `elementos comparables: ${claves.length} de ${total}`);
    const difs = [];
    for (const k of claves) vieja.props.forEach((p, i) => {
        const a = vieja.out[k].s[i], b = nueva.out[k].s[i];
        if (a !== b && !casiIgual(a, b)) difs.push(`${k} [${vieja.out[k].cls.slice(0, 60)}] ${p}: ${a} → ${b}`);
    });
    ok(difs.length === 0, `estilo calculado idéntico (${difs.length} diferencias)`);
    if (difs.length) console.log(difs.slice(0, 30).join('\n'));
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
        if (d.method === 'Network.requestWillBeSent') pedidos.push({ id: d.params.requestId, url: d.params.request.url, tipo: d.params.type });
        // Lo que frena la política de seguridad de la página nunca sale del navegador: no cuenta.
        if (d.method === 'Network.loadingFailed' && d.params.blockedReason) {
            const p = pedidos.find(x => x.id === d.params.requestId); if (p) p.bloqueado = d.params.blockedReason;
        }
    };
    await rpc('Page.enable'); await rpc('Runtime.enable'); await rpc('Network.enable');
    await rpc('Network.setCacheDisabled', { cacheDisabled: true });

    for (const pag of PAGINAS) {
        await comparar(pag);
        // Las librerías siguen funcionando (estamos en la página nueva).
        if (pag === 'dapp') {
            ok(await ev(`typeof elliptic === 'object' && typeof elliptic.ec === 'function'`), 'elliptic está como global');
            ok(await ev(`typeof QRCodeStyling === 'function' && typeof Html5Qrcode === 'function'`), 'QRCodeStyling y Html5Qrcode están como globales');
            // La cuenta stealth usa elliptic: debe dar la misma llave pública que ethers.
            ok(await ev(`(() => { const e = new elliptic.ec('secp256k1');
                const k = e.keyFromPrivate('${PK.slice(2)}', 'hex');
                return '0x' + k.getPublic().encodeCompressed('hex') === ethers.SigningKey.computePublicKey('${PK}', true); })()`),
                'elliptic calcula la misma llave pública que ethers');
            // El escáner de archivo (el de "subir foto del QR") lee un QR de verdad.
            ok(await ev(`(async () => { const d = document.createElement('div'); d.id = 'qrPruebaSinCdn'; document.body.appendChild(d);
                const q = new QRCodeStyling({ width: 300, height: 300, margin: 20, data: 'https://chatwallet.org/dapp?prueba=1', type: 'canvas',
                    backgroundOptions: { color: '#ffffff' }, dotsOptions: { color: '#000000' } });
                const blob = await q.getRawData('png'); const f = new File([blob], 'qr.png', { type: 'image/png' });
                const txt = await new Html5Qrcode('qrPruebaSinCdn', { verbose: false }).scanFile(f, false);
                d.remove(); return txt; })()`) === 'https://chatwallet.org/dapp?prueba=1', 'Html5Qrcode lee un QR generado por QRCodeStyling');
        }
        if (pag === 'index') ok(await ev(`typeof VanillaTilt === 'function' && [...document.querySelectorAll('.artwork-container')].every(e => e.vanillaTilt)`),
            'VanillaTilt está y se enganchó a las imágenes de la portada');
        if (pag === 'book') ok(await ev(`typeof confetti === 'function' && typeof ethers?.Contract === 'function' && typeof QRCodeStyling === 'function'`),
            'confetti, ethers y QRCodeStyling están en el libro');
        if (pag === 'manifiesto') ok(await ev(`getComputedStyle(document.body).getPropertyValue('--tw-ring-offset-width') !== '' || !!document.querySelector('link[href*="tailwind"]')`),
            'el manifiesto tiene su Tailwind compilado');
    }
} catch (e) {
    console.error('💥', e.message); fails++;
} finally {
    chrome.kill();
    console.log(fails ? `\n✗ ${fails} fallas` : '\n✓ todo bien');
    process.exit(fails ? 1 : 0);
}
