// Verificación end-to-end del respaldo incremental DENTRO de la app real (Chrome headless
// por CDP, sin playwright). Cubre lo que el test de formato no puede: la migración de
// IndexedDB v2→v3, el store 'bkstate', y chatBackupNow() entero corriendo en el navegador.
//
// Las URLs del nodo están hardcodeadas a producción en dapp.html, así que se interceptan
// por CDP (Fetch.requestPaused) y se reescriben al upload-server y al gateway locales:
// el test NO toca la caja.
//
// Correr vía tests/run-backup-cdp.sh (levanta Kubo + upload-server + http server).
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9455;
const APP = process.env.APP_URL || 'http://localhost:8817/dapp.html';
const LOCAL_UPLOAD = `http://127.0.0.1:${process.env.UPLOAD_PORT || 3199}`;
const LOCAL_GATEWAY = process.env.GATEWAY_ORIGIN || 'http://127.0.0.1:8080';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // hardhat

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`,
    // Perfil limpio por corrida: uno reusado arrastra las bases IndexedDB del run anterior.
    `--user-data-dir=${os.tmpdir()}/cdp-cw-backup-${Date.now()}`,
    '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map();
let ws;
function rpc(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
        const mid = ++id; pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
        setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 45000);
    });
}
const ev = (expr, aw = false) => rpc('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: aw }).then(r => r.result?.value);

const metrics = async () => {
    const txt = await (await fetch(`${LOCAL_UPLOAD}/metrics`)).text();
    const get = k => Number((txt.match(new RegExp(`${k} (\\d+)`)) || [])[1] ?? 0);
    return { uploads: get('chatwallet_uploads_total'), bytes: get('chatwallet_upload_bytes_total') };
};

try {
    // ── Conectar a Chrome ──
    let target;
    for (let i = 0; i < 40; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
            target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
            if (target) break;
        } catch { }
        await sleep(500);
    }
    if (!target) throw new Error('no hay target de Chrome');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    const consoleLines = [];
    ws.addEventListener('message', async ev2 => {
        const m = JSON.parse(ev2.data);
        if (m.id && pending.has(m.id)) {
            const p = pending.get(m.id); pending.delete(m.id);
            m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
            return;
        }
        if (m.method === 'Runtime.consoleAPICalled') {
            const txt = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
            consoleLines.push(txt);
        }
        // Redirigir las llamadas a producción hacia el nodo local.
        if (m.method === 'Fetch.requestPaused') {
            const { requestId, request } = m.params;
            let url = request.url;
            if (url.startsWith('https://backup.chatwallet.org')) {
                url = url.replace('https://backup.chatwallet.org', LOCAL_UPLOAD);
            } else if (url.startsWith('https://gateway.chatwallet.org')) {
                url = url.replace('https://gateway.chatwallet.org', LOCAL_GATEWAY);
            }
            try { await rpc('Fetch.continueRequest', { requestId, url }); } catch { }
        }
    });

    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Fetch.enable', {
        patterns: [
            { urlPattern: 'https://backup.chatwallet.org/*' },
            { urlPattern: 'https://gateway.chatwallet.org/*' },
        ],
    });

    // Esperar por CONDICIÓN, no por reloj: la app tarda distinto según cache y red, y con
    // esperas fijas el test falla por lento, no por roto.
    const esperarWallet = async (segundos = 40) => {
        for (let i = 0; i < segundos * 2; i++) {
            if (await ev(`!!(window.currentWallet && window.currentWallet.privateKey)`)) return true;
            await sleep(500);
        }
        return false;
    };

    console.log('→ cargando la app…');
    await rpc('Page.navigate', { url: APP });
    await sleep(3000);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
    await rpc('Page.navigate', { url: APP });

    const listo = await esperarWallet();
    ok(listo, 'la wallet quedó cargada en la app');
    if (!listo) throw new Error('la app nunca cargó la wallet; el resto del test no tiene sentido');

    // ── La migración de IndexedDB: v3 con el store 'bkstate' ──

    // Abrir la base sin poder CREARLA ni migrarla: si hiciera falta un upgrade, aborta.
    // Las dos versiones anteriores de este test se autoinfligieron el fallo — una abriendo
    // sin versión (crea en v1), otra con versión 3 (crea en v3, vacía). El test no debe
    // poder fabricar la base cuya migración está verificando.
    const ABRIR = `(() => new Promise((res, rej) => {
        const r = indexedDB.open('chatwallet-msgstore', 3);
        r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} rej(new Error('la app todavia no creo la base')); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error || new Error('open fallo'));
    }))()`;

    // Esperar a que la APP haya creado la base con sus tres stores.
    const esperarDb = async (segundos = 60) => {
        for (let i = 0; i < segundos * 2; i++) {
            const r = await ev(`(async () => { try {
                const db = await ${ABRIR}; const s = [...db.objectStoreNames]; db.close();
                return { version: db.version, stores: s };
            } catch (e) { return null; } })()`, true);
            if (r && r.stores.length >= 3) return r;
            await sleep(500);
        }
        return null;
    };

    // La app abre el store recién cuando lo necesita, y con XMTP lento eso puede tardar.
    // Un clic al botón de respaldo dispara chatBackupNow() → msgStoreOpen(), así la base la
    // crea LA APP por su camino real (que es justo lo que queremos verificar), no el test.
    await ev(`document.getElementById('chatBackupNowBtn').click()`);
    await sleep(2000);

    const dbInfo = await esperarDb();
    ok(dbInfo?.version === 3, `la app migró IndexedDB a v3 (es v${dbInfo?.version})`);
    ok(dbInfo?.stores?.includes('bkstate'), `existe el store 'bkstate' (${dbInfo?.stores?.join(', ')})`);

    // ── Sembrar historial ──
    const seed = n => `(async () => {
        const db = await ${ABRIR};
        await new Promise((res, rej) => {
            const tx = db.transaction('messages', 'readwrite');
            const os = tx.objectStore('messages');
            for (let i = 0; i < ${n}; i++) {
                os.put({ id: 'cdp-' + Date.now() + '-' + i + '-' + Math.random().toString(36).slice(2),
                         peer: '0xabc0000000000000000000000000000000000001',
                         ts: Date.now() + i, body: 'mensaje ' + i, sender: 'me' });
            }
            tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
        return new Promise(res => { const t = db.transaction('messages','readonly').objectStore('messages').count(); t.onsuccess = () => res(t.result); });
    })()`;

    const total1 = await ev(seed(200), true);
    ok(total1 >= 200, `sembrados ${total1} mensajes en el store`);

    // ── Primer respaldo ──
    const m0 = await metrics();
    await ev(`document.getElementById('chatBackupNowBtn').click()`);
    await sleep(7000);
    const m1 = await metrics();
    ok(m1.uploads - m0.uploads === 2, `primer respaldo = 2 subidas (segmento + manifiesto), fueron ${m1.uploads - m0.uploads}`);
    const bytesPrimero = m1.bytes - m0.bytes;
    console.log(`   primer respaldo: ${bytesPrimero} bytes`);

    // ── Segundo respaldo con 3 mensajes nuevos: tiene que ser MUCHO más chico ──
    await ev(seed(3), true);
    await ev(`document.getElementById('chatBackupNowBtn').click()`);
    await sleep(7000);
    const m2 = await metrics();
    const bytesDelta = m2.bytes - m1.bytes;
    console.log(`   segundo respaldo (3 mensajes nuevos): ${bytesDelta} bytes`);
    ok(m2.uploads - m1.uploads === 2, `segundo respaldo = 2 subidas, fueron ${m2.uploads - m1.uploads}`);
    ok(bytesDelta < bytesPrimero / 3,
        `el delta pesa mucho menos que el historial completo (${bytesDelta} vs ${bytesPrimero} bytes)`);

    // ── El estado de segmentos quedó persistido ──
    const st = await ev(`(async () => {
        const db = await ${ABRIR};
        const keys = await new Promise(res => { const r = db.transaction('bkstate','readonly').objectStore('bkstate').getAllKeys(); r.onsuccess = () => res(r.result); });
        const val = await new Promise(res => { const r = db.transaction('bkstate','readonly').objectStore('bkstate').get(keys[0]); r.onsuccess = () => res(r.result); });
        return { keys, segments: val?.segments?.length, covered: val?.covered?.length };
    })()`, true);
    ok(st?.segments === 2, `quedaron 2 segmentos registrados (${st?.segments})`);
    ok(st?.covered === total1 + 3, `el estado cubre ${st?.covered} mensajes (esperado ${total1 + 3})`);

    // ── Restore en dispositivo "nuevo": borrar todo y recuperar del respaldo ──
    // El borrado va por CDP y no con indexedDB.deleteDatabase() desde la página: la app
    // mantiene su conexión abierta (msgStoreDbPromise la cachea), así que el delete queda
    // "blocked" y la base sobrevive a medias — el test se peleaba con su propia app.
    // Navegar a about:blank cierra las conexiones y recién ahí se limpia el origen entero
    // (IndexedDB + OPFS), que es lo que de verdad se parece a un dispositivo nuevo.
    await rpc('Page.navigate', { url: 'about:blank' });
    await sleep(1500);
    await rpc('Storage.clearDataForOrigin', {
        origin: new URL(APP).origin,
        storageTypes: 'indexeddb,file_systems,cache_storage',
    });
    await rpc('Page.navigate', { url: APP });
    await esperarWallet();
    const vacio = await ev(`(async () => {
        const db = await ${ABRIR};
        return new Promise(res => { const t = db.transaction('messages','readonly').objectStore('messages').count(); t.onsuccess = () => res(t.result); });
    })()`, true);
    console.log(`   store tras el borrado: ${typeof vacio === 'number' ? vacio + ' mensajes' : 'base ausente (la app aún no la recreó)'}`);

    await ev(`document.getElementById('chatBackupRestoreBtn').click()`);
    await sleep(12000);
    const restaurados = await ev(`(async () => {
        const db = await ${ABRIR};
        return new Promise(res => { const t = db.transaction('messages','readonly').objectStore('messages').count(); t.onsuccess = () => res(t.result); });
    })()`, true);
    ok(restaurados >= total1 + 3, `restore recuperó ${restaurados} mensajes (esperado ${total1 + 3})`);

    const errores = consoleLines.filter(l => /respaldo|backup|segmento|bkstate/i.test(l) && /error|falló|rechaz/i.test(l));
    ok(errores.length === 0, `sin errores de respaldo en consola${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
    console.log('   --- consola relevante ---');
    consoleLines.filter(l => /☁/.test(l)).slice(-8).forEach(l => console.log('   ' + l));
} catch (e) {
    console.error('💥', e);
    fails++;
} finally {
    try { chrome.kill(); } catch { }
    console.log(fails ? `\n❌ ${fails} chequeos fallaron` : '\n✅ todos los chequeos pasaron');
    process.exit(fails ? 1 : 0);
}
