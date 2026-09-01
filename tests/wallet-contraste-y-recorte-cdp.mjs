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
const shortDe = a => `${a.slice(0, 6)}...${a.slice(-4)}`;
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

// La pantalla de billetera tiene que entrar ENTERA: QR, dirección, saldo y acciones, sin
// scroll. Anclar la fila de acciones dejaba los botones a la vista pero escondía el saldo
// detrás: por eso se mide también que el saldo esté dentro del área visible.
const RECORTE = `(() => {
    const w = document.getElementById('walletView');
    const fila = document.getElementById('scanQrBtn').parentElement;
    const nav = document.getElementById('appNav');
    const r = fila.getBoundingClientRect();
    const navArriba = nav && !nav.classList.contains('hidden') ? nav.getBoundingClientRect().top : innerHeight;
    // Contra la VENTANA, no contra la caja del contenedor: el canvas del QR puede desbordar
    // unos px su wrapper sin que nada se recorte (el wrapper no clipea). Lo que importa es que
    // se vea en pantalla y que no haya scroll pendiente, no en qué caja cae.
    const dentro = el => { if (!el) return null; const b = el.getBoundingClientRect();
        return b.top >= -1 && b.bottom <= innerHeight + 1 && b.height > 0; };
    const saldo = document.getElementById('balanceValue')
        || document.querySelector('#walletView .text-4xl, #walletView .text-3xl');
    const qr = document.querySelector('#qr-code canvas, #qr-code img');
    return JSON.stringify({
        filaBottom: Math.round(r.bottom), navTop: Math.round(navArriba), ventana: innerHeight,
        tapada: r.bottom > navArriba + 1,
        scrollPendiente: w.scrollHeight - w.clientHeight,
        saldoVisible: dentro(saldo),
        qrVisible: dentro(qr),
        altoQr: qr ? Math.round(qr.getBoundingClientRect().height) : null
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
    await sleep(900);
    const r = JSON.parse(await ev(RECORTE) || '{}');
    ok(!r.tapada, `ventana ${alto}px: la fila no la tapa el nav (${r.filaBottom} vs ${r.navTop})`);
    ok(r.scrollPendiente === 0, `ventana ${alto}px: entra todo sin scroll (sobra ${r.scrollPendiente}px)`);
    ok(r.saldoVisible, `ventana ${alto}px: el saldo se ve`);
    ok(r.qrVisible, `ventana ${alto}px: el QR se ve entero (${r.altoQr}px)`);
}

// Y en tema claro también, que el QR cambia de tamaño con el tema.
await cargar('light');
for (const alto of [760, 700]) {
    await conAlto(alto);
    await sleep(900);
    const r = JSON.parse(await ev(RECORTE) || '{}');
    ok(!r.tapada && r.scrollPendiente === 0 && r.saldoVisible,
        `tema claro, ventana ${alto}px: entra todo y el saldo se ve (sobra ${r.scrollPendiente}px)`);
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
            // Lo que se pidió: que entren TODAS sin scrollear. Se mide antes de haber scrolleado
            // arriba — scrollHeight/clientHeight no dependen de la posición.
            necesitaScroll: lista.scrollHeight - lista.clientHeight,
            altoDelPanel: Math.round(pr.height), ventana: innerHeight,
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
ok(selClaro.necesitaScroll === 0,
    `las ${selClaro.redes} redes entran sin scrollear (sobra ${selClaro.necesitaScroll}px)`);
ok(selClaro.altoDelPanel > selClaro.ventana * 0.85,
    `el panel usa la pantalla (${selClaro.altoDelPanel}px de ${selClaro.ventana})`);
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
ok(selOsc.necesitaScroll === 0, `y tampoco scrollea (sobra ${selOsc.necesitaScroll}px)`);
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

// ─────────── 5. la tarjeta propia se ve como tarjeta ───────────
console.log('\n── tu propia tarjeta ──');
await conAlto(900);
await cargar('dark');
await ev(`localStorage.setItem('chatwallet-user-profile', JSON.stringify({
    alias: 'Xunorus', links: 'energiasonora.eth', avatar: '' }))`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3000);
await esperar(`!!currentWallet`);

await ev(`document.getElementById('userDidTrigger').click()`);
await sleep(600);
const propia = JSON.parse(await ev(`(() => {
    const card = document.getElementById('userInfoCard');
    const editor = document.getElementById('userDidWindow');
    return JSON.stringify({
        tarjetaAbierta: getComputedStyle(card).display !== 'none',
        editorAbierto: !editor.classList.contains('hidden'),
        nombre: document.getElementById('userCardName').textContent.trim(),
        address: document.getElementById('userCardAddress').textContent.trim(),
        lapiz: !document.getElementById('userCardEditBtn').classList.contains('hidden'),
        aliasDeContacto: !document.getElementById('userCardLocalName').classList.contains('hidden'),
        links: document.querySelectorAll('#userCardLinks .did-link').length
    });
})()`) || '{}');
ok(propia.tarjetaAbierta, 'se abre la tarjeta');
ok(!propia.editorAbierto, 'y NO el formulario de edición de una');
ok(propia.nombre === 'Xunorus', `con tu alias (“${propia.nombre}”)`);
ok(/^0x[0-9a-fA-F]{40}$/.test(propia.address), 'y tu address completa');
ok(propia.links === 1, `y tus links (${propia.links})`);
ok(propia.lapiz, 'tiene el lápiz para editar');
ok(!propia.aliasDeContacto, '"Tu alias: …" no aparece: eso es de un contacto, no de vos');

// El lápiz lleva al editor que ya existía.
await ev(`document.getElementById('userCardEditBtn').click()`);
await sleep(600);
ok(await ev(`!document.getElementById('userDidWindow').classList.contains('hidden')`),
    'el lápiz abre el editor');
ok(await ev(`getComputedStyle(document.getElementById('userInfoCard')).display === 'none'`),
    'y cierra la tarjeta para dejarlo ver');
ok(await ev(`document.getElementById('userDidAlias').value === 'Xunorus'`),
    'el editor viene cargado con lo que ya tenías');

// Y en la tarjeta de OTRO el lápiz no tiene que estar.
await ev(`(() => { document.getElementById('userDidWindow').classList.add('hidden');
    showUserInfo('0x2233445566778899aabbccddeeff001122334455'); return true; })()`);
await sleep(400);
ok(await ev(`document.getElementById('userCardEditBtn').classList.contains('hidden')`),
    'en la tarjeta de un contacto no aparece el lápiz');

// ─────────── 6. el apodo local no se lee como si fuera propio ───────────
console.log('\n── "Tu alias" en la tarjeta de un contacto ──');
const OTRO = '0x2233445566778899aabbccddeeff001122334455';
const lineaAlias = async (nombre) => {
    await ev(`(async () => {
        contacts = [{ name: ${JSON.stringify(nombre)}, selfAlias: 'Xunorus', address: '${OTRO}',
                      unreadCount: 0, status: 'offline' }];
        showUserInfo('${OTRO}');
        return true;
    })()`);
    await sleep(400);
    return await ev(`document.getElementById('userCardLocalName').innerText.trim()`);
};

const conApodo = await lineaAlias('Clau');
ok(!/tu alias/i.test(conApodo || ''),
    `ya no dice "Tu alias" (“${conApodo}”)`);
ok(/Clau/.test(conApodo || ''), 'pero sigue mostrando el apodo que pusiste');
// Sin posesivo: ni "Tu alias" ni "Para vos" — los dos se leían como que el alias es de uno.
ok(!/tu |para vos|you call|vous/i.test(conApodo || ''),
    'y sin posesivo, que era lo que confundía');
ok(/^alias/i.test(conApodo || ''), 'la etiqueta sola alcanza');

// Sin apodo: la invitación a ponerle uno.
const sinApodo = await lineaAlias(shortDe(OTRO));
ok(!/tu alias/i.test(sinApodo || ''), `tampoco en el estado vacío (“${sinApodo}”)`);
ok(/alias/i.test(sinApodo || ''), 'y ofrece ponerle uno');

// El texto ahora es i18n: en inglés tiene que cambiar.
await ev(`localStorage.setItem('chatwallet-lang','en')`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3000);
await esperar(`!!currentWallet`);
// "Alias" es igual en los tres idiomas; lo que tiene que cambiar es el estado vacío.
const vacioEnIngles = await lineaAlias(shortDe(OTRO));
ok(/add an alias/i.test(vacioEnIngles || ''), `y se traduce (“${vacioEnIngles}”)`);
await ev(`localStorage.setItem('chatwallet-lang','es')`);

// ─────────── 7. el modo frío vive en Configuración ───────────
console.log('\n── modo frío en Configuración ──');
await conAlto(900);
await cargar('dark');

ok(!(await ev(`!!document.getElementById('mode-toggle-btn')`)),
    'el botón de apagado ya no ocupa lugar en el header');

const abrirConfig = `(() => { const m = document.getElementById('settingsModal');
    m.classList.remove('hidden'); m.classList.add('flex'); return true; })()`;
await ev(abrirConfig); await sleep(400);

const cfg = JSON.parse(await ev(`(() => {
    const sw = document.getElementById('coldModeSwitch');
    const modal = document.getElementById('settingsModal');
    const orden = [...modal.querySelectorAll('h2[data-i18n-key], label[data-i18n-key], hr')]
        .map(e => e.tagName === 'HR' ? '───' : (e.textContent || '').trim().split('\\n')[0]);
    const y = id => { const e = document.getElementById(id); return e ? Math.round(e.getBoundingClientRect().top) : null; };
    return JSON.stringify({
        existe: !!sw,
        visible: sw ? sw.closest('label').offsetParent !== null : false,
        centrado: (() => { const l = sw && sw.closest('label'); if (!l) return null;
            const r = l.getBoundingClientRect(), p = l.parentElement.getBoundingClientRect();
            return Math.abs((r.left + r.right) / 2 - (p.left + p.right) / 2) < 3; })(),
        orden,
        yIdioma: y('settings-lang-selector'), ySwitch: y('coldModeSwitch'),
        yClaves: y('backupWalletSettingsBtn')
    });
})()`) || '{}');

ok(cfg.existe && cfg.visible, 'hay un switch de modo frío en Configuración');
ok(cfg.centrado, 'y está centrado');
ok(cfg.yIdioma < cfg.ySwitch, `va después del idioma (${cfg.yIdioma} → ${cfg.ySwitch})`);
ok(cfg.ySwitch < cfg.yClaves, `y antes de las claves (${cfg.ySwitch} → ${cfg.yClaves})`);
ok(/Modo frío/.test(cfg.orden.join(' | ')), `hay sección "Modo frío" (${cfg.orden.slice(0, 6).join(' | ')})`);
ok(/Gestión de claves/.test(cfg.orden.join(' | ')), 'y sección "Gestión de claves"');
// Cada sección con su línea: el orden tiene que ser ─── título ─── título.
const i1 = cfg.orden.findIndex(x => /Modo frío/.test(x));
const i2 = cfg.orden.findIndex(x => /Gestión de claves/.test(x));
ok(cfg.orden[i1 - 1] === '───' && cfg.orden[i2 - 1] === '───',
    'cada una precedida por su línea divisoria');

// Prender NO es directo: pasa por el modal de confirmación, y hasta confirmar sigue apagado.
await ev(`document.getElementById('coldModeSwitch').click()`);
await sleep(500);
ok(await ev(`!document.getElementById('offlineModeModal').classList.contains('hidden')`),
    'prenderlo abre la confirmación de siempre');
ok(!(await ev(`document.getElementById('coldModeSwitch').checked`)),
    'y el switch NO queda prendido hasta que se confirme');

// Traducción de las dos secciones nuevas.
await ev(`(() => { document.getElementById('offlineModeModal').classList.add('hidden');
    localStorage.setItem('chatwallet-lang','fr'); return true; })()`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3000);
await esperar(`!!document.getElementById('coldModeSwitch')`);
await ev(abrirConfig); await sleep(400);
const fr = await ev(`document.getElementById('settingsModal').innerText`);
ok(/Mode hors ligne/.test(fr || ''), 'el título del modo frío se traduce');
ok(/Gestion des clés/.test(fr || ''), 'y el de gestión de claves también');
await ev(`localStorage.setItem('chatwallet-lang','es')`);

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
