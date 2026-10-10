// En Android, la app antes que el navegador + traspaso de la cuenta navegador → app.
// Un Chrome headless con user-agent de Android. Los dos lados del traspaso corren en dos
// orígenes distintos (127.0.0.1 = el navegador con la cuenta, localhost = la app sin wallet),
// así no comparten localStorage, igual que la PWA y el WebView del APK.
//
//   1. yarn parcel build src/dapp.html --dist-dir <dir> --public-url ./ --cache-dir .parcel-cache-ui
//   2. cd <dir> && python3 -m http.server 8817 &
//   3. unset NODE_OPTIONS && node tests/traspaso-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WEB = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const APP = WEB.replace('127.0.0.1', 'localhost');
const PORT = 9502;
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-traspaso-');
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
// Página limpia (sin service worker ni datos) en `url`, con lo que haga falta sembrado antes.
async function abrir(url, sembrar = '') {
    const origen = new URL(url).origin;
    await rpc('Page.navigate', { url: origen + '/favicon.ico' }); await sleep(600);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); sessionStorage.clear(); ${sembrar} })()`);
    await rpc('Page.navigate', { url }); await sleep(800);
    await pollFor(`typeof cwOfrecerApk === 'function' && document.readyState === 'complete'`, 40);
}
const visible = (sel) => `(() => { const el = document.querySelector(${JSON.stringify(sel)});
    return !!el && getComputedStyle(el).display !== 'none' && !el.classList.contains('hidden'); })()`;

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
    await rpc('Emulation.setUserAgentOverride', { userAgent: UA_ANDROID, platform: 'Linux armv8l' });

    // ── 1. Android, sin wallet y sin invitación: se ofrece la app ──
    await abrir(WEB);
    check('sin invitación: aparece la oferta de la app', await pollFor(visible('#cwOfrecerApk'), 20));
    check('…con el título general', /mejor como app/.test(await ev(`document.querySelector('#cwOfrecerApk h3').textContent`)));
    const hrefSin = await ev(`document.getElementById('cwApkAbrir').getAttribute('href')`);
    check('…"Ya la tengo" abre la app por intent en /dapp.html',
        hrefSin.startsWith('intent://chatwallet.org/dapp.html#Intent;') && hrefSin.includes('package=org.energiasonora.chatwallet'), hrefSin);
    check('…y sin la app, el intent cae a la descarga', hrefSin.includes(encodeURIComponent('chatwallet-energiasonora.apk')));
    check('…la descarga es el APK firmado', /chatwallet-energiasonora\.apk$/.test(await ev(`document.getElementById('cwApkBajar').href`)));
    check('los pasos se ven recién al tocar Descargar', await ev(visible('#cwApkPasos')) === false);
    await ev(`(() => { const a = document.getElementById('cwApkBajar'); a.addEventListener('click', e => e.preventDefault()); a.click(); })()`);
    check('…y después sí', await ev(visible('#cwApkPasos')));
    check('todavía no nació ninguna wallet', await ev(`!localStorage.getItem('xmtp-chat-wallet')`));
    await ev(`document.getElementById('cwApkSeguir').click()`);
    check('"Seguir en el navegador" la cierra', await pollFor(`!document.getElementById('cwOfrecerApk')`, 10));
    check('…y quedan Crear / Restaurar', await pollFor(visible('#initActions'), 10));
    check('…sin el botón de traer cuenta (es sólo del APK)', await ev(visible('#traspasoTraerBtn')) === false);
    await rpc('Page.reload'); await sleep(1500);
    await pollFor(`document.readyState === 'complete' && typeof cwOfrecerApk === 'function'`, 20);
    await sleep(1000);
    check('en la misma sesión no se vuelve a ofrecer', !await ev(`!!document.getElementById('cwOfrecerApk')`));

    // ── 2. Android con invitación: la oferta lleva la invitación a la app ──
    const INVITA = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    await abrir(`${WEB}?address=${INVITA}`);
    check('con invitación: aparece la oferta', await pollFor(visible('#cwOfrecerApk'), 20));
    check('…con el título de invitación', /invitaron/.test(await ev(`document.querySelector('#cwOfrecerApk h3').textContent`)));
    const hrefInv = await ev(`document.getElementById('cwApkAbrir').getAttribute('href')`);
    check('…y el intent lleva la invitación', hrefInv.startsWith(`intent://chatwallet.org/dapp.html?address=${INVITA}#Intent;`), hrefInv);
    check('mientras decide, no se crea la wallet', await ev(`!localStorage.getItem('xmtp-chat-wallet')`));
    await ev(`document.getElementById('cwApkSeguir').click()`);
    check('si sigue en el navegador, la invitación crea la wallet como siempre',
        await pollFor(`!!localStorage.getItem('xmtp-chat-wallet')`, 30));

    // ── 3. Traspaso: el navegador (127.0.0.1) tiene la cuenta ──
    await abrir(WEB);
    const cuenta = await ev(`(() => { const w = window.Wallet.createRandom();
        return { pk: w.privateKey, a: w.address, m: w.mnemonic.phrase }; })()`);
    const efimera = await ev(`(() => { const w = window.Wallet.createRandom();
        return { k: w.privateKey, pub: w.signingKey.compressedPublicKey.slice(2) }; })()`);
    await abrir(`${WEB}#cw-traspaso=${efimera.pub}`, `
        localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(cuenta.pk)});
        localStorage.setItem('xmtp-chat-wallet-mnemonic', ${JSON.stringify(cuenta.m)});
        localStorage.setItem('cw-moneda', 'ARS');`);
    check('el navegador con cuenta muestra "Llevar tu cuenta a la app"', await pollFor(`!!document.getElementById('cwTrSi')`, 90, 1000));
    check('…nombrando la cuenta', (await ev(`document.getElementById('cwTraspasoModal').textContent`)).includes(cuenta.a.slice(0, 6)));
    check('…y el fragmento con la llave ya no está en la URL', await ev(`location.hash`) === '');
    check('no ofrece la app arriba del traspaso', !await ev(`!!document.getElementById('cwOfrecerApk')`));
    await ev(`document.getElementById('cwTrSi').click()`);
    const intent = await pollFor(`document.getElementById('cwTrAbrir')?.getAttribute('href')`, 70, 500);
    check('arma el intent a la app', !!intent && intent.includes('package=org.energiasonora.chatwallet'), String(intent).slice(0, 90));
    const cifrado = /cw-traspaso=([0-9a-f]+)#Intent/.exec(intent || '')?.[1];
    check('…con la cuenta cifrada en el query (no en claro)', !!cifrado && !intent.includes(cuenta.pk.slice(2)) && !intent.includes(cuenta.m.split(' ')[0] + ' '));
    // Tocar "Abrir la app" (el intent no lleva a ningún lado en headless): luego ofrece borrar.
    await ev(`(() => { const a = document.getElementById('cwTrAbrir'); a.addEventListener('click', e => e.preventDefault()); a.click(); })()`);
    check('al volver, ofrece borrarla de este navegador', await pollFor(`!!document.getElementById('cwTrBorrar')`, 10));

    // ── 4. La app (localhost, sin wallet) recibe la cuenta ──
    const urlApp = `https://chatwallet.org/dapp.html?cw-traspaso=${cifrado}`;
    await abrir(APP, `localStorage.setItem('cw-traspaso-llave', JSON.stringify({ k: ${JSON.stringify(efimera.k)}, t: Date.now() }));`);
    await ev(`document.getElementById('cwApkSeguir')?.click()`).catch(() => { });
    await ev(`cwTraspasoRecibir(${JSON.stringify(urlApp)})`);
    await pollFor(`!!localStorage.getItem('xmtp-chat-wallet')`, 10);
    check('la app guardó la MISMA cuenta', await ev(`localStorage.getItem('xmtp-chat-wallet')`) === cuenta.pk);
    check('…con su frase', await ev(`localStorage.getItem('xmtp-chat-wallet-mnemonic')`) === cuenta.m);
    check('…y la moneda elegida', await ev(`localStorage.getItem('cw-moneda')`) === 'ARS');
    check('la llave de un solo uso se borró', await ev(`localStorage.getItem('cw-traspaso-llave')`) === null);
    await sleep(2500);   // recarga sola
    check('tras recargar, abre esa cuenta', await pollFor(`currentWallet && currentWallet.address === ${JSON.stringify(cuenta.a)}`, 60));

    // ── 5. Lo que no tiene que pasar ──
    await ev(`cwTraspasoRecibir(${JSON.stringify(urlApp)})`);
    check('repetir el mismo link: ya no hay llave → "venció"', /venció/.test(await ev(`document.body.innerText`)));
    await abrir(APP, `localStorage.setItem('cw-traspaso-llave', JSON.stringify({ k: ${JSON.stringify(efimera.k)}, t: Date.now() - 16 * 60000 }));`);
    await ev(`document.getElementById('cwApkSeguir')?.click()`).catch(() => { });
    await ev(`cwTraspasoRecibir(${JSON.stringify(urlApp)})`);
    check('llave de hace 16 min: no la toma', await ev(`!localStorage.getItem('xmtp-chat-wallet')`));
    const otra = await ev(`(() => { const w = window.Wallet.createRandom(); return { k: w.privateKey, pub: w.signingKey.compressedPublicKey.slice(2) }; })()`);
    await abrir(APP, `localStorage.setItem('cw-traspaso-llave', JSON.stringify({ k: ${JSON.stringify(otra.k)}, t: Date.now() }));`);
    await ev(`document.getElementById('cwApkSeguir')?.click()`).catch(() => { });
    await ev(`cwTraspasoRecibir(${JSON.stringify(urlApp)})`);
    check('cifrado para otra llave: no se abre', await ev(`!localStorage.getItem('xmtp-chat-wallet')`));
    check('…y lo dice', /No se pudo abrir la cuenta/.test(await ev(`document.body.innerText`)));

    // ── 6. El navegador sin cuenta recibe el pedido ──
    await abrir(`${WEB}#cw-traspaso=${efimera.pub}`);
    check('navegador sin cuenta: lo explica y ofrece copiar el link', await pollFor(`!!document.getElementById('cwTrCopiar')`, 20));
    check('…y no ofrece instalar la app', !await ev(`!!document.getElementById('cwOfrecerApk')`));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
