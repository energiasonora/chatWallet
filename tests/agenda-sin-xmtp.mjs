// La agenda es local: tiene que verse aunque XMTP no arranque, y nunca borrarse.
//
// Visto en el S10+ el 21/9/2026: el puntito rojo de "error de conexión con el chat" y la
// lista de contactos VACÍA. Los contactos estaban guardados; la app los leía recién después
// de que XMTP terminaba de arrancar, así que con XMTP caído no los leía nunca.
// Y al revisar apareció algo peor: si fallaba el descifrado, la agenda se BORRABA.
//
// Acá se corta XMTP de verdad (se bloquean sus dominios) y se mira la barra lateral.
// Correr:  ./tests/run-agenda-sin-xmtp.sh

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8848/dapp.html';
const PORT = 9402;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-agenda-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
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
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    const listo = async (cond, seg = 60) => {
        for (let i = 0; i < seg; i++) { await sleep(1000); try { if (await ev(cond)) return true; } catch { } }
        return false;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable'); await rpc('Network.enable');

    // 1) Una wallet con tres contactos guardados (cifrados con su clave, como en la vida real).
    await rpc('Page.navigate', { url: BASE });
    await listo(`typeof saveContacts === 'function'`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'la wallet carga');
    await ev(`(async () => {
        contacts = [
          { name: 'Mamá', address: '0x1111111111111111111111111111111111111111', unreadCount: 0, status: 'offline' },
          { name: 'Juan', address: '0x2222222222222222222222222222222222222222', unreadCount: 0, status: 'offline' },
          { name: 'Taller', address: '0x3333333333333333333333333333333333333333', unreadCount: 0, status: 'offline' },
        ];
        await saveContacts();
        return localStorage.getItem('xmtp-chat-contacts').length;
    })()`);

    // 2) XMTP caído. Bloquear sus dominios NO sirve: XMTP habla desde un worker y el bloqueo
    //    de red de la página no lo alcanza (medido: arrancaba igual). Se hace fallar su
    //    arranque en la fuente —Client.create tira— antes de que corra ningún script.
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
        let real;
        Object.defineProperty(window, 'Client', { configurable: true,
            set(v) { real = v; },
            get() { return real && new Proxy(real, { get(t, k) {
                return k === 'create' ? async () => { throw new Error('XMTP caído a propósito (test)'); } : Reflect.get(t, k);
            } }); } });
    })();` });
    await rpc('Page.navigate', { url: BASE });
    console.log('\n── con XMTP caído ──');
    const rojo = await listo(`!document.getElementById('headerXmtpErrorBadge').classList.contains('hidden')`, 40);
    ok(rojo, 'aparece el puntito rojo de "error de conexión con el chat" (el síntoma del S10+)');
    const vistos = await listo(`[...document.querySelectorAll('#contactsListSidebar .contact-item')].length === 3`, 5);
    const estado = await ev(`({ filas: [...document.querySelectorAll('#contactsListSidebar .contact-item')].map(f => f.querySelector('p.font-semibold')?.innerText.trim()),
                                xmtp: !!window.chatwalletxmtp })`);
    ok(estado.xmtp === false, 'XMTP efectivamente no arrancó', JSON.stringify(estado));
    ok(vistos, 'y los tres contactos se ven igual en la barra lateral', JSON.stringify(estado.filas));
    ok(['Mamá', 'Juan', 'Taller'].every(n => (estado.filas || []).includes(n)), 'con sus nombres', JSON.stringify(estado.filas));

    // 3) Descifrado imposible: la agenda NO se borra.
    console.log('\n── agenda que no se puede descifrar ──');
    await ev(`localStorage.setItem('xmtp-chat-contacts', 'esto-no-es-un-cifrado-valido')`);
    await rpc('Page.navigate', { url: BASE });
    await listo(`!!(currentWallet && currentWallet.address)`);
    await sleep(3000);
    const trasFallo = await ev(`(() => {
        const claves = Object.keys(localStorage);
        return { principal: localStorage.getItem('xmtp-chat-contacts'),
                 rescates: claves.filter(k => k.startsWith('xmtp-chat-contacts-rescate-')).map(k => localStorage.getItem(k)),
                 avisos: [...document.querySelectorAll('.cw-notif')].map(n => (n.innerText || '').replace(/\\s+/g, ' ').trim()) };
    })()`);
    ok(trasFallo.rescates.includes('esto-no-es-un-cifrado-valido'), 'queda una copia de rescate intacta', JSON.stringify(trasFallo.rescates));
    ok(trasFallo.principal !== null, 'y la agenda original no se borró', JSON.stringify(trasFallo.principal));
    ok(!trasFallo.avisos.some(a => /resetead/i.test(a)), 'el aviso ya no dice que "se resetearon"', JSON.stringify(trasFallo.avisos));
    ok(trasFallo.avisos.some(a => /no se borró nada/i.test(a)), 'dice que no se borró nada', JSON.stringify(trasFallo.avisos));
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
