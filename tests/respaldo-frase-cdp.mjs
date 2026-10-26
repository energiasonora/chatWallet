// Respaldo de la frase secreta, de punta a punta en la app real (Chrome headless por CDP).
// Cubre: palabras numeradas en orden, clave privada escondida en "Opciones avanzadas",
// comprobación de una palabra (falla con la equivocada, acepta sin tildes/mayúsculas),
// y que recién al acertar se apaga el aviso. También el caso sin frase (importada por clave).
//
// Uso: servir el build en :8817 (python3 -m http.server 8817 -d dist-respaldo-test) y
//      node tests/respaldo-frase-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9461;
const APP = process.env.APP_URL || 'http://localhost:8817/dapp.html';
const PK = '0x584bf778404a370bc90c7ef5c1aef766bc3aff5761a02d69d1294d843513b06c';
const FRASE = 'devote emotion cash dress loop tuition receive giraffe term clerk snack truly';
const PALABRAS = FRASE.split(' ');

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw-frase-${Date.now()}`,
    '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map(); let ws;
const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 30000);
});
const ev = (expr) => rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    .then(r => { if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result?.value; });
const visible = (id) => ev(`!document.getElementById('${id}').classList.contains('hidden')`);

async function cargar(seed) {
    await rpc('Page.navigate', { url: APP }); await sleep(2500);
    await ev(`(async()=>{for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); ${seed} })()`);
    await rpc('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`typeof currentWallet!=='undefined' && !!currentWallet`)) return; }
    throw new Error('la wallet no cargó');
}

try {
    let target;
    for (let i = 0; i < 40 && !target; i++) {
        try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        await sleep(300);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id).resolve(d.result || d); pending.delete(d.id); } };
    await rpc('Page.enable'); await rpc('Runtime.enable');

    // ── Wallet con frase, backup pendiente ──
    await cargar(`localStorage.setItem('xmtp-chat-wallet', '${PK}');
        localStorage.setItem('xmtp-chat-wallet-mnemonic', '${FRASE}');`);
    await ev(`openBackupModal()`);
    ok(await visible('backupWarningView'), 'abre con el aviso primero');
    await ev(`document.getElementById('showBackupKeysBtn').click()`);
    const items = await ev(`[...document.querySelectorAll('#backupWordsGrid li')].map(li=>li.textContent.replace(/\\s+/g,' ').trim())`);
    ok(items.length === 12, `12 palabras en la grilla (${items.length})`);
    ok(items.every((t, i) => t === `${i + 1}.${PALABRAS[i]}`), 'cada palabra con su número, en orden: ' + items.slice(0, 3).join(' | '));
    ok(await ev(`document.getElementById('backupAdvanced').open === false`), 'la clave privada queda cerrada en Opciones avanzadas');
    ok(await ev(`document.getElementById('closeBackupModalBtn').textContent.trim()`) === 'Ya las anoté', 'botón "Ya las anoté"');
    const shot = await rpc('Page.captureScreenshot', { format: 'png' });
    (await import('node:fs')).writeFileSync(process.env.SHOT || `${os.tmpdir()}/respaldo-palabras.png`, Buffer.from(shot.data, 'base64'));

    await ev(`document.getElementById('closeBackupModalBtn').click()`);
    ok(await visible('backupVerifyView'), 'pasa a la comprobación');
    const n = Number(await ev(`document.getElementById('backupVerifyNum').textContent`));
    ok(n >= 2 && n <= 12, `pide la palabra número ${n} (nunca la 1)`);

    const equivocada = PALABRAS[n === 12 ? 0 : n]; // la de al lado: orden mal anotado
    await ev(`document.getElementById('backupVerifyInput').value='${equivocada}'; document.getElementById('backupVerifyBtn').click()`);
    ok(!!(await ev(`document.getElementById('backupVerifyMsg').textContent`)), 'palabra equivocada → mensaje de error');
    ok(!(await ev(`localStorage.getItem('xmtp-chat-wallet-backup-done')`)), 'con la equivocada NO se da por hecho');

    await ev(`document.getElementById('backupVerifyBackBtn').click()`);
    ok(await visible('backupKeysView'), '"Volver a ver las palabras" vuelve a la grilla');
    await ev(`document.getElementById('closeBackupModalBtn').click()`);
    const n2 = Number(await ev(`document.getElementById('backupVerifyNum').textContent`));
    await ev(`document.getElementById('backupVerifyInput').value='  ${PALABRAS[n2 - 1].toUpperCase()} ';
        document.getElementById('backupVerifyInput').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`);
    ok(await ev(`localStorage.getItem('xmtp-chat-wallet-backup-done')`) === '1', 'palabra correcta (mayúsculas/espacios, Enter) → respaldo hecho');
    ok(await ev(`document.getElementById('backupWalletModal').classList.contains('hidden')`), 'el modal se cierra');
    ok(await ev(`document.getElementById('backupWordsGrid').children.length`) === 0, 'las palabras no quedan en el DOM');
    ok(await ev(`document.getElementById('backupWalletSettingsBtn').textContent.trim()`) === 'Ver mis palabras secretas', 'Configuración ofrece "Ver mis palabras secretas"');

    // Ya hecho: volver a abrir no pide comprobar de nuevo.
    await ev(`openBackupModal(); document.getElementById('showBackupKeysBtn').click()`);
    ok(await ev(`document.getElementById('closeBackupModalBtn').textContent.trim()`) === 'Listo', 'ya respaldada: el botón es "Listo"');
    await ev(`document.getElementById('closeBackupModalBtn').click()`);
    ok(await ev(`document.getElementById('backupWalletModal').classList.contains('hidden')`), '"Listo" cierra sin comprobar');

    // Acentos: en la lista española la comparación ignora tildes.
    ok(await ev(`normalizarPalabra('Ábaco') === normalizarPalabra('abaco')`), 'compara sin tildes (ábaco = abaco)');

    // ── Wallet importada por clave privada (sin frase) ──
    await cargar(`localStorage.setItem('xmtp-chat-wallet', '${PK}');`);
    await ev(`openBackupModal(); document.getElementById('showBackupKeysBtn').click()`);
    ok(await ev(`document.getElementById('backupMnemonicContainer').classList.contains('hidden')`), 'sin frase: no hay grilla');
    ok(await ev(`document.getElementById('backupAdvanced').open === true`), 'sin frase: la clave privada se muestra abierta');
    ok(await ev(`document.getElementById('backupPrivateKey').textContent`) === PK, 'muestra la clave correcta');
} catch (e) {
    console.error('💥', e); fails++;
} finally {
    try { ws?.close(); } catch { }
    chrome.kill();
    console.log(fails ? `\n${fails} fallas` : '\nTodo OK');
    process.exit(fails ? 1 : 0);
}
