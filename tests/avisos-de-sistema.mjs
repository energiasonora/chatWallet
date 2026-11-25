// Los avisos de sistema de XMTP ('group_updated': alguien entró o salió, un dispositivo nuevo,
// la creación del DM) no son mensajes: no cambian la vista previa ni el orden de la lista.
//
// El caso real (S10+, 24/11/2026): un cambio de dispositivo metió uno en cada chat y los 17
// quedaron con `{"initiatedByInboxId":…` de vista previa, todos en "Ayer", y el chat con el
// último mensaje de verdad (macM1) dejó de estar primero.
//
// Qué se prueba, sin XMTP real (se hace fallar su arranque y se usa un cliente de mentira que
// entrega el manejador del stream, así se le pueden pasar mensajes armados a mano):
//   · un aviso que llega en vivo —propio o ajeno— no toca vista previa, fecha, no leídos ni avisa;
//   · un mensaje de verdad que llega después sí (el camino normal sigue andando);
//   · un aviso no revive un contacto borrado;
//   · al arrancar, las vistas previas que ya quedaron sucias vuelven al último mensaje de verdad
//     (con su fecha), y la lista recupera el orden.
//
// Correr:  ./tests/run-avisos-de-sistema.sh

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8848/dapp.html';
const PORT = 9401;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra !== '' ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-avisos-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=400,860', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    const errores = [];
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
    });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    // XMTP real afuera: su arranque falla en la fuente (ver tests/agenda-sin-xmtp.mjs).
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
        let real;
        Object.defineProperty(window, 'Client', { configurable: true,
            set(v) { real = v; },
            get() { return real && new Proxy(real, { get(t, k) {
                if (k === 'create') return async () => { throw new Error('XMTP afuera a propósito (test)'); };
                // El estado del inbox "en la red" lo pone la prueba (ver la sección del dispositivo dado de baja).
                if (k === 'fetchInboxStates' && window.__fetchInboxStates) return window.__fetchInboxStates;
                return Reflect.get(t, k);
            } }); } });
    })();` });
    await rpc('Page.navigate', { url: BASE });
    await sleep(1500);
    await ev(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))}); localStorage.setItem('xmtp-chat-wallet-backup-done','1'); true`);
    await rpc('Page.reload');
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof renderContacts === 'function' && typeof currentWallet !== 'undefined' && !!currentWallet`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar la wallet');
    await sleep(2500);   // que termine loadContacts (reemplaza la lista entera)

    const MAC = '0x' + '81'.repeat(20), OTRO = '0x' + '22'.repeat(20), LIMPIO = '0x' + '33'.repeat(20), BORRADO = '0x' + '44'.repeat(20);
    const H = 3600e3;
    const aviso = (inbox) => JSON.stringify({ initiatedByInboxId: inbox, addedInboxes: [], removedInboxes: [], leftInboxes: [],
        metadataFieldChanges: [], addedAdminInboxes: [], removedAdminInboxes: [], addedSuperAdminInboxes: [], removedSuperAdminInboxes: [] });

    // ── 1. Lo que ya quedó guardado: vistas previas de sistema con fecha "nueva" ──
    // macM1: su último mensaje de verdad es el más reciente de todos (hace 2 h), pero el aviso
    // (hace 1 h) le puso JSON y una fecha. OTRO: aviso más nuevo todavía (hace 30 min) sobre un
    // mensaje viejo (hace 5 h). LIMPIO: nunca tuvo aviso (hace 3 h).
    await ev(`(async () => {
        const ahora = Date.now(), H = ${H};
        const msg = (id, txt, ts, yo) => ({ id, content: txt, contentType: { typeId: 'text' }, sentAt: new Date(ts),
            senderInboxId: yo ? 'yo-inbox' : 'otro-inbox', conversationId: 'c-' + id });
        await captureXmtpMessages([msg('m1', 'debería ser el último', ahora - 2 * H, true)], '${MAC}', 'yo-inbox');
        await captureXmtpMessages([msg('o1', 'un mensaje viejo', ahora - 5 * H, false)], '${OTRO}', 'yo-inbox');
        contacts.push(
            { address: '${MAC}', name: 'macM1', lastMessage: ${JSON.stringify(aviso('yo-inbox'))}, lastMessageTimestamp: ahora - 1 * H, unreadCount: 0 },
            { address: '${OTRO}', name: 'Otro', lastMessage: ${JSON.stringify(aviso('otro-inbox'))}, lastMessageTimestamp: ahora - 0.5 * H, unreadCount: 0 },
            { address: '${LIMPIO}', name: 'Limpio', lastMessage: 'hola', lastMessageTimestamp: ahora - 3 * H, unreadCount: 0 });
        await saveContacts();
        return true; })()`);
    const lista = `[...document.querySelectorAll('#contactsListSidebar .contact-item')].map(e => e.dataset.address)`;
    const fila = (a) => `contacts.find(c => c.address === '${a}')`;
    let antes = await ev(lista);
    ok(antes[0] === OTRO && antes[1] === MAC, 'situación de partida (la del S10+): un aviso deja a otro chat arriba de macM1', antes.map(a => a.slice(0, 6)).join(' '));

    console.log('\n── al arrancar se limpia lo que quedó guardado ──');
    const n = await ev(`limpiarVistasPreviasDePlomeria()`);
    ok(n === 2, 'se limpian las dos vistas previas de sistema (y la normal no se toca)', n);
    const mac = await ev(fila(MAC)), otro = await ev(fila(OTRO)), limpio = await ev(fila(LIMPIO));
    ok(mac.lastMessage === 'debería ser el último', 'macM1 vuelve a mostrar su último mensaje de verdad', mac.lastMessage);
    ok(otro.lastMessage === 'un mensaje viejo', 'y el otro chat también', otro.lastMessage);
    ok(limpio.lastMessage === 'hola', 'el que estaba bien queda igual', limpio.lastMessage);
    let ahora = await ev(lista);
    ok(ahora[0] === MAC && ahora[1] === LIMPIO && ahora[2] === OTRO, 'y la lista vuelve al orden del último mensaje: macM1 primero', ahora.map(a => a.slice(0, 6)).join(' '));
    ok(await ev(`!document.getElementById('contactsListSidebar').textContent.includes('initiatedByInboxId')`), 'no queda ningún renglón con el JSON crudo');

    // ── 2. En vivo: un cliente de mentira entrega el manejador del stream ──
    await ev(`(async () => {
        window.maybeSendProfile = async () => { };          // no hay red a la que mandar el perfil
        window.playNewMessageSound = () => { window.__sonidos = (window.__sonidos || 0) + 1; };
        window.notifyNative = async () => { window.__nativas = (window.__nativas || 0) + 1; };
        const nada = { return() { }, end: async () => { } };
        chatwalletxmtp = { inboxId: 'yo-inbox', conversations: {
            streamAllMessages: async (o) => { window.__onValue = o.onValue; return nada; },
            stream: async () => nada,
            getConversationById: async () => null, list: async () => [] } };
        chatKeyByConvId.set('conv-mac', { key: '${MAC}', isGroup: false });
        chatKeyByConvId.set('conv-borrado', { key: '${BORRADO}', isGroup: false });
        await listenForIncomingMessages();
        return typeof window.__onValue === 'function'; })()`);
    const llega = (m) => ev(`(async () => { await window.__onValue(${m}); return true; })()`);
    const avisoMsg = (convId, inbox, id) => `{ id: '${id}', conversationId: '${convId}', senderInboxId: '${inbox}', sentAt: new Date(),
        contentType: { typeId: 'group_updated' }, content: ${aviso(inbox)} }`;

    console.log('\n── un aviso que llega en vivo ──');
    const previo = await ev(fila(MAC));
    await llega(avisoMsg('conv-mac', 'yo-inbox', 'g1'));
    await llega(avisoMsg('conv-mac', 'otro-inbox', 'g2'));
    await sleep(300);
    let d = await ev(fila(MAC));
    ok(d.lastMessage === previo.lastMessage && d.lastMessageTimestamp === previo.lastMessageTimestamp,
        'propio o ajeno, no cambia la vista previa ni la fecha', `${d.lastMessage} / ${d.lastMessageTimestamp === previo.lastMessageTimestamp}`);
    ok((d.unreadCount || 0) === 0, 'no suma no leídos', d.unreadCount);
    const ruido = await ev(`({ s: window.__sonidos || 0, n: window.__nativas || 0, t: document.querySelectorAll('.cw-notif').length })`);
    ok(ruido.s === 0 && ruido.n === 0 && ruido.t === 0, 'ni suena ni avisa', JSON.stringify(ruido));

    await ev(`(async () => { tombstones['${BORRADO}'] = { at: Date.now() - 60000 }; return true; })()`);
    await llega(avisoMsg('conv-borrado', 'otro-inbox', 'g3'));
    await sleep(300);
    ok(await ev(`!contacts.some(c => c.address === '${BORRADO}') && !!tombstones['${BORRADO}']`), 'un aviso no revive un contacto borrado');

    console.log('\n── un mensaje de verdad sigue andando como siempre ──');
    await llega(`{ id: 't1', conversationId: 'conv-mac', senderInboxId: 'otro-inbox', sentAt: new Date(),
        contentType: { typeId: 'text' }, content: 'ahora sí, nuevo' }`);
    await sleep(400);
    d = await ev(fila(MAC));
    ok(d.lastMessage === 'ahora sí, nuevo' && d.lastMessageTimestamp > previo.lastMessageTimestamp, 'cambia la vista previa y la fecha', d.lastMessage);
    ok(d.unreadCount === 1, 'cuenta como no leído', d.unreadCount);
    const ruido2 = await ev(`({ s: window.__sonidos || 0, n: window.__nativas || 0 })`);
    ok(ruido2.s === 1 && ruido2.n === 1, 'y suena y avisa', JSON.stringify(ruido2));
    ahora = await ev(lista);
    ok(ahora[0] === MAC, 'y macM1 sigue primero', ahora.map(a => a.slice(0, 6)).join(' '));

    console.log('\n── un dispositivo dado de baja se dice y se puede reconectar ──');
    // El S10+ el 25/11/2026: la cuenta con 0 instalaciones vivas en la red. Antes eso daba
    // "no sé" (null), el chat ofrecía "Reabrir" y nada avisaba que no entraba ni salía nada.
    const baja = async (respuesta) => ev(`(async () => {
        window.__reconectar = 0;
        window.cwReconectarDispositivo = () => { window.__reconectar++; };
        chatwalletxmtp.installationId = 'yo-instalacion';
        window.__fetchInboxStates = async () => { ${respuesta} };
        const viva = await cwInstalacionViva();
        await cwAvisarSiDispositivoDadoDeBaja();
        const aviso = document.getElementById('cwDispositivoBaja');
        const texto = aviso ? aviso.textContent : '';   // antes del click: el botón pasa a "…"
        if (aviso) aviso.querySelector('button').click();
        return { viva, aviso: !!aviso, enLaPila: !!aviso && aviso.parentNode.id === 'noticeStack',
                 texto, reconectar: window.__reconectar }; })()`);
    let b = await baja(`return [{ installations: [] }];`);
    ok(b.viva === false, 'con 0 instalaciones vivas en la red, este dispositivo cuenta como dado de baja (antes: null)', String(b.viva));
    ok(b.aviso && b.enLaPila && /Reconectar este dispositivo/.test(b.texto), 'y aparece el aviso fijo arriba, con el botón de reconectar', b.texto.slice(0, 80));
    ok(b.reconectar === 1, 'el botón reconecta');
    b = await baja(`return [{ installations: [{ id: 'otra' }] }];`);
    ok(b.viva === false && b.aviso, 'si están vivas sólo otras, también');
    b = await baja(`return [{ installations: [{ id: 'otra' }, { id: 'yo-instalacion' }] }];`);
    ok(b.viva === true && !b.aviso, 'si ésta está viva, no hay aviso (y se saca el que había)');
    b = await baja(`throw new Error('sin red');`);
    ok(b.viva === null && !b.aviso, 'si la red no contesta, no se asusta a nadie (null, sin aviso)');

    // Con el aviso de arriba ya puesto, abrir un chat que falla con "inactive" no agrega otro
    // (salían dos, uno encima del otro: captura del S10+ del 25/11/2026).
    const doble = await ev(`(async () => {
        window.__fetchInboxStates = async () => [{ installations: [] }];
        await cwAvisarSiDispositivoDadoDeBaja();
        await cwAvisarChatSinSync({ id: 'conv-x' }, new Error('Group is inactive'), chatOpenToken);
        const reconectar = [...document.querySelectorAll('button')].filter(x => /Reconectar este dispositivo/.test(x.textContent));
        return { botones: reconectar.length, delChat: !!document.getElementById('cwChatSinSync'), arriba: !!document.getElementById('cwDispositivoBaja') }; })()`);
    ok(doble.botones === 1 && !doble.delChat && doble.arriba, 'con el chat abierto, el aviso de dado de baja sale una sola vez', JSON.stringify(doble));
    const soloChat = await ev(`(async () => {
        document.getElementById('cwDispositivoBaja')?.remove();
        await cwAvisarChatSinSync({ id: 'conv-y' }, new Error('Group is inactive'), chatOpenToken);
        const reconectar = [...document.querySelectorAll('button')].filter(x => /Reconectar este dispositivo/.test(x.textContent));
        return { botones: reconectar.length, arriba: !!document.getElementById('cwDispositivoBaja') }; })()`);
    ok(soloChat.botones === 1 && soloChat.arriba, 'y si el chat lo descubre primero, pone el de arriba (no uno propio)', JSON.stringify(soloChat));

    console.log('\n── la línea 🤝 cuenta el comienzo del contacto, no una reconexión ──');
    // S10+, 25/11/2026: tras reconectar el dispositivo, el DM se rearmó y en medio del chat con
    // macM1 apareció "🤝 Entraste por su enlace de invitación · 02:43".
    const hs = await ev(`(() => {
        currentChatContact = contacts.find(c => c.address === '${MAC}');
        localStorage.setItem('cw-par-origen-${MAC}', 'link');
        const creacion = (id) => ({ id, contentType: { typeId: 'group_updated' }, senderInboxId: 'yo-inbox',
            sentAtNs: BigInt(Date.now()) * 1000000n,
            content: { initiatedByInboxId: 'yo-inbox', addedInboxes: [{ inboxId: 'otro-inbox' }], removedInboxes: [], leftInboxes: [], metadataFieldChanges: [] } });
        const texto = (id, txt) => ({ id, contentType: { typeId: 'text' }, senderInboxId: 'otro-inbox', content: txt,
            sentAt: new Date(), sentAtNs: BigInt(Date.now()) * 1000000n });
        const lineas = () => [...messagesContainer.querySelectorAll('.handshake-message')].map(e => e.textContent);
        // Un contacto que recién empieza: el evento de creación es lo primero del hilo.
        messagesContainer.innerHTML = ''; processedMessages.clear(); handshakeShownInChat = false;
        addMessageToUI(creacion('hs-1'), 'sent');
        addMessageToUI(texto('tx-1', 'hola'), 'received');
        const nuevo = lineas();
        // Un par de siempre, con el DM rearmado: hay historial antes del evento.
        messagesContainer.innerHTML = ''; processedMessages.clear(); handshakeShownInChat = false;
        addMessageToUI(texto('tx-2', 'un mensaje de hace días'), 'received');
        addMessageToUI(creacion('hs-2'), 'sent');
        addMessageToUI(texto('tx-3', 'yes'), 'received');
        const rearmado = lineas();
        return { nuevo, rearmado }; })()`);
    ok(hs.nuevo.length === 1 && /enlace de invitación/.test(hs.nuevo[0]), 'en un contacto nuevo la línea 🤝 sale (con su origen)', JSON.stringify(hs.nuevo));
    ok(hs.rearmado.length === 0, 'con historial antes, un DM rearmado no inventa "Entraste por su enlace"', JSON.stringify(hs.rearmado));

    console.log('\n── el respaldo no vuelve a ensuciarla ──');
    ok(await ev(`esVistaPreviaDeSistema(${JSON.stringify(aviso('x'))}) && !esVistaPreviaDeSistema('hola') && !esVistaPreviaDeSistema('{"cw":1}')`),
        'reconoce una vista previa de sistema y nada más');
    ok(errores.length === 0, 'sin errores de JS en la página', errores.slice(0, 3).join(' | '));
} catch (e) {
    console.log('💥', e.message); fails++;
} finally {
    try { ws?.close(); } catch { }
    proc.kill();
}
console.log(fails ? `\n${fails} fallas` : '\ntodo bien');
process.exit(fails ? 1 : 0);
