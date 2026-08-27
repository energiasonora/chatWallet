// Verifica lo que ve un usuario de web/PWA después de la mudanza a producción:
//   · el aviso de llegada sale UNA sola vez, y sólo a quien ya usaba la app
//   · "todavía no se mudó" se distingue de un error genérico
// Uso:  APP_URL=http://localhost:8825/dapp.html node tests/mudanza-web-cdp.mjs
const CDP = process.env.CDP || 'http://127.0.0.1:9342';
const APP = process.env.APP_URL || 'http://localhost:8825/dapp.html';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const w = new Map();
const rpc = (m, p = {}) => new Promise(r => { const i = ++id; w.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await new Promise(r => ws.onopen = r);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && w.has(m.id)) { w.get(m.id)(m.result); w.delete(m.id); } };
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async x => (await rpc('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;
const esperar = async (x, seg = 40) => { for (let i = 0; i < seg * 2; i++) { if (await ev(x)) return true; await sleep(500); } return false; };

console.log('→ usuario nuevo (agenda vacía)…');
await rpc('Page.navigate', { url: APP }); await sleep(2500);
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)})`);
await rpc('Page.navigate', { url: APP });
ok(await esperar(`!!(window.currentWallet && window.currentWallet.privateKey)`), 'la wallet cargó');

// El aviso corre después del restore; se espera a que la función deje su marca.
const marcado = await esperar(`!!localStorage.getItem('cw-mudanza-avisada-v1')`, 60);
ok(marcado, 'el aviso de mudanza se evaluó al arrancar');
ok(await ev(`localStorage.getItem('cw-mudanza-avisada-v1') === 'nuevo'`),
   'a quien recién llega no se le cuenta una mudanza que no vivió');
ok(!(await ev(`!!document.querySelector('[data-tag="mudanza"]')`)),
   'y por lo tanto no le aparece ningún cartel');

console.log('→ usuario de siempre (con agenda)…');
const alcanzable = await ev(`typeof avisarMudanzaUnaVez === 'function' && Array.isArray(contacts)`);
ok(alcanzable, 'la función y la agenda son alcanzables para probar la otra rama');
if (alcanzable) {
    await ev(`localStorage.removeItem('cw-mudanza-avisada-v1');
              contacts.push({ address: '0x1111111111111111111111111111111111111111', name: 'Alguien' });
              avisarMudanzaUnaVez();`);
    await sleep(500);
    ok(await ev(`!!document.querySelector('[data-tag="mudanza"]')`),
       'a quien ya usaba la app sí le aparece el aviso');
    const txt = await ev(`(document.querySelector('[data-tag="mudanza"]')||{}).innerText || ''`);
    ok(/conversaciones/i.test(txt), 'explica que lo que arranca de cero son las conversaciones');
    ok(/grupos/i.test(txt), 'y avisa que los grupos hay que rehacerlos');
    ok(await ev(`(() => { const c = document.querySelector('[data-tag="mudanza"]'); return !c._cwTimer; })()`),
       'queda hasta que lo cierren, no se va solo');

    // Segunda vez: no vuelve a molestar.
    await ev(`document.querySelectorAll('[data-tag="mudanza"]').forEach(n => n.remove()); avisarMudanzaUnaVez();`);
    await sleep(400);
    ok(!(await ev(`!!document.querySelector('[data-tag="mudanza"]')`)), 'no se repite en el arranque siguiente');
}

console.log('→ "todavía no se mudó" vs. error genérico…');
const hayVista = await ev(`typeof showPeerNotMigrated === 'function' && typeof peerEnLaRed === 'function'`);
ok(hayVista, 'existen el chequeo de red y su vista');
if (hayVista) {
    await ev(`showPeerNotMigrated('0x2222222222222222222222222222222222223333')`);
    await sleep(300);
    const t2 = await ev(`document.getElementById('messagesContainer').innerText`);
    ok(/todavía no se mudó/i.test(t2), 'el cartel dice el motivo real, no "no se pudo abrir"');
    ok(/no se perdieron/i.test(t2), 'y aclara que los mensajes viejos siguen ahí');
    ok(await ev(`!!document.getElementById('invitarAMudarseBtn')`), 'ofrece pasarle el link para actualizar');

    // canMessage con una address que no existe en producción → false, no null.
    const r = await ev(`peerEnLaRed('0x2222222222222222222222222222222222223333')`);
    ok(r === false, `canMessage contra un desconocido responde false (dio ${JSON.stringify(r)})`);
}

console.log(fails ? `\n❌ ${fails} chequeos fallaron` : '\n✅ todos los chequeos pasaron');
ws.close(); process.exit(fails ? 1 : 0);
