// Verifica en el build real, por CDP:
//  1. que las dos funciones shortAddr dejaron de pisarse (era lo que rompía todo lo demás)
//  2. que contactLocalAlias() vuelve a distinguir "lo nombraste vos" de "se nombró él"
//  3. que la barra de chats marca el nombre que no confirmaste vos
//
// Uso:  BASE_URL=http://localhost:8827 node tests/agenda-contactos-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9343';
const BASE = process.env.BASE_URL || 'http://localhost:8827';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

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

const cargar = async () => {
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(1000);
    return esperar(`typeof renderContacts === 'function'`);
};
ok(await cargar(), 'la app cargó');

// ────────────── 1. las dos shortAddr dejaron de pisarse ──────────────
console.log('\n── shortAddr ──');

const ADDR = '0x5fe294fbE811C38550Ea004ccE447147d03B102B';
const formatos = JSON.parse(await ev(`JSON.stringify({
    contactos: shortAddr(${JSON.stringify(ADDR)}),
    frio: typeof shortAddrCold === 'function' ? shortAddrCold(${JSON.stringify(ADDR)}) : null
})`) || '{}');
ok(formatos.contactos === '0x5fe2...102B',
    `el de contactos usa 6+4 con puntos ASCII (${formatos.contactos})`);
ok(formatos.frio === '0x5fe294…3B102B',
    `el del circuito frío conserva su formato aparte (${formatos.frio})`);
ok(formatos.contactos !== formatos.frio, 'y ya no son la misma función');

// Es el formato con el que las altas automáticas siembran el nombre: si no coinciden,
// contactLocalAlias() confunde una address con un apodo puesto por el usuario.
ok(formatos.contactos === `${ADDR.slice(0, 6)}...${ADDR.slice(-4)}`,
    'coincide con el que usan las altas automáticas para sembrar el nombre');

// ────────────── 2. "lo nombraste vos" vs "se nombró él" ──────────────
console.log('\n── contactLocalAlias ──');

const casos = JSON.parse(await ev(`JSON.stringify({
    autoCreado: contactLocalAlias({ name: shortAddr(${JSON.stringify(ADDR)}), selfAlias: '📚 Ventas del libro', address: ${JSON.stringify(ADDR)} }),
    seNombroEl: contactLocalAlias({ name: 'ana.eth', selfAlias: 'ana.eth', address: ${JSON.stringify(ADDR)} }),
    loNombraste: contactLocalAlias({ name: 'Mamá', selfAlias: 'ana.eth', address: ${JSON.stringify(ADDR)} })
})`) || '{}');
ok(casos.autoCreado === '', 'un contacto creado solo NO cuenta como nombrado por vos');
ok(casos.seNombroEl === '', 'que el nombre sea su propio alias tampoco');
ok(casos.loNombraste === 'Mamá', 'y el apodo que sí pusiste se conserva');

// ────────────── 3. la barra de chats ──────────────
console.log('\n── barra de chats ──');

const t = Date.now();
// Dos filas dicen llamarse igual: una es el notificador, la otra cualquiera.
await ev(`(() => {
    contacts = [
      { name: shortAddr('0x5fe294fbE811C38550Ea004ccE447147d03B102B'), selfAlias: '📚 Ventas del libro',
        address: '0x5fe294fbE811C38550Ea004ccE447147d03B102B', lastMessage: 'venta', lastMessageTimestamp: ${t}, status: 'online' },
      { name: 'Mamá', selfAlias: 'ana.eth', address: '0x2233445566778899aabbccddeeff001122334455',
        lastMessage: 'hola', lastMessageTimestamp: ${t - 1000}, status: 'online' },
      { name: shortAddr('0x77aa0011223344556677889900aabbccddee91Cd'), selfAlias: '',
        address: '0x77aa0011223344556677889900aabbccddee91Cd', lastMessage: 'buenas', lastMessageTimestamp: ${t - 2000} },
      { name: 'Soberanos', isGroup: true, memberCount: 7, address: 'group:abc',
        lastMessage: 'jueves', lastMessageTimestamp: ${t - 3000} }
    ];
    renderContacts();
    return contacts.length;
})()`);
await sleep(400);

