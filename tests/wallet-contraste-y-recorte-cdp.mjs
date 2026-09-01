// Dos quejas medibles de la vista de billetera:
//   1. en tema claro, el botón índigo quedaba con letra oscura (2.82:1, WCAG pide 4.5)
//   2. en una ventana baja, la fila de acciones abría cortada bajo el nav fijo
// Se miden con números, no mirando la pantalla.
//
// Uso:  BASE_URL=http://localhost:8833 node tests/wallet-contraste-y-recorte-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9346';
const BASE = process.env.BASE_URL || 'http://localhost:8833';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = await (await fetch(CDP + '/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const waiters = new Map();
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; waiters.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.onopen = r);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); } };
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async expr =>
    (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const esperar = async (expr, seg = 30) => {
    for (let i = 0; i < seg * 2; i++) { if (await ev(expr)) return true; await sleep(500); }
    return false;
};

// Alto de la ventana a voluntad: es la variable que dispara el recorte.
const conAlto = async (alto) => {
    await rpc('Emulation.setDeviceMetricsOverride',
        { width: 1360, height: alto, deviceScaleFactor: 1, mobile: false });
    await sleep(900);
};

const cargar = async (tema) => {
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(1500);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)});
              localStorage.setItem('chatwallet_theme', ${JSON.stringify(tema)}); true`);
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2000);
    return esperar(`!!document.getElementById('scanQrBtn')`);
};

// Contraste WCAG del texto contra el primer fondo opaco que encuentra hacia arriba.
const CONTRASTE = `(() => {
    const lum = c => { const [r,g,b] = c.match(/\\d+/g).map(Number).map(v => { v /= 255;
        return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
        return .2126*r + .7152*g + .0722*b; };
    const ratio = (a,b) => { const L1 = Math.max(lum(a), lum(b)), L2 = Math.min(lum(a), lum(b));
        return +((L1 + .05) / (L2 + .05)).toFixed(2); };
    const fondo = el => { let n = el; while (n && n !== document.documentElement) {
        const bg = getComputedStyle(n).backgroundColor;
        if (bg && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) return bg; n = n.parentElement; }
        return 'rgb(255, 255, 255)'; };
    const out = {};
    for (const id of ['scanQrBtn', 'sendBtn', 'receiveBtn']) {
        const b = document.getElementById(id); if (!b) continue;
        const bg = fondo(b);
        out[id] = { fondo: bg, texto: getComputedStyle(b.querySelector('span')).color,
                    contraste: ratio(getComputedStyle(b.querySelector('span')).color, bg),
                    icono: ratio(getComputedStyle(b.querySelector('svg')).color, bg) };
    }
    return JSON.stringify(out);
})()`;

// ¿La fila se ve entera al abrir, sin que el usuario tenga que descubrir el scroll?
const RECORTE = `(() => {
    const fila = document.getElementById('scanQrBtn').parentElement;
    const nav = document.getElementById('appNav');
    const r = fila.getBoundingClientRect();
    const navArriba = nav && !nav.classList.contains('hidden') ? nav.getBoundingClientRect().top : innerHeight;
    return JSON.stringify({
        filaBottom: Math.round(r.bottom), navTop: Math.round(navArriba), ventana: innerHeight,
        tapada: r.bottom > navArriba + 1,
        scrollPendiente: (() => { const w = document.getElementById('walletView');
            return w ? w.scrollHeight - w.clientHeight : 0; })()
    });
})()`;

// ─────────── 1. contraste en tema claro ───────────
console.log('\n── contraste (tema claro) ──');
await conAlto(900);
ok(await cargar('light'), 'la app cargó en tema claro');
const c = JSON.parse(await ev(CONTRASTE) || '{}');
for (const [id, v] of Object.entries(c)) {
    ok(v.contraste >= 4.5, `${id}: texto ${v.contraste}:1 sobre ${v.fondo} (WCAG AA pide 4.5)`);
    ok(v.icono >= 3, `${id}: ícono ${v.icono}:1 (WCAG pide 3 para gráficos)`);
}
ok(Object.keys(c).length === 3, 'se midieron los tres botones');

console.log('\n── contraste (tema oscuro, que no se rompa) ──');
ok(await cargar('dark'), 'la app cargó en tema oscuro');
const d = JSON.parse(await ev(CONTRASTE) || '{}');
for (const [id, v] of Object.entries(d)) {
    ok(v.contraste >= 4.5, `${id}: texto ${v.contraste}:1 sobre ${v.fondo}`);
}

// ─────────── 2. recorte en ventanas bajas ───────────
console.log('\n── la fila de acciones entra sin scrollear ──');
for (const alto of [900, 760, 700, 640]) {
    await conAlto(alto);
    await sleep(700);
    const r = JSON.parse(await ev(RECORTE) || '{}');
    ok(!r.tapada,
        `ventana ${alto}px: la fila termina en ${r.filaBottom} y el nav empieza en ${r.navTop}` +
        (r.tapada ? ' → TAPADA' : ' → entera'));
}

// Y en tema claro también, que el QR cambia de tamaño con el tema.
await cargar('light');
for (const alto of [760, 700]) {
    await conAlto(alto);
    await sleep(700);
    const r = JSON.parse(await ev(RECORTE) || '{}');
    ok(!r.tapada, `tema claro, ventana ${alto}px: la fila entra (bottom ${r.filaBottom} < nav ${r.navTop})`);
}

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
