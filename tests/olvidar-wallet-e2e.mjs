// "Olvidar" una wallet y crear otra en el mismo navegador, con la PWA abierta a la vez.
// Reproduce el reporte del 22/10/2026: la cuenta nueva heredaba el alias de la vieja, veía
// MEZCLADOS los chats de la wallet olvidada y salía el aviso falso de "el navegador borró los
// chats". La PWA y la pestaña comparten origen (localStorage, IndexedDB, OPFS y candados), así
// que acá son dos pestañas del MISMO Chrome. P es un tercero, en otro Chrome.
//
// Correr:  ./tests/run-olvidar.sh
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8848/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

async function lanzar(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-olvidar-');
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { await sleep(500); try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { } }
    return { port, close: () => { try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } } };
}
async function pestana(port, nueva) {
    const t = nueva ? await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
        : (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(x => x.type === 'page');
    const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, b) => { ws.onopen = r; ws.onerror = b; });
    let id = 0; const pend = new Map(); const errores = [];
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errores.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300)); });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => { const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails; if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300)); return r.result?.result?.value; };
    const listo = async (expr, seg = 60) => { for (let i = 0; i < seg * 2; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(500); } return null; };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    // Avisos que aparezcan en cualquier momento (duran segundos): se juntan en Node.
    const avisos = new Set();
    const vigia = setInterval(async () => { try { const v = await ev(`[...document.querySelectorAll('.cw-notif')].map(n => n.innerText)`); (v || []).forEach(x => avisos.add(x.replace(/\s+/g, ' '))); } catch { } }, 400);
    return { rpc, ev, listo, errores, avisos, id: t.id, cerrar: () => { clearInterval(vigia); try { ws.close(); } catch { } } };
}
async function identidad(T, pk) {
    await T.rpc('Page.navigate', { url: BASE });
    await T.listo(`typeof renderContacts === 'function'`);
    await T.ev(`localStorage.setItem('xmtp-chat-wallet', '${pk}'); true`);
    await T.rpc('Page.navigate', { url: BASE });
    return T.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId) && currentWallet.address`, 120);
}
async function abrirChat(T, addr, texto) {
    await T.ev(`(async () => { let c = contacts.find(x => (x.address || '').toLowerCase() === '${addr.toLowerCase()}');
        if (!c) { c = { name: 'Otro', address: '${addr}', unreadCount: 0, status: 'offline' }; contacts.push(c); await saveContacts(); }
        showView && showView('chatView'); await startChatWithContact(c); return true; })()`);
    await T.listo(`!!currentConversation && !/Sincronizando|Iniciando/.test(messagesContainer.innerText)`, 90);
    if (!texto) return true;
    for (let i = 0; i < 15; i++) { if (await T.ev(`messagesContainer.innerText.includes(${JSON.stringify(texto)})`)) return true; await T.ev(`reloadCurrentChat().then(() => true)`).catch(() => { }); await sleep(2500); }
    return false;
}

const wx = Wallet.createRandom(), wp = Wallet.createRandom();
const CA = await lanzar(9431), CP = await lanzar(9432);
let T1, T2, P;
try {
    T1 = await pestana(CA.port, false); P = await pestana(CP.port, false);
    const reintento = async (T, pk) => (await identidad(T, pk)) || (await identidad(T, pk));
    const [x, p] = await Promise.all([reintento(T1, wx.privateKey), reintento(P, wp.privateKey)]);
    if (!x || !p) throw new Error('XMTP no arrancó');
    console.log('\n── PWA (pestaña 1) con la wallet X, que chatea con P ──');
    await T1.ev(`localStorage.setItem(OWN_PROFILE_KEY, JSON.stringify({ alias: 'macm1v2', links: '', avatar: '' })); true`);
    await abrirChat(P, wx.address);
    await P.ev(`messageInput.value = 'hola X, soy P'; sendMessageForm.requestSubmit(); true`);
    ok(await abrirChat(T1, wp.address, 'hola X, soy P'), 'X recibe el mensaje de P');

    console.log('\n── pestaña 2 (navegador): link propio, olvidar, wallet nueva ──');
    T2 = await pestana(CA.port, true);
    await T2.rpc('Page.navigate', { url: BASE + '?address=' + wx.address });
    const otra = await T2.listo(`/otra pestaña/.test(document.body.innerText) || (window.cwXmtpUltimoError && /otra/.test(String(cwXmtpUltimoError)))`, 60);
    ok(!!otra, 'la segunda ventana avisa que ChatWallet ya está abierta en otra');
    await T2.ev(`document.getElementById('confirmForgetWalletBtn').click(); true`);
    // Olvidar recarga esta pestaña, y la PWA (que comparte la wallet) también se entera y se recarga.
    await sleep(3000);
    ok(!!await T2.listo(`typeof renderContacts === 'function' && !currentWallet && !localStorage.getItem('xmtp-chat-wallet')`, 30), 'la pestaña olvida y vuelve a la pantalla inicial');
    ok(!!await T1.listo(`typeof renderContacts === 'function' && !currentWallet`, 30), 'la PWA también suelta la wallet olvidada (no sigue escribiendo con ella)');
    const restos = await T2.ev(`(async () => ({ contactos: !!localStorage.getItem(CONTACTS_STORAGE_KEY), perfil: !!localStorage.getItem(OWN_PROFILE_KEY),
        conDir: Object.keys(localStorage).filter(k => k.toLowerCase().includes('${wx.address.toLowerCase()}')).length,
        mensajes: (await msgStoreGetByPeer('${wp.address}')).length }))()`);
    ok(!restos.contactos && !restos.perfil && !restos.conDir && !restos.mensajes, 'no queda nada local de X (agenda, perfil, claves con su dirección, mensajes)', JSON.stringify(restos));
    await T2.ev(`document.getElementById('createWalletButton').click(); true`);
    const y = await T2.listo(`currentWallet && currentWallet.address !== '${wx.address}' && currentWallet.address`, 30);
    ok(!!y, 'se creó la wallet nueva Y', y);
    const alias = await T2.ev(`(readOwnProfile() || {}).alias || ''`);
    ok(alias !== 'macm1v2', 'Y NO hereda el alias de X', JSON.stringify(alias));
    await T2.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    // La PWA toma la wallet nueva, pero el chat lo tiene la pestaña: avisa en vez de pisarlo.
    const pwa = await T1.listo(`currentWallet && currentWallet.address === '${y}' && /otra pestaña/.test(document.body.innerText + (document.getElementById('status')?.textContent || '')) && 'ok'`, 60);
    ok(!!pwa, 'la PWA sigue a la wallet nueva y avisa que el chat está abierto en la otra ventana',
        JSON.stringify(await T1.ev(`({ w: currentWallet && currentWallet.address, err: String(window.cwXmtpUltimoError || ''), st: (document.getElementById('status')?.textContent || '').slice(0, 80), xmtp: !!window.chatwalletxmtp })`).catch(e => e.message)));
    T1.cerrar(); await fetch(`http://127.0.0.1:${CA.port}/json/close/${T1.id}`); T1 = null;
    const inst1 = await T2.ev(`({ id: String(chatwalletxmtp.installationId), inbox: chatwalletxmtp.inboxId, guardada: localStorage.getItem('cw-xmtp-instalacion-' + currentWallet.address.toLowerCase()), candado: cwXmtpCandado })`);
    console.log('   Y antes del link:', JSON.stringify(inst1));
    console.log('\n── Y abre el link de invitación de P ──');
    await T2.rpc('Page.navigate', { url: BASE + '?address=' + wp.address });
    await T2.listo(`currentWallet && currentWallet.address === '${y}'`, 60);
    await T2.listo(`!!(window.chatwalletxmtp && chatwalletxmtp.inboxId)`, 120);
    await sleep(8000);
    console.log('   Y después del link:', JSON.stringify(await T2.ev(`({ id: String(chatwalletxmtp.installationId), inbox: chatwalletxmtp.inboxId })`)));
    const c = await T2.ev(`contacts.map(c => c.address.toLowerCase())`);
    const vioDeX = await abrirChat(T2, wp.address, 'hola X, soy P').catch(() => false);
    const hilo = await T2.ev(`messagesContainer.innerText.slice(0, 300)`);
    ok(!vioDeX, 'Y NO ve los mensajes que P le mandó a X', hilo.replace(/\s+/g, ' ').slice(0, 120));
    const stored = await T2.ev(`msgStoreGetByPeer('${wp.address}').then(r => r.filter(m => String(m.content).includes('hola X')).length)`);
    ok(stored === 0, 'el almacén local de Y no tiene los mensajes de X con P', String(stored));
    const falso = [...T2.avisos].find(a => /borró los chats/.test(a));
    ok(!falso, 'no sale el aviso falso de «el navegador borró los chats»', falso ? falso.slice(0, 60) : '');
    console.log('   avisos vistos en la pestaña 2:', [...T2.avisos].map(a => a.slice(0, 70)));
    const errs = [...T2.errores, ...P.errores].filter(e => !/favicon|ERR_|Failed to fetch|NetworkError/i.test(e));
    ok(!errs.length, 'ninguna excepción sin atrapar', errs.join(' | ').slice(0, 300));
} catch (e) {
    ok(false, 'la prueba se cortó', e.message);
} finally {
    for (const t of [T1, T2, P]) t?.cerrar?.();
    CA.close(); CP.close();
}
console.log(fails ? `\n${fails} fallaron` : '\ntodo bien');
process.exit(fails ? 1 : 0);
