// CW Connect v2 de punta a punta, con XMTP de producción (cw-connect/SPEC.md).
// Una pestaña es la billetera (dapp.html, wallet nueva); la otra, tests/cw-connect-app.html, hace
// de app v2 (con el módulo común), de app v1 (como StealthPay/Soberano Mail antes) y de persona.
//
//   ./tests/run-cw-connect.sh
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8853';
const PORT = 9512;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`); return ok; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-connect-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

async function conectar(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map();
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    const rpc = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
        return r.result?.result?.value;
    };
    const esperar = async (expr, tries = 90, delay = 1000) => {
        for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
        return false;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    return { rpc, ev, esperar };
}

// Aprobar el modal de la billetera (vincular o firmar) y devolver el texto que mostró.
async function aprobar(W) {
    const t0 = Date.now();
    const cuerpo = await W.esperar(`document.getElementById('wc-body')?.textContent || ''`, 90);
    await W.ev(`document.getElementById('wc-yes').click()`);
    console.log(`   (el modal tardó ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    return cuerpo;
}
const contactos = (W) => W.ev(`JSON.stringify(contacts.map(c => String(c.address).toLowerCase()))`).then(JSON.parse);
const apps = (W) => W.ev(`localStorage.getItem('chatwallet-wc-apps') || '{}'`).then(JSON.parse);

