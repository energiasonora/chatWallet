// Bóveda de secretos (etapa 1 del candado, 2/11/2026).
//
// En el APK la clave privada, la frase y la llave Ğ1 se guardan cifradas con una llave del
// Android Keystore (plugin nativo Boveda). Acá se simula el plugin con un Capacitor falso
// (cifrado reversible de mentira, con fallas a pedido) y se verifica en Chrome que:
//   1. Una wallet vieja guardada en claro se migra a cifrada y sigue abriendo la misma.
//   2. Después de la migración no queda ningún secreto en claro en localStorage.
//   3. Recargar abre la wallet desde lo cifrado.
//   4. Una falla pasajera del plugin NO ofrece crear otra wallet ni toca lo guardado.
//   5. Si la llave del chip ya no está, se guarda aparte lo cifrado y se ofrece restaurar.
//   6. Sin bloqueo de pantalla aparece el aviso.
//   7. Una wallet creada por invitación nace cifrada.
//   8. En la web (sin plugin) todo sigue como antes, en claro.
// XMTP se deja caído a propósito: no hace falta para nada de esto y así no se registran
// instalaciones de prueba en la red.
//
// Correr:  ./tests/run-boveda.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8851/dapp.html';
const PORT = 9401;
const INVITA = '0xAba0232960Bb97Ac16D0a4a15309f8Be95cf6042';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// Antes de cualquier script de la página: XMTP caído siempre y, si sessionStorage['cw-test-nativo']
// está prendido, un Capacitor "nativo" con la Boveda falsa. Las fallas se piden por
// sessionStorage['cw-test-boveda'] = 'error' | 'sin_llave'; el bloqueo de pantalla por
// sessionStorage['cw-test-sin-bloqueo'] = '1'.
const PRELUDIO = `(() => {
    let realClient;
    Object.defineProperty(window, 'Client', { configurable: true,
        set(v) { realClient = v; },
        get() { return realClient && new Proxy(realClient, { get(t, k) {
            if (k !== 'create') return Reflect.get(t, k);
            return async () => { throw new Error('XMTP caído a propósito (test)'); };
        } }); } });
    const ss = (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
    if (ss('cw-test-nativo') !== '1') return;
    const cod = (s) => 'FAKE' + btoa(unescape(encodeURIComponent(s))).split('').reverse().join('');
    const dec = (c) => decodeURIComponent(escape(atob(c.slice(4).split('').reverse().join(''))));
    const err = (code, msg) => { const e = new Error(msg); e.code = code; return e; };
    window.__boveda = { cifrar: 0, descifrar: 0 };
    const Boveda = {
        async cifrar({ texto }) {
            window.__boveda.cifrar++;
            if (ss('cw-test-boveda') === 'error') throw err('ERROR', 'falla pasajera (test)');
            return { c: cod(texto) };
        },
        async descifrar({ c }) {
            window.__boveda.descifrar++;
            const modo = ss('cw-test-boveda');
            if (modo === 'error') throw err('ERROR', 'falla pasajera (test)');
            if (modo === 'sin_llave') throw err('SIN_LLAVE', 'La llave de la bóveda no está en este teléfono');
            return { texto: dec(c) };
        },
        async estado() { return { bloqueoPantalla: ss('cw-test-sin-bloqueo') !== '1', hardware: 'tee' }; },
    };
    const noop = new Proxy({}, { get: (t, k) => k === 'then' ? undefined
        : (k === 'addListener' ? () => ({ remove() {} }) : async () => ({})) });
    window.Capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: new Proxy({}, { get: (t, k) => k === 'Boveda' ? Boveda : noop }),
    };
})();`;

async function chrome(port) {
    const dir = fs.mkdtempSync(os.tmpdir() + '/cw-boveda-');
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
    let id = 0; const pend = new Map();
    const excepciones = [];
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') excepciones.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text);
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
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: PRELUDIO });
    const close = () => { try { ws.close(); } catch { } try { proc.kill('SIGKILL'); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } };
    return { rpc, ev, listo, close, excepciones };
}

