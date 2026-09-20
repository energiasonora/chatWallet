// La pantalla de Novedades: que se abra sola UNA vez al estrenar versión, que no vuelva a
// molestar, y que se pueda abrir a mano. Es la parte del trabajo heredado que nadie probó.
const CDP = process.env.CDP || 'http://127.0.0.1:9350';
const BASE = process.env.BASE_URL || 'http://localhost:8842';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const page = (await (await fetch(`${CDP}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const rpc = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async x => {
    const r = await rpc('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    const e = r.result?.exceptionDetails;
    if (e) throw new Error('EXCEPCIÓN: ' + (e.exception?.description || e.text).slice(0, 300));
    return r.result?.result?.value;
};
const ir = async () => { await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(6000); };

// ── los datos llegaron al HTML ──
await ir();
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); true`);
await ir();
const datos = await ev(`(() => { const el = document.getElementById('cwChangelogData');
    if (!el) return null; const d = JSON.parse(el.textContent);
    return { n: d.length, primera: d[0].v, items: d[0].items.length }; })()`);
ok(!!datos, 'el JSON de novedades está incrustado en la página');
ok(datos && datos.n > 0 && /^\d+\.\d+$/.test(datos.primera), `la versión más nueva es ${datos?.primera}`);

// ── instalación nueva: NO se abre ──
// Recibir a alguien que recién instala con el historial de versiones que nunca tuvo sería
// ruido. Se anota la versión y se calla; el modal es para quien ACTUALIZA.
console.log('\n── instalación nueva ──');
const nueva = await ev(`(async () => {
    localStorage.removeItem('cw-novedades-vistas');
    cerrarNovedades();
    mostrarNovedadesSiHayVersionNueva();
    await new Promise(r => setTimeout(r, 600));
    return { visible: !document.getElementById('changelogModal').classList.contains('hidden'),
             guardado: localStorage.getItem('cw-novedades-vistas') };
})()`);
ok(nueva.visible === false, 'a quien recién instala NO se le abre el modal');
ok(nueva.guardado === datos.primera, 'pero se anota la versión, así el próximo salto sí avisa', String(nueva.guardado));

// ── actualizás: AVISA, no interrumpe ──
// Abrir el modal solo tapaba la app apenas entrabas, para algo que no pediste.
// Parte de la 0.01: también cubre a quien salteó varias versiones.
console.log('\n── venís de una versión anterior ──');
const avisa = await ev(`(async () => {
    cerrarNovedades();
    document.querySelectorAll('.cw-notif').forEach(n => n.remove());
    localStorage.setItem('cw-novedades-vistas', '0.01');
    mostrarNovedadesSiHayVersionNueva();
    await new Promise(r => setTimeout(r, 800));
    const notif = [...document.querySelectorAll('.cw-notif')];
    return { modal: !document.getElementById('changelogModal').classList.contains('hidden'),
             aviso: notif.length, texto: (notif[0]?.innerText || '').replace(/\\s+/g, ' ').slice(0, 70),
             guardado: localStorage.getItem('cw-novedades-vistas') };
})()`);
ok(avisa.modal === false, 'el modal NO se abre solo');
ok(avisa.aviso === 1, 'sale una notificación en su lugar', avisa.texto);
ok(avisa.guardado === datos.primera, 'y queda anotada la versión (no insiste)', String(avisa.guardado));

const alTocar = await ev(`(async () => {
    const n = document.querySelector('.cw-notif');
    if (n) n.click();
    await new Promise(r => setTimeout(r, 600));
    return !document.getElementById('changelogModal').classList.contains('hidden');
})()`);
ok(alTocar === true, 'y si la tocás, ahí sí se abre Novedades');

// ── misma versión: no molesta ──
console.log('\n── ya viste esta versión ──');
const segunda = await ev(`(async () => {
    cerrarNovedades();
    await new Promise(r => setTimeout(r, 300));
    mostrarNovedadesSiHayVersionNueva();
    await new Promise(r => setTimeout(r, 600));
    return !document.getElementById('changelogModal').classList.contains('hidden');
})()`);
ok(segunda === false, 'no se vuelve a abrir sola');

// ── una versión sin novedades no abre un modal vacío ──
// Pasa en un redeploy con ALLOW_EMPTY_CHANGELOG: hay versión nueva y nada que contar.
const vacio = await ev(`(async () => {
    cerrarNovedades();
    localStorage.setItem('cw-novedades-vistas', '0.01');
    const real = leerNovedades;
    leerNovedades = () => [{ v: '9.99', d: '', items: ['otra cosa'] }];   // ninguna es la actual
    mostrarNovedadesSiHayVersionNueva();
    await new Promise(r => setTimeout(r, 500));
    const abierto = !document.getElementById('changelogModal').classList.contains('hidden');
    leerNovedades = real;
    return abierto;
})()`);
ok(vacio === false, 'si la versión actual no tiene novedades, no abre un modal vacío');

// ── pero se puede abrir a mano, desde los dos lugares ──
console.log('\n── a mano ──');
for (const [boton, donde] of [['openChangelogBtn', 'la marca'], ['openChangelogFromSettings', 'Configuración']]) {
    const r = await ev(`(async () => {
        cerrarNovedades(); await new Promise(r => setTimeout(r, 200));
        const b = document.getElementById(${JSON.stringify(boton)});
        if (!b) return 'no existe';
        b.click(); await new Promise(r => setTimeout(r, 500));
        return !document.getElementById('changelogModal').classList.contains('hidden');
    })()`);
    ok(r === true, `el botón de ${donde} lo abre`, String(r));
}


console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
