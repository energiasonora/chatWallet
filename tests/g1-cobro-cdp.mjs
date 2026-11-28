// Ğ1 que entra por fuera del chat (Ğecko, Cesium², el QR de un puesto): la app abierta
// tiene que sonar, avisar quién pagó y con qué comentario, y actualizar el saldo.
//
// El indexador y la cadena Ğ1 se simulan; los pagos se "hacen" agregando transferencias
// a window.__g1tr. Todo lo demás es la app real (build de Parcel).
// Correr:  TEST=tests/g1-cobro-cdp.mjs ./tests/run-g1-red.sh   (SKIP_BUILD=1 para no rebuildear)

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const PORT = 9405;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const W = Wallet.createRandom();
const MIA = 'g1LaNkwMqD9HaEMiWWUDrgXggJWybtTLMjCRMxa37H5uBehHn';
const XUN = 'g1Pb8LtH4vn5XMHAYQVaBGVmLXU3UQxw6zdhf6C4NE1HcDyWW';
const OTRA = 'g1QG8aBiND8vY7sF32a1uZ6QMvwVbvAGCa1w7uM5kWvLaP6qQ';
const ANON = 'g1NtrhnuauXfjqkTohrh6uNFiCJyWACz4Pf6ort6CoHb4JG89';
// Quien paga desde su ChatWallet y publicó el vínculo ius1 (sección J): lo firma su 0x.
const VINC = 'g1QgzWbj65W7fLNvRL5JzsrgCxhmdLxPEk2judtwbrxpWnPPG';
const EVM_V = Wallet.createRandom();
const firmaV = Buffer.from((await EVM_V.signMessage('Ius Naturalis · vinculo Ğ1 · v1\nEVM: ' + EVM_V.address.toLowerCase() + '\nG1: ' + VINC)).slice(2), 'hex');
const COMENTARIO_V = { remark: 'ius1:' + Buffer.concat([Buffer.from(EVM_V.address.slice(2), 'hex'), firmaV]).toString('base64url'),
    blockNumber: 3714920, authorId: VINC, event: { extrinsic: { hash: '0xabc', success: true } } };

const FALSO = `(() => {
    const MIA = ${JSON.stringify(MIA)};
    // Transferencias (de la más vieja a la más nueva) y saldo: sobreviven a las recargas,
    // como en la red de verdad.
    let guardado = {};
    try { guardado = JSON.parse(localStorage.getItem('__g1falso') || '{}'); } catch (e) { }
    window.__g1tr = guardado.tr || [];
    window.__saldo = guardado.saldo || 1000;
    window.__g1guardar = () => { try { localStorage.setItem('__g1falso', JSON.stringify({ tr: window.__g1tr, saldo: window.__saldo })); } catch (e) { } };
    window.__g1consultas = 0;
    window.__g1comentarios = [${JSON.stringify(COMENTARIO_V)}];
    const cadena = {
        saldo: async () => ({ saldo: window.__saldo, pendiente: 0 }),
        identidad: async () => null,
    };
    Object.defineProperty(window, 'cwCargarCadenaG1', { configurable: true, get: () => async () => cadena, set: () => { } });
    const real = window.fetch.bind(window);
    const json = (data) => new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
    window.fetch = async (url, opts) => {
        if (/squid/.test(String(url)) && opts && opts.body) {
            window.__g1consultas++;
            const b = JSON.parse(opts.body), q = b.query, v = b.variables || {};
            if (/transfers\\(first/.test(q)) {
                window.__g1historial = (window.__g1historial || 0) + 1;
                const mias = window.__g1tr.filter(t => t.fromId === v.id || t.toId === v.id).slice().reverse().slice(0, v.n || 50);
                return json({ transfers: { totalCount: mias.length, pageInfo: { hasNextPage: false, endCursor: null }, nodes: mias } });
            }
            if (/accounts\\(filter/.test(q)) return json({ accounts: { nodes: [{ id: v.id || MIA, balance: String(window.__saldo), identity: null }] } });
            if (/identityByAccountId/.test(q)) return json({ identityByAccountId: null, blocks: { nodes: [{ height: 3814751, timestamp: new Date().toISOString() }] } });
            if (/universalDividends/.test(q)) return json({ universalDividends: { nodes: [] } });
            if (/txComments/.test(q)) return json({ txComments: { nodes: (window.__g1comentarios || []).filter(n => v.id && n.authorId === v.id) } });
        }
        return real(url, opts);
    };
})();`;

