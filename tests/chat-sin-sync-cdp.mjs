// Un chat cuya sincronización falla ("Group is inactive", red caída) igual muestra lo guardado,
// con un aviso arriba, en vez de taparlo con "No se pudieron cargar los mensajes".
// Chrome headless con XMTP real; la conversación es de mentira (sync() que falla a pedido).
//
//   unset NODE_OPTIONS && node tests/chat-sin-sync-cdp.mjs     (BASE=… para otro build)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9504;
const PEER = '0x2233445566778899aabbccddeeff001122334455';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-sinsync-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 60, delay = 500) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}
// Abre el chat de mentira: `falla` es el mensaje con que revienta sync() ('' = no falla).
const abrirChat = (falla, extra = '') => ev(`(async () => {
    const yo = chatwalletxmtp.inboxId;
    const msg = (id, texto, mio, min) => ({ id, content: texto, contentType: { typeId: 'text' },
        senderInboxId: mio ? yo : 'otro-inbox', sentAt: new Date(Date.now() - min * 60000), reactions: [] });
    window.__conv = { id: 'conv-falsa', peerAddress: ${JSON.stringify(PEER)},
        sync: async () => { ${falla ? `throw new Error(${JSON.stringify(falla)});` : ''} },
        messages: async () => [msg('m1', 'hola guardado', false, 30), msg('m2', 'respuesta guardada', true, 20)],
        peerInboxId: async () => 'otro-inbox' };
    ${extra}
    currentChatContact = { address: ${JSON.stringify(PEER)}, name: 'Prueba' };
    currentConversation = window.__conv;
    showView('chatView');
    await loadAndStreamMessages(window.__conv);
})()`);
const textoChat = () => ev(`document.getElementById('messagesContainer')?.innerText || messagesContainer.innerText`);

try {
    for (let i = 0; i < 60 && !ws; i++) {
        await sleep(500);
        try {
            const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
            if (page) {
                ws = new WebSocket(page.webSocketDebuggerUrl);
                await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
            }
        } catch { ws = null; }
    }
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Page.reload');
    const inbox = await pollFor(`window.chatwalletxmtp && window.chatwalletxmtp.inboxId`, 300, 1000);
    check('XMTP conectado', !!inbox, inbox ? '' : await ev(`(document.getElementById('status')?.textContent || '') + ' | ' + (typeof cwXmtpUltimoError !== 'undefined' && cwXmtpUltimoError ? (cwXmtpUltimoError.message || cwXmtpUltimoError) : '') + ' | wallet=' + !!currentWallet + ' | ' + document.body.innerText.slice(0, 300)`).catch(e => e.message));
    if (!inbox) throw new Error('sin XMTP no se puede probar');

    // ── Sin fallas: el hilo de siempre, sin aviso ──
    await abrirChat('');
    let txt = await textoChat();
    check('sin fallas: se ven los mensajes', /hola guardado/.test(txt) && /respuesta guardada/.test(txt));
    check('…y no hay aviso', !await ev(`!!document.getElementById('cwChatSinSync')`));

    // ── "Group is inactive" con la instalación viva ──
    await abrirChat('Errors Occurred During Sync: Group is inactive processed 0 total messages');
    txt = await textoChat();
    check('inactivo: igual se ven los mensajes guardados', /hola guardado/.test(txt) && /respuesta guardada/.test(txt));
    check('…sin el cartel "No se pudieron cargar los mensajes"', !/No se pudieron cargar/.test(txt));
    check('…con el aviso de que este dispositivo quedó fuera', /quedó fuera de esta conversación/.test(txt));
    check('…y ofrece reabrir (la instalación sigue viva)', await pollFor(`!!document.querySelector('#cwChatSinSync button')`, 40));
    check('…el aviso va arriba del hilo', await ev(`messagesContainer.firstElementChild?.id`) === 'cwChatSinSync');

    // ── Ya se intentó reabrir y sigue igual: se dice cómo se arregla ──
    await ev(`cwReabrirIntentado = 'conv-falsa'`);
    await abrirChat('Group is inactive');
    check('tras intentar reabrir: explica que le escriban', await pollFor(`/Sigue fuera/.test(document.getElementById('cwChatSinSync')?.textContent || '')`, 40));
    check('…y ya no insiste con el botón', !await ev(`!!document.querySelector('#cwChatSinSync button')`));
    await ev(`cwReabrirIntentado = null`);

    // ── Instalación dada de baja ──
    await ev(`(() => { window.__fis = Client.fetchInboxStates; Client.fetchInboxStates = async () => [{ installations: [{ id: 'otra-instalacion' }] }]; })()`);
    await abrirChat('Group is inactive');
    check('instalación dada de baja: lo dice', await pollFor(`/fue dado de baja/.test(document.getElementById('cwChatSinSync')?.textContent || '')`, 40));
    check('…sin botón de reabrir', !await ev(`!!document.querySelector('#cwChatSinSync button')`));
    check('…y los mensajes siguen ahí', /hola guardado/.test(await textoChat()));
    await ev(`Client.fetchInboxStates = window.__fis`);

    // ── Otra falla de sync (red): lo guardado + Reintentar ──
    await abrirChat('network error');
    txt = await textoChat();
    check('otra falla: mensajes guardados + "No se pudo sincronizar"', /hola guardado/.test(txt) && /No se pudo sincronizar este chat/.test(txt));
    check('…con Reintentar', /Reintentar/.test(await ev(`document.querySelector('#cwChatSinSync button')?.textContent || ''`)));

    // ── Si tampoco se puede leer lo guardado, el cartel de error de siempre ──
    await abrirChat('Group is inactive', `window.__conv.messages = async () => { throw new Error('base rota'); };`);
    txt = await textoChat();
    check('sin poder leer lo guardado: cartel de error', /No se pudieron cargar los mensajes/.test(txt), txt.slice(0, 80));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
