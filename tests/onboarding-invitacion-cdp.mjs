// Quien llega por un link de invitación no vino a abrir una billetera: vino a chatear.
// Se verifica, en el build real por CDP, que no le caigan encima los avisos de respaldo
// mientras la wallet esté vacía — y que sí aparezcan apenas haya fondos.
//
// Uso:  BASE_URL=http://localhost:8828 node tests/onboarding-invitacion-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9344';
const BASE = process.env.BASE_URL || 'http://localhost:8828';
// A quién invita el link. Es una address válida cualquiera: no hace falta que exista en XMTP,
// porque lo que se mide es la UI del recién llegado, no que el chat se establezca.
const INVITA = '0x2233445566778899aabbccddeeff001122334455';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const targets = await (await fetch(CDP + '/json/list')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const waiters = new Map();
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; waiters.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await new Promise(r => ws.onopen = r);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); } };
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async expr =>
    (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const esperar = async (expr, segundos = 40) => {
    for (let i = 0; i < segundos * 2; i++) { if (await ev(expr)) return true; await sleep(500); }
    return false;
};

const nagVisible = `(() => { const e = document.getElementById('backupNagBanner');
    return !!e && !e.classList.contains('hidden'); })()`;
const textoNag = `document.getElementById('backupNagBanner').innerText`;

// Arranca de cero de verdad: sin wallet, sin flags, sin la marca del ✕ de la sesión anterior.
const desdeCero = async (query = '') => {
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(1500);
    await ev(`localStorage.clear(); sessionStorage.clear(); true`);
    await rpc('Page.navigate', { url: BASE + '/dapp.html' + query }); await sleep(3000);
    return esperar(`typeof updateBackupNagBanner === 'function'`);
};

// ────────────── 1. llega por el link ──────────────
console.log('\n── llegada por link de invitación ──');

ok(await desdeCero(`?address=${INVITA}`), 'la app cargó desde el link');
ok(await esperar(`!!currentWallet`, 30), 'se le creó una wallet sola, sin pedirle nada');
ok(await ev(`localStorage.getItem('cw-wallet-origen') === 'invitacion'`),
    'y queda marcada como venida de una invitación');
ok(await ev(`!!localStorage.getItem('xmtp-chat-wallet-mnemonic')`),
    'la frase se guardó (el respaldo es posible, sólo que no se grita)');

// Los avisos NO salen todos de una: el de mudanza llega recién cuando termina el sync de
// XMTP, unos 15s después. Mirar el centro de notificaciones una sola vez da un falso
// verde — pasó, y tapó un aviso que sí estaba saliendo. Se junta todo lo que aparezca
// durante la ventana entera.
const vistos = new Set();
for (let i = 0; i < 60; i++) {
    await sleep(500);
    const txt = await ev(`(document.getElementById('cwNotifs') || {}).innerText || ''`);
    if (txt && txt.trim()) vistos.add(txt.replace(/\s+/g, ' ').trim());
    if (await ev(nagVisible)) break;   // si aparece el cartel rojo ya falló: no sigas esperando
}
const todo = [...vistos].join(' | ');

ok(!(await ev(nagVisible)), 'NO le aparece el cartel rojo de respaldo');

// El toast viejo duraba 10s y traía dos links ("backup | restore wallet") a alguien que
// todavía no sabe qué es una frase semilla.
ok(!/backup|restore|respald/i.test(todo), 'ni un toast pidiéndole que respalde');
// …pero algo tiene que confirmarle que está listo: reemplazar el sermón por nada sería
// dejarlo sin señal de que la wallet se creó.
ok(/podés chatear|can chat|discuter/i.test(todo),
    `sí una confirmación corta (“${[...vistos][0] || '(ningún toast)'}”)`);

// La mudanza es de gente que ya usaba la app: al recién llegado no le pasó nada. Se mide
// después de la ventana completa, cuando el sync ya corrió y el aviso habría salido.
ok(await ev(`localStorage.getItem('cw-mudanza-avisada-v1') === 'nuevo'`),
    'su wallet queda sellada como nueva, aunque después junte contactos');
ok(!/mudó de red|moved|réseau/i.test(todo),
    `y el aviso de mudanza nunca aparece (${vistos.size} toast(s) en la ventana)`);

// Silenciar el aviso no es esconderlo: sigue a un toque en Configuración.
ok(await ev(`(() => { const b = document.getElementById('backupWalletSettingsBtn');
    return !!b && b.textContent.trim().length > 0; })()`),
    'el respaldo sigue disponible en Configuración desde el primer arranque');

// ────────────── 2. entra plata ──────────────
console.log('\n── cuando entra plata ──');

ok(!(await ev(`walletTuvoFondos()`)), 'todavía no tuvo fondos');
await ev(`(() => { recordIncomingPayment(optionsList[currentTokenIndex],
    { amount: '0.01', symbol: 'ETH', source: 'chat' }); return true; })()`);
await sleep(600);
ok(await ev(`walletTuvoFondos()`), 'el cobro queda registrado');
ok(await ev(nagVisible), 'y AHORA sí aparece el aviso de respaldo');

const texto = await ev(textoNag);
ok(/fondos|funds/i.test(texto || ''),
    `que explica por qué aparece recién ahora (“${(texto || '').trim().split('\n')[0]}”)`);

// ────────────── 3. no se apaga solo ──────────────
console.log('\n── persistencia ──');

await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3500);
ok(await esperar(`!!currentWallet`, 30), 'recargó con la misma wallet');
ok(await ev(nagVisible), 'el aviso sigue puesto tras reiniciar');

// El ✕ lo calla sólo por esta sesión: "perdés el dispositivo, perdés la billetera" no es
// una sugerencia que se apague para siempre con un tap.
await ev(`document.getElementById('backupNagDismiss').click()`);
await sleep(300);
ok(!(await ev(nagVisible)), 'la ✕ lo oculta');
ok(await ev(`sessionStorage.getItem('cw-backup-nag-dismissed') === '1'`),
    'pero sólo por la sesión, como antes');

// ────────────── 4. sin regresión para quien la pidió ──────────────
console.log('\n── wallet creada a propósito (comportamiento de siempre) ──');

ok(await desdeCero(), 'la app cargó sin link');
// Se simula el alta explícita: mismo camino que "Crear Nueva Billetera", que marca 'propia'.
await ev(`(() => {
    const w = window.ethers.HDNodeWallet.createRandom();
    localStorage.setItem('xmtp-chat-wallet', w.privateKey);
    rememberCreatedMnemonic(w);          // sin segundo argumento → 'propia'
    return true;
})()`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3500);
ok(await esperar(`!!currentWallet`, 30), 'la wallet cargó');
ok(await ev(`localStorage.getItem('cw-wallet-origen') === 'propia'`), 'queda marcada como propia');
ok(!(await ev(`walletTuvoFondos()`)), 'y sin fondos');
ok(await ev(nagVisible), 'aun así el aviso aparece: la pidió, sabe lo que tiene');
ok(/secreta|secret|secrète/i.test(await ev(textoNag) || ''),
    'con el texto de siempre, no el de fondos');

// ────────────── 5. wallet vieja, sin marca de origen ──────────────
console.log('\n── wallet anterior a este cambio ──');

await ev(`localStorage.removeItem('cw-wallet-origen')`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(3500);
ok(await esperar(`!!currentWallet`, 30), 'la wallet sin marca cargó');
ok(await ev(nagVisible),
    'se comporta como propia: nadie pierde el aviso por no tener la clave nueva');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
