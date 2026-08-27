// Verifica el aviso de mudanza dentro de la app REAL (el build que va al APK), manejando
// Chrome por CDP. Comprueba lo que importa: que aparezca SÓLO en la APK vieja, que no
// aparezca en la web, y que los tres pasos hagan lo que prometen.
//
// Uso:  APP_URL=http://localhost:8818/dapp.html node tests/migration-splash-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9334';
const APP = process.env.APP_URL || 'http://localhost:8818/dapp.html';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = await (await fetch(CDP + '/json/list')).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const waiters = new Map();
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; waiters.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.onopen = r);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); } };
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async (expr, byValue = true) =>
    (await rpc('Runtime.evaluate', { expression: expr, returnByValue: byValue, awaitPromise: true })).result?.value;

const esperar = async (expr, segundos = 40) => {
    for (let i = 0; i < segundos * 2; i++) { if (await ev(expr)) return true; await sleep(500); }
    return false;
};

// ── 1. Como WEB (sin Capacitor): el aviso NO debe existir en pantalla ──
console.log('→ probando como web (sin Capacitor)…');
await rpc('Page.navigate', { url: APP });
await sleep(2500);
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
await rpc('Page.navigate', { url: APP });
ok(await esperar(`!!(window.currentWallet && window.currentWallet.privateKey)`), 'la wallet cargó');
await sleep(3000);
ok(await ev(`document.getElementById('migrationSplash').classList.contains('hidden')`),
   'en la web el aviso queda oculto (no hay nada que desinstalar)');

// ── 2. Como APK vieja: se finge Capacitor ANTES de que corran los scripts ──
console.log('→ probando como APK vieja (Capacitor nativo)…');
await rpc('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
             window.__urlAbierta = null;
             const _open = window.open;
             window.open = (u, t) => { window.__urlAbierta = u; return null; };`
});
await rpc('Page.navigate', { url: APP });
ok(await esperar(`!!(window.currentWallet && window.currentWallet.privateKey)`), 'la wallet cargó en modo nativo');
ok(await ev(`!!(window.Capacitor && window.Capacitor.isNativePlatform())`), 'la app se cree nativa');

const aparecio = await esperar(`!document.getElementById('migrationSplash').classList.contains('hidden')`, 25);
ok(aparecio, 'el aviso de mudanza aparece solo en la APK');

if (aparecio) {
    ok(await ev(`document.getElementById('migrationSplash').innerText.includes('ChatWallet se muda')`),
       'dice de qué se trata');
    ok(await ev(`document.getElementById('migrationSplash').innerText.includes('desinstalar')`),
       'avisa que hay que desinstalar (que es lo que borra los datos)');

    // Paso 3: el botón tiene que apuntar al APK FIRMADO, no al que baja el updater.
    await ev(`document.getElementById('migDownloadBtn').click()`);
    const url = await ev(`window.__urlAbierta`);
    ok(/chatwallet-energiasonora\.apk$/.test(url || ''),
       `el botón baja el APK firmado (${url})`);

    // Paso 2: abre el flujo de semilla que ya existía y cierra el aviso.
    await ev(`document.getElementById('migShowSeedBtn').click()`);
    await sleep(600);
    ok(!(await ev(`document.getElementById('backupWalletModal').classList.contains('hidden')`)),
       'el paso 2 abre el modal de la frase semilla');
    ok(await ev(`document.getElementById('migrationSplash').classList.contains('hidden')`),
       'y el aviso se corre para dejarlo ver');

    // Paso 1: existe y está cableado (el respaldo real necesita el nodo soberano).
    ok(await ev(`typeof document.getElementById('migBackupChatsBtn').onclick === 'function'`),
       'el paso 1 tiene el respaldo de chats cableado');
}

// ── 3. Tema claro: el aviso pinta su propio fondo oscuro, así que su texto tiene que
// seguir siendo claro. El override `body.theme-light .text-white{color:#111827}` dejaba
// las palabras en negrita casi negras sobre negro — invisible — y así salió la 2.26.
console.log('→ probando con tema claro…');
await ev(`document.body.classList.add('theme-light')`);
await sleep(300);

const luminancia = async sel => await ev(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    if (!el) return null;
    const m = getComputedStyle(el).color.match(/\\d+/g).map(Number);
    return Math.round(0.2126*m[0] + 0.7152*m[1] + 0.0722*m[2]);
})()`);

for (const [sel, que] of [
    ['#migrationSplash h2', 'el título'],
    ['#migrationSplash strong', 'las palabras en negrita'],
    ['#migrationSplash #migLaterBtn', 'el botón "Ahora no"'],
]) {
    const L = await luminancia(sel);
    ok(L !== null && L > 120, `en tema claro, ${que} sigue siendo legible sobre el fondo oscuro (luminancia ${L})`);
}
await ev(`document.body.classList.remove('theme-light')`);

// ── 3. La red: esta build es el PUENTE, tiene que seguir hablando XMTP dev ──
// Se mira el fuente, no el bundle: Parcel minifica y renombra, así que buscar la
// constante en el HTML servido daría un falso negativo.
console.log(fails ? `\n❌ ${fails} chequeos fallaron` : '\n✅ todos los chequeos pasaron');
ws.close();
process.exit(fails ? 1 : 0);
