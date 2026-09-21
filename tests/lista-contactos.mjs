// La barra lateral de contactos: qué nombre se ve arriba y qué vista previa se ve abajo.
//
// Dos defectos vistos en la Mac el 20/9/2026 y corregidos en la 3.42/3.43:
//   · un renglón mostraba `{"cw":4,"t":"res"…}` en crudo — la app leía su PROPIO mensaje de
//     sincronía— y encima le robaba el lugar a la última conversación de verdad;
//   · teniendo un apodo puesto, arriba seguía apareciendo la address.
// Acá se dibuja la lista de verdad en Chrome (sin XMTP: renderContacts() no lo necesita) y
// se mide lo que queda en pantalla, incluida la caja de cada texto para ver que nada se pise.
//
// Correr:  ./tests/run-lista-contactos.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8843/dapp.html';
const PORT = 9393;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-lista-');
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
    await rpc('Page.enable'); await rpc('Runtime.enable');
    // La barra lateral de la captura era angosta: es donde un nombre largo puede pisar la hora.
    await rpc('Emulation.setDeviceMetricsOverride', { width: 380, height: 900, deviceScaleFactor: 1, mobile: false });
    await rpc('Page.navigate', { url: BASE });
    // Esperar a que el script clásico haya corrido: el bundle es grande y con un sleep fijo
    // el eval llega antes y falla con "renderContacts is not defined".
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof renderContacts === 'function' && typeof contacts !== 'undefined'`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar (renderContacts no existe)');

    const ADDR_SIN = '0xe14f241b7a6a1b1f6bd0e0dd6bd0e0dd6bd01b7a';
    const ADDR_CON = '0x4F1f241b7a6a1b1f6bd0e0dd6bd0e0dd6bd01b7a';

    console.log('\n── el nombre de arriba ──');
    const filas = await ev(`(() => {
        contacts = [
          { name: '0xe14f...1b7a', address: '${ADDR_SIN}', lastMessage: 'hola', lastMessageTimestamp: Date.now(), status: 'offline', unreadCount: 0 },
          { name: 'es', address: '${ADDR_CON}', lastMessage: 'ji', lastMessageTimestamp: Date.now() - 86400000, status: 'offline', unreadCount: 0 },
        ];
        renderContacts();
        return [...document.querySelectorAll('#contactsListSidebar .contact-item')].map(f => ({
            nombre: f.querySelector('p.font-semibold').innerText.trim(),
            texto: (f.innerText || '').replace(/\\s+/g, ' ').trim(),
        }));
    })()`);
    ok(filas[1].nombre === 'es', 'con apodo puesto, arriba va el apodo', JSON.stringify(filas[1]));
    ok(!/es[\s\S]*·[\s\S]*es/.test(filas[1].texto), 'y no se repite abajo', JSON.stringify(filas[1].texto));
    ok(/^0xe14f/.test(filas[0].nombre), 'sin apodo ni nombre declarado, la address', JSON.stringify(filas[0].nombre));

    const conPerfil = await ev(`(() => {
        contacts[0].selfAlias = 'Vendedor';
        renderContacts();
        return document.querySelector('#contactsListSidebar .contact-item p.font-semibold').innerText.trim();
    })()`);
    ok(conPerfil === 'Vendedor', 'si él declara un nombre, ese gana', JSON.stringify(conPerfil));

    console.log('\n── nada se pisa en una barra angosta ──');
    const cajas = await ev(`(() => {
        contacts[0].selfAlias = 'Un nombre larguísimo que no entra de ninguna manera en la fila';
        renderContacts();
        const f = document.querySelector('#contactsListSidebar .contact-item');
        const n = f.querySelector('p.font-semibold').getBoundingClientRect();
        const h = f.querySelectorAll('p.text-xs')[0].getBoundingClientRect();
        return { ancho: Math.round(f.getBoundingClientRect().width), nombreDer: Math.round(n.right), horaIzq: Math.round(h.x) };
    })()`);
    ok(cajas.nombreDer <= cajas.horaIzq + 1, 'un nombre larguísimo se corta antes de llegar a la hora', JSON.stringify(cajas));

    console.log('\n── la plomería guardada se limpia sola ──');
    const limpiado = await ev(`(async () => {
        contacts = [{ name: '0xe14f...1b7a', address: '${ADDR_SIN}',
                      lastMessage: '{"cw":4,"t":"res","dias":{}}', lastMessageTimestamp: Date.now(),
                      status: 'offline', unreadCount: 0 }];
        await msgStorePut([
            { id: 'm1', peer: '${ADDR_SIN}'.toLowerCase(), dir: 'received', typeId: 'text', content: 'el último mensaje de verdad', ts: Date.now() - 60000 },
            { id: 'm2', peer: '${ADDR_SIN}'.toLowerCase(), dir: 'sent', typeId: 'text', content: '{"cw":4,"t":"res","dias":{}}', ts: Date.now() - 1000 },
        ]);
        const cambios = await limpiarVistasPreviasDePlomeria();
        const fila = document.querySelector('#contactsListSidebar .contact-item');
        return { cambios, guardado: contacts[0].lastMessage, enPantalla: (fila.innerText || '').replace(/\\s+/g, ' ').trim() };
    })()`);
    ok(limpiado.cambios === 1, 'encuentra el renglón con plomería guardada', JSON.stringify(limpiado));
    ok(limpiado.guardado === 'el último mensaje de verdad',
        'y lo reemplaza por el último mensaje real del almacén', JSON.stringify(limpiado.guardado));
    ok(!/\{"cw"/.test(limpiado.enPantalla), 'en pantalla ya no hay JSON en crudo', JSON.stringify(limpiado.enPantalla));

    const sinNada = await ev(`(async () => {
        contacts = [{ name: 'pelado', address: '0x1111111111111111111111111111111111111111',
                      lastMessage: '{"cw":4,"t":"lote","m":[]}', lastMessageTimestamp: Date.now(), status: 'offline', unreadCount: 0 }];
        await limpiarVistasPreviasDePlomeria();
        return { guardado: contacts[0].lastMessage, enPantalla: (document.querySelector('#contactsListSidebar .contact-item').innerText || '').replace(/\\s+/g, ' ').trim() };
    })()`);
    ok(sinNada.guardado === null, 'sin nada en el almacén, queda sin vista previa (no el JSON)', JSON.stringify(sinNada.guardado));
    ok(/Aún no hay mensajes/.test(sinNada.enPantalla), 'y el renglón lo dice en castellano', JSON.stringify(sinNada.enPantalla));
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
