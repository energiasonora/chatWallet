// Test CDP del path de avatar propio: abre la ventana DID, sube una imagen no-cuadrada
// (400x200), verifica que makeAvatarThumb la normaliza a 256x256 WebP chico y que se guarda
// así en localStorage. (El path de recepción/contactos viaja por XMTP → se prueba con 2 wallets.)
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9445, URL = 'http://localhost:8817/dapp.html';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const IMG = '/tmp/avatar-test.png';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-av`,
  '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map();
const rpc = (ws, method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
  setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 30000);
});

(async () => {
  let target;
  for (let i = 0; i < 30; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); target = l.find(t => t.type === 'page' && t.webSocketDebuggerUrl); if (target) break; } catch {}
    await sleep(500);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  await rpc(ws, 'Page.enable'); await rpc(ws, 'Runtime.enable'); await rpc(ws, 'DOM.enable');
  const ev = (expr, aw = false) => rpc(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: aw }).then(r => r.result?.value);

  await rpc(ws, 'Page.navigate', { url: URL }); await sleep(3000);
  await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); 'ok'`);
  await rpc(ws, 'Page.navigate', { url: URL }); await sleep(6000);

  // abrir ventana DID
  console.log('→ abriendo ventana DID…');
  await ev(`document.getElementById('userDidTrigger').click(); 'ok'`);
  await sleep(600);

  // subir la imagen no-cuadrada
  console.log('→ subiendo avatar 400x200…');
  const doc = await rpc(ws, 'DOM.getDocument', { depth: -1 });
  const node = await rpc(ws, 'DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#avatarUpload' });
  await rpc(ws, 'DOM.setFileInputFiles', { files: [IMG], nodeId: node.nodeId });
  await ev(`document.getElementById('avatarUpload').dispatchEvent(new Event('change',{bubbles:true})); 'ok'`);
  await sleep(1500); // esperar makeAvatarThumb (async)

  // inspeccionar el src normalizado + dimensiones
  const info = await ev(`(async () => {
    const src = document.getElementById('userDidAvatar').src;
    const isData = src.startsWith('data:image');
    const type = src.slice(5, src.indexOf(';'));
    const kb = Math.round((src.length * 3/4) / 1024);
    const dim = await new Promise(res => { const i = new Image(); i.onload = () => res(i.width+'x'+i.height); i.onerror=()=>res('?'); i.src = src; });
    return { isData, type, kb, dim };
  })()`, true);
  console.log('  avatar normalizado:', JSON.stringify(info));

  // guardar perfil y leer localStorage
  console.log('→ guardando perfil…');
  await ev(`document.getElementById('saveUserDid').click(); 'ok'`);
  await sleep(600);
  const saved = await ev(`(() => { try { const p = JSON.parse(localStorage.getItem('chatwallet-user-profile')||'{}'); const a = p.avatar||''; return { type: a.slice(5, a.indexOf(';')), kb: Math.round((a.length*3/4)/1024) }; } catch(e){ return {err:e.message}; } })()`);
  console.log('  en localStorage:', JSON.stringify(saved));
  const sidebar = await ev(`document.getElementById('userAvatarImg')?.src.startsWith('data:image')`);
  console.log('  sidebar propio actualizado:', sidebar);

  const shot = await rpc(ws, 'Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/cdp-avatar.png', Buffer.from(shot.data, 'base64'));

  const ok = info?.isData && info.type === 'image/webp' && info.dim === '256x256' && info.kb < 30;
  console.log('\n=== RESULTADO:', ok ? '✅ avatar normalizado (webp 256x256 chico)' : '⚠️ revisar', '===');
  ws.close(); chrome.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error('error:', e.message); chrome.kill(); process.exit(2); });