let bloque = 3814700;
const tr = (fromId, toId, amount, remark, nombre) => ({
    id: `000${++bloque}-abcde-000001`, blockNumber: bloque, timestamp: new Date().toISOString(), amount: String(amount),
    fromId, toId, from: { identity: nombre ? { name: nombre } : null }, to: { identity: null }, comment: remark ? { remark } : null,
});

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1cobro-');
// Chrome headless se cae a veces a mitad de una sesión larga (también sin estos cambios: ver
// g1-red-cdp). La billetera y los pagos falsos viven en el perfil (localStorage), así que
// entre secciones se lo reabre con el mismo perfil y se sigue.
let proc, ws, id = 0; const pend = new Map();
async function abrirChrome() {
    try { proc?.kill(); } catch { }
    await sleep(500);
    proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
        `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
    ws = null;
    for (let i = 0; i < 200 && !ws; i++) {
        await sleep(300);
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    ws.addEventListener('close', () => console.log('⚠️ se cerró la conexión con Chrome'));
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: FALSO });
}
// Con tope: si Chrome se cae, la llamada falla en vez de colgar la prueba.
const rpc = (method, params = {}) => new Promise(res => {
    if (!ws || ws.readyState !== 1) return res({ result: { exceptionDetails: { text: `Chrome caído (${method})` } } });
    const i = ++id;
    const reloj = setTimeout(() => { pend.delete(i); res({ result: { exceptionDetails: { text: `sin respuesta a ${method}` } } }); }, 30000);
    pend.set(i, (m) => { clearTimeout(reloj); res(m); });
    ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (expr) => {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
    return r.result?.result?.value;
};
// Al empezar una sección: si Chrome se cayó, reabrirlo y recargar la app.
async function seccion(titulo) {
    console.log(`\n── ${titulo} ──`);
    if (ws && ws.readyState === 1) return;
    console.log('↻ reabriendo Chrome');
    await abrirChrome();
    await rpc('Page.navigate', { url: BASE });
    for (let i = 0; i < 120; i++) { await sleep(500); try { if (await ev(`!!(currentWallet && currentWallet.address)`)) break; } catch { } }
}
try {
    await abrirChrome();
    const listo = async (cond, seg = 60) => {
        for (let i = 0; i < seg * 2; i++) { await sleep(500); try { if (await ev(cond)) return true; } catch { } }
        return false;
    };
    const pagar = (t) => ev(`window.__g1tr.push(${JSON.stringify(t)}); window.__g1guardar(); true`);
    const avisos = () => ev(`[...document.querySelectorAll('.cw-notif[data-tag="g1-cobro"]')].filter(n => !n.dataset.out).map(n => ({
        t: n.querySelector('.cwn-title')?.textContent || '', b: n.querySelector('.cwn-body')?.textContent || '',
        html: n.querySelector('.cwn-body')?.innerHTML || '' }))`);
    const limpiar = () => ev(`document.querySelectorAll('.cw-notif[data-tag="g1-cobro"]').forEach(n => n.remove()); true`);
    const vigilar = () => ev(`window.cwVigilarCobrosG1()`);
    const saldo = () => ev(`document.getElementById('balanceDisplay').textContent.trim()`);

    // ── A) billetera SIN Ğ1: nada de consultas ────────────────────────────────
    await rpc('Page.navigate', { url: BASE });
    await listo(`typeof saveContacts === 'function'`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(W.privateKey)}); localStorage.setItem('chatwallet-lang', 'es')`);
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'la wallet carga');
    await seccion('A) sin cuenta Ğ1');
    await sleep(8000);
    ok(await ev(`window.__g1consultas`) === 0, 'una billetera sin Ğ1 no le pregunta nada al indexador', String(await ev(`window.__g1consultas`)));

    // ── B) con cuenta Ğ1 y la red Ğ1 elegida ──────────────────────────────────
    await seccion('B) primera vez: sólo siembra');
    await pagar(tr(XUN, MIA, 200, 'solo wallet', 'Xunorus'));             // cobro VIEJO (25/11)
    await pagar(tr(MIA, OTRA, 500, 'pan', null));                         // un pago que hice yo
    await ev(`localStorage.setItem('cw-g1-cuenta-' + currentWallet.address.toLowerCase(), JSON.stringify({ g1: ${JSON.stringify(MIA)}, ruta: '' }));
              localStorage.setItem('cw-red-g1-' + currentWallet.address.toLowerCase(), '1')`);
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'recarga');
    ok(await listo(`document.getElementById('balanceDisplay').textContent.trim() === '10,00 Ğ1'`, 20), 'saldo 10,00 Ğ1', await saldo());
    // Un toque cualquiera habilita el audio (los navegadores no dejan sonar sin uno).
    await rpc('Input.dispatchMouseEvent', { type: 'mousePressed', x: 5, y: 450, button: 'left', clickCount: 1 });
    await rpc('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 5, y: 450, button: 'left', clickCount: 1 });
    ok(await listo(`toneStarted && !!clickSynth`, 10), 'el audio quedó habilitado');
    await ev(`window.__notas = []; const o = clickSynth.triggerAttackRelease.bind(clickSynth);
              clickSynth.triggerAttackRelease = (n, ...r) => { window.__notas.push(n); return o(n, ...r); }; true`);
    ok(await listo(`!!localStorage.getItem('cw-g1-cobros-vistos-' + currentWallet.address.toLowerCase())`, 15), 'el vigía arranca solo y siembra lo visto');
    const sem = await ev(`JSON.parse(localStorage.getItem('cw-g1-cobros-vistos-' + currentWallet.address.toLowerCase()))`);
    ok(sem.g1 === MIA && sem.ids.length === 1, 'siembra sólo el cobro (no el pago saliente)', JSON.stringify(sem));
    ok((await avisos()).length === 0, 'no avisa el cobro viejo');
    ok((await ev(`window.__notas.length`)) === 0, 'ni suena');

    await seccion('C) entra un pago desde Ğecko');
    await pagar(tr(XUN, MIA, 200, 'test', 'Xunorus'));
    await ev(`window.__saldo = 1200; window.__g1guardar(); true`);
    await vigilar();
    let a = await avisos();
    ok(a.length === 1, 'aparece un aviso', JSON.stringify(a));
    ok(a[0]?.t === '💰 Recibiste 2,00 Ğ1', 'título con el monto', a[0]?.t);
    ok(a[0]?.b === 'de Xunorus · «test»', 'quién pagó y el comentario', a[0]?.b);
    ok(JSON.stringify(await ev(`window.__notas`)) === '["E5","B5"]', 'suena (dos notas, distinto del mensaje)', JSON.stringify(await ev(`window.__notas`)));
    ok(await listo(`document.getElementById('balanceDisplay').textContent.trim() === '12,00 Ğ1'`, 10), 'el saldo se actualiza solo', await saldo());

    await seccion('D) no repite');
    await limpiar(); await ev(`window.__notas = []; true`);
    await vigilar();
    ok((await avisos()).length === 0 && (await ev(`window.__notas.length`)) === 0, 'el mismo pago no se vuelve a avisar');
    await pagar(tr(MIA, OTRA, 300, 'yerba', null));
    await vigilar();
    ok((await avisos()).length === 0, 'un pago que mando yo no avisa');

    await seccion('E) comentario con HTML + contacto conocido');
    await pagar(tr(ANON, MIA, 150, '<img src=x onerror="window.__xss=1">miel', null));
    await vigilar();
    a = await avisos();
    ok(a[0]?.b === `de ${ANON.slice(0, 6)}…${ANON.slice(-4)} · «<img src=x onerror="window.__xss=1">miel»`, 'sin seudónimo: la cuenta recortada; el HTML queda como texto', a[0]?.b);
    ok(!/<img/.test(a[0]?.html || '') && !(await ev(`!!window.__xss`)), 'no se ejecuta nada');
    await limpiar();
    await ev(`contacts.push({ address: '0x000000000000000000000000000000000000dEaD', name: 'Amiga del puesto', g1: ${JSON.stringify(OTRA)} }); true`);
    await pagar(tr(OTRA, MIA, 5000, null, 'SeudonimoG1'));
    await vigilar();
    a = await avisos();
    ok(a[0]?.t === '💰 Recibiste 50,00 Ğ1' && a[0]?.b === 'de Amiga del puesto', 'si es un contacto, su nombre (y sin comentario, sin comillas)', JSON.stringify(a[0]));

    await seccion('F) varios juntos');
    await limpiar();
    await pagar(tr(XUN, MIA, 100, 'uno', 'Xunorus'));
    await pagar(tr(ANON, MIA, 250, 'dos', null));
    await vigilar();
    a = await avisos();
    ok(a.length === 1 && a[0].t === '💰 Recibiste 2 pagos: 3,50 Ğ1', 'un solo aviso con el total', JSON.stringify(a));
    ok(a[0]?.b === `de ${ANON.slice(0, 6)}…${ANON.slice(-4)} · «dos»`, 'nombra el último', a[0]?.b);

    await seccion('G) lo que entró con la app cerrada');
    await pagar(tr(XUN, MIA, 15000, 'CPS-ABCDE', 'Xunorus'));
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'reabre');
    ok(await listo(`[...document.querySelectorAll('.cw-notif[data-tag="g1-cobro"]')].some(n => /150,00 Ğ1/.test(n.textContent))`, 20), 'al abrir avisa el cobro que entró mientras tanto (sin tocar nada)');

    await seccion('I) ritmo: seguido sólo con la red Ğ1 en pantalla');
    const vueltas = () => ev(`window.__g1historial || 0`);
    const tic = (haceSeg) => ev(`g1VigiaUltima = Date.now() - ${haceSeg * 1000}; window.cwVigiaTicG1()`);
    ok(await tic(21) === true, 'con la red Ğ1 en pantalla: cada 20 s');
    ok(await tic(10) === false, '…y no antes');
    await ev(`localStorage.removeItem('cw-red-g1-' + currentWallet.address.toLowerCase()); true`);
    ok(await tic(21) === false, 'en otra red: a los 20 s no pregunta');
    ok(await tic(121) === true, 'en otra red: cada 2 minutos');
    await ev(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); true`);
    const antes = await vueltas();
    ok(await tic(3600) === false, 'la web en segundo plano no pregunta (no es el APK)');
    await sleep(500);
    ok(await vueltas() === antes, 'ni una consulta', `${antes} → ${await vueltas()}`);
    await ev(`delete document.hidden; localStorage.setItem('cw-red-g1-' + currentWallet.address.toLowerCase(), '1'); true`);

    await seccion('J) tocar el aviso abre el chat de quien pagó');
    await ev(`window.__abiertos = []; window.__escaneados = [];
              startChatWithContact = async (c) => { window.__abiertos.push(c.address); };
              handleScannedAddress = async (a) => { window.__escaneados.push(a); contacts.push({ address: a, name: shortAddr(a) }); };
              if (!contacts.some(c => c.g1 === ${JSON.stringify(OTRA)})) contacts.push({ address: '0x000000000000000000000000000000000000dEaD', name: 'Amiga del puesto', g1: ${JSON.stringify(OTRA)} });
              true`);
    const tocar = () => ev(`document.querySelector('.cw-notif[data-tag="g1-cobro"]').click(); true`);
    await limpiar();
    await pagar(tr(OTRA, MIA, 100, null, 'SeudonimoG1'));
    await vigilar();
    await tocar();
    ok(await listo(`window.__abiertos.length === 1`, 5) && (await ev(`window.__abiertos[0]`)) === '0x000000000000000000000000000000000000dEaD', 'contacto con esa cuenta Ğ1: abre su chat', JSON.stringify(await ev(`window.__abiertos`)));
    await limpiar();
    await pagar(tr(VINC, MIA, 200, 'desde mi ChatWallet', 'Vecina'));
    await vigilar();
    ok((await avisos())[0]?.b === 'de Vecina · «desde mi ChatWallet»', 'sin contacto: el seudónimo Ğ1', (await avisos())[0]?.b);
    await tocar();
    ok(await listo(`window.__escaneados.length === 1`, 10), 'sin contacto pero con vínculo en la cadena: abre el chat con su 0x', JSON.stringify(await ev(`window.__escaneados`)));
    ok((await ev(`window.__escaneados[0]`) || '').toLowerCase() === EVM_V.address.toLowerCase(), '…la 0x del vínculo firmado');
    const nuevo = await ev(`(() => { const c = contacts.find(x => x.address.toLowerCase() === ${JSON.stringify(EVM_V.address.toLowerCase())}); return c && { g1: c.g1, name: c.name }; })()`);
    ok(nuevo?.g1 === VINC && nuevo?.name === 'Vecina', 'el contacto nuevo queda con su cuenta Ğ1 y su seudónimo', JSON.stringify(nuevo));
    await limpiar();
    await pagar(tr(VINC, MIA, 300, 'otra vez', 'Vecina'));
    await vigilar();
    await tocar();
    ok(await listo(`window.__abiertos.length === 2`, 5) && (await ev(`window.__escaneados.length`)) === 1, 'la segunda vez ya es un contacto: abre directo');
    await limpiar();
    await pagar(tr(ANON, MIA, 100, null, null));
    await vigilar();
    await tocar();
    ok(await listo(`[...document.querySelectorAll('.cw-notif')].some(n => /no tiene una ChatWallet vinculada/.test(n.textContent))`, 10), 'sin ChatWallet: lo dice');
    ok((await ev(`window.__abiertos.length`)) === 2 && (await ev(`window.__escaneados.length`)) === 1, '…y no abre ningún chat');

    await seccion('H) en francés');
    await ev(`localStorage.setItem('chatwallet-lang', 'fr'); true`);
    await limpiar();
    await pagar(tr(XUN, MIA, 200, 'merci', 'Xunorus'));
    await vigilar();
    a = await avisos();
    ok(a[0]?.t === '💰 Vous avez reçu 2,00 Ğ1' && a[0]?.b === 'de Xunorus · « merci »', 'texto en francés', JSON.stringify(a[0]));
} catch (e) {
    console.error('💥', e);
    fails++;
} finally {
    try { ws?.close(); } catch { }
    try { proc?.kill(); } catch { }
    await sleep(1000);   // Chrome sigue escribiendo su carpeta un instante después de morir
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(fails ? `\n❌ ${fails} fallas` : '\n✅ todo en verde');
process.exit(fails ? 1 : 0);