// Billetera fija de prueba (hardhat #3, nunca tiene fondos reales).
const PK = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';
const DIR = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const FRASE = 'test test test test test test test test test test test junk';
const RAIZ = 'ab'.repeat(32);
const claveG1 = `cw-g1-raiz-${DIR.toLowerCase()}`;
const estado = `(document.getElementById('status')?.innerText || statusEl.textContent || '')`;
const avisos = `[...document.querySelectorAll('.cw-notif')].map(n => n.innerText.replace(/\\s+/g, ' ')).join(' | ')`;
// ¿Aparece algún secreto en claro en CUALQUIER valor de localStorage?
const fugas = `(() => { const s = [${JSON.stringify(PK.slice(2))}, ${JSON.stringify(FRASE)}, ${JSON.stringify(RAIZ)}];
    const malas = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k) || '';
    if (s.some(x => v.toLowerCase().includes(x.toLowerCase()))) malas.push(k); } return malas; })()`;

const B = await chrome(PORT);
try {
    // ── 1-3: usuario viejo con todo en claro → migra y sigue andando ──
    console.log('\n── migración de una wallet guardada en claro ──');
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`typeof renderContacts === 'function'`);
    await B.ev(`localStorage.clear(); sessionStorage.setItem('cw-test-nativo', '1');
        localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)});
        localStorage.setItem('xmtp-chat-wallet-mnemonic', ${JSON.stringify(FRASE)});
        localStorage.setItem(${JSON.stringify(claveG1)}, ${JSON.stringify(RAIZ)});
        localStorage.setItem('xmtp-chat-wallet-rescate-1', 'basura-ilegible'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    const dir1 = await B.listo(`currentWallet && currentWallet.address`, 60);
    ok(dir1 === DIR, 'abre la misma wallet', dir1);
    const crudo = await B.listo(`(localStorage.getItem('xmtp-chat-wallet') || '').startsWith('cwk1:') && localStorage.getItem('xmtp-chat-wallet')`, 20);
    ok(!!crudo, 'la clave quedó cifrada en disco', String(crudo).slice(0, 24));
    ok((await B.ev(`(localStorage.getItem('xmtp-chat-wallet-mnemonic') || '').startsWith('cwk1:')`)), 'la frase también');
    ok((await B.ev(`(localStorage.getItem(${JSON.stringify(claveG1)}) || '').startsWith('cwk1:')`)), 'la llave Ğ1 también');
    ok((await B.ev(`(localStorage.getItem('xmtp-chat-wallet-rescate-1') || '').startsWith('cwk1:')`)), 'y la copia de rescate');
    const f1 = await B.ev(fugas);
    ok(f1.length === 0, 'ningún secreto en claro en localStorage', JSON.stringify(f1));
    ok((await B.ev(`cwSecretoLeer('xmtp-chat-wallet-mnemonic')`)) === FRASE, 'la app lee la frase de memoria');
    ok((await B.ev(`cwSecretoLeer(${JSON.stringify(claveG1)})`)) === RAIZ, 'y la llave Ğ1');

    console.log('\n── recargar: abre desde lo cifrado ──');
    await B.rpc('Page.navigate', { url: BASE });
    const dir2 = await B.listo(`currentWallet && currentWallet.address`, 60);
    ok(dir2 === DIR, 'misma wallet después de recargar', dir2);
    ok((await B.ev(`window.__boveda.descifrar`)) >= 3, 'la abrió descifrando', String(await B.ev(`window.__boveda.descifrar`)));
    ok((await B.ev(`window.__boveda.cifrar`)) === 0, 'sin volver a cifrar lo que ya estaba cifrado');
    ok((await B.ev(fugas)).length === 0, 'sigue sin secretos en claro');

    // ── 4: falla pasajera del plugin ──
    console.log('\n── el plugin falla (pasajero) ──');
    const antes = await B.ev(`localStorage.getItem('xmtp-chat-wallet')`);
    await B.ev(`sessionStorage.setItem('cw-test-boveda', 'error'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`typeof renderContacts === 'function'`);
    const msg4 = await B.listo(`/No se pudo abrir la billetera guardada/.test(${estado}) && ${estado}`, 30);
    ok(!!msg4, 'dice que no pudo abrirla', JSON.stringify(msg4));
    ok(!(await B.ev(`!document.getElementById('initActions').classList.contains('hidden')`)), 'NO ofrece crear/restaurar');
    ok((await B.ev(`!currentWallet`)), 'no abrió ninguna wallet');
    ok((await B.ev(`[...document.querySelectorAll('button')].some(b => /Recargar/i.test(b.innerText))`)), 'ofrece recargar');
    ok((await B.ev(`localStorage.getItem('xmtp-chat-wallet')`)) === antes, 'lo guardado quedó intacto');
    await B.ev(`sessionStorage.removeItem('cw-test-boveda'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    ok((await B.listo(`currentWallet && currentWallet.address`, 60)) === DIR, 'cuando el plugin vuelve, abre la misma');

    // ── 6: sin bloqueo de pantalla ──
    console.log('\n── teléfono sin bloqueo de pantalla ──');
    await B.ev(`sessionStorage.setItem('cw-test-sin-bloqueo', '1'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`currentWallet && currentWallet.address`, 60);
    const av6 = await B.listo(`/no tiene bloqueo de pantalla/.test(${avisos}) && ${avisos}`, 20);
    ok(!!av6, 'avisa que no hay bloqueo de pantalla', JSON.stringify(av6));
    await B.ev(`sessionStorage.removeItem('cw-test-sin-bloqueo'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`currentWallet && currentWallet.address`, 60);
    await sleep(2500);
    ok(!/no tiene bloqueo de pantalla/.test(await B.ev(avisos)), 'con bloqueo, no avisa');

    // ── 5: la llave del chip ya no está ──
    console.log('\n── la llave del chip no está ──');
    const cifrada = await B.ev(`localStorage.getItem('xmtp-chat-wallet')`);
    await B.ev(`sessionStorage.setItem('cw-test-boveda', 'sin_llave'); true`);
    await B.rpc('Page.navigate', { url: BASE });
    await B.listo(`typeof renderContacts === 'function'`);
    const msg5 = await B.listo(`/12 palabras/.test(${estado}) && ${estado}`, 30);
    ok(!!msg5, 'pide restaurar con las 12 palabras', JSON.stringify(msg5));
    ok((await B.ev(`!document.getElementById('initActions').classList.contains('hidden')`)), 'muestra crear/restaurar');
    const copia = await B.ev(`Object.keys(localStorage).filter(k => k.startsWith('xmtp-chat-wallet-sin-abrir-')).map(k => localStorage.getItem(k))`);
    ok(copia.length === 1 && copia[0] === cifrada, 'guardó aparte lo cifrado', JSON.stringify(copia).slice(0, 60));
    await B.ev(`sessionStorage.removeItem('cw-test-boveda'); true`);

    // ── 7: wallet nueva por invitación: nace cifrada ──
    console.log('\n── wallet nueva por invitación ──');
    await B.ev(`localStorage.clear(); true`);
    await B.rpc('Page.navigate', { url: `${BASE}?address=${INVITA}` });
    const nueva = await B.listo(`currentWallet && currentWallet.address`, 60);
    ok(!!nueva && nueva !== DIR, 'creó una wallet', nueva);
    const crudo7 = await B.listo(`(localStorage.getItem('xmtp-chat-wallet') || '').startsWith('cwk1:') && localStorage.getItem('xmtp-chat-wallet')`, 20);
    ok(!!crudo7, 'nació cifrada en disco');
    const pk7 = await B.ev(`currentWallet.privateKey`);
    ok(!(await B.ev(`Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes(${'`'}\${currentWallet.privateKey.slice(2)}${'`'}))`)), 'su clave no está en claro en ningún lado');
    await B.rpc('Page.navigate', { url: BASE });
    ok((await B.listo(`currentWallet && currentWallet.privateKey`, 60)) === pk7, 'y abre la misma al recargar');

    // ── 8: web sin plugin, como siempre ──
    console.log('\n── web (sin plugin) ──');
    await B.ev(`localStorage.clear(); sessionStorage.clear(); localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); true`);
    await B.rpc('Page.navigate', { url: BASE });
    ok((await B.listo(`currentWallet && currentWallet.address`, 60)) === DIR, 'abre la wallet');
    await sleep(1500);
    ok((await B.ev(`localStorage.getItem('xmtp-chat-wallet')`)) === PK, 'y la deja en claro como antes (etapa 2 pendiente)');

    const exc = B.excepciones.filter(e => !/XMTP caído a propósito/.test(e || ''));
    ok(exc.length === 0, 'sin excepciones sin atrapar', JSON.stringify(exc.slice(0, 3)));
} finally {
    B.close();
}
console.log(fails ? `\n❌ ${fails} falla(s)` : '\n✅ todo bien');
process.exit(fails ? 1 : 0);
