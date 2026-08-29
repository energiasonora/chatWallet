// Dos arreglos chicos, verificados en el build real por CDP:
//  1. la versión se muestra con el minor de dos dígitos ("3.01", no "3.1")
//  2. la tarjeta de contacto tiene un botón para copiar la dirección
//
// Uso:  BASE_URL=http://localhost:8822 node tests/version-y-copiar-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9338';
const BASE = process.env.BASE_URL || 'http://localhost:8822';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const DIR = '0xe14f241b23ac40487faedf68fff2a6c693780f82';

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
const esperar = async (expr, segundos = 30) => {
    for (let i = 0; i < segundos * 2; i++) { if (await ev(expr)) return true; await sleep(500); }
    return false;
};

await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(1000);
ok(await esperar(`!!document.getElementById('checkUpdatesBtn')`), 'la app cargó');

// ────────────────── 1. la versión que se muestra ──────────────────
console.log('\n── versión ──');

const versionEnPantalla = await ev(`document.getElementById('settingsVersionText').textContent.trim()`);
ok(/\d+\.\d\d$/.test(versionEnPantalla || ''),
    `el panel usa minor de dos dígitos (“${versionEnPantalla}”)`);

// Se falsea la respuesta de GitHub y se dispara el chequeo real: interesa el texto que
// termina viendo el usuario, no la función que lo arma.
const chequear = async tag => {
    await ev(`window.fetch = async () => ({ ok: true, json: async () => ({ tag_name: ${JSON.stringify(tag)} }) })`);
    await ev(`document.getElementById('checkUpdatesBtn').click()`);
    for (let i = 0; i < 40; i++) {
        const t = await ev(`document.getElementById('updateStatus').innerText`);
        if (t && !/Buscando/.test(t)) return t.trim();
        await sleep(250);
    }
    return '(sin respuesta)';
};

// Misma versión que la instalada → "estás al día", y tiene que decirla completa.
const propia = (versionEnPantalla || '').match(/(\d+\.\d+)/)[1];
const alDia = await chequear('v' + propia);
ok(alDia.includes(propia), `"al día" nombra la versión entera (“${alDia}”)`);
ok(!/\d+\.\d(?!\d)/.test(alDia), 'y no la recorta a un solo dígito');

// Una versión nueva con minor de un dígito significativo: v3.10 NO puede mostrarse 3.1.
const nueva = await chequear('v9.05');
ok(/9\.05/.test(nueva), `una versión nueva conserva el cero (“${nueva}”)`);
const dosDigitos = await chequear('v9.10');
ok(/9\.10/.test(dosDigitos), `y un minor de dos dígitos queda igual (“${dosDigitos}”)`);

// ────────────────── 2. copiar la dirección ──────────────────
console.log('\n── copiar la dirección del contacto ──');

ok(await ev(`!!document.getElementById('userCardCopyBtn')`), 'la tarjeta tiene botón de copiar');

// Se instrumenta el portapapeles: en headless no se puede leer, y lo que importa es QUÉ
// se manda a copiar.
await ev(`(() => {
    window.__copiado = null;
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async t => { window.__copiado = t; } }
    });
    document.getElementById('userCardAddress').textContent = ${JSON.stringify(DIR)};
    document.getElementById('userInfoCard').style.display = 'block';
    return true;
})()`);
await sleep(200);

ok(await ev(`document.getElementById('userCardCopyBtn').offsetParent !== null`),
    'y se ve cuando la tarjeta está abierta');

// El botón va al lado de la dirección, no debajo ni encimado.
const fila = JSON.parse(await ev(`(() => {
    const p = document.getElementById('userCardAddress').getBoundingClientRect();
    const b = document.getElementById('userCardCopyBtn').getBoundingClientRect();
    return JSON.stringify({ aLaDerecha: b.left >= p.right - 1, seSolapan: b.left < p.right - 1,
        dentroDeLaTarjeta: b.right <= document.getElementById('userInfoCard').getBoundingClientRect().right });
})()`) || '{}');
ok(fila.aLaDerecha && !fila.seSolapan, 'está al lado de la dirección, sin pisarla');
ok(fila.dentroDeLaTarjeta, 'y no se sale de la tarjeta');

await ev(`document.getElementById('userCardCopyBtn').click()`);
await sleep(300);
const copiado = await ev(`window.__copiado`);
ok(copiado === DIR, `copia la dirección completa (${copiado})`);

ok(await ev(`document.getElementById('userCardCopyIcon').classList.contains('hidden')
    && !document.getElementById('userCardCopiedIcon').classList.contains('hidden')`),
    'el ícono confirma con un tilde');
ok(await ev(`getComputedStyle(document.getElementById('userCardCopyIcon')).display === 'none'`),
    'y el "hidden" realmente lo oculta dentro del botón (CSS propio, no Tailwind)');

// Vuelve solo, para poder copiar otra vez.
ok(await esperar(`!document.getElementById('userCardCopyIcon').classList.contains('hidden')`, 5),
    'y al rato vuelve a ser un botón de copiar');

// ────────────────── 3. apoyar el proyecto (modal de marca) ──────────────────
console.log('\n── modal de marca: apoyar / GitHub ──');

await ev(`(() => { const m = document.getElementById('brandModal');
    m.classList.remove('hidden'); m.classList.add('flex'); return true; })()`);
await sleep(300);

// Ningún link puede apuntar a /presale: la ruta tiene rewrite a un archivo inexistente.
const muertos = JSON.parse(await ev(`JSON.stringify(
    [...document.querySelectorAll('#brandModal a')].map(a => ({ href: a.getAttribute('href'), txt: a.innerText.trim() })))`) || '[]');
ok(!muertos.some(a => /presale/.test(a.href || '')), 'no queda ningún link a /presale');
ok(!muertos.some(a => /buy token/i.test(a.txt || '')), 'ya no ofrece un token que no existe');

const apoyo = muertos.find(a => /book\.html/.test(a.href || ''));
ok(!!apoyo, `hay una vía para apoyar y va al libro (${apoyo ? apoyo.href : 'no está'})`);
ok(/^https:\/\//.test(apoyo ? apoyo.href : ''),
    'con URL absoluta, que dentro de la APK una relativa sería localhost');
ok(await ev(`document.getElementById('brandModal').innerText.includes('libro')
    || document.getElementById('brandModal').innerText.toLowerCase().includes('book')
    || document.getElementById('brandModal').innerText.toLowerCase().includes('livre')`),
    'y explica que el proyecto se financia con el libro');

// GitHub deja de ser un botón del mismo peso que el de apoyar.
const pesos = JSON.parse(await ev(`(() => {
    const links = [...document.querySelectorAll('#brandModal a')];
    const gh = links.find(a => /github/i.test(a.href));
    const sup = links.find(a => /book\.html/.test(a.href));
    const r = e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return { ancho: Math.round(b.width), fondo: cs.backgroundColor, display: cs.display }; };
    return JSON.stringify({ gh: r(gh), sup: r(sup) });
})()`) || '{}');
ok(pesos.gh && pesos.sup && pesos.gh.ancho < pesos.sup.ancho,
    `GitHub queda como link, no como botón ancho (${pesos.gh?.ancho}px vs ${pesos.sup?.ancho}px)`);
ok(/rgba\(0, 0, 0, 0\)|transparent/.test(pesos.gh?.fondo || ''),
    'sin fondo de botón');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
