// Verifica que en Android la web ofrezca el APK en vez de la PWA — en el build real,
// manejando Chrome por CDP. Se falsea el User-Agent (Emulation.setUserAgentOverride)
// porque es exactamente lo que mira el código.
//
// Uso:  BASE_URL=http://localhost:8819 node tests/apk-en-android-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9335';
const BASE = process.env.BASE_URL || 'http://localhost:8819';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 12; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_ESCRITORIO = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
const ev = async expr =>
    (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const esperar = async (expr, segundos = 30) => {
    for (let i = 0; i < segundos * 2; i++) { if (await ev(expr)) return true; await sleep(500); }
    return false;
};
// Sin userAgentMetadata a propósito: el objeto incompleto hace que CDP rechace la llamada
// entera y el UA quede sin cambiar (falso negativo silencioso). El código sólo mira el UA.
const comoAndroid = () => rpc('Emulation.setUserAgentOverride', { userAgent: UA_ANDROID });
const comoEscritorio = () => rpc('Emulation.setUserAgentOverride', { userAgent: UA_ESCRITORIO });
const ir = async url => { await rpc('Page.navigate', { url }); await sleep(2200); };

const ASSET_ESPERADO = /chatwallet-energiasonora\.apk$/;

// ─────────────────────────── LANDING ───────────────────────────
console.log('\n── landing (index.html) ──');

await comoEscritorio();
await ir(BASE + '/index.html');
ok(await ev(`navigator.userAgent.includes('Macintosh')`), 'el UA de escritorio quedó aplicado');
ok(!(await ev(`document.body.classList.contains('is-android')`)),
    'en escritorio NO se marca is-android');
ok(await ev(`getComputedStyle(document.querySelector('.hero__android-hint')).display === 'none'`),
    'en escritorio el cartel "recomendado en Android" no se ve');
ok(await ev(`getComputedStyle(document.querySelector('.hero-btn--pwa')).boxShadow !== 'none'`),
    'en escritorio la PWA conserva el estilo principal');

await comoAndroid();
await ir(BASE + '/index.html');
ok(await ev(`navigator.userAgent.includes('Android')`), 'el UA de Android quedó aplicado');
ok(await ev(`document.body.classList.contains('is-android')`),
    'en Android se marca is-android');
ok(await ev(`getComputedStyle(document.querySelector('.hero__android-hint')).display !== 'none'`),
    'en Android aparece el porqué (notificaciones con el navegador cerrado)');
ok(await ev(`getComputedStyle(document.querySelector('.hero-btn--apk')).order === '-1'`),
    'el botón del APK pasa a ir primero');
ok(await ev(`getComputedStyle(document.querySelector('.hero-btn--pwa')).boxShadow === 'none'`),
    'y el de la PWA queda degradado a secundario');

// El botón sigue existiendo: se recomienda el APK, no se esconde la PWA.
ok(await ev(`getComputedStyle(document.getElementById('heroInstallBtn')).display !== 'none'`),
    'la PWA sigue disponible para quien la quiera');

// Que apunte al APK firmado (producción), no al puente en dev.
const hrefs = await ev(`JSON.stringify([...document.querySelectorAll('a[href*="releases/latest/download"]')].map(a => a.href))`);
const lista = JSON.parse(hrefs || '[]');
ok(lista.length >= 2, `la landing enlaza el APK en ${lista.length} lugar(es)`);
ok(lista.length > 0 && lista.every(h => ASSET_ESPERADO.test(h)),
    `todos los enlaces bajan el APK firmado en producción (${[...new Set(lista.map(h => h.split('/').pop()))].join(', ')})`);

// ─────────────────────────── DAPP ───────────────────────────
console.log('\n── app web (dapp.html) ──');

const cargar = async () => {
    await ir(BASE + '/dapp.html');
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
    await ir(BASE + '/dapp.html');
    return esperar(`!!document.getElementById('apkInstallBanner')`);
};
const bannerApkVisible = `(() => { const e = document.getElementById('apkInstallBanner');
    return !!e && !e.classList.contains('hidden'); })()`;
const bannerPwaVisible = `(() => { const e = document.getElementById('pwaInstallBanner');
    return !!e && !e.classList.contains('hidden'); })()`;

await comoEscritorio();
ok(await cargar(), 'la app cargó en escritorio');
await sleep(1200);
ok(!(await ev(bannerApkVisible)), 'en escritorio el banner del APK no aparece (no serviría de nada)');

await comoAndroid();
ok(await cargar(), 'la app cargó en Android');
ok(await esperar(bannerApkVisible, 10), 'en Android web aparece el banner del APK');
ok(await ev(`document.getElementById('apkInstallBanner').classList.contains('flex')`),
    'y se muestra de verdad (flex, no sólo sin "hidden")');
const hrefBanner = await ev(`document.getElementById('apkInstallBtn').href`);
ok(ASSET_ESPERADO.test(hrefBanner || ''), `el banner baja el APK firmado (${hrefBanner})`);
// El texto viene de i18n, así que se acepta cualquiera de los tres idiomas: lo que se
// verifica es que diga el motivo (notificaciones), no sólo "instalá".
const textoBanner = await ev(`document.getElementById('apkInstallBanner').innerText`);
ok(/notificaci|notification/i.test(textoBanner || ''),
    `explica por qué conviene, no sólo "instalá" (“${(textoBanner || '').trim()}”)`);

// El de la PWA no debe salir aunque el navegador ofrezca el prompt: serían dos banners
// peleándose, y en Android la PWA es la peor de las dos opciones.
await ev(`window.dispatchEvent(new Event('beforeinstallprompt'))`);
await sleep(400);
ok(!(await ev(bannerPwaVisible)),
    'el banner de la PWA queda suprimido en Android aunque llegue beforeinstallprompt');

// Ocultarlo es definitivo (es una sugerencia, no una advertencia).
await ev(`document.getElementById('apkDismissBtn').click()`);
await sleep(300);
ok(!(await ev(bannerApkVisible)), 'la ✕ lo oculta');
ok(await cargar() && !(await ev(bannerApkVisible)), 'y no vuelve al recargar');
await ev(`localStorage.removeItem('cw-apk-banner-dismissed')`);

// Ya instalada como APK (Capacitor): no tiene sentido ofrecerle bajar el APK.
console.log('\n── ya instalada (APK / Capacitor) ──');
await rpc('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.Capacitor = { isNativePlatform: () => true, Plugins: {} };`
});
ok(await cargar(), 'la app cargó fingiendo ser nativa');
await sleep(1200);
ok(await ev(`!!(window.Capacitor && window.Capacitor.isNativePlatform())`), 'la app se cree nativa');
ok(!(await ev(bannerApkVisible)), 'dentro del APK no se ofrece bajar el APK');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
