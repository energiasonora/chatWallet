// E2E del vínculo Ğ1 en ius/index.html por CDP (Chrome headless real).
// Identidades: indexador Ğ1 REAL. Comentarios (remarks): simulados en la página.
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT = 9461;
const URL = 'http://127.0.0.1:8830/';
const G1 = 'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH';     // SophieRegis, miembro real
const OTRO = 'g1LqPgmosBjJC4qW7iniiAxopFXVugVHPzhDPNKCasdT6UFJo';   // Benham, miembro real
const OUT = process.argv[2];
const PK = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');

const perfil = fs.mkdtempSync(os.tmpdir() + '/ius-g1-');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${perfil}`, '--window-size=1000,1600', 'about:blank'], { stdio: 'ignore' });
const dormir = ms => new Promise(r => setTimeout(r, ms));
let target;
for(let i = 0; i < 200 && !target; i++){
  try{ target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page'); }catch(_){}
  if(!target) await dormir(200);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errores = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if(m.id && pend.has(m.id)){ pend.get(m.id)(m); pend.delete(m.id); }
  if(m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if(m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errores.push(m.params.args.map(a => a.value ?? a.description).join(' '));
};
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => {
  const r = await rpc('Runtime.evaluate', { expression: `(async()=>{ ${expr} })()`, awaitPromise: true, returnByValue: true });
  if(r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval');
  return r.result.result.value;
};
const esperar = async (expr, ms = 20000, que = expr) => {
  const t0 = Date.now();
  while(Date.now() - t0 < ms){ const v = await ev(`return (${expr})`); if(v) return v; await dormir(300); }
  throw new Error('timeout esperando: ' + que);
};
let n = 0; const ok = (c, m) => { if(!c) throw new Error('✘ ' + m); n++; console.log('  ✔', m); };

// Wallet falsa EIP-1193 + comentarios Ğ1 simulados; se instala antes que los scripts de la página.
const PRELUDIO = `
  window.__PK = ${JSON.stringify(PK)};
  window.__g1Comentarios = [];
  let __chain = '0xa4b1';
  window.ethereum = { isMetaMask:false, on(){}, removeListener(){},
    async request({method, params}){
      const w = new window.ethers.Wallet(window.__PK);
      switch(method){
        case 'eth_requestAccounts': case 'eth_accounts': return [w.address];
        case 'eth_chainId': return __chain;
        case 'net_version': return String(parseInt(__chain, 16));
        case 'wallet_switchEthereumChain': __chain = params[0].chainId; return null;
        case 'personal_sign': {
          const m = params[0]; const txt = /^0x[0-9a-f]*$/i.test(m) ? window.ethers.toUtf8String(m) : m;
          return w.signMessage(txt);
        }
        default: throw new Error('fake wallet: ' + method);
      }
    } };
  const __fetch = window.fetch.bind(window);
  window.__g1Consultas = 0;
  window.fetch = async (url, opts) => {
    if(String(url).includes('/v1/graphql') && opts && opts.body && opts.body.includes('txComments')){
      window.__g1Consultas++;
      const { query, variables } = JSON.parse(opts.body);
      let nodes = window.__g1Comentarios.slice();
      if(query.includes('equalTo:$id')) nodes = nodes.filter(c => c.authorId === variables.id);
      else nodes = nodes.filter(c => c.remark.startsWith(variables.p));
      nodes.sort((a, b) => b.blockNumber - a.blockNumber);
      return new Response(JSON.stringify({ data: { txComments: { nodes } } }), { headers: { 'content-type': 'application/json' } });
    }
    return __fetch(url, opts);
  };`;

try{
  await rpc('Page.enable'); await rpc('Runtime.enable');
  await rpc('Page.addScriptToEvaluateOnNewDocument', { source: PRELUDIO });
  await rpc('Page.navigate', { url: URL + '?lang=es' });
  await esperar(`window.IusG1 && document.readyState==='complete'`, 15000, 'carga');
  await ev(`window.IusI18n.setLang('es')`);
  ok(await ev(`return document.getElementById('g1-sec').offsetParent === null`), 'sin sesión, la sección Ğ1 está oculta');

  console.log('· conectar');
  await ev(`document.getElementById('btn-conectar-hero').click()`);
  await esperar(`[...document.querySelectorAll('.wallet-item')].some(b=>/Wallet del navegador/.test(b.textContent))`, 5000, 'modal');
  await ev(`[...document.querySelectorAll('.wallet-item')].find(b=>/Wallet del navegador/.test(b.textContent)).click()`);
  await esperar(`document.getElementById('paso1').classList.contains('hecho')`, 15000, 'W3Auth');
  const evm = await ev(`return new window.ethers.Wallet(window.__PK).address`);
  await esperar(`!document.getElementById('g1-form').hidden`, 15000, 'formulario Ğ1');
  ok(true, 'conectado ' + evm + ' y sin vínculo → formulario');

  console.log('· previsualización contra la red Ğ1 real');
  await ev(`const i=document.getElementById('g1-dir'); i.value='g1basura'; i.dispatchEvent(new Event('input'))`);
  ok(await esperar(`document.getElementById('g1-previa').textContent.includes('No es una dirección Ğ1')`, 3000), 'dirección inválida rechazada');
  ok(await ev(`return document.getElementById('btn-g1-firmar').disabled`), 'botón deshabilitado con dirección inválida');
  await ev(`const i=document.getElementById('g1-dir'); i.value=${JSON.stringify(G1)}; i.dispatchEvent(new Event('input'))`);
  const previa = await esperar(`/SophieRegis/.test(document.getElementById('g1-previa').textContent) && document.getElementById('g1-previa').textContent`, 20000, 'previa');
  ok(/miembro Ğ1/.test(previa), 'previa real: ' + previa);

  console.log('· firmar y esperar el comentario');
  await ev(`document.getElementById('btn-g1-firmar').click()`);
  const comentario = await esperar(`!document.getElementById('g1-pendiente').hidden && document.getElementById('g1-comentario-txt').textContent`, 10000, 'comentario');
  ok(comentario.length === 119 && comentario.startsWith('ius1:'), 'comentario generado (119 caracteres)');
  const guardado = await ev(`return localStorage.getItem('ius:g1pend:' + ${JSON.stringify(evm.toLowerCase())})`);
  ok(guardado && JSON.parse(guardado).comentario === comentario, 'pendiente guardado para sobrevivir a una recarga');
  ok(await ev(`return getComputedStyle(document.getElementById('g1-revocar')).display === 'none'`), 'mientras está pendiente, "desvincular" NO se ve');
  if(OUT) fs.writeFileSync(OUT.replace('.png', '-pendiente.png'), Buffer.from((await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result.data, 'base64'));

  // alguien "copia" el comentario desde otra cuenta: no tiene que vincular
  await ev(`window.__g1Comentarios.push({ remark:${JSON.stringify(comentario)}, authorId:${JSON.stringify(OTRO)}, blockNumber:2900000, event:{extrinsic:{hash:'0xcopiado',success:true}} })`);
  // y la billetera Ğ1 real lo manda desde la cuenta correcta
  await ev(`window.__g1Comentarios.push({ remark:${JSON.stringify(comentario)}, authorId:${JSON.stringify(G1)}, blockNumber:2905123, event:{extrinsic:{hash:'0xabc123',success:true}} })`);
  await esperar(`document.querySelector('#g1-vinculado .badge-vivo')`, 25000, 'badge tras el sondeo');
  const badge = await ev(`return document.querySelector('#g1-vinculado .badge-vivo').innerText`);
  ok(/Ser vivo · miembro Ğ1/.test(badge) && /SophieRegis/.test(badge) && badge.includes(evm) && /2905123/.test(badge), 'badge: ' + badge.replace(/\n/g, ' | '));
  ok(await ev(`return !!document.querySelector('#cuenta .vivo')`), '✦ en la cabecera');
  ok(await ev(`return getComputedStyle(document.getElementById('g1-pendiente')).display === 'none' && getComputedStyle(document.getElementById('g1-revocar')).display !== 'none'`), 'pendiente oculto de verdad, revocar visible');
  ok(!(await ev(`return localStorage.getItem('ius:g1pend:' + ${JSON.stringify(evm.toLowerCase())})`)), 'pendiente borrado');

  console.log('· idioma');
  await ev(`window.IusI18n.setLang('fr')`);
  ok(/Être vivant · membre Ğ1/.test(await ev(`return document.querySelector('#g1-vinculado .badge-vivo').innerText`)), 'badge re-pintado en francés');
  await ev(`window.IusI18n.setLang('es')`);
  if(OUT) fs.writeFileSync(OUT, Buffer.from((await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result.data, 'base64'));

  console.log('· vista Verificar');
  await ev(`document.querySelector('.nav-vistas .tab[data-vista=verificar]').click()`);
  const consultar = async v => { await ev(`document.getElementById('sv-entrada').value=${JSON.stringify(v)}; document.getElementById('btn-sv').click()`);
    await esperar(`!document.getElementById('btn-sv').disabled`, 20000, 'consulta ' + v);
    return ev(`return document.getElementById('sv-veredicto').innerText + ' || ' + document.getElementById('sv-resultado').innerText`); };
  let r = await consultar(evm);
  ok(/miembro Ğ1/.test(r) && r.includes(G1), 'por 0x vinculada → badge');
  r = await consultar(OTRO);
  ok(/miembro Ğ1/.test(r) && /Benham/.test(r) && /Sin vínculo/.test(r), 'por g1 real sin vínculo → miembro, sin 0x');
  r = await consultar('0x000000000000000000000000000000000000dEaD');
  ok(/no tiene un vínculo Ğ1/.test(r), 'por 0x desconocida');
  r = await consultar('hola');
  ok(/Formato no reconocido/.test(r), 'formato inválido');
  if(OUT) fs.writeFileSync(OUT.replace('.png', '-verificar.png'), Buffer.from((await rpc('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })).result.data, 'base64'));

  console.log('· revocación, sin recargar el estado');
  await ev(`window.__g1Comentarios.push({ remark:'ius1:rev', authorId:${JSON.stringify(G1)}, blockNumber:2906000, event:{extrinsic:{hash:'0xrev',success:true}} })`);
  r = await consultar(evm);
  ok(/no tiene un vínculo Ğ1/.test(r), 'tras ius1:rev la 0x pierde el vínculo');

  ok(errores.length === 0, 'sin errores en consola' + (errores.length ? ': ' + errores.join(' / ') : ''));
  console.log(`\n✔ ${n} comprobaciones E2E OK`);
}catch(e){
  console.error(e.message); console.error('errores de página:', errores); process.exitCode = 1;
}finally{
  ws.close(); chrome.kill('SIGKILL');
}
