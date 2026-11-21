// Invitar con la cuenta Ğ1: el botón de compartir de al lado del nombre manda
// chatwallet.org/@g1… si hay vínculo público ius1; si no, ofrece publicarlo UNA vez
// («Ahora no» queda anotado); y /@g1… del otro lado abre la tarjeta Ğ1 del escáner.
// Con seudónimo Ğ1, el link es /@Nombre (se resuelve contra el indexador real).
// La cadena va simulada (no se manda nada); el comentario que se "publicaría" se verifica
// con el mismo código que usa quien lo lee.
//
// Uso: servir el build en :8817 (python3 -m http.server 8817 -d dist-respaldo-test) y
//      node tests/invitacion-g1-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9465;
const APP = process.env.APP_URL || 'http://localhost:8817/dapp.html';
const PK = '0x584bf778404a370bc90c7ef5c1aef766bc3aff5761a02d69d1294d843513b06c';

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw-invg1-${Date.now()}`,
    '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map(); let ws;
const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 30000);
});
const ev = (expr) => rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    .then(r => { if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result?.value; });
const hayModal = (id) => ev(`!!document.getElementById('${id}')`);
const copiado = () => ev(`window.__copiado || null`);
// Toca el botón real del header y espera a que algo pase.
const tocarCompartir = async () => { await ev(`window.__copiado=null; document.getElementById('copyAddressButton').click()`); await sleep(1200); };

try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
        try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        await sleep(300);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id).resolve(d.result || d); pending.delete(d.id); } };
    await rpc('Page.enable'); await rpc('Runtime.enable');

    await rpc('Page.navigate', { url: APP }); await sleep(2500);
    await ev(`(async()=>{for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); localStorage.setItem('xmtp-chat-wallet', '${PK}'); })()`);
    await rpc('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`typeof currentWallet!=='undefined' && !!currentWallet`)) break; }

    // Sin hoja nativa: compartir = copiar, y se captura lo copiado.
    await ev(`Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
        navigator.clipboard.writeText = async (x) => { window.__copiado = x; };`);
    const dir = await ev(`currentWallet.address`);
    // Una cuenta Ğ1 cualquiera (la "tuya") y otra ajena, con el formato real.
    const B = `(await window.cwCargarBilleteraG1())`;
    const [miG1, otroG1] = await ev(`(async()=>{const G=${B}.G1; return [G.ss58Codificar(new Uint8Array(32).fill(7)), G.ss58Codificar(new Uint8Array(32).fill(9))]})()`);

    // ── 1. Ğ1 apagada: el link de siempre ──
    await tocarCompartir();
    ok(/\/dapp\?address=0x[0-9a-fA-F]{40}&pk=/.test(await copiado() || ''), 'Ğ1 apagada → link EVM de siempre');
    ok(!(await hayModal('g1VinculoPublicoModal')), 'Ğ1 apagada → no pregunta nada');

    // ── 2. Ğ1 activa, sin vínculo público → pregunta; «Ahora no» → link común y no vuelve a preguntar ──
    await ev(`localStorage.setItem('cw-red-g1-${dir.toLowerCase()}','1');
        localStorage.setItem('cw-g1-cuenta-${dir.toLowerCase()}', JSON.stringify({g1:'${miG1}', ruta:''}));
        (async()=>{ const G=${B}.G1; window.__vinculo=null; G.vinculoDeEvm = async()=>window.__vinculo; })()`);
    await tocarCompartir();
    ok(await hayModal('g1VinculoPublicoModal'), 'Ğ1 activa sin vínculo → aparece la pregunta');
    ok(await copiado() === null, '…y todavía no compartió nada');
    ok((await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="cuenta"]').textContent`)) === miG1, 'la pregunta muestra tu cuenta Ğ1');
    await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="comun"]').click()`); await sleep(600);
    ok(/\/dapp\?address=/.test(await copiado() || ''), '«Ahora no» → comparte el link común');
    ok(!(await hayModal('g1VinculoPublicoModal')), '…y cierra la pregunta');
    await tocarCompartir();
    ok(!(await hayModal('g1VinculoPublicoModal')) && /\/dapp\?address=/.test(await copiado() || ''), 'segunda vez: no vuelve a preguntar, link común');

    // ── 3. Publicar (cadena simulada): el comentario es un vínculo válido de TU 0x con TU g1 ──
    await ev(`localStorage.removeItem('cw-g1-vinculo-publico-no-${dir.toLowerCase()}');
        window.__publicado = null;
        window.cwCargarCadenaG1 = async () => ({
            cuentaExiste: async () => true,
            publicarComentario: async (cuenta, comentario) => { window.__publicado = { de: cuenta.direccion, comentario }; return { hash: '0xab', bloque: 4242 }; },
        });
        cuentaFirmanteG1 = async () => ({ direccion: '${miG1}' });`);
    await tocarCompartir();
    ok(await hayModal('g1VinculoPublicoModal'), 'sin el «no» anotado, vuelve a ofrecer');
    await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="publicar"]').click()`); await sleep(1500);
    const pub = await ev(`window.__publicado`);
    ok(pub && pub.de === miG1, 'publica desde tu cuenta Ğ1');
    ok(pub && /^ius1:[A-Za-z0-9_-]{114}$/.test(pub.comentario), 'comentario ius1 de 119 caracteres');
    ok((await ev(`(async()=>${B}.G1.verificarComentario(${JSON.stringify(pub?.comentario || '')}, '${miG1}', window.ethers))()`) || '').toLowerCase() === dir.toLowerCase(),
        'el comentario verifica: tu 0x, firmado por vos, publicado por tu g1');
    ok(!(await ev(`(async()=>${B}.G1.verificarComentario(${JSON.stringify(pub?.comentario || '')}, '${otroG1}', window.ethers))()`)), 'el mismo comentario publicado por otra g1 no vale');
    ok(/4242/.test(await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="estado"]').textContent`)), 'dice en qué bloque quedó');
    ok(await copiado() === null, 'no comparte solo (hace falta otro toque para la hoja nativa)');
    await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="compartir"]').click()`); await sleep(600);
    ok(await copiado() === `https://chatwallet.org/@${miG1}`, 'botón «Compartir mi link Ğ1» → chatwallet.org/@g1…');

    // ── 4. Con el vínculo hecho: directo el link Ğ1, sin preguntar ──
    await tocarCompartir();
    ok(!(await hayModal('g1VinculoPublicoModal')) && await copiado() === `https://chatwallet.org/@${miG1}`, 'después: el botón comparte el link Ğ1 directo');
    // Vínculo encontrado en el indexador (otra instalación lo publicó) → también directo.
    await ev(`localStorage.removeItem('cw-g1-vinculo-publico-${dir.toLowerCase()}'); window.__vinculo = { g1: '${miG1}', evm: '${dir}', bloque: 1 };`);
    await tocarCompartir();
    ok(await copiado() === `https://chatwallet.org/@${miG1}`, 'vínculo ya en la cadena → link Ğ1 sin preguntar');
    // Vínculo de la 0x con OTRA g1 (cambiaste de cuenta Ğ1): no sirve, se ofrece de nuevo.
    await ev(`localStorage.removeItem('cw-g1-vinculo-publico-${dir.toLowerCase()}'); window.__vinculo = { g1: '${otroG1}', evm: '${dir}', bloque: 1 };`);
    await tocarCompartir();
    ok(await hayModal('g1VinculoPublicoModal'), 'vínculo con otra g1 → vuelve a ofrecer');
    await ev(`document.getElementById('g1VinculoPublicoModal')?.remove()`);
    // Indexador caído: no se pregunta nada, va el link común.
    await ev(`(async()=>{ const G=${B}.G1; G.vinculoDeEvm = async()=>{ throw new Error('caído') }; })()`);
    await tocarCompartir();
    ok(!(await hayModal('g1VinculoPublicoModal')) && /\/dapp\?address=/.test(await copiado() || ''), 'indexador caído → link común, sin preguntar');

    // ── 5. Cuenta Ğ1 que no existe en la cadena: avisa y ofrece el link común ──
    await ev(`(async()=>{ const G=${B}.G1; G.vinculoDeEvm = async()=>null; })();
        window.cwCargarCadenaG1 = async () => ({ cuentaExiste: async () => false, publicarComentario: async () => { window.__publicado2 = true; } });`);
    await tocarCompartir();
    await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="publicar"]').click()`); await sleep(1000);
    ok(!(await ev(`window.__publicado2 || false`)), 'cuenta inexistente → no intenta publicar');
    ok(/todavía no existe/.test(await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="estado"]').textContent`)), '…y lo explica');
    await ev(`document.querySelector('#g1VinculoPublicoModal [data-g1="comun"]').click()`); await sleep(600);
    ok(/\/dapp\?address=/.test(await copiado() || ''), '…y comparte el link común');
    ok(await ev(`localStorage.getItem('cw-g1-vinculo-publico-no-${dir.toLowerCase()}')`) === null, 'eso no cuenta como «Ahora no»: se vuelve a ofrecer cuando exista');

    // ── 6. Del otro lado: /@g1… abre la tarjeta Ğ1 ──
    ok(await ev(`cwDestinoDeLink('https://chatwallet.org/@${otroG1}')`) === otroG1, 'cwDestinoDeLink lee /@g1…');
    await ev(`void abrirChatConDestino('${otroG1}', null, {greet:'link'})`); await sleep(1500);
    ok(await hayModal('g1EscaneoModal'), '/@g1… abre la tarjeta de la cuenta Ğ1');
    await ev(`document.getElementById('g1EscaneoModal')?.remove()`);
    await ev(`void abrirChatConDestino('g1NoEsUnaCuentaValidaPeroTieneElLargoDeUna1234567', null, {greet:'link'})`); await sleep(1000);
    ok(!(await hayModal('g1EscaneoModal')), 'una g1 con la suma de control mal no abre la tarjeta');

    // ── 7. Seudónimo Ğ1: chatwallet.org/@Xunorus ──
    // Compartir: con nombre (identidad viva) el link lleva el nombre; revocada, la g1.
    await ev(`localStorage.setItem('cw-g1-vinculo-publico-${dir.toLowerCase()}', JSON.stringify({g1:'${miG1}', bloque:1}));
        localStorage.removeItem('cw-g1-nombre-${miG1}');
        (async()=>{ const G=${B}.G1; window.__idty={nombre:'Mi_Nombre', estado:'Unvalidated'}; G.identidad = async()=>window.__idty; })()`);
    await tocarCompartir();
    ok(await copiado() === 'https://chatwallet.org/@Mi_Nombre', 'con seudónimo Ğ1 → comparte chatwallet.org/@Mi_Nombre');
    await ev(`localStorage.removeItem('cw-g1-nombre-${miG1}'); window.__idty={nombre:'Mi_Nombre', estado:'Revoked'};`);
    await tocarCompartir();
    ok(await copiado() === `https://chatwallet.org/@${miG1}`, 'identidad revocada → no presta el nombre, va la g1');
    // Del otro lado, contra el indexador real: «Xunorus» existe (con X mayúscula).
    const XUN = 'g1Pb8LtH4vn5XMHAYQVaBGVmLXU3UQxw6zdhf6C4NE1HcDyWW';
    const deNombre = (n) => ev(`(async()=>${B}.G1.cuentaDeNombre(${JSON.stringify(n)}))()`);
    ok((await deNombre('Xunorus'))?.g1 === XUN, 'cuentaDeNombre: nombre exacto → su cuenta');
    const min = await deNombre('xunorus');
    ok(min?.g1 === XUN && min?.nombre === 'Xunorus', 'en minúsculas también, y devuelve el nombre real');
    ok(await deNombre('zz-nadie-tiene-esto-7') === null, 'nombre que no existe → null');
    ok(await deNombre('no.vale') === null && await deNombre('ab') === null, 'nombre con caracteres o largo inválidos → null sin preguntar');
    ok(await ev(`cwDestinoDeLink('https://chatwallet.org/@Xunorus')`) === 'Xunorus', 'cwDestinoDeLink lee /@Xunorus');
    await ev(`void abrirChatConDestino('@xunorus', null, {greet:'link'})`); await sleep(4000);
    ok(await hayModal('g1EscaneoModal'), '/@xunorus abre la tarjeta Ğ1');
    ok(await ev(`document.querySelector('#g1EscaneoModal [data-g1="cuenta"]')?.textContent`) === XUN, '…de la cuenta de Xunorus');
    ok(await ev(`!document.querySelector('#g1EscaneoModal [data-g1="chat"]')?.classList.contains('hidden')`), '…con «Agregar y chatear» (su vínculo ius1 real)');
    await ev(`document.getElementById('g1EscaneoModal')?.remove()`);
    await ev(`void abrirChatConDestino('@zz-nadie-tiene-esto-7', null, {greet:'link'})`); await sleep(4000);
    ok(!(await hayModal('g1EscaneoModal')), 'nombre sin identidad Ğ1 → no abre tarjeta (sigue como .eth)');
} catch (e) {
    console.error('💥', e); fails++;
} finally {
    chrome.kill();
    console.log(fails ? `\n${fails} fallas` : '\nTodo OK');
    process.exit(fails ? 1 : 0);
}
