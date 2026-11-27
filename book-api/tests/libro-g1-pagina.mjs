// Prueba de las páginas con Chrome headless por CDP (sin playwright).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9461;
const B = 'http://127.0.0.1:8787', SQ = 'http://127.0.0.1:8799', OUT = process.argv[2];
const ADM = { Authorization: 'Bearer admin-prueba', 'Content-Type': 'application/json' };
const CUENTA = 'g1XunorusCuentaDePrueba11111111111111111111111111';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, mal = 0;
const chk = (c, m) => { c ? ok++ : mal++; console.log(`${c ? '✔' : '✘'} ${m}`); };
const cfg = (b) => fetch(B + '/admin/g1/config', { method: 'POST', headers: ADM, body: JSON.stringify(b) }).then((r) => r.json());

let chrome, ws, id = 0; const pend = new Map(); const errores = [];
async function abrirChrome() {
  if (chrome) { ws.close(); chrome.kill(); await dormir(500); }
  chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${mkdtempSync(tmpdir() + '/libro-g1-')}`, '--window-size=390,844', '--lang=es-AR', 'about:blank'], { stdio: 'ignore' });
  let tgt;
  for (let i = 0; i < 60 && !tgt; i++) { await dormir(500); try { tgt = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch {} }
  ws = new WebSocket(tgt.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map((a) => a.value).join(' '));
  });
  await rpc('Page.enable'); await rpc('Runtime.enable');
  await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
}
setInterval(() => {}, 1000);
const rpc = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) console.log('EXC', expr.slice(0,80), r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const ir = async (url) => { await rpc('Page.navigate', { url }); await dormir(1200); };
const foto = async (nombre) => { if (!OUT) return; const r = await rpc('Page.captureScreenshot', { format: 'png' }); if (r.result?.data) writeFileSync(`${OUT}/${nombre}.png`, Buffer.from(r.result.data, 'base64')); };
const visible = (sel) => ev(`(() => { const e = document.querySelector('${sel}'); return !!e && !e.closest('[hidden]') && e.offsetParent !== null; })()`);
const clic = (sel) => ev(`document.querySelector('${sel}').click()`);
await abrirChrome();

// 1. cerrada
await cfg({ activo: false });
await ir(B + '/');
chk(await visible('#vCerrada') && !(await visible('#vAbierta')), 'cerrada: muestra el aviso y no el botón de compra');
await foto('1-cerrada');

// 2. abierta
await cfg({ cuenta: CUENTA, centimos: 15000, activo: true });
await ir(B + '/');
chk(await visible('#comprar'), 'abierta: botón Comprar con junas');
chk((await ev(`document.getElementById('precio').textContent`)) === '150 Ğ1', 'precio 150 Ğ1');
chk(/12,3 DU/.test(await ev(`document.getElementById('precioDu').textContent`)), 'precio en DU (≈ 12,3 DU)');
await foto('2-abierta');

// 3. francés
await clic('.pills button[data-lang=fr]'); await dormir(300);
chk((await ev(`document.getElementById('comprar').textContent`)) === 'Acheter en junes' && (await ev(`document.getElementById('tapa').getAttribute('src')`)) === 'tapa-fr.jpg', 'FR: textos y tapa en francés');
await foto('3-fr');
await clic('.pills button[data-lang=es]'); await dormir(300);

// 4. comprar
await clic('#comprar'); await dormir(1200);
chk(await visible('#vPago'), 'pedido: pantalla de pago');
const g = JSON.parse(await ev(`localStorage.getItem('libro-g1-pedido')`));
chk(/^CPS-/.test(g.codigo) && (await ev(`document.getElementById('codigo').textContent`)) === g.codigo, `código visible ${g.codigo}`);
chk(await ev(`!!document.querySelector('#qrPago svg')`), 'QR de pago dibujado');
chk((await ev(`document.getElementById('abrirBilletera').getAttribute('href')`)) === `june://${CUENTA}?amount=150&comment=${g.codigo}`, 'botón «Abrir en mi billetera» con june://');
await foto('4-pago');

// 5. recarga: retoma el pedido
await ir(B + '/');
await dormir(800);
chk(await visible('#vPago') && (await ev(`document.getElementById('codigo').textContent`)) === g.codigo, 'al recargar retoma el mismo pedido');

// 6. pago parcial, después completo → se habilita solo
await fetch(SQ + '/_agregar', { method: 'POST', body: JSON.stringify({ toId: CUENTA, amount: 5000, remark: g.codigo }) });
await dormir(6500);
chk(await visible('#parcial') && /Faltan 100/.test(await ev(`document.getElementById('parcial').textContent`)), 'parcial: «Llegaron 50 Ğ1. Faltan 100 Ğ1»');
await fetch(SQ + '/_agregar', { method: 'POST', body: JSON.stringify({ toId: CUENTA, amount: 10000, remark: g.codigo }) });
await dormir(6500);
chk(await visible('#vListo'), 'pagado: la página pasa sola a «Pago recibido»');
chk(/\/download\?token=/.test(await ev(`document.getElementById('descargar').href`)) && await ev(`!!document.querySelector('#qrDescarga svg')`), 'botón Descargar + QR de descarga');
await foto('5-listo');

// 7. nuevo pedido (modo mostrador)
await clic('#nuevo'); await dormir(800);
chk(await visible('#comprar') && !(await ev(`localStorage.getItem('libro-g1-pedido')`)), 'Nuevo pedido: vuelve al inicio para el próximo comprador');

// 8. cancelar con doble toque
await clic('#comprar'); await dormir(1000);
await clic('#cancelar'); await dormir(200);
chk(await visible('#vPago'), 'cancelar: el primer toque sólo pide confirmación');
await clic('#cancelar'); await dormir(800);
chk(await visible('#comprar'), 'cancelar: el segundo toque vuelve al inicio');

// 9. se cierra mientras alguien mira la página
await cfg({ activo: false });
await clic('#comprar'); await dormir(800);
chk(await visible('#vCerrada') && /acaba de cerrarse/.test(await ev(`document.getElementById('error').textContent`)), 'si la cierran justo: «La venta acaba de cerrarse»');

// 10. panel (Chrome nuevo: headless se cae en sesiones largas con muchas capturas)
await abrirChrome();
await ir(B + '/admin');
chk(await visible('#token'), 'panel: pide el token');
await ev(`document.getElementById('token').value = 'equivocado'`); await clic('#entrar'); await dormir(1200);
chk(await visible('#token') && /incorrecto/.test(await ev(`document.getElementById('loginErr').textContent`)), 'panel: token equivocado');
await ev(`document.getElementById('token').value = 'admin-prueba'`); await clic('#entrar'); await dormir(1500);
chk(/CERRADA/.test(await ev(`document.getElementById('interruptor').textContent`)), 'panel: muestra CERRADA');
chk(/Xunorus/.test(await ev(`document.getElementById('cuentaInfo').textContent`)), 'panel: confirma de quién es la cuenta');
await clic('#interruptor'); await dormir(1200);
chk(/ABIERTA/.test(await ev(`document.getElementById('interruptor').textContent`)), 'panel: un toque la abre');
const est = await (await fetch(B + '/g1/estado')).json();
chk(est.abierto === true, 'y la página pública la ve abierta');

// marcar pagado a mano un pedido nuevo
const p = await (await fetch(B + '/g1/pedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang: 'es' }) })).json();
await ir(B + '/admin'); await dormir(1200);
const sel = `[data-pagar="${p.codigo}"]`;
await clic(sel); await dormir(300);
chk(/Seguro/.test(await ev(`document.querySelector('${sel}').textContent`)), 'marcar pagado pide confirmación');
await clic(sel); await dormir(1500);
chk(await ev(`!document.getElementById('modal').hidden`) && await ev(`!!document.querySelector('#mQr svg')`), 'marcado a mano: muestra el QR de descarga para el comprador');

// cuenta inválida
await clic('#mCerrar');
await ev(`document.getElementById('cuenta').value = 'g1mal'`); await clic('#guardar'); await dormir(800);
chk(/inválida/.test(await ev(`document.getElementById('guardado').textContent`)), 'panel: rechaza una cuenta mal escrita');
await cfg({ activo: false });

chk(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
console.log(`\n${ok} ✔  ${mal} ✘`);
ws.close(); chrome.kill();
process.exit(mal ? 1 : 0);
