// Explorador Ğ1 (src/static/g1/index.html) contra la red Ğ1 real: el indexador y un nodo.
// Correr:  (python3 -m http.server 8851 --directory src/static &) ; node tests/g1-explorador-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8851/g1/';
const ES = '&lang=es';   // Chrome headless viene en inglés
const SHOTS = process.env.SHOTS;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1x-');
const proc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=9463', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
let ws;
for (let i = 0; i < 40 && !ws; i++) { await sleep(500); try { const l = await (await fetch('http://127.0.0.1:9463/json/list')).json(); const pg = l.find(t => t.type === 'page'); if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl); } catch { } }
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errores = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text); };
const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const esperar = async (expr, seg = 30) => { for (let i = 0; i < seg * 4; i++) { if (await ev(expr)) return true; await sleep(250); } return false; };
const foto = async (n) => { if (!SHOTS) return; const r = await rpc('Page.captureScreenshot', { captureBeyondViewport: true }); fs.writeFileSync(`${SHOTS}/g1x-${n}.png`, Buffer.from(r.result.data, 'base64')); };
await rpc('Page.enable'); await rpc('Runtime.enable');
await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

try {
    console.log('── el bloque del pago de 120 Ğ1 ──');
    await rpc('Page.navigate', { url: BASE + '?bloque=3652720' + ES });
    ok(await esperar(`!!document.querySelector('.monto')`), 'carga el bloque');
    const v = await ev(`({ num: document.querySelector('.bloque-num').textContent, monto: document.querySelector('.monto').textContent,
        partes: document.querySelector('.partes').innerText, com: document.querySelector('.comentario')?.textContent, titulo: document.title })`);
    ok(/3\.652\.720/.test(v.num), 'número de bloque con puntos', v.num);
    ok(v.monto === '120,00 Ğ1', 'el monto en Ğ1 (12000 céntimos)', v.monto);
    ok(/g1LZB3pV1gDLAdixBoNDZwaBdYTxx4BGVu3vuuLbqY42bqTTf/.test(v.partes) && /Xunorus/.test(v.partes) && /sin comisión/.test(v.partes), 'de, para (con nombre Ğ1) y comisión', v.partes.replace(/\n/g, ' | '));
    ok(v.com === 'olivos 14/11/26', 'el comentario', v.com);
    ok(await esperar(`document.querySelector('.sello').classList.contains('ok')`, 30), 'comprobado contra un nodo', await ev(`document.querySelector('.sello').textContent + ' · ' + (document.querySelector('.sello').dataset.nodo||'')`));
    await ev(`document.querySelector('details').open = true; true`);
    const todo = await ev(`document.querySelector('details').innerText`);
    ok(/Un paquete de operaciones/.test(todo) && /Se movió la plata/.test(todo), 'las operaciones en llano', todo.split('\n')[0]);
    await ev(`document.querySelectorAll('details').forEach(d => d.open = true); true`);
    const ancho = await ev(`document.documentElement.scrollWidth`);
    ok(ancho <= 390, 'no se sale de la pantalla a lo ancho', String(ancho));
    await foto('1-bloque');

    console.log('── buscar otro bloque ──');
    await ev(`document.getElementById('inBloque').value = '1'; document.getElementById('formBuscar').requestSubmit(); true`);
    ok(await esperar(`/#1$/.test(document.querySelector('.bloque-num')?.textContent || '') && /[?&]bloque=1(&|$)/.test(location.search)`), 'buscar cambia el bloque y la URL');
    ok(await esperar(`/En este bloque no hubo pagos/.test(document.body.textContent)`, 10), 'un bloque sin pagos lo dice');

    console.log('── un bloque que no existe ──');
    await rpc('Page.navigate', { url: BASE + '?bloque=999999999' + ES });
    ok(await esperar(`/no está en el indexador/.test(document.body.textContent)`), 'avisa que no existe');

    console.log('── un nodo propio por la URL (inexistente): cae al siguiente ──');
    await rpc('Page.navigate', { url: BASE + '?bloque=3652720&nodo=' + encodeURIComponent('wss://127.0.0.1:1') });
    ok(await esperar(`document.querySelector('.sello')?.classList.contains('ok')`, 40), 'si el primer nodo no responde, prueba el siguiente', await ev(`document.querySelector('.sello')?.dataset.nodo`));

    console.log('── en inglés ──');
    await rpc('Page.navigate', { url: BASE + '?bloque=3652720&lang=en' });
    ok(await esperar(`/Payments in this block/.test(document.body.textContent) && document.querySelector('.monto')?.textContent === '120.00 Ğ1'`), 'textos y número en inglés', await ev(`location.href + ' :: ' + document.body.textContent.replace(/\s+/g, ' ').slice(0, 300)`));

    console.log('── tema claro ──');
    await rpc('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await rpc('Page.navigate', { url: BASE + '?bloque=3652720' + ES });
    await esperar(`document.querySelector('.sello')?.classList.contains('ok')`, 30);
    ok(await ev(`getComputedStyle(document.body).backgroundColor`) === 'rgb(243, 244, 246)', 'sigue el tema claro del teléfono');
    await foto('3-claro');

    console.log('── un indexador que miente ──');
    // Un indexador falso que da otro hash: el nodo lo desmiente.
    await rpc('Fetch.enable', { patterns: [{ urlPattern: 'https://squid.g1.brussels.ovh/*' }] });
    ws.addEventListener('message', async e => {
        const m = JSON.parse(e.data);
        if (m.method !== 'Fetch.requestPaused') return;
        const cors = [{ name: 'access-control-allow-origin', value: '*' }, { name: 'access-control-allow-headers', value: 'content-type' }, { name: 'access-control-allow-methods', value: 'POST, OPTIONS' }];
        if (m.params.request.method === 'OPTIONS') { rpc('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 204, responseHeaders: cors }); return; }
        // La respuesta real (con reintentos: el indexador a veces tarda), con el hash cambiado.
        let r;
        for (let i = 0; i < 3 && !r; i++) { try { r = await (await fetch(m.params.request.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: m.params.request.postData, signal: AbortSignal.timeout(8000) })).json(); } catch { } }
        r = r || { errors: [{ message: 'sin respuesta' }] };
        if (r.data?.blocks?.nodes?.[0]) r.data.blocks.nodes[0].hash = '\\x' + 'ab'.repeat(32);
        rpc('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'application/json' }, ...cors], body: Buffer.from(JSON.stringify(r)).toString('base64') });
    });
    await rpc('Page.navigate', { url: BASE + '?bloque=3652720' });
    ok(await esperar(`document.querySelector('.sello')?.classList.contains('bad')`, 60), 'el nodo desmiente al indexador', await ev(`document.querySelector('.sello')?.textContent || document.body.textContent.slice(0, 200)`));
    await foto('2-miente');
    await rpc('Fetch.disable');

    ok(!errores.length, 'sin excepciones', errores.join(' | '));
} catch (e) { ok(false, 'la prueba se cortó', e.message); }
finally { try { ws.close(); } catch { } proc.kill('SIGKILL'); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { } }
console.log(fails ? `\n${fails} fallaron` : '\ntodo bien');
process.exit(fails ? 1 : 0);