try {
    let paginas;
    for (let i = 0; i < 60 && !paginas?.length; i++) {
        await sleep(500);
        try { paginas = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter(t => t.type === 'page'); } catch { }
    }
    // ── Billetera ──
    const W = await conectar(paginas[0].webSocketDebuggerUrl);
    await W.rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
    await W.ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await W.ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await W.rpc('Page.reload');
    const inboxW = await W.esperar(`window.chatwalletxmtp && chatwalletxmtp.inboxId`, 300);
    if (!check('billetera: chat conectado', !!inboxW, inboxW ? '' : await W.ev(`String(window.cwXmtpUltimoError || '') + ' / ' + (document.getElementById('status')?.textContent || '')`))) throw new Error('sin XMTP no se puede probar');
    const yo = (await W.ev(`currentWallet.address`)).toLowerCase();

    // ── App ──
    const nueva = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(BASE + '/app/cw-connect-app.html')}`, { method: 'PUT' })).json();
    const A = await conectar(nueva.webSocketDebuggerUrl);
    check('app de prueba cargada', !!await A.esperar(`window.listo === true`, 60));

    // 1. v2: la app se presenta, la billetera lo muestra como declarado.
    await A.ev(`conectarV2({ app: 'prueba.chatwallet.org', name: 'App de prueba', kind: 'once', chainId: 0 })`);
    const uri = await A.esperar(`window.__estado.v2.uri`, 120);
    check('v2: la app arma el URI con nombre, dominio y uso', /v=2/.test(uri) && /app=prueba\.chatwallet\.org/.test(uri) && /name=App%20de%20prueba/.test(uri) && /kind=once/.test(uri), uri);
    const inboxV2 = new URLSearchParams(uri.split('?')[1]).get('inbox');
    W.ev(`handleScannedData(${JSON.stringify(uri)})`).catch(() => { });
    const cuerpo = await aprobar(W);
    check('v2: el aviso dice quién dice ser la app y que no está verificado', /«App de prueba»/.test(cuerpo) && /prueba\.chatwallet\.org/.test(cuerpo) && /no está verificado/.test(cuerpo), cuerpo.split('\n')[0]);
    check('v2: el aviso dice que es de un solo uso', /un solo uso/.test(cuerpo));
    const version = await A.esperar(`window.__sesionV2 && window.__sesionV2.version`, 120);
    check('v2: la app quedó conectada en versión 2', version === 2, String(version || (await A.ev(`JSON.stringify(window.__estado.v2)`))));
    check('v2: la app sabe qué cuenta firma', (await A.ev(`window.__sesionV2.address`))?.toLowerCase() === yo);

    await sleep(3000);
    check('v2: la app NO es un contacto', !(await contactos(W)).includes(inboxV2));
    let reg = await apps(W);
    check('v2: la app quedó registrada con lo que declaró', reg[inboxV2]?.name === 'App de prueba' && reg[inboxV2]?.app === 'prueba.chatwallet.org' && reg[inboxV2]?.kind === 'once' && reg[inboxV2]?.v === 2, JSON.stringify(reg[inboxV2]));
    const fila = await W.ev(`(() => { const f = document.getElementById('appsConectadasRow'); return f && !f.classList.contains('hidden') && f.textContent; })()`);
    check('v2: la lista de chats muestra "1 app conectada"', /1 app conectada/.test(fila || ''), String(fila));

    // Firma por el tipo de contenido propio.
    await A.ev(`window.__firmaV2 = null; window.__tf = [Date.now()]; window.__sesionV2.firmar('hola v2').then(f => { window.__tf.push(Date.now()); window.__firmaV2 = f; }, e => { window.__tf.push(Date.now()); window.__firmaV2 = 'ERROR ' + e.message; }); true`);
    const cuerpoFirma = await aprobar(W);
    check('v2: la billetera muestra el texto a firmar', /hola v2/.test(cuerpoFirma));
    const t1 = Date.now();
    const firma = await A.esperar(`window.__firmaV2`, 200);
    console.log(`   (la respuesta tardó ${((Date.now() - t1) / 1000).toFixed(1)} s; en la app: ${await A.ev('JSON.stringify(window.__tf)')})`);
    if (process.env.SOLO_V2) throw new Error('fin (SOLO_V2)');
    check('v2: la firma vuelve y es de la cuenta', !String(firma).startsWith('ERROR') && (await A.ev(`verificarFirma('hola v2', ${JSON.stringify(firma)})`)) === yo, String(firma).slice(0, 24));
    const tipos = await W.ev(`(async () => { const s = JSON.parse(localStorage.getItem('chatwallet-wc-sessions') || '[]').find(x => x.ethInbox === ${JSON.stringify(inboxV2)});
        const dm = await chatwalletxmtp.conversations.getDmByInboxId(s.peerInboxId); return [...new Set((await dm.messages()).map(m => m.contentType.authorityId + '/' + m.contentType.typeId))].join(','); })()`);
    check('v2: los mensajes viajan como chatwallet.org/cw, no como texto', /chatwallet\.org\/cw/.test(tipos) && !/xmtp\.org\/text/.test(tipos), tipos);
    const actividad = await W.ev(`JSON.parse(localStorage.getItem('chatwallet-wc-activity') || '[]')[0]`);
    check('v2: el registro de actividad anota la firma aprobada', actividad?.kind === 'sign' && actividad?.result === 'approved');

    // bye: la app cierra y la billetera la archiva.
    await A.ev(`window.__sesionV2.cerrar()`);
    const archivada = await W.esperar(`JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inboxV2)}]?.archivada === true`, 60);
    check('v2: al cerrar la app (bye) la billetera la archiva', !!archivada);
    check('v2: …y deja de atenderla', !(await W.ev(`JSON.parse(localStorage.getItem('chatwallet-wc-sessions') || '[]').some(x => x.ethInbox === ${JSON.stringify(inboxV2)})`)));
    check('v2: …y la fila de apps desaparece', await W.ev(`document.getElementById('appsConectadasRow')?.classList.contains('hidden') !== false`));

    // 2. v1: una app vieja sigue funcionando y tampoco es contacto.
    const uriV1 = await A.ev(`conectarV1()`);
    const inboxV1 = await A.ev(`window.__estado.v1.inbox`);
    W.ev(`handleScannedData(${JSON.stringify(uriV1)})`).catch(() => { });
    const cuerpoV1 = await aprobar(W);
    check('v1: el aviso dice que la app no se presenta', /no dice quién es/.test(cuerpoV1));
    const connectV1 = await A.esperar(`window.__estado.v1.connect && JSON.stringify(window.__estado.v1.connect)`, 120);
    check('v1: el connect llega como texto y sin campos de v2', !!connectV1 && !/"v"/.test(connectV1), String(connectV1));
    await aprobar(W);
    const respV1 = await A.esperar(`window.__estado.v1.respuesta && JSON.stringify(window.__estado.v1.respuesta)`, 90);
    const firmaV1 = respV1 && JSON.parse(respV1).result;
    check('v1: la firma vuelve como texto y es de la cuenta', !!firmaV1 && (await A.ev(`verificarFirma('firma v1', ${JSON.stringify(firmaV1)})`)) === yo, String(respV1).slice(0, 60));
    // (el perfil va aparte, con su propio tipo, igual que antes de la v2: StealthPay muestra el avatar)
    check('v1: a la app vieja no le llegó nada con el tipo nuevo', (await A.ev(`(window.__estado.v1.tipos || []).every(t => t !== 'cw')`)), await A.ev(`JSON.stringify(window.__estado.v1.tipos)`));
    await sleep(3000);
    check('v1: la app vieja NO es un contacto', !(await contactos(W)).includes(inboxV1));
    reg = await apps(W);
    check('v1: registrada como sesión v1', reg[inboxV1]?.v === 1 && reg[inboxV1]?.kind === 'session', JSON.stringify(reg[inboxV1]));

    // 2b. «Desconectar» en la billetera le avisa a la app v2 (bye) y la app se entera.
    await A.ev(`conectarV2({ app: 'otra.chatwallet.org', name: 'Otra app', kind: 'session' })`);
    const uri2 = await A.esperar(`window.__estado.v2.uri`, 120);
    const inbox2 = new URLSearchParams(uri2.split('?')[1]).get('inbox');
    W.ev(`handleScannedData(${JSON.stringify(uri2)})`).catch(() => { });
    const cuerpo2 = await aprobar(W);
    check('sesión: el aviso dice que queda conectada', /Queda conectada/.test(cuerpo2));
    await A.esperar(`window.__sesionV2 && window.__sesionV2.version === 2 && window.__sesionV2.address`, 120);
    await W.ev(`document.getElementById('settingsBtn').click()`);
    const boton = await W.esperar(`!!document.querySelector('#wcSessionsList [data-app="${inbox2}"] button')`, 20);
    check('Configuración → Apps conectadas lista la app con su nombre', !!boton && /Otra app/.test(await W.ev(`document.getElementById('wcSessionsList').textContent`)));
    await W.ev(`document.querySelector('#wcSessionsList [data-app="${inbox2}"] button').click()`);
    const cerrada = await A.esperar(`window.__estado.v2.cerrada`, 90);
    check('«Desconectar» le avisa a la app y la app cierra la sesión', /cerró la sesión/.test(String(cerrada)), String(cerrada));
    check('…y en la billetera queda archivada', (await apps(W))[inbox2]?.archivada === true);
    await W.ev(`document.getElementById('settingsModal')?.classList.add('hidden')`);

    // 2c. Cobro v2 (la tienda del libro): la billetera muestra el pago, se rechaza, el resultado
    // vuelve con el tipo propio y quien cobra no queda como contacto.
    const urlPago = await A.ev(`pedirPago(${JSON.stringify(yo)})`);
    const replyPago = await A.ev(`window.__estado.pago.reply`);
    W.ev(`handleScannedData(${JSON.stringify(urlPago)})`).catch(() => { });
    const modalPago = await W.esperar(`document.getElementById('pm-no') && document.getElementById('pm-body').textContent`, 90);
    check('cobro v2: la billetera muestra el pedido de pago', /Prueba/.test(modalPago || ''), String(modalPago).slice(0, 80));
    await W.ev(`document.getElementById('pm-no').click(); true`);
    const resPago = await A.esperar(`window.__estado.pago.resultado && JSON.stringify({ r: window.__estado.pago.resultado, v: window.__estado.pago.version })`, 90);
    check('cobro v2: el rechazo vuelve con el tipo propio', !!resPago && JSON.parse(resPago).v === 2 && /user rejected/.test(resPago), String(resPago));
    reg = await apps(W);
    check('cobro v2: quien cobra quedó como app de un solo uso, con su nombre', reg[replyPago]?.name === 'Libro de prueba' && reg[replyPago]?.kind === 'once', JSON.stringify(reg[replyPago]));
    await sleep(2000);
    check('cobro v2: quien cobra NO es un contacto', !(await contactos(W)).includes(replyPago));

    // 3. Una persona que escribe sigue siendo un contacto.
    const persona = await A.ev(`escribirComoPersona(${JSON.stringify(yo)}, 'hola, soy una persona')`);
    check('una persona que escribe aparece entre los chats', !!await W.esperar(`contacts.some(c => String(c.address).toLowerCase() === ${JSON.stringify(persona)})`, 90));

    // 4. Lo de antes de la v2: un "contacto" que en realidad es una app, sin registro. Al
    // recargar, el recorrido de conversaciones lo reconoce (todo su DM es protocolo) y lo saca.
    await W.ev(`(async () => {
        localStorage.removeItem('chatwallet-wc-apps'); localStorage.removeItem('chatwallet-wc-sessions');
        contacts.push({ name: '0xviejo', address: ${JSON.stringify(inboxV1)}, unreadCount: 2, status: 'offline', lastSeen: null, avatar: ANON_AVATAR });
        await saveContacts();
    })()`);
    check('antes de recargar: la app vieja está entre los contactos', (await contactos(W)).includes(inboxV1));
    await W.rpc('Page.reload');
    await W.esperar(`window.chatwalletxmtp && chatwalletxmtp.inboxId`, 300);
    const limpio = await W.esperar(`window.contacts && contacts.length > 0 && !contacts.some(c => String(c.address).toLowerCase() === ${JSON.stringify(inboxV1)}) && JSON.parse(localStorage.getItem('chatwallet-wc-apps') || '{}')[${JSON.stringify(inboxV1)}]`, 120);
    check('después de recargar: la app vieja salió de los contactos y quedó como app', !!limpio);
    check('…la persona sigue entre los contactos', (await contactos(W)).includes(persona));
    check('…y la app v2 tampoco volvió como contacto', !(await contactos(W)).includes(inboxV2));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