const filas = JSON.parse(await ev(`JSON.stringify(
    [...document.querySelectorAll('#contactsListSidebar .contact-item')].map(f => ({
        titulo: f.querySelector('p.font-semibold').textContent.trim(),
        marcada: f.querySelector('p.font-semibold').classList.contains('contact-unconfirmed'),
        chip: f.querySelector('.contact-addr-chip')?.textContent || null
    })))`) || '[]');
ok(filas.length === 4, `se dibujaron las 4 filas (${filas.length})`);

const alias = filas.find(f => /Ventas del libro/.test(f.titulo));
// OJO: el título grande es contactOwnName(), o sea el alias que eligió el OTRO
// ('ana.eth'); tu apodo ('Mamá') vive en el renglón de abajo. Lo que se verifica acá es
// que esa fila no lleve la marca, porque vos ya la identificaste.
const propio = filas.find(f => f.titulo === 'ana.eth');
const soloAddr = filas.find(f => /^0x77aa/.test(f.titulo));
const grupo = filas.find(f => f.titulo === 'Soberanos');

ok(alias && alias.marcada, 'el nombre que eligió el otro queda marcado');
ok(alias && alias.chip === '0x5fe2...102B', `y muestra la address que lo respalda (${alias?.chip})`);
ok(propio && !propio.marcada, 'el que nombraste vos NO se marca');
ok(propio && propio.chip === null, 'ni le cuelga una address al lado');
ok(soloAddr && soloAddr.marcada, 'el que no tiene ningún nombre también queda marcado');
ok(soloAddr && soloAddr.chip === null,
    'pero sin repetir la address, que ya es el título');
ok(grupo && !grupo.marcada, 'un grupo no se marca: su nombre no es el alias de nadie');

// La marca tiene que verse distinta de verdad, no sólo llevar la clase.
const estilos = JSON.parse(await ev(`(() => {
    const f = [...document.querySelectorAll('#contactsListSidebar .contact-item')];
    const m = f.find(x => x.querySelector('.contact-unconfirmed'));
    const n = f.find(x => x.querySelector('p.font-semibold').textContent.trim() === 'ana.eth');
    const cs = e => { const s = getComputedStyle(e); return { italica: s.fontStyle, color: s.color }; };
    return JSON.stringify({ marcado: cs(m.querySelector('p.font-semibold')), normal: cs(n.querySelector('p.font-semibold')) });
})()`) || '{}');
ok(estilos.marcado?.italica === 'italic', 'la marca es itálica de verdad');
ok(estilos.normal?.italica !== 'italic', 'y el confirmado no');
ok(estilos.marcado?.color !== estilos.normal?.color,
    `y con distinto color (${estilos.marcado?.color} vs ${estilos.normal?.color})`);

// Tema claro: el CSS crudo oscuro no se adapta solo, necesita override explícito.
await ev(`localStorage.setItem('chatwallet_theme', 'light')`);
ok(await cargar(), 'recarga en tema claro');
await ev(`(() => { contacts = [{ name: shortAddr('0x5fe294fbE811C38550Ea004ccE447147d03B102B'),
    selfAlias: '📚 Ventas del libro', address: '0x5fe294fbE811C38550Ea004ccE447147d03B102B',
    lastMessage: 'venta', lastMessageTimestamp: ${t} }]; renderContacts(); return 1; })()`);
await sleep(400);
const claro = JSON.parse(await ev(`(() => {
    const p = document.querySelector('#contactsListSidebar .contact-unconfirmed');
    const c = document.querySelector('#contactsListSidebar .contact-addr-chip');
    const lum = col => { const m = col.match(/\\d+/g); return m ? (+m[0] * .299 + +m[1] * .587 + +m[2] * .114) : -1; };
    return JSON.stringify({ nombre: lum(getComputedStyle(p).color), chip: lum(getComputedStyle(c).color),
        fondo: lum(getComputedStyle(document.body).backgroundColor) });
})()`) || '{}');
ok(claro.fondo > 150, `el tema claro está aplicado (fondo ${Math.round(claro.fondo)})`);
ok(claro.nombre < 140, `el nombre marcado se lee sobre blanco (luminancia ${Math.round(claro.nombre)})`);
ok(claro.chip < 140, `y el chip también (luminancia ${Math.round(claro.chip)})`);

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
ws.close();
process.exit(fails === 0 ? 0 : 1);
