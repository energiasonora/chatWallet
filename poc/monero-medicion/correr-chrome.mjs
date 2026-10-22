// Abre la página de medición en un Chrome (local headless o el del teléfono por CDP) y espera el resultado.
//   node correr-chrome.mjs <url> [puertoCDP]
import { spawn } from 'node:child_process';
import os from 'node:os'; import fs from 'node:fs';
const url = process.argv[2]; const puerto = Number(process.argv[3] || 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let proc, dir, port = puerto;
if (!puerto) {
  port = 9441; dir = fs.mkdtempSync(os.tmpdir() + '/cw-xmr-');
  proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--no-first-run', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 30; i++) { await sleep(500); try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { } }
}
const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === 'Runtime.consoleAPICalled') console.log('  ·', m.params.args.map(a => a.value).join(' ')); };
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await rpc('Runtime.enable'); await rpc('Page.enable');
await rpc('Page.navigate', { url });
let res = null;
for (let i = 0; i < 900 && !res; i++) { await sleep(1000); const r = await rpc('Runtime.evaluate', { expression: 'window.resultado', returnByValue: true }); res = r.result?.result?.value; }
console.log('RESULTADO', JSON.stringify(res));
await rpc('Target.closeTarget', { targetId: tab.id }).catch(() => {});
ws.close(); if (proc) { proc.kill('SIGKILL'); fs.rmSync(dir, { recursive: true, force: true }); }
process.exit(0);
