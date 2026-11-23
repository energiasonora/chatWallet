// Pestaña Archivos con planes de espacio, dentro de la app real (Chrome headless por CDP).
// Las URLs del nodo están fijas a producción en dapp.html: se interceptan por CDP y se mandan
// al upload-server y al Kubo locales. El test NO toca la caja.
//
// Correr vía tests/run-espacio-cdp.sh (levanta Kubo + upload-server + http server).
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9457;
const APP = process.env.APP_URL || 'http://localhost:8818/dapp.html';
const LOCAL_UPLOAD = `http://127.0.0.1:${process.env.UPLOAD_PORT || 3198}`;
const LOCAL_GATEWAY = process.env.GATEWAY_ORIGIN || 'http://127.0.0.1:8080';
const PLANES = process.env.ESPACIO_PLANES;
const SHOTS = process.env.SHOTS_DIR || os.tmpdir();
// Wallet nueva en cada corrida: no comparte inbox con nadie.
const PK = '0x' + randomBytes(32).toString('hex');

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const espacio = (...args) => execFileSync(process.execPath, ['poc/ipfs-node/espacio.mjs', ...args],
    { env: { ...process.env, ESPACIO_PLANES: PLANES } }).toString().trim();

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw-espacio-${Date.now()}`,
    '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map(); let ws;
function rpc(method, params = {}) {
    return new Promise((resolve, reject) => {
        const mid = ++id; pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
        setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 60000);
    });
}
const ev = (expr, aw = false) => rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: aw })
    .then(r => r.result?.value);
const esperar = async (expr, segundos = 30) => {
    for (let i = 0; i < segundos * 4; i++) { if (await ev(expr)) return true; await sleep(250); }
    return false;
};
const foto = async (nombre) => {
    const { data } = await rpc('Page.captureScreenshot', { format: 'png' });
    const f = path.join(SHOTS, nombre); writeFileSync(f, Buffer.from(data, 'base64')); console.log(`   📸 ${f}`);
};
const tabVisible = `(() => { const b = document.getElementById('filesNavBtn'); return !!b && !b.classList.contains('hidden') && getComputedStyle(b).display !== 'none'; })()`;
const toasts = [];

try {
    let target;
    for (let i = 0; i < 40 && !target; i++) {
        try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        if (!target) await sleep(500);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', async e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return; }
        if (m.method === 'Fetch.requestPaused') {
            const { requestId, request } = m.params;
            const url = request.url.replace('https://backup.chatwallet.org', LOCAL_UPLOAD).replace('https://gateway.chatwallet.org', LOCAL_GATEWAY);
            try { await rpc('Fetch.continueRequest', { requestId, url }); } catch { }
        }
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Fetch.enable', { patterns: [{ urlPattern: 'https://backup.chatwallet.org/*' }, { urlPattern: 'https://gateway.chatwallet.org/*' }] });

    await rpc('Page.navigate', { url: APP });
    await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`, true);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
    await rpc('Page.navigate', { url: APP });
    ok(await esperar(`!!(window.currentWallet && window.currentWallet.privateKey)`, 45), 'la app cargó la wallet');
    // Capturar los toasts de la app para leer los mensajes.
    await ev(`(() => { const o = window.showToast; window.__toasts = []; window.showToast = (m, t) => { window.__toasts.push(String(m)); return o?.(m, t); }; })()`);
    const addr = await ev(`window.currentWallet.address`);

    // ── Sin plan: no hay pestaña ──
    await ev(`window.cwEspacioRevisar()`, true);
    await sleep(500);
    ok(!(await ev(tabVisible)), 'sin plan, la pestaña Archivos no aparece');

    // ── Con plan ──
    console.log('   ' + espacio('dar', addr, '0.02', '30', 'prueba CDP'));   // ~20 MB
    await ev(`window.cwEspacioRevisar()`, true);
    ok(await esperar(tabVisible, 10), 'con plan, la pestaña Archivos aparece');
    await ev(`document.getElementById('filesNavBtn').click()`);
    await sleep(800);
    const card = await ev(`({ usado: document.getElementById('espacioUsado').textContent, vence: document.getElementById('espacioVence').textContent, hint: document.getElementById('ipfsDropHint').textContent })`);
    ok(/de 20 MB/.test(card.usado) && /hasta el/.test(card.vence), `la tarjeta muestra el plan («${card.usado}», «${card.vence}»)`);
    ok(/100 MB/.test(card.hint), `el tope por archivo es el del plan («${card.hint}»)`);
    await foto('espacio-1-plan.png');

    // Subir un archivo público de 6 MB (más que el tope gratis) y uno privado chico.
    const pub = path.join(os.tmpdir(), 'cw-espacio-publico.bin'); writeFileSync(pub, randomBytes(6 * 1024 * 1024));
    const priv = path.join(os.tmpdir(), 'cw-espacio-secreto.txt'); writeFileSync(priv, 'nota secreta ' + Date.now());
    const { root } = await rpc('DOM.getDocument');
    const { nodeId } = await rpc('DOM.querySelector', { nodeId: root.nodeId, selector: '#ipfsFileInput' });
    await rpc('DOM.setFileInputFiles', { nodeId, files: [pub] });
    await sleep(300);
    await ev(`document.getElementById('ipfsUploadBtn').click()`);
    ok(await esperar(`JSON.parse(localStorage.getItem('chatwallet_ipfs_uploads') || '[]').some(e => e.name === 'cw-espacio-publico.bin')`, 60), 'subió el archivo público de 6 MB');

    await ev(`document.getElementById('ipfsPrivateToggle').checked = true`);
    await rpc('DOM.setFileInputFiles', { nodeId, files: [priv] });
    await sleep(300);
    await ev(`document.getElementById('ipfsUploadBtn').click()`);
    ok(await esperar(`JSON.parse(localStorage.getItem('chatwallet_ipfs_uploads') || '[]').some(e => e.name === 'cw-espacio-secreto.txt' && e.isPrivate)`, 60), 'subió el archivo privado');
    await ev(`document.getElementById('ipfsPrivateToggle').checked = false`);

    // El gateway devuelve el público tal cual y el privado como bytes ilegibles.
    const hist = await ev(`JSON.parse(localStorage.getItem('chatwallet_ipfs_uploads'))`);
    const cPriv = hist.find(e => e.isPrivate).cid;
    const bytesPriv = Buffer.from(await (await fetch(`${LOCAL_GATEWAY}/ipfs/${cPriv}`)).arrayBuffer());
    ok(!bytesPriv.toString('latin1').includes('nota secreta'), 'el nodo guarda el privado cifrado (no se lee en el gateway)');

    await sleep(1500);
    const usado = await ev(`document.getElementById('espacioUsado').textContent`);
    ok(/^6(\.\d+)? MB de 20 MB/.test(usado), `la barra de uso se actualizó («${usado}»)`);
    await ev(`document.querySelector('[data-view="documentView"]').scrollIntoView()`);
    await foto('espacio-2-subidos.png');

    // Descifrar el privado desde la lista.
    await ev(`window.__toasts.length = 0`);
    await ev(`document.querySelector('#ipfsHistory button[data-acc="descifrar"]').click()`);
    ok(await esperar(`window.__toasts.some(t => t.startsWith('Descifrado y guardado'))`, 20), 'el privado se descifra desde la lista');

    // Un nombre con comillas no rompe la lista (antes iba dentro de un onclick).
    await ev(`(() => { const h = JSON.parse(localStorage.getItem('chatwallet_ipfs_uploads')); h.unshift({ name: "it's <b>raro</b>.pdf", size: 10, cid: h[0].cid, isPrivate: false, date: new Date().toISOString() }); localStorage.setItem('chatwallet_ipfs_uploads', JSON.stringify(h)); })()`);
    await ev(`document.getElementById('filesNavBtn').click()`);
    await sleep(400);
    ok(await ev(`!document.querySelector('#ipfsHistory b') && document.getElementById('ipfsHistory').textContent.includes("it's <b>raro</b>.pdf")`), 'un nombre con comillas y HTML se muestra como texto');

    // ── Plan lleno: otro de 6 MB entra, un tercero de 10 MB no ──
    const grande = path.join(os.tmpdir(), 'cw-espacio-grande.bin'); writeFileSync(grande, randomBytes(15 * 1024 * 1024));
    await ev(`window.__toasts.length = 0`);
    await rpc('DOM.setFileInputFiles', { nodeId, files: [grande] });
    await sleep(300);
    await ev(`document.getElementById('ipfsUploadBtn').click()`);
    ok(await esperar(`window.__toasts.some(t => /no tiene lugar/.test(t))`, 30), 'sin lugar en el plan, el nodo lo rechaza con un mensaje claro');
    await ev(`document.getElementById('ipfsClearBtn').click()`);

    // ── Plan vencido: la pestaña sigue (los archivos son suyos), con aviso ──
    espacio('dar', addr, '0.02', '2026-01-01');
    await ev(`window.cwEspacioRevisar()`, true);
    await sleep(500);
    const venc = await ev(`({ tab: ${tabVisible}, vence: document.getElementById('espacioVence').textContent, aviso: document.getElementById('espacioAviso').textContent })`);
    ok(venc.tab && /venció/.test(venc.vence) && /siguen guardados/.test(venc.aviso), `plan vencido: pestaña visible y aviso («${venc.vence}»)`);
    await ev(`window.__toasts.length = 0`);
    await rpc('DOM.setFileInputFiles', { nodeId, files: [pub] });
    ok(await esperar(`window.__toasts.some(t => /supera 5(\\.00)? MB/.test(t))`, 5), 'vencido, vuelve al tope gratis de 5 MB por archivo');
    await foto('espacio-3-vencido.png');

    // ── Sin plan otra vez: la pestaña se va y la app vuelve a la wallet ──
    espacio('quitar', addr);
    await ev(`window.cwEspacioRevisar()`, true);
    await sleep(500);
    ok(!(await ev(tabVisible)) && await ev(`document.getElementById('walletView').classList.contains('active')`), 'plan quitado: la pestaña desaparece y vuelve a la wallet');
} catch (e) {
    console.error('💥', e); fails++;
} finally {
    try { chrome.kill(); } catch { }
}
console.log(fails ? `\n${fails} FALLAS` : '\nTodo OK');
process.exit(fails ? 1 : 0);
