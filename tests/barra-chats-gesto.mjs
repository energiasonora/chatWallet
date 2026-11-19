// La barra de chats se abre y se cierra con el dedo, como en Off Player.
//
// Qué se espera:
//   · deslizar a la izquierda desde cualquier parte la abre, y mientras el dedo se mueve la barra
//     lo sigue (no aparece entera de golpe al soltar);
//   · soltar a mitad de camino y lento decide por dónde quedó; un gesto rápido corto manda la dirección;
//   · deslizar a la derecha la cierra siguiendo el dedo;
//   · el scroll vertical no la mueve, y deslizar un mensaje (para responder) no la abre;
//   · en el teléfono ocupa a lo sumo el 88 % del ancho y deja ver la pantalla de atrás.
//
// Correr:  ./tests/run-barra-chats-gesto.sh

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8846/dapp.html';
const PORT = 9399;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra !== '' ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-barra-');
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
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
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
    // Una wallet cualquiera: sin wallet no hay chats y el gesto no se activa.
    await ev(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))}); localStorage.setItem('xmtp-chat-wallet-backup-done','1'); true`);
    await rpc('Page.reload');
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof closeSidebar === 'function' && typeof currentWallet !== 'undefined' && !!currentWallet`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar la wallet');
    // Que no quede ningún modal de bienvenida encima.
    await ev(`modalesALaVista().forEach(x => { x.m.classList.add('hidden'); x.m.classList.remove('flex'); }); true`);
    await sleep(300);

    const toque = (type, x, y) => rpc('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const posicion = `(() => { const s = document.getElementById('contactsSidebar'); const r = s.getBoundingClientRect();
        return { x: Math.round(r.left), w: Math.round(r.width), activa: s.classList.contains('active'),
                 velo: Number(getComputedStyle(document.getElementById('sidebarOverlay')).opacity).toFixed(2) }; })()`;
    // Arrastre en pasos; `pausa` = ms entre pasos (lento = decide la posición; rápido = la dirección).
    async function arrastrar(x0, x1, y, pasos = 12, pausa = 30, { soltar = true, mirarEn } = {}) {
        let visto;
        await toque('touchStart', x0, y);
        for (let i = 1; i <= pasos; i++) {
            await toque('touchMove', x0 + (x1 - x0) * i / pasos, y + i * 0.5);
            await sleep(pausa);
            if (mirarEn === i) visto = await ev(posicion);
        }
        if (soltar) await toque('touchEnd');
        await sleep(450);
        return visto;
    }
    const cerrar = async () => { await ev(`closeSidebar(); true`); await sleep(400); };

    const inicial = await ev(posicion);
    console.log('\n── tamaño en el teléfono ──');
    ok(inicial.w <= Math.ceil(390 * 0.88) && inicial.w >= 300, 'la barra ocupa a lo sumo el 88 % del ancho', `${inicial.w}px de 390`);
    ok(!inicial.activa && inicial.x >= 389, 'arranca cerrada, fuera de pantalla', `x=${inicial.x}`);

    console.log('\n── abrir siguiendo el dedo ──');
    const mitad = await arrastrar(330, 180, 420, 10, 40, { mirarEn: 10 });
    ok(mitad && mitad.x < 390 && mitad.x > 390 - inicial.w, 'a mitad del gesto la barra está a mitad de camino (sigue al dedo)', mitad && `x=${mitad.x}`);
    ok(mitad && Number(mitad.velo) > 0 && Number(mitad.velo) < 1, 'y el fondo se oscurece a la par', mitad && mitad.velo);
    let p = await ev(posicion);
    ok(p.activa && p.x <= 390 - p.w + 1, 'al soltar (más de 60 px hacia la izquierda), queda abierta', `x=${p.x}`);

    console.log('\n── cerrar siguiendo el dedo ──');
    const cerrando = await arrastrar(120, 220, 420, 8, 40, { mirarEn: 8, soltar: false });
    ok(cerrando && cerrando.x > 390 - p.w + 40, 'arrastrando a la derecha la barra acompaña', cerrando && `x=${cerrando.x}`);
    await toque('touchEnd'); await sleep(450);
    p = await ev(posicion);
    ok(!p.activa, 'y al soltar pasados 60 px se cierra');
    await ev(`openSidebar(); true`); await sleep(400);
    await arrastrar(120, 165, 420, 10, 60);
    p = await ev(posicion);
    ok(p.activa, 'un arrastre lento y corto (45 px) la devuelve abierta');
    await arrastrar(100, 300, 420, 4, 10);
    p = await ev(posicion);
    ok(!p.activa && p.x >= 389, 'un gesto rápido a la derecha la cierra', `x=${p.x}`);

    console.log('\n── gestos rápidos y lentos para abrir ──');
    await arrastrar(330, 275, 420, 2, 0);   // 55 px: menos de 60, decide la velocidad
    p = await ev(posicion);
    ok(p.activa, 'un flick corto y rápido a la izquierda la abre');
    await cerrar();
    await arrastrar(370, 330, 420, 10, 60);
    p = await ev(posicion);
    ok(!p.activa, 'un arrastre lento que no llega a la mitad no la abre');

    console.log('\n── lo que NO tiene que abrirla ──');
    await toque('touchStart', 200, 600);
    for (let i = 1; i <= 10; i++) { await toque('touchMove', 200 - i * 3, 600 - i * 25); await sleep(20); }
    await toque('touchEnd'); await sleep(450);
    p = await ev(posicion);
    ok(!p.activa, 'un scroll vertical (con algo de desvío) no la abre');

    await ev(`(() => { const r = document.createElement('div'); r.id = 'filaPrueba'; r.dataset.gestoPropio = 'responder';
        r.style.cssText = 'position:fixed;left:0;right:0;top:300px;height:80px;z-index:20;background:rgba(255,0,0,.1)';
        document.body.appendChild(r); return true; })()`);
    await arrastrar(330, 150, 340, 10, 20);
    p = await ev(posicion);
    ok(!p.activa, 'deslizar sobre un mensaje (gesto de responder) no la abre');
    await ev(`document.getElementById('filaPrueba').remove(); true`);

    await ev(`(() => { const m = document.getElementById('settingsModal'); m.classList.remove('hidden'); m.classList.add('flex'); return true; })()`);
    await arrastrar(330, 150, 420, 10, 20);
    p = await ev(posicion);
    ok(!p.activa, 'con un modal abierto no se abre detrás');
    await ev(`(() => { const m = document.getElementById('settingsModal'); m.classList.add('hidden'); m.classList.remove('flex'); return true; })()`);

    console.log('\n── el botón sigue andando ──');
    await ev(`openSidebar(); true`); await sleep(400);
    p = await ev(posicion);
    ok(p.activa && p.x <= 390 - p.w + 1, 'openSidebar() la abre entera (sin estilos del dedo pegados)', `x=${p.x}`);
    await ev(`manejarBotonAtras(); true`); await sleep(400);
    p = await ev(posicion);
    ok(!p.activa, 'el botón atrás la cierra');
    const shot = await rpc('Page.captureScreenshot', { format: 'png' });
    await ev(`openSidebar(); true`); await sleep(400);
    const shot2 = await rpc('Page.captureScreenshot', { format: 'png' });
    if (process.env.SHOT_DIR) {
        fs.writeFileSync(process.env.SHOT_DIR + '/barra-cerrada.png', Buffer.from(shot.result.data, 'base64'));
        fs.writeFileSync(process.env.SHOT_DIR + '/barra-abierta.png', Buffer.from(shot2.result.data, 'base64'));
    }
} catch (e) {
    console.log('💥', e.message); fails++;
} finally {
    try { ws?.close(); } catch { }
    proc.kill();
}
console.log(fails ? `\n${fails} fallas` : '\ntodo bien');
process.exit(fails ? 1 : 0);
