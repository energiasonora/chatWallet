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

// ── pestaña stealth ──
console.log('\n── meta-address stealth ──');
await ev(`document.getElementById('receiveTabStealth').click();
          window.__toasts = []; const _s = window.showToast;
          window.showToast = (m, t) => { window.__toasts.push(t + ': ' + m); return _s && _s(m, t); }; true`);
await sleep(400);
await ev(`document.getElementById('generateStealthMetaAddressBtn').click(); true`); await sleep(3000);
const st = await ev(`(() => { const q = document.getElementById('stealthMetaAddressQr');
    const svg = q.querySelector('svg');
    return { toasts: window.__toasts,
             oculto: document.getElementById('stealthMetaAddressContainer').classList.contains('hidden'),
             meta: (document.getElementById('stealthMetaAddressData').value || '').trim(),
             paths: svg ? svg.querySelectorAll('path, rect, circle').length : 0 }; })()`);
ok(!st.toasts.some(x => /error/i.test(x)), 'no protesta por la wallet', JSON.stringify(st.toasts));
ok(!st.oculto, 'el resultado se muestra');
// Dos claves públicas comprimidas concatenadas: 0x + 66 + 66 hex.
ok(/^0x[0-9a-fA-F]{132}$/.test(st.meta), `la meta-address tiene forma de par spend+view (${st.meta.length} chars)`);
ok(st.paths > 10, `y su QR también está dibujado (${st.paths} formas)`);

// ── el 404 que causaba todo ──
console.log('\n── recursos ──');
const rotos = [...new Set(http404)].filter(u => u !== 'favicon.ico');
ok(rotos.length === 0, 'ningún recurso 404 durante el flujo', JSON.stringify(rotos));

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
