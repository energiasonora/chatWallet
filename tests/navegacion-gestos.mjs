// Navegar con el dedo: principal → agenda → chat. Izquierda avanza, derecha vuelve, un nivel por gesto.
//
// Qué se espera:
//   · en el chat, deslizar a la DERECHA (en cualquier parte, también arrancando sobre una burbuja)
//     vuelve a la agenda; mientras el dedo se mueve, el chat lo sigue y deja ver la agenda debajo;
//   · un arrastre corto y lento se arrepiente: el chat vuelve a su lugar y no queda nada pegado;
//   · deslizar una burbuja a la IZQUIERDA sigue siendo responder (y ya no a la derecha);
//   · en el chat, deslizar a la izquierda fuera de las burbujas no abre la agenda encima;
//   · con la agenda abierta, deslizar a la izquierda reabre el último chat (y su fila está marcada);
//   · principal ←← = último chat; sin último chat, ← en la agenda no hace nada;
//   · la flecha ← y el botón atrás de Android hacen lo mismo que el gesto: chat → agenda.
//
// Correr:  ./tests/run-navegacion-gestos.sh

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8847/dapp.html';
const PORT = 9400;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
let bajoElDedo = '';   // qué había debajo del último toque (para entender una falla)
const ok = (c, m, extra = '') => {
    console.log(`${c ? '✅' : '❌'} ${m}${extra !== '' ? ' — ' + extra : ''}`);
    if (!c) { fails++; console.log('     debajo del dedo:', bajoElDedo); }
    return c;
};

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-nav-');
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
    await rpc('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await rpc('Page.navigate', { url: BASE });
    await sleep(1500);
    await ev(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))}); localStorage.setItem('xmtp-chat-wallet-backup-done','1'); true`);
    await rpc('Page.reload');
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof closeSidebar === 'function' && typeof currentWallet !== 'undefined' && !!currentWallet`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar la wallet');
    // Que termine de cargar la agenda guardada (loadContacts reemplaza la lista entera).
    await sleep(3000);
    await ev(`modalesALaVista().forEach(x => { x.m.classList.add('hidden'); x.m.classList.remove('flex'); }); true`);
    await sleep(300);

    // Dos contactos de mentira y un chat sin XMTP: el gesto no depende de la red, así que
    // startChatWithContact se reemplaza por uno que hace lo mismo que el real hasta mostrar el
    // chat (anota el último, muestra la vista) y pone una burbuja con sus gestos de verdad.
    await ev(`(async () => {
        const ANA = '0x' + 'a1'.repeat(20), BETO = '0x' + 'b2'.repeat(20);
        contacts.push({ address: ANA, name: 'Ana', lastMessage: 'hola', lastMessageTimestamp: Date.now() - 1000 },
                      { address: BETO, name: 'Beto', lastMessage: 'chau', lastMessageTimestamp: Date.now() - 5000 });
        await saveContacts();   // guardados: si la app relee la agenda, siguen ahí
        window.__abiertos = []; window.__respuestas = [];
        window.startReply = (msgId) => { __respuestas.push(msgId); };
        window.startChatWithContact = async (c) => {
            __abiertos.push(c.address);
            currentChatContact = c;
            recordarUltimoChat(c.address);
            chattingWithEl.textContent = c.name;
            messagesContainer.innerHTML = '';
            const row = document.createElement('div');
            row.className = 'flex justify-start mb-2'; row.id = 'filaBurbuja';
            const b = document.createElement('div');
            b.className = 'p-3 rounded-lg bg-gray-700 max-w-[80%]'; b.textContent = 'un mensaje para deslizar';
            row.appendChild(b); messagesContainer.appendChild(row);
            attachMessageGestures(row, b, 'm1');
            showView('chatView');
        };
        return true; })()`);

    const toque = (type, x, y) => rpc('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    async function arrastrar(x0, x1, y, pasos = 12, pausa = 30, { soltar = true, mirarEn, mirar } = {}) {
        let visto;
        // Los avisos de la app (conectando el chat, etc.) aparecen arriba cuando quieren, y
        // deslizar sobre uno lo descarta en vez de navegar —está bien que así sea—: fuera de la prueba.
        await ev(`document.querySelectorAll('.cw-notif').forEach(n => n.remove()); true`);
        bajoElDedo = await ev(`(() => { const el = document.elementFromPoint(${x0}, ${y});
            const d = el ? (el.tagName + '#' + el.id + '.' + String(el.className).slice(0, 60)) : 'nada';
            return d + ' · notif=' + !!el?.closest?.('.cw-notif') + ' · modales=' + modalesALaVista().map(x => x.m.id).join(',')
                + ' · vista=' + document.querySelector('.view.active')?.id + ' · agenda=' + contactsSidebar.classList.contains('active'); })()`);
        await toque('touchStart', x0, y);
        for (let i = 1; i <= pasos; i++) {
            await toque('touchMove', x0 + (x1 - x0) * i / pasos, y + i * 0.3);
            await sleep(pausa);
            if (mirarEn === i) visto = await ev(mirar);
        }
        if (soltar) { await toque('touchEnd'); await sleep(450); }
        return visto;
    }
    const estado = `(() => {
        const s = document.getElementById('contactsSidebar');
        const capa = document.querySelector('#app-shell > .flex.flex-1');
        const telon = document.getElementById('cwTelonChat');
        const marcadas = [...document.querySelectorAll('#contactsListSidebar .contact-item.cw-ultimo-chat')].map(e => e.dataset.address);
        return { vista: document.querySelector('.view.active')?.id, agenda: s.classList.contains('active'),
                 agendaX: Math.round(s.getBoundingClientRect().left),
                 telon: !!telon, telonTr: telon ? telon.style.transform : '', telonFondo: telon ? telon.style.background : '',
                 capaTr: capa.style.transform, capaZ: capa.style.zIndex, headerZ: appHeader.style.zIndex,
                 bodyFondo: getComputedStyle(document.body).backgroundColor,
                 marcadas, ultimo: localStorage.getItem('cw-ultimo-chat'),
                 abiertos: [...__abiertos], respuestas: [...__respuestas],
                 filaTr: document.getElementById('filaBurbuja')?.style.transform || '',
                 modales: modalesALaVista().map(x => x.m.id) }; })()`;
    const ANA = '0x' + 'a1'.repeat(20), BETO = '0x' + 'b2'.repeat(20);
    const fila = async (addr) => ev(`(() => { const r = document.querySelector('#contactsListSidebar .contact-item[data-address="${addr}"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const yHeaderChat = async () => ev(`(() => { const r = document.getElementById('chattingWith').getBoundingClientRect(); return r.top + r.height / 2; })()`);
    const yBurbuja = async () => ev(`(() => { const r = document.getElementById('filaBurbuja').getBoundingClientRect(); return r.top + r.height / 2; })()`);

    console.log('\n── abrir un chat desde la agenda marca su fila ──');
    await arrastrar(330, 150, 420, 10, 20);
    let p = await ev(estado);
    ok(p.agenda && p.vista === 'walletView', 'principal ← abre la agenda (como antes)');
    ok(p.marcadas.length === 0, 'sin último chat no hay ninguna fila marcada', JSON.stringify(p.marcadas));
    await ev(`document.querySelector('#contactsListSidebar .contact-item[data-address="${ANA}"] .flex-grow').click(); true`);
    await sleep(500);
    p = await ev(estado);
    ok(p.vista === 'chatView' && !p.agenda, 'tocar a Ana abre su chat', `${p.vista}, agenda=${p.agenda}`);
    ok(p.ultimo === ANA && p.marcadas.length === 1 && p.marcadas[0] === ANA, 'Ana queda como último chat y su fila marcada', JSON.stringify(p.marcadas));

    console.log('\n── chat → deslizar a la derecha vuelve a la agenda, siguiendo al dedo ──');
    let y = await yHeaderChat();
    const medio = await arrastrar(40, 200, y, 10, 40, { soltar: false, mirarEn: 10, mirar: estado });
    ok(medio && medio.telon && /translateX\(1[56]\dpx\)/.test(medio.telonTr), 'a mitad del gesto el chat se corrió con el dedo', medio && medio.telonTr);
    ok(medio && medio.capaTr === medio.telonTr && medio.capaZ === '45' && medio.headerZ === '45', 'header y contenido se mueven juntos, por encima de la agenda', medio && `${medio.capaTr} z=${medio.capaZ}/${medio.headerZ}`);
    ok(medio && medio.agenda && medio.agendaX < 390 && medio.vista === 'chatView', 'y debajo ya está la agenda abierta', medio && `x=${medio.agendaX}`);
    ok(medio && medio.telonFondo && medio.telonFondo.replace(/\s/g, '') === medio.bodyFondo.replace(/\s/g, ''), 'el telón tiene el fondo de la app (opaco)', medio && `${medio.telonFondo} / ${medio.bodyFondo}`);
    if (process.env.SHOT_DIR) {
        const s = await rpc('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(process.env.SHOT_DIR + '/volver-a-mitad.png', Buffer.from(s.result.data, 'base64'));
    }
    await toque('touchEnd'); await sleep(600);
    p = await ev(estado);
    ok(p.vista === 'walletView' && p.agenda, 'al soltar queda la agenda sobre la principal', `${p.vista}, agenda=${p.agenda}`);
    ok(!p.telon && !p.capaTr && !p.capaZ && !p.headerZ, 'y no queda nada del gesto pegado (telón, capas)', JSON.stringify({ t: p.telon, tr: p.capaTr, z: p.capaZ, h: p.headerZ }));
    ok(p.agendaX <= 390 - 300, 'la agenda quedó entera en su lugar', `x=${p.agendaX}`);
    ok(await ev(`currentConversation === null`), 'y el chat se cerró de verdad (sin conversación activa)');
    if (process.env.SHOT_DIR) {
        const s = await rpc('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(process.env.SHOT_DIR + '/volver-agenda.png', Buffer.from(s.result.data, 'base64'));
    }

    console.log('\n── agenda ← reabre el último chat ──');
    const fa = await fila(ANA);
    const tirando = await arrastrar(300, 230, fa.y, 6, 30, { soltar: false, mirarEn: 6,
        mirar: `document.querySelector('#contactsListSidebar .contact-item[data-address="${ANA}"]').style.transform` });
    ok(/translateX\(-\d+/.test(tirando || ''), 'mientras se tira, la fila del último chat acompaña al dedo', tirando);
    await toque('touchEnd'); await sleep(500);
    p = await ev(estado);
    ok(p.vista === 'chatView' && !p.agenda && p.abiertos.at(-1) === ANA, 'al soltar se reabre el chat de Ana', `${p.vista}, ${p.abiertos.at(-1)}`);

    console.log('\n── en el chat: las burbujas ──');
    y = await yBurbuja();
    await arrastrar(300, 200, y, 8, 25);
    p = await ev(estado);
    ok(p.respuestas.at(-1) === 'm1' && p.vista === 'chatView' && !p.agenda, 'burbuja ← = responder (y el chat sigue ahí)', JSON.stringify(p.respuestas));
    const resp = p.respuestas.length;
    const sobreBurbuja = await arrastrar(60, 220, y, 10, 30, { soltar: false, mirarEn: 10, mirar: estado });
    ok(sobreBurbuja && sobreBurbuja.telon && !sobreBurbuja.filaTr, 'burbuja → no mueve la burbuja: es volver', sobreBurbuja && `tr=${sobreBurbuja.filaTr}`);
    await toque('touchEnd'); await sleep(600);
    p = await ev(estado);
    ok(p.vista === 'walletView' && p.agenda && p.respuestas.length === resp, 'y al soltar vuelve a la agenda, sin responder', `${p.vista}, respuestas=${p.respuestas.length}`);

    console.log('\n── en el chat: lo que NO tiene que hacer nada ──');
    await ev(`startChatWithContact(contacts.find(c => c.address === '${ANA}')); closeSidebar(); true`); await sleep(400);
    y = await yHeaderChat();
    await arrastrar(330, 150, y, 10, 20);
    p = await ev(estado);
    ok(p.vista === 'chatView' && !p.agenda, '← fuera de las burbujas no abre la agenda encima del chat', `${p.vista}, agenda=${p.agenda}`);
    await arrastrar(60, 100, y, 10, 70);
    p = await ev(estado);
    ok(p.vista === 'chatView' && !p.agenda && !p.telon && !p.capaTr && !p.headerZ, 'un → corto y lento se arrepiente: el chat vuelve y no queda nada pegado', JSON.stringify({ v: p.vista, a: p.agenda, t: p.telon, tr: p.capaTr }));
    await toque('touchStart', 200, 500);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', 200 + i * 3, 500 - i * 25); await sleep(20); }
    await toque('touchEnd'); await sleep(450);
    p = await ev(estado);
    ok(p.vista === 'chatView' && !p.telon, 'un scroll vertical (con algo de desvío) no cierra el chat');

    console.log('\n── la flecha y el botón atrás: mismo destino que el gesto ──');
    await ev(`startChatWithContact(contacts.find(c => c.address === '${BETO}')); true`); await sleep(400);
    await ev(`document.getElementById('backToContactsBtn').click(); true`); await sleep(500);
    p = await ev(estado);
    ok(p.vista === 'walletView' && p.agenda, 'la flecha ← del chat vuelve a la agenda');
    ok(p.marcadas.length === 1 && p.marcadas[0] === BETO, 'y la marca pasó a Beto', JSON.stringify(p.marcadas));
    await ev(`startChatWithContact(contacts.find(c => c.address === '${BETO}')); closeSidebar(); true`); await sleep(400);
    await ev(`manejarBotonAtras(); true`); await sleep(400);
    p = await ev(estado);
    ok(p.vista === 'walletView' && p.agenda, 'el botón atrás de Android en el chat también va a la agenda', `${p.vista}, agenda=${p.agenda}`);
    await ev(`manejarBotonAtras(); true`); await sleep(400);
    p = await ev(estado);
    ok(p.vista === 'walletView' && !p.agenda, 'y otro atrás cierra la agenda');

    console.log('\n── principal ←← = último chat ──');
    await arrastrar(330, 150, 420, 10, 20);
    await arrastrar(330, 180, 420, 6, 20);
    p = await ev(estado);
    ok(p.vista === 'chatView' && p.abiertos.at(-1) === BETO, 'dos ← desde la principal abren el último chat (Beto)', `${p.vista}, ${p.abiertos.at(-1)}`);
    await ev(`localStorage.removeItem('cw-ultimo-chat'); volverDelChat(); renderContacts(); true`); await sleep(400);
    const antes = (await ev(estado)).abiertos.length;
    await arrastrar(330, 180, 420, 6, 20);
    p = await ev(estado);
    ok(p.agenda && p.vista === 'walletView' && p.abiertos.length === antes, 'sin último chat, ← en la agenda no hace nada', `agenda=${p.agenda}, abiertos=${p.abiertos.length - antes}`);

    console.log('\n── la barra sigue andando como antes ──');
    await arrastrar(100, 300, 420, 4, 10);
    p = await ev(estado);
    ok(!p.agenda, 'agenda → (rápido) la cierra');
    ok(errores.length === 0, 'sin errores de JS en la página', errores.slice(0, 3).join(' | '));
} catch (e) {
    console.log('💥', e.message); fails++;
} finally {
    try { ws?.close(); } catch { }
    proc.kill();
}
console.log(fails ? `\n${fails} fallas` : '\ntodo bien');
process.exit(fails ? 1 : 0);
