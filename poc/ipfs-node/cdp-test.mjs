// Test end-to-end por CDP (Chrome real headless, sin playwright): seedea wallet, va a la
// pestaña Docs, sube un archivo real por la UI (ipfsUploadDirect) contra el nodo Kubo local,
// y verifica el CID + retrieval por gateway. Correr con Node 22 y NODE_OPTIONS deshabilitado.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9444;
const URL = 'http://localhost:8817/dapp.html';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // hardhat
const DOC = '/tmp/cdp-doc.txt';
writeFileSync(DOC, `Documento soberano vía CDP — ${new Date().toISOString()}\n`);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw`,
  '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map();
function rpc(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 30000);
  });
}
const logs = [];

(async () => {
  // esperar a que Chrome exponga el target
  let target;
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch {}
    await sleep(500);
  }
  if (!target) throw new Error('no Chrome target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ');
      if (/error|fail|❌|exception|rechaz/i.test(txt)) logs.push('[console] ' + txt);
    }
  });

  await rpc(ws, 'Page.enable'); await rpc(ws, 'Runtime.enable'); await rpc(ws, 'DOM.enable');

  const ev=(expr,aw=false)=>rpc(ws,'Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:aw}).then(r=>r.result?.value);

  console.log('→ navegando…');
  await rpc(ws, 'Page.navigate', { url: URL });
  await sleep(3500);
  console.log('→ seedeando wallet + reload…');
  await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); 'ok'`);
  await rpc(ws, 'Page.navigate', { url: URL });
  await sleep(6000);

  // esperar currentWallet + ethers
  let ready = null;
  for (let i = 0; i < 20; i++) {
    ready = await ev(`(function(){return {w: !!(window.currentWallet&&window.currentWallet.privateKey), a: window.currentWallet&&window.currentWallet.address, e: !!window.ethers};})()`);
    if (ready && ready.w && ready.e) break;
    await sleep(1000);
  }
  console.log('  wallet/ethers:', JSON.stringify(ready));
  if (!ready || !ready.w) throw new Error('window.currentWallet no disponible');

  // ir a Docs
  console.log('→ abriendo pestaña Docs…');
  await ev(`(document.querySelector('[data-view="documentView"]')||{click(){}}).click(); 'ok'`);
  await sleep(1000);

  // setear el file input (CDP)
  console.log('→ cargando archivo en el input…');
  const doc = await rpc(ws, 'DOM.getDocument', { depth: -1 });
  const node = await rpc(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#ipfsFileInput' });
  if (!node.nodeId) throw new Error('#ipfsFileInput no encontrado');
  await rpc(ws, 'DOM.setFileInputFiles', { files: [DOC], nodeId: node.nodeId });
  // disparar el change por las dudas
  await ev(`document.getElementById('ipfsFileInput').dispatchEvent(new Event('change',{bubbles:true})); 'ok'`);
  await sleep(800);
  const queued = await ev(`document.getElementById('ipfsFileList')?.children.length||0`);
  console.log('  en cola:', queued);

  // subir
  console.log('→ subiendo (ipfsUploadDirect → nodo Kubo)…');
  await ev(`document.getElementById('ipfsUploadBtn').click(); 'ok'`);

  // poll historial (ipfsSaveHistory guarda cid en localStorage)
  let cid = null;
  for (let i = 0; i < 25; i++) {
    const hist = await ev(`localStorage.getItem('chatwallet_ipfs_uploads')`);
    if (hist) { try { const arr = JSON.parse(hist); if (arr[0]?.cid) { cid = arr[0].cid; break; } } catch {} }
    const status = await ev(`document.getElementById('ipfsStatus')?.textContent||''`);
    if (i % 3 === 0) console.log('   … status:', status);
    await sleep(1000);
  }

  console.log('\n=== RESULTADO ===');
  console.log('CID subido:', cid || '(ninguno)');
  if (cid) {
    const g = await fetch(`http://127.0.0.1:8080/ipfs/${cid}`);
    console.log('gateway   :', g.status, JSON.stringify((await g.text()).slice(0, 70)));
    const pinned = await (await fetch(`http://127.0.0.1:5001/api/v0/pin/ls?arg=${cid}`, { method: 'POST' })).text();
    console.log('pin/ls    :', pinned.includes(cid) ? '✓ pineado en Kubo' : pinned.slice(0, 120));
  }
  if (logs.length) { console.log('\n--- console errores ---'); logs.slice(0, 10).forEach(l => console.log(l)); }

  const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/cdp-docs.png', Buffer.from(shot.data, 'base64'));
  console.log('\nscreenshot: /tmp/cdp-docs.png');

  ws.close(); chrome.kill(); process.exit(cid ? 0 : 1);
})().catch(e => { console.error('CDP test error:', e.message); logs.slice(0, 10).forEach(l => console.log(l)); chrome.kill(); process.exit(2); });
