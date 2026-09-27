// Ser vivo · Ğ1 en la tarjeta del DID.
//
// Si la 0x de un contacto tiene un vínculo vigente con una cuenta Ğ1 (comentario ius1: en la
// cadena, norma ius-naturalis/vinculo-g1/1), la tarjeta muestra la identidad Ğ1. Sin vínculo,
// no muestra nada.
//
// Hoy nadie se vinculó todavía, así que el comentario se simula: una llave EVM al azar firma
// el vínculo con una cuenta Ğ1 REAL (miembro), y el indexador falso lo devuelve. La identidad
// (seudónimo, certificaciones, vencimiento) viene del indexador real.
// Correr:  ./tests/run-g1-tarjeta.sh

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import { Wallet } from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const PORT = 9403;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// El vínculo, armado como lo arma Ius (spec §2–§3).
const G1_MIEMBRO = 'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH';   // SophieRegis, miembro
const evm = Wallet.createRandom();
const msg = 'Ius Naturalis · vinculo Ğ1 · v1\nEVM: ' + evm.address.toLowerCase() + '\nG1: ' + G1_MIEMBRO;
const firma = Buffer.from((await evm.signMessage(msg)).slice(2), 'hex');
const comentario = 'ius1:' + Buffer.concat([Buffer.from(evm.address.slice(2), 'hex'), firma]).toString('base64url');
const SIN_VINCULO = '0x2222222222222222222222222222222222222222';

