// El botón atrás de Android (APK) tiene que cerrar lo de MÁS ARRIBA, una capa por vez.
//
// El defecto: los modales se apilan —Configuración → Administrar redes → Añadir nueva red—
// y el manejador cerraba el primero que encontraba EN EL HTML, no el de arriba. En pantalla
// seguía abierto el de adelante, así que desde afuera el botón atrás "no hacía nada".
//
// Se prueba en el navegador llamando al mismo manejador que registra Capacitor en el APK
// (por eso vive fuera del `if (NativeApp)`), así la lógica queda cubierta sin un teléfono.
//
// Correr:  ./tests/run-boton-atras.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8844/dapp.html';
const PORT = 9398;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-atras-');
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
    await rpc('Page.navigate', { url: BASE });
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof manejarBotonAtras === 'function'`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar (manejarBotonAtras no existe)');

    const abrir = (ids) => `(() => {
        ${JSON.stringify(ids)}.forEach(i => { const m = document.getElementById(i);
            m.classList.remove('hidden'); m.classList.add('flex'); });
        return ${JSON.stringify(ids)}.map(i => !document.getElementById(i).classList.contains('hidden'));
    })()`;
    const visibles = `(() => modalesALaVista().map(x => x.m.id))()`;

    console.log('\n── tres modales apilados, tres veces atrás ──');
    const abiertos = await ev(abrir(['settingsModal', 'manageNetworksModal', 'addNewNetworkModal']));
    ok(abiertos.every(Boolean), 'los tres quedan abiertos', JSON.stringify(abiertos));
    ok((await ev(visibles)).length === 3, 'y el manejador los ve a los tres');

    await ev(`manejarBotonAtras()`); await sleep(150);
    let quedan = await ev(visibles);
    ok(!quedan.includes('addNewNetworkModal'), 'el primer atrás cierra "Añadir nueva red" (el de arriba)', JSON.stringify(quedan));
    ok(quedan.includes('manageNetworksModal'), 'y deja el de abajo abierto', JSON.stringify(quedan));

    await ev(`manejarBotonAtras()`); await sleep(150);
    quedan = await ev(visibles);
    ok(!quedan.includes('manageNetworksModal'), 'el segundo cierra "Administrar redes"', JSON.stringify(quedan));
    ok(quedan.includes('settingsModal'), 'y queda Configuración', JSON.stringify(quedan));

    await ev(`manejarBotonAtras()`); await sleep(150);
    quedan = await ev(visibles);
    ok(quedan.length === 0, 'el tercero cierra Configuración y no queda nada', JSON.stringify(quedan));

    console.log('\n── el z-index manda sobre el orden del HTML ──');
    // confirmSharedNetworkModal va DESPUÉS en el documento pero con z-[60]: es el de arriba.
    await ev(abrir(['manageNetworksModal', 'confirmSharedNetworkModal']));
    const zs = await ev(`(() => modalesALaVista().map(x => x.id = x.m.id + ':' + x.z))()`);
    await ev(`manejarBotonAtras()`); await sleep(150);
    quedan = await ev(visibles);
    ok(!quedan.includes('confirmSharedNetworkModal'), 'cierra el de z más alto primero', JSON.stringify({ zs, quedan }));
    ok(quedan.includes('manageNetworksModal'), 'y el de abajo sigue ahí', JSON.stringify(quedan));
    await ev(`manejarBotonAtras()`);

    console.log('\n── sin nada abierto no rompe ──');
    const sinNada = await ev(`(() => { try { manejarBotonAtras(); return 'ok'; } catch (e) { return 'ERROR: ' + e.message; } })()`);
    ok(sinNada === 'ok', 'con todo cerrado, el manejador no tira error', String(sinNada));
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
