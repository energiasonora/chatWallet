// "Recibir fondos" tiene dos pestañas y las dos estaban rotas:
//   · el QR estándar se dibujaba vacío (marco blanco) porque QRCodeStyling esperaba un logo
//     cuyo nombre nunca podía resolver — Parcel le pone hash y sólo reescribe los <img src>
//     del HTML, no los strings de JS;
//   · "Generar Meta-Address" contestaba "conectá tu wallet" con la billetera cargada, porque
//     miraba un global de la época de MetaMask que ChatWallet nunca asigna.
// El test exige QR con contenido real, no sólo que el elemento exista.
const CDP = process.env.CDP || 'http://127.0.0.1:9348';
const BASE = process.env.BASE_URL || 'http://localhost:8836';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const page = (await (await fetch(`${CDP}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const http404 = [];
ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Network.responseReceived' && m.params.response.status === 404)
        http404.push(m.params.response.url.split('/').pop());
});
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await rpc('Page.enable'); await rpc('Runtime.enable'); await rpc('Network.enable');
const ev = async expr => {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error('EXCEPCIÓN: ' + (ex.exception?.description || ex.text).slice(0, 300));
    return r.result?.result?.value;
};

await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); true`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(7000);
ok(await ev(`!!window.currentWallet`), 'la billetera cargó');

// ── pestaña estándar ──
console.log('\n── dirección estándar ──');
await ev(`document.getElementById('receiveBtn').click(); true`); await sleep(2500);
const est = await ev(`(() => { const q = document.getElementById('receiveStandardQr');
    const svg = q.querySelector('svg');
    return { hijos: q.children.length,
             // Un <svg> vacío mide igual que uno dibujado: lo que distingue el marco blanco
             // del QR de verdad es que haya paths adentro.
             paths: svg ? svg.querySelectorAll('path, rect, circle').length : 0,
             dir: (document.getElementById('receiveStandardAddress').textContent || '').trim() }; })()`);
ok(est.hijos === 1, 'el QR se insertó');
ok(est.paths > 10, `y tiene dibujo real, no un marco vacío (${est.paths} formas)`);
ok(/^0x[0-9a-fA-F]{40}$/.test(est.dir), 'muestra la dirección', est.dir.slice(0, 12) + '…');

// ── la pestaña stealth está oculta ──
// Generar la meta-address funciona, pero no hay escáner: la app nunca podría encontrar ni
// gastar lo que le paguen ahí. Mientras falte, ofrecerla sería invitar a cobrar a ciegas.
console.log('\n── stealth: oculta hasta que exista el escáner ──');
const vis = await ev(`(() => {
    const visible = el => !!(el && el.offsetParent !== null);
    return { tabs: visible(document.getElementById('receiveTabs')),
             tabStealth: visible(document.getElementById('receiveTabStealth')),
             contenido: visible(document.getElementById('receiveStealthContent')),
             estandar: visible(document.getElementById('receiveStandardContent')) }; })()`);
ok(!vis.tabStealth, 'la pestaña stealth no se ve');
ok(!vis.contenido, 'ni su contenido');
ok(vis.estandar, 'y la dirección estándar sigue a la vista');

// ── la derivación coincide con el spec publicado ──
// El botón sigue existiendo aunque esté oculto; se lo llama directo para comprobar que la
// llave que deriva es la de StealthPay v1 y no la del mensaje viejo. Si alguien vuelve a
// poner STEALTH_ENABLED = true, esto exige que ya esté alineado.
console.log('\n── derivación v1 (github.com/energiasonora/stealthpay §2) ──');
const META_SEGUN_SPEC = '0x02de477c92f9069ea18ecba4ebd93f1c324124975cd3828946b0dd63967787637c'
                      + '02278de5845e02753c0d5a753975a7b411318ea24195fa2e70a1a2a73ac1d22a7a';
await ev(`window.__toasts = []; const _s = window.showToast;
          window.showToast = (m, t) => { window.__toasts.push(t + ': ' + m); return _s && _s(m, t); }; true`);
await ev(`document.getElementById('generateStealthMetaAddressBtn').click(); true`); await sleep(3000);
const st = await ev(`(() => ({ toasts: window.__toasts,
    meta: (document.getElementById('stealthMetaAddressData').value || '').trim() }))()`);
ok(!st.toasts.some(x => /error/i.test(x)), 'no protesta por la wallet', JSON.stringify(st.toasts));
ok(st.meta === META_SEGUN_SPEC,
    'la meta-address es la que el spec publica para esta llave',
    META_SEGUN_SPEC.slice(0, 20) + '…', st.meta.slice(0, 20) + '…');

// ── el 404 que causaba todo ──
console.log('\n── recursos ──');
const rotos = [...new Set(http404)].filter(u => u !== 'favicon.ico');
ok(rotos.length === 0, 'ningún recurso 404 durante el flujo', JSON.stringify(rotos));

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