// Indexador falso SOLO para los comentarios; la identidad pasa al real.
const FALSO = `(() => {
    const COM = ${JSON.stringify({ remark: comentario, blockNumber: 2900000, authorId: G1_MIEMBRO, event: { extrinsic: { hash: '0xabc', success: true } } })};
    const real = window.fetch.bind(window);
    window.__g1consultas = 0;
    window.fetch = async (url, opts) => {
        if (/squid|g1-squid/.test(String(url)) && opts && opts.body) {
            window.__g1consultas++;
            const b = JSON.parse(opts.body);
            if (/txComments/.test(b.query)) {
                const v = b.variables || {};
                const nodos = (v.id === COM.authorId || (v.p && COM.remark.startsWith(v.p))) ? [COM] : [];
                return new Response(JSON.stringify({ data: { txComments: { nodes: nodos } } }), { headers: { 'content-type': 'application/json' } });
            }
        }
        return real(url, opts);
    };
})();`;

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1tarjeta-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 200 && !ws; i++) {
        await sleep(300);
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    const listo = async (cond, seg = 60) => {
        for (let i = 0; i < seg * 2; i++) { await sleep(500); try { if (await ev(cond)) return true; } catch { } }
        return false;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: FALSO });

    await rpc('Page.navigate', { url: BASE });
    await listo(`typeof saveContacts === 'function'`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await ev(`localStorage.setItem('chatwallet-lang', 'es')`);
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'la wallet carga');
    ok(await ev(`window.__g1consultas`) === 0, 'al cargar no se consulta la red Ğ1');
    await ev(`(async () => {
        contacts = [
          { name: 'Sophie', address: ${JSON.stringify(evm.address)}, unreadCount: 0, status: 'offline' },
          { name: 'Juan', address: '${SIN_VINCULO}', unreadCount: 0, status: 'offline' },
        ];
        await saveContacts();
    })()`);

    console.log('\n── contacto vinculado a un miembro Ğ1 ──');
    await ev(`showUserInfo(${JSON.stringify(evm.address)})`);
    const vio = await listo(`!document.getElementById('userCardG1').classList.contains('hidden')`, 30);
    const caja = await ev(`(() => { const b = document.getElementById('userCardG1');
        return { txt: b.innerText, miembro: b.classList.contains('miembro'), display: getComputedStyle(b).display,
                 lineas: [...b.children].map(c => c.className + ': ' + c.textContent) }; })()`);
    ok(vio && caja.display !== 'none', 'aparece el bloque Ğ1', JSON.stringify(caja.lineas));
    ok(caja.miembro, 'con el estilo de miembro');
    ok(/✦ Ser vivo · miembro Ğ1/.test(caja.txt), 'dice "✦ Ser vivo · miembro Ğ1"');
    ok(/SophieRegis/.test(caja.txt), 'muestra el seudónimo Ğ1 (del indexador real)');
    ok(caja.txt.includes(G1_MIEMBRO), 'muestra la cuenta Ğ1');
    ok(/\d+ certificaciones vigentes · membresía hasta el \d+ de \w+ de 20\d\d/.test(caja.txt), 'certificaciones y vencimiento', caja.txt.split('\n').pop());

    const shot = await rpc('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.SHOT || '/tmp/g1-tarjeta.png', Buffer.from(shot.result.data, 'base64'));

    console.log('\n── en inglés ──');
    await ev(`localStorage.setItem('chatwallet-lang', 'en'); document.getElementById('userInfoCard').style.display = 'none'; showUserInfo(${JSON.stringify(evm.address)})`);
    await listo(`/Living being/.test(document.getElementById('userCardG1').innerText)`, 15);
    const en = await ev(`document.getElementById('userCardG1').innerText`);
    ok(/✦ Living being · Ğ1 member/.test(en) && /active certifications · membership until/.test(en), 'traducido', en.replace(/\n/g, ' | '));
    await ev(`localStorage.setItem('chatwallet-lang', 'es')`);

    console.log('\n── contacto sin vínculo ──');
    await ev(`document.getElementById('userInfoCard').style.display = 'none'; showUserInfo('${SIN_VINCULO}')`);
    await sleep(4000);
    const sin = await ev(`(() => { const b = document.getElementById('userCardG1');
        return { oculto: getComputedStyle(b).display === 'none', vacio: b.children.length === 0 }; })()`);
    ok(sin.oculto && sin.vacio, 'no muestra nada', JSON.stringify(sin));

    console.log('\n── carrera: se abre otra tarjeta antes de que llegue la respuesta ──');
    await ev(`g1Cache.clear(); document.getElementById('userInfoCard').style.display = 'none';
              showUserInfo(${JSON.stringify(evm.address)}); showUserInfo('${SIN_VINCULO}')`);
    await sleep(5000);
    const carrera = await ev(`({ dir: document.getElementById('userCardAddress').textContent,
        oculto: getComputedStyle(document.getElementById('userCardG1')).display === 'none' })`);
    ok(carrera.dir === SIN_VINCULO && carrera.oculto, 'la tarjeta de Juan no hereda el badge de Sophie', JSON.stringify(carrera));

    console.log('\n── tarjeta propia (sin vínculo) ──');
    await ev(`document.getElementById('userInfoCard').style.display = 'none'; showOwnCard()`);
    await sleep(4000);
    ok(await ev(`getComputedStyle(document.getElementById('userCardG1')).display === 'none'`), 'no muestra nada');

    console.log('\n── seudónimo con HTML (lo elige un tercero) ──');
    await ev(`g1Cache.set(${JSON.stringify(evm.address.toLowerCase())}, { t: Date.now(), r: { g1: '${G1_MIEMBRO}',
        identidad: { nombre: '<img src=x onerror="window.__xss=1">', miembro: true, certificaciones: 5, vence: null } } });
        document.getElementById('userInfoCard').style.display = 'none'; showUserInfo(${JSON.stringify(evm.address)})`);
    await sleep(1500);
    const xss = await ev(`({ img: !!document.querySelector('#userCardG1 img'), flag: !!window.__xss,
        nombre: document.querySelector('#userCardG1 .g1-nombre')?.textContent })`);
    ok(!xss.img && !xss.flag && xss.nombre.startsWith('<img'), 'se muestra como texto, no se ejecuta', JSON.stringify(xss));

} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
