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

// ─────────── 3. cambiar de tema no tira un cartel ───────────
console.log('\n── el toggle de tema es silencioso ──');
await conAlto(900);
await cargar('dark');
await ev(`(document.getElementById('cwNotifs') || {}).innerHTML = ''`);
await ev(`document.getElementById('themeHeaderBtn').click()`);
await sleep(700);
ok(await ev(`document.body.classList.contains('theme-light')`), 'el tema cambió a claro');
const cartel = await ev(`((document.getElementById('cwNotifs') || {}).innerText || '').trim()`);
ok(!cartel, `y no apareció ningún aviso (“${cartel.slice(0, 40)}”)`);

await ev(`document.getElementById('themeHeaderBtn').click()`);
await sleep(700);
ok(!(await ev(`document.body.classList.contains('theme-light')`)), 'vuelve a oscuro');
ok(!(await ev(`((document.getElementById('cwNotifs') || {}).innerText || '').trim()`)),
    'tampoco al volver');

// ─────────── 4. el selector de red es una pantalla, no un desplegable cortado ───────────
const abrirSelector = async () => {
    await ev(`document.getElementById('tokenSelectorToggle').click()`);
    await sleep(600);
    return JSON.parse(await ev(`(() => {
        const m = document.getElementById('tokenSelectorMenu');
        const lista = document.getElementById('tokenSelectorList');
        const panel = m.firstElementChild;
        const items = [...lista.children];
        // Con muchas redes la lista scrollea, y eso está bien: lo que NO puede pasar es que la
        // última quede inalcanzable o cortada al llegar al final.
        lista.scrollTop = lista.scrollHeight;
        const ultimo = items[items.length - 1];
        const pr = panel.getBoundingClientRect();
        const lum = c => { const [r,g,b] = c.match(/\\d+/g).map(Number); return .299*r + .587*g + .114*b; };
        const contraste = (a, b) => { const L = c => { const [r,g,b2] = c.match(/\\d+/g).map(Number)
            .map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
            return .2126*r + .7152*g + .0722*b2; };
            const L1 = Math.max(L(a), L(b)), L2 = Math.min(L(a), L(b));
            return +((L1 + .05) / (L2 + .05)).toFixed(2); };
        // El primero es el seleccionado (va en índigo); para ver si la lista sigue el tema hay
        // que mirar uno NO seleccionado.
        const normal = items.find(i => !/indigo/.test(i.className)) || items[0];
        const fondo = getComputedStyle(panel).backgroundColor;
        return JSON.stringify({
            abierto: !m.classList.contains('hidden'),
            aPantallaCompleta: getComputedStyle(m).position === 'fixed',
            redes: items.length,
            fondoPanel: lum(fondo),
            textoItem: lum(getComputedStyle(normal).color),
            contrasteNormal: contraste(getComputedStyle(normal).color, fondo),
            contrasteSeleccionado: contraste(getComputedStyle(items[0]).color, fondo),
            ultimoEntero: ultimo ? ultimo.getBoundingClientRect().bottom <= pr.bottom + 1 : true,
            panelDentroDeLaVentana: pr.bottom <= innerHeight + 1 && pr.top >= -1,
            tieneTitulo: !!document.querySelector('#tokenSelectorMenu h3')
        });
    })()`) || '{}');
};

console.log('\n── selector de red (tema claro) ──');
await conAlto(700);
await cargar('light');
const selClaro = await abrirSelector();
ok(selClaro.abierto, 'se abre');
ok(selClaro.aPantallaCompleta, 'ocupa la pantalla en vez de colgar sobre el QR');
ok(selClaro.tieneTitulo, 'tiene título y botón de cerrar: se lee como una pantalla');
ok(selClaro.redes > 0, `lista ${selClaro.redes} red(es)`);
ok(selClaro.ultimoEntero, 'al llegar al final, la última red se ve entera');
ok(selClaro.panelDentroDeLaVentana, 'y el panel entra en la ventana');
// El bug: bg-gray-700/90 no tenía override de tema claro y quedaba gris oscuro.
ok(selClaro.fondoPanel > 150,
    `el panel sigue el tema claro (luminancia ${Math.round(selClaro.fondoPanel)})`);
ok(selClaro.textoItem < 140,
    `y el texto es oscuro sobre él (luminancia ${Math.round(selClaro.textoItem)})`);
ok(selClaro.contrasteNormal >= 4.5, `contraste de una red sin seleccionar: ${selClaro.contrasteNormal}:1`);
ok(selClaro.contrasteSeleccionado >= 4.5,
    `y de la seleccionada, que va en índigo: ${selClaro.contrasteSeleccionado}:1`);

console.log('\n── selector de red (tema oscuro) ──');
await cargar('dark');
const selOsc = await abrirSelector();
ok(selOsc.abierto && selOsc.ultimoEntero, 'se abre y la última red entra');
ok(selOsc.fondoPanel < 100, `el panel sigue oscuro (luminancia ${Math.round(selOsc.fondoPanel)})`);
ok(selOsc.textoItem > 150, `con texto claro (luminancia ${Math.round(selOsc.textoItem)})`);
ok(selOsc.contrasteNormal >= 4.5, `contraste de una red sin seleccionar: ${selOsc.contrasteNormal}:1`);
ok(selOsc.contrasteSeleccionado >= 4.5, `y de la seleccionada: ${selOsc.contrasteSeleccionado}:1`);

// Cerrar: por la ✕ y tocando el fondo.
await ev(`document.getElementById('closeTokenSelector').click()`);
await sleep(400);
ok(await ev(`document.getElementById('tokenSelectorMenu').classList.contains('hidden')`), 'la ✕ lo cierra');
await abrirSelector();
await ev(`(() => { const m = document.getElementById('tokenSelectorMenu');
    m.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; })()`);
await sleep(400);
ok(await ev(`document.getElementById('tokenSelectorMenu').classList.contains('hidden')`),
    'y tocar el fondo también');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
