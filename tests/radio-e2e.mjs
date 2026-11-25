// Chat por radio (dongle FlyLog) entre dos identidades en modo frío, con un dongle
// SIMULADO: el test hace de aire. Lo que una página escribe por BLE le llega a la otra
// como lo entrega el firmware lora_bridge: "RX <id> <línea> [-80dBm 9.0dB]".
// Mide: hola → contacto con clave, mensaje + acuse ✓✓, respuesta con el chat abierto,
// reintento cuando el aire se come un frame (y sin duplicar), texto largo partido,
// y que ninguna línea supere los 190 caracteres que entran en el aire.
//
// Correr:  ./tests/run-radio.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-radio-');
    const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
    let ws;
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
        try {
            const l = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    let id = 0; const pend = new Map(); const errores = [];
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errores.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 300));
    });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    const listo = async (expr, seg = 60) => {
        for (let i = 0; i < seg * 2; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(500); }
        return null;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    const close = () => { try { ws.close(); } catch { } try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
    return { rpc, ev, listo, close, errores };
}

// El dongle de mentira: guarda lo que la página escribe y le entrega lo que "llega".
const FAKE_BLE = (dongleId) => `(() => {
    const out = []; let cb = null;
    const toPhone = (l) => { if (cb) { const b = new TextEncoder().encode(l + '\\n'); cb(new DataView(b.buffer)); } };
    window.__radioOut = out;
    window.__radioIn = (l) => toPhone(l);
    window.CwBle = { BleClient: {
        initialize: async () => {},
        requestDevice: async () => ({ deviceId: 'fake-${dongleId}', name: 'FLYLOG-${dongleId}' }),
        connect: async () => {},
        disconnect: async () => {},
        startNotifications: async (d, s, c, f) => { cb = f; },
        writeWithoutResponse: async (d, s, c, dv) => {
            const l = new TextDecoder().decode(dv).replace(/\\n$/, '');
            if (l === '.stat') return setTimeout(() => toPhone('# id=${dongleId} air=LORA freq=915.0 sf=9'), 50);
            out.push(l);
        },
    } };
    return true;
})()`;

const vis = (id) => `(() => { const e = document.getElementById('${id}'); return !!e && !e.classList.contains('hidden') && !!(e.offsetWidth || e.offsetHeight); })()`;
// El interruptor de Configuración, como lo toca la gente: la primera vez confirma, muestra el
// splash, cierra Configuración y vuelve al inicio; el splash se va solo. Después, directo.
async function frioPorLaUI(C) {
    await C.ev(`localStorage.removeItem('cw:frioVisto'); document.getElementById('settingsBtn').click(); true`);
    await new Promise(r => setTimeout(r, 400));
    await C.ev(`document.getElementById('coldModeSwitch').click(); true`);
    await new Promise(r => setTimeout(r, 300));
    ok(await C.ev(vis('offlineModeModal')), 'primera vez: pide confirmar el modo frío');
    await C.ev(`document.getElementById('confirmOfflineModeBtn').click(); true`);
    await new Promise(r => setTimeout(r, 600));
    ok(await C.ev(vis('coldModeSplash')) && !(await C.ev(vis('settingsModal'))), 'splash a la vista y Configuración cerrada');
    await new Promise(r => setTimeout(r, 4000));
    ok(!(await C.ev(vis('coldModeSplash'))) && await C.ev(`document.getElementById('walletView').classList.contains('active') && isOffline`),
        'el splash se cierra solo y queda en la pantalla principal, en frío');
    // Segunda vez: sin modal ni splash.
    await C.ev(`isOffline = false; updateOfflineUI(); document.getElementById('settingsBtn').click(); true`);
    await new Promise(r => setTimeout(r, 400));
    await C.ev(`document.getElementById('coldModeSwitch').click(); true`);
    await new Promise(r => setTimeout(r, 600));
    ok(await C.ev(`isOffline`) && !(await C.ev(vis('offlineModeModal'))) && !(await C.ev(vis('coldModeSplash'))) && !(await C.ev(vis('settingsModal'))),
        'segunda vez: prende directo, sin modal ni splash, y cierra Configuración');
}

async function identidad(C, pk, dongleId, porLaUI = false) {
    await C.rpc('Page.navigate', { url: BASE });
    await C.listo(`typeof renderContacts === 'function'`);
    await C.ev(`localStorage.setItem('xmtp-chat-wallet', '${pk}'); true`);
    await C.rpc('Page.navigate', { url: BASE });
    const addr = await C.listo(`typeof currentWallet !== 'undefined' && currentWallet && currentWallet.address`, 90);
    await C.ev(FAKE_BLE(dongleId));
    if (porLaUI) await frioPorLaUI(C);
    // Modo frío, como en la demo: sin internet.
    else await C.ev(`(async () => { isOffline = true; await goOffline(); updateOfflineUI(); hideColdSplash && hideColdSplash(); return true; })()`);
    return addr;
}

(async () => {
    const pa = Wallet.createRandom(), pb = Wallet.createRandom();
    const A = await chrome(9441), B = await chrome(9442);
    const aire = { drop: 0, largos: [], lineas: 0 };
    let relay;
    try {
        const addrA = await identidad(A, pa.privateKey, 'A218', true);
        const addrB = await identidad(B, pb.privateKey, 'B730');
        ok(addrA && addrB, 'dos billeteras cargadas en modo frío', `${addrA?.slice(0, 8)} / ${addrB?.slice(0, 8)}`);

        // El aire: cada 150 ms se lleva lo escrito por una y se lo entrega a la otra.
        const pares = [[A, B, 'A218'], [B, A, 'B730']];
        relay = setInterval(async () => {
            for (const [de, a, id] of pares) {
                let ls = [];
                try { ls = await de.ev(`window.__radioOut.splice(0)`); } catch { }
                for (const l of ls || []) {
                    aire.lineas++;
                    if (l.length > 190) aire.largos.push(l.length);
                    if (aire.drop > 0 && l.startsWith('CWR1') && l.length > 60) { aire.drop--; continue; }   // el aire se lo comió
                    try { await a.ev(`window.__radioIn(${JSON.stringify(`RX ${id} ${l} [-80dBm 9.0dB]`)}); true`); } catch { }
                }
            }
        }, 150);

        ok(await A.ev(`(() => { const b = document.getElementById('radioHeaderBtn'); return !!b && !!b.offsetWidth && !b.classList.contains('radio-on'); })()`),
            'A: 📡 en la pantalla principal (modo frío), apagado');
        if (process.env.SHOTS) { const r = await A.rpc('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.SHOTS + '/radio-header-off.png', Buffer.from(r.result.data, 'base64')); }
        // 1) Conectar los dos dongles → se oyen los «hola»
        await A.ev(`cwRadio.radioConectar().then(() => true)`);
        await B.ev(`cwRadio.radioConectar().then(() => true)`);
        ok(await A.listo(`!!cwRadio.radio.dev && document.getElementById('radioHeaderBtn').classList.contains('radio-on')`, 10), 'A: dongle enlazado, botón 📡 encendido');
        ok(await A.listo(`cwRadio.radio.air === 'LORA'`, 5), 'A: leyó el aire del .stat (LORA)');
        const cercaA = await A.listo(`cwRadio.radio.nearby['${addrB.toLowerCase()}'] ? true : false`, 15);
        const cercaB = await B.listo(`cwRadio.radio.nearby['${addrA.toLowerCase()}'] ? true : false`, 15);
        ok(cercaA && cercaB, 'cada uno ve al otro «cerca por radio» (hola con clave pública)');
        ok(await A.listo(`(() => { const b = document.getElementById('radioHeaderBtn'); const n = document.getElementById('radioHeaderCerca'); return b.classList.contains('radio-on') && !n.classList.contains('hidden') && n.textContent === '1'; })()`, 5),
            'A: 📡 del inicio en verde y con «1 cerca»');
        if (process.env.SHOTS) { await A.ev(`radioCerrarModal && radioCerrarModal(); showView('walletView'); true`); const r = await A.rpc('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(process.env.SHOTS + '/radio-header-on.png', Buffer.from(r.result.data, 'base64')); }
        ok(await A.ev(`contacts.every(c => c.address.toLowerCase() !== '${addrB.toLowerCase()}')`), 'oír un hola NO crea contactos solo');
        await A.ev(`radioAbrirModal(); true`);
        ok(await A.ev(`document.getElementById('radioNearby').innerText.includes('Chatear')`), 'el panel lista al vecino con «Chatear»');

        // 2) A abre el chat desde el panel y escribe
        await A.ev(`document.querySelector('#radioNearby button').click(); true`);
        ok(await A.listo(`currentOfflineContact && currentOfflineContact.address.toLowerCase() === '${addrB.toLowerCase()}' && !!currentOfflineContact.pubKey`, 10), 'A: chat offline abierto con la clave de B');
        ok(await A.ev(`messageInput.placeholder.includes('radio')`), 'el compositor dice «por radio»');
        const t1 = 'Hola desde la junta Ğ1 👋 sin internet';
        await A.ev(`messageInput.value = ${JSON.stringify(t1)}; sendMessageForm.requestSubmit(); true`);
        const llego = await B.listo(`(offlineThreads['${addrA.toLowerCase()}'] || []).some(m => m.text === ${JSON.stringify(t1)} && m.via === 'radio')`, 15);
        ok(llego, 'B recibió el mensaje cifrado por radio');
        ok(await B.ev(`(contacts.find(c => c.address.toLowerCase() === '${addrA.toLowerCase()}') || {}).unreadCount === 1`), 'B: contacto nuevo con 1 sin leer');
        ok(!(await A.ev(`document.getElementById('offlineMsgQrModal').classList.contains('flex')`)), 'A: no abrió el QR (fue por radio)');
        ok(await A.listo(`(offlineThreads['${addrB.toLowerCase()}'] || []).some(m => m.text === ${JSON.stringify(t1)} && m.ack)`, 15), 'A: acuse recibido (✓✓)');
        ok(await A.ev(`messagesContainer.innerText.includes('✓✓')`), 'A: la burbuja muestra ✓✓');

        // 3) B responde con el chat abierto → A lo ve en pantalla
        await B.ev(`(async () => { await startChatWithContact(contacts.find(c => c.address.toLowerCase() === '${addrA.toLowerCase()}')); return true; })()`);
        const t2 = 'Te leo fuerte y claro 📡';
        await B.ev(`messageInput.value = ${JSON.stringify(t2)}; sendMessageForm.requestSubmit(); true`);
        ok(await A.listo(`messagesContainer.innerText.includes(${JSON.stringify(t2)})`, 15), 'A: la respuesta aparece en el chat abierto');

        // 4) El aire se come el primer intento → reintenta y llega UNA vez
        aire.drop = 1;
        const t3 = 'Este se pierde la primera vez';
        await A.ev(`messageInput.value = ${JSON.stringify(t3)}; sendMessageForm.requestSubmit(); true`);
        ok(await A.listo(`(offlineThreads['${addrB.toLowerCase()}'] || []).some(m => m.text === ${JSON.stringify(t3)} && m.ack)`, 25), 'reintento: llegó y volvió el acuse');
        ok(await B.ev(`(offlineThreads['${addrA.toLowerCase()}'] || []).filter(m => m.text === ${JSON.stringify(t3)}).length === 1`), 'sin duplicados del lado de B');

        // 5) Texto largo → varios mensajes, todos llegan
        const largo = 'Ğ1 es una moneda libre: cada miembro co-crea un dividendo universal todos los días, sin bancos y sin deuda. ChatWallet la paga por chat y ahora también por radio, sin internet, cuando no hay antena.';
        await A.ev(`messageInput.value = ${JSON.stringify(largo)}; sendMessageForm.requestSubmit(); true`);
        const partes = await A.ev(`cwRadio.radioPartir(${JSON.stringify(largo)}).length`);
        ok(partes >= 2, 'el texto largo se parte', `${partes} partes`);
        ok(await B.listo(`(() => { const h = offlineThreads['${addrA.toLowerCase()}'] || []; const t = h.filter(m => m.via === 'radio').map(m => m.text).join(' '); return t.includes('sin bancos') && t.includes('cuando no hay antena'); })()`, 30), 'B recibió todas las partes');

        if (process.env.SHOTS) {
            const shot = async (C, f) => { const r = await C.rpc('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); };
            await shot(A, process.env.SHOTS + '/radio-chat-A.png');
            await B.ev(`radioAbrirModal(); true`); await sleep(300);
            await shot(B, process.env.SHOTS + '/radio-panel-B.png');
        }
        ok(aire.largos.length === 0, 'ninguna línea pasó los 190 caracteres', `${aire.lineas} líneas por el aire`);
        ok(A.errores.length === 0 && B.errores.length === 0, 'sin excepciones en las páginas', [...A.errores, ...B.errores].slice(0, 2).join(' | '));
    } catch (e) {
        ok(false, 'el test se cayó', e.message);
    } finally {
        clearInterval(relay);
        A.close(); B.close();
    }
    console.log(fails ? `\n✗ ${fails} fallaron` : '\n✓ todo bien');
    process.exit(fails ? 1 : 0);
})();
