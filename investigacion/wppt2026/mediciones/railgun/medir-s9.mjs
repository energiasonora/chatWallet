// Sirve bench.html desde la Mac, lo abre en el Chrome del teléfono por CDP (adb) y junta resultados.
// Uso: node medir-s9.mjs [serial-adb] [variantes] [reps] [sintéticos, p.ej. 01x02,POI_3x3]
//      node medir-s9.mjs mac            → mismo banco en el Chrome de la Mac (headless), para comparar
import http from 'http'; import fs from 'fs'; import path from 'path'; import { execSync, spawn } from 'child_process';
const [destino = '192.168.1.43:5555', variantes = '01x02,02x02,03x02,08x02', reps = '3', sint = ''] = process.argv.slice(2);
const PUERTO = 8850, CDP = 9333;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const RAIZ = path.dirname(new URL(import.meta.url).pathname);
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  const f = p === '/snarkjs.min.js' ? path.join(RAIZ, 'node_modules/snarkjs/build/snarkjs.min.js') : path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO);
let chrome;
if (destino === 'mac') {
  chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=${RAIZ}/.chrome-mac`, '--enable-precise-memory-info', 'about:blank'], { stdio: 'ignore' });
} else {
  const adb = (c) => execSync(`adb -s ${destino} ${c}`).toString();
  adb(`reverse tcp:${PUERTO} tcp:${PUERTO}`);
  adb(`forward tcp:${CDP} localabstract:chrome_devtools_remote`);
  adb('shell input keyevent KEYCODE_WAKEUP');
}
for (let i = 0; i < 60; i++) { try { await fetch(`http://localhost:${CDP}/json/version`); break; } catch { await new Promise(r => setTimeout(r, 500)); } }
const url = `http://localhost:${PUERTO}/bench.html?v=${variantes}&reps=${reps}&sint=${sint}`;
let tab;
if (destino === 'mac') {
  tab = await (await fetch(`http://localhost:${CDP}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
} else {
  // En Android /json/new falla ("Could not create new page") y el intent no siempre carga: se pide
  // la pestaña por el WebSocket del navegador (Target.createTarget), sin tocar las pestañas del usuario.
  const ver = await (await fetch(`http://localhost:${CDP}/json/version`)).json();
  const bws = new WebSocket(ver.webSocketDebuggerUrl); await new Promise(r => bws.onopen = r);
  const { targetId } = await new Promise(r => { bws.onmessage = (m) => r(JSON.parse(m.data).result);
    bws.send(JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url } })); });
  bws.close();
  for (let i = 0; i < 30 && !tab; i++) {
    await new Promise(r => setTimeout(r, 1000));
    tab = (await (await fetch(`http://localhost:${CDP}/json/list`)).json()).find(t => t.id === targetId);
  }
}
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); pend.get(d.id)?.(d); };
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const t0 = Date.now(); let res = null;
while (!res && Date.now() - t0 < 30 * 60e3) {
  await new Promise(r => setTimeout(r, 5000));
  const r = await cdp('Runtime.evaluate', { expression: 'JSON.stringify(window.__res||null)', returnByValue: true });
  res = JSON.parse(r.result?.result?.value || 'null');
  if (!res) process.stdout.write('.');
}
console.log('\n' + JSON.stringify(res, null, 1));
const nombre = destino === 'mac' ? 'mac' : 's9';
fs.mkdirSync(path.join(RAIZ, 'resultados'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'resultados', `${nombre}-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`), JSON.stringify(res, null, 1));
await fetch(`http://localhost:${CDP}/json/close/${tab.id}`).catch(() => {});
ws.close(); srv.close(); chrome?.kill();
process.exit(0);
