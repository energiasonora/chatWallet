// Red Ğ1 en la billetera (solo lectura) + restaurar con frases en otros idiomas.
//
// El indexador Ğ1 se simula: no hay una frase de un miembro real para probar. La cuenta
// "miembro" es la //0 de una frase de prueba, así se prueba también que elige la derivación
// que se usa en la red y no la raíz. Todo lo demás es la app real (build de Parcel).
// Correr:  ./tests/run-g1-red.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import { HDNodeWallet, Mnemonic, wordlists } from 'ethers';
import { cuentaG1 } from '../src/js/g1-llave.js';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8849/dapp.html';
const PORT = 9405;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

// Frase 1 (inglés, "creada acá"): su //0 es miembro con saldo.
const P1 = Mnemonic.fromEntropy('0x' + '17'.repeat(16)).phrase;
const W1 = HDNodeWallet.fromPhrase(P1);
const MIEMBRO = cuentaG1(P1, '//0').direccion;
const RAIZ1 = cuentaG1(P1, '').direccion;
const PENDIENTE = cuentaG1(P1, '//1').direccion;   // identidad que todavía junta certificaciones
// Frase 2 (francés, como la muestra Ğecko): ninguna candidata existe todavía.
const P2 = Mnemonic.fromEntropy('0x' + '2b'.repeat(16), undefined, wordlists.fr).phrase;
const W2 = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(P2, undefined, wordlists.fr));
const RAIZ2 = cuentaG1(P2, '').direccion;

// Vínculo ius1 del miembro con una 0x (sección D): lo firma una llave EVM al azar.
const EVM_VINCULADA = HDNodeWallet.createRandom();
const firmaV = Buffer.from((await EVM_VINCULADA.signMessage('Ius Naturalis · vinculo Ğ1 · v1\nEVM: ' + EVM_VINCULADA.address.toLowerCase() + '\nG1: ' + MIEMBRO)).slice(2), 'hex');
const COMENTARIO_VINCULO = { remark: 'ius1:' + Buffer.concat([Buffer.from(EVM_VINCULADA.address.slice(2), 'hex'), firmaV]).toString('base64url'),
    blockNumber: 2900000, authorId: MIEMBRO, event: { extrinsic: { hash: '0xabc', success: true } } };

const FALSO = `(() => {
    const MIEMBRO = ${JSON.stringify(MIEMBRO)};
    const PENDIENTE = ${JSON.stringify(PENDIENTE)};
    const cuentas = { [MIEMBRO]: { id: MIEMBRO, balance: '412013', identity: { isMember: true, name: 'TestMiembro', firstEligibleUd: 202 }, estado: 'Member', certs: 7 },
                      [PENDIENTE]: { id: PENDIENTE, balance: '0', identity: { isMember: false, name: 'Novata', firstEligibleUd: 0 }, estado: 'Unvalidated', certs: 3 } };
    const real = window.fetch.bind(window);
    window.__g1consultas = 0;
    const json = (data) => new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json' } });
    window.fetch = async (url, opts) => {
        if (/squid/.test(String(url)) && opts && opts.body) {
            window.__g1consultas++;
            const b = JSON.parse(opts.body), q = b.query, v = b.variables || {};
            if (/id:\\{ in:/.test(q)) return json({ accounts: { nodes: v.ids.filter(i => cuentas[i]).map(i => cuentas[i]) } });
            if (/accounts\\(filter:\\{ id:\\{ equalTo/.test(q)) return json({ accounts: { nodes: cuentas[v.id] ? [cuentas[v.id]] : [] } });
            if (/universalDividends/.test(q)) return json({ universalDividends: { nodes: v.desde === 202 ? [{ amount: '1217' }, { amount: '1217' }] : [] } });
            if (/identityByAccountId/.test(q)) {
                const c = cuentas[v.id];
                return json({ identityByAccountId: c ? { index: 99, name: c.identity.name, status: c.estado, isMember: c.identity.isMember, expireOn: 3000000,
                    certReceived: { totalCount: c.certs } } : null, blocks: { nodes: [{ height: 2900000, timestamp: new Date().toISOString() }] } });
            }
            if (/txComments/.test(q)) {
                const nodos = (window.__g1comentarios || []).filter(n => v.id ? n.authorId === v.id : n.remark.startsWith(v.p));
                return json({ txComments: { nodes: nodos } });
            }
        }
        return real(url, opts);
    };
})();`;

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-g1red-');
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
    const texto = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.textContent || '').trim()`);
    const visible = (sel) => ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return !!e && getComputedStyle(e).display !== 'none' && !e.classList.contains('hidden'); })()`);
    const chunks = () => ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => /g1-billetera|frase\\.|\\/g1\\./.test(n))`);
    const abrirSelector = () => ev(`document.getElementById('tokenSelectorToggle').click()`);
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.addScriptToEvaluateOnNewDocument', { source: FALSO });

    // ── A) billetera creada acá (la frase quedó guardada) ─────────────────────
    await rpc('Page.navigate', { url: BASE });
    await listo(`typeof saveContacts === 'function'`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(W1.privateKey)});
              localStorage.setItem('xmtp-chat-wallet-mnemonic', ${JSON.stringify(P1)});
              localStorage.setItem('chatwallet-lang', 'es')`);
    await rpc('Page.navigate', { url: BASE });
    ok(await listo(`!!(currentWallet && currentWallet.address)`), 'la wallet carga');
    await sleep(2000);
    console.log('\n── A) nada de Ğ1 hasta elegirla ──');
    ok(await ev(`window.__g1consultas`) === 0, 'cero consultas a la red Ğ1 al cargar');
    ok((await chunks()).length === 0, 'no se bajó ningún pedazo Ğ1 ni de frases', JSON.stringify(await chunks()));
    await abrirSelector();
    ok(await listo(`!!document.getElementById('redG1Item')`, 5), 'el selector ofrece Ğ1');
    ok(await ev(`document.querySelector('#tokenSelectorList').lastElementChild.id === 'redG1Item'`), 'al final, debajo de las EVM');
    ok(await texto('#redG1Item') === 'Ğ1 · moneda libre', 'se llama "Ğ1 · moneda libre"', await texto('#redG1Item'));

    console.log('\n── A) activar Ğ1 ──');
    await ev(`document.getElementById('redG1Item').click()`);
    ok(await listo(`/Ğ1$/.test(document.getElementById('balanceDisplay').textContent)`, 20), 'el saldo pasa a Ğ1', await texto('#balanceDisplay'));
    ok(await texto('#balanceDisplay') === '4.120,13 Ğ1', 'saldo 4.120,13 Ğ1', await texto('#balanceDisplay'));
    ok(await texto('#g1WalletPendiente') === '+ 24,34 Ğ1 de dividendo universal por cobrar', 'dividendo por cobrar', await texto('#g1WalletPendiente'));
    ok(await texto('#g1WalletIdentidad') === '✦ TestMiembro · miembro Ğ1', 'identidad de miembro', await texto('#g1WalletIdentidad'));
    ok(await texto('#chainNameDisplay') === 'Ğ1 · moneda libre', 'nombre de la red');
    const guardada = await ev(`JSON.parse(localStorage.getItem('cw-g1-cuenta-' + currentWallet.address.toLowerCase()))`);
    ok(guardada?.g1 === MIEMBRO && guardada?.ruta === '//0', 'eligió la //0 (la que existe), no la raíz', JSON.stringify(guardada));
    ok(await texto('#qrAddressLabel') === `${MIEMBRO.slice(0, 8)}…${MIEMBRO.slice(-6)}`, 'el QR de la billetera es la cuenta Ğ1', await texto('#qrAddressLabel'));
    ok(!(await visible('#gasBalanceDisplay')) && !(await visible('#smartWalletBalanceDisplay')), 'sin renglones EVM (gas, SmartWallet)');
    ok((await chunks()).some(n => /g1-billetera/.test(n)), 'el pedazo Ğ1 se bajó recién ahora');
    const sinFrase = await ev(`Object.keys(localStorage).filter(k => /g1/.test(k)).map(k => localStorage.getItem(k)).join(' ')`);
    ok(!sinFrase.includes(P1.split(' ')[0] + ' ' + P1.split(' ')[1]), 'lo guardado para Ğ1 no incluye la frase');

    const shot = await rpc('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(process.env.SHOT || '/tmp/g1-red.png', Buffer.from(shot.result.data, 'base64'));

    console.log('\n── A) ocultar saldo ──');
    await ev(`document.getElementById('hideBalanceBtn').click()`);
    await sleep(300);
    ok(await texto('#balanceDisplay') === '••••' && /••••/.test(await texto('#g1WalletPendiente')), 'tapa el saldo y el dividendo', await texto('#g1WalletPendiente'));
    await ev(`document.getElementById('hideBalanceBtn').click()`);

    console.log('\n── A) enviar y recibir ──');
    await ev(`document.getElementById('sendBtn').click()`);
    await sleep(800);
    ok(!(await visible('#sendModal')), 'Enviar no abre el envío EVM');
    ok(await ev(`[...document.querySelectorAll('.cw-notif')].some(n => /próxima versión/.test(n.innerText))`), 'avisa que enviar Ğ1 llega pronto');
    await ev(`document.getElementById('receiveBtn').click()`);
    await sleep(800);
    ok(await visible('#receiveModal') && await texto('#receiveStandardAddress') === MIEMBRO, 'Recibir muestra la cuenta Ğ1', await texto('#receiveStandardAddress'));
    ok(!(await visible('#receiveTabStealth')), 'sin la pestaña stealth (es EVM)');
    await ev(`document.getElementById('closeReceiveModal').click()`);

    console.log('\n── A) recargar ──');
    await rpc('Page.navigate', { url: BASE });
    await listo(`!!(currentWallet && currentWallet.address)`);
    ok(await listo(`document.getElementById('balanceDisplay').textContent.trim() === '4.120,13 Ğ1'`, 20), 'sigue en Ğ1 después de recargar', await texto('#balanceDisplay'));
    ok(await listo(`/Recibir|Receive/.test(document.body.innerText)`, 5) && await texto('#chainNameDisplay') === 'Ğ1 · moneda libre', 'con el nombre de la red Ğ1');

    console.log('\n── A) volver a una red EVM ──');
    await abrirSelector();
    await listo(`!!document.getElementById('redG1Item')`, 5);
    ok(await ev(`!!document.querySelector('#redG1Item svg')`), 'Ğ1 aparece tildada');
    await ev(`document.querySelector('#tokenSelectorList button').click()`);
    await sleep(1500);
    ok(!(await ev(`document.body.classList.contains('red-g1')`)), 'sale de Ğ1');
    ok(!/Ğ1/.test(await texto('#chainNameDisplay')), 'nombre de red EVM', await texto('#chainNameDisplay'));
    ok(await texto('#qrAddressLabel') === `${W1.address.slice(0, 8)}…${W1.address.slice(-6)}`, 'el QR vuelve a la 0x', await texto('#qrAddressLabel'));
    ok(!(await visible('#g1WalletPendiente')), 'sin renglones Ğ1');

    // ── B) restaurar con una frase en francés (como la muestra Ğecko) ───────────
    console.log('\n── B) restaurar con frase en francés ──');
    const sinTildes = P2.normalize('NFD').replace(/[̀-ͯ]/g, '');
    await ev(`document.getElementById('restoreInput').value = ${JSON.stringify(sinTildes.toUpperCase())};
              document.getElementById('restoreWalletForm').requestSubmit()`);
    ok(await listo(`currentWallet && currentWallet.address === ${JSON.stringify(W2.address)}`, 30), 'restaura: la 0x es la de ethers con la lista francesa (tipeada sin tildes y en mayúsculas)', await ev(`currentWallet && currentWallet.address`));
    ok(await listo(`[...document.querySelectorAll('.cw-notif')].some(n => /Frase en francés/.test(n.innerText))`, 10), 'avisa "Frase en francés" y que use siempre la misma');
    ok(await ev(`localStorage.getItem('xmtp-chat-wallet-mnemonic')`) === null, 'la frase NO se guarda (como antes)');
    const cands = await ev(`JSON.parse(localStorage.getItem('cw-g1-candidatas-' + currentWallet.address.toLowerCase()) || 'null')`);
    ok(cands?.length === 31 && cands[0].g1 === RAIZ2, 'guarda las 31 candidatas Ğ1 (solo direcciones)', cands && cands[0].g1);
    await abrirSelector();
    await listo(`!!document.getElementById('redG1Item')`, 5);
    await ev(`document.getElementById('redG1Item').click()`);
    ok(await listo(`document.getElementById('balanceDisplay').textContent.trim() === '0,00 Ğ1'`, 20), 'activa Ğ1 sin pedir la frase: cuenta nueva, 0,00 Ğ1', await texto('#balanceDisplay'));
    ok(await texto('#g1WalletIdentidad') === 'Cuenta Ğ1 nueva: todavía no recibió nada', 'dice que es nueva', await texto('#g1WalletIdentidad'));
    ok(await texto('#qrAddressLabel') === `${RAIZ2.slice(0, 8)}…${RAIZ2.slice(-6)}`, 'la raíz (la que crearía Cesium²)');

    // ── C) billetera restaurada antes de esta versión: sin frase ni candidatas ─────
    console.log('\n── C) sin frase a mano: se pide una vez ──');
    await ev(`localStorage.clear(); localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(W1.privateKey)}); localStorage.setItem('chatwallet-lang', 'es')`);
    await rpc('Page.navigate', { url: BASE });
    await listo(`!!(currentWallet && currentWallet.address)`);
    await abrirSelector();
    await listo(`!!document.getElementById('redG1Item')`, 5);
    await ev(`document.getElementById('redG1Item').click()`);
    ok(await listo(`!!document.getElementById('g1FraseModal')`, 10), 'pide la frase');
    await ev(`{ const m = document.getElementById('g1FraseModal'); m.querySelector('textarea').value = ${JSON.stringify(P2)}; m.querySelector('form').requestSubmit() }`);
    await sleep(500);
    ok(/otra billetera/.test(await texto('#g1FraseModal [data-g1="error"]')), 'rechaza la frase de otra billetera', await texto('#g1FraseModal [data-g1="error"]'));
    await ev(`{ const m = document.getElementById('g1FraseModal'); m.querySelector('textarea').value = 'hola que tal'; m.querySelector('form').requestSubmit() }`);
    await sleep(300);
    ok(/no es una frase válida/.test(await texto('#g1FraseModal [data-g1="error"]')), 'rechaza lo que no es una frase');
    await ev(`{ const m = document.getElementById('g1FraseModal'); m.querySelector('textarea').value = ${JSON.stringify(P1)}; m.querySelector('form').requestSubmit() }`);
    ok(await listo(`!document.getElementById('g1FraseModal') && document.getElementById('balanceDisplay').textContent.trim() === '4.120,13 Ğ1'`, 20), 'con la correcta, activa y muestra el saldo', await texto('#balanceDisplay'));
    const guardado = await ev(`JSON.stringify(Object.fromEntries(Object.entries(localStorage)))`);
    ok(!guardado.includes(P1.split(' ').slice(0, 3).join(' ')), 'y la frase no quedó guardada en ningún lado');

    // ── D) escanear QR de Ğ1 ─────────────────────────────────────────────────────
    console.log('\n── D) escanear QR de Ğ1 ──');
    await ev(`window.__alertas = []; window.alert = (m) => window.__alertas.push(String(m))`);
    const modalG1 = () => ev(`(() => { const m = document.getElementById('g1EscaneoModal'); if (!m) return null;
        const q = k => m.querySelector('[data-g1="' + k + '"]');
        const vis = k => !q(k).classList.contains('hidden');
        return { identidad: q('identidad').textContent, det: q('det').textContent, cuenta: q('cuenta').textContent,
                 monto: vis('monto') ? q('monto').textContent : null, comentario: vis('comentario') ? q('comentario').textContent : null,
                 vinculo: q('vinculo').textContent, chat: vis('chat') ? q('chat').textContent : null, invitar: vis('invitar') }; })()`);
    await ev(`handleScannedData(${JSON.stringify(MIEMBRO)})`);
    ok(await listo(`/TestMiembro/.test(document.getElementById('g1EscaneoModal')?.innerText || '')`, 15), 'la dirección sola abre la cuenta Ğ1');
    let m = await modalG1();
    ok(m.identidad === '✦ TestMiembro · miembro Ğ1' && /7 certificaciones vigentes/.test(m.det), 'con su identidad de miembro', JSON.stringify(m));
    ok(m.cuenta === MIEMBRO && m.monto === null && !m.chat, 'sin monto y sin chat (no vinculó una 0x)');
    ok(/Todavía no vinculó un chat/.test(m.vinculo) && m.invitar, 'dice que no vinculó y ofrece invitarlo', m.vinculo);
    ok((await ev(`window.__alertas`)).length === 0, 'ya no dice "QR no reconocido"');
    await ev(`document.querySelector('#g1EscaneoModal [data-g1="cerrar"]').click()`);

    await ev(`handleScannedData(${JSON.stringify('june://' + RAIZ1 + '?amount=12.50&comment=Caf%C3%A9%20%3Cb%3Ey%3C%2Fb%3E')})`);
    ok(await listo(`!!document.getElementById('g1EscaneoModal') && !/Consultando/.test(document.getElementById('g1EscaneoModal').innerText)`, 15), 'june:// con monto');
    m = await modalG1();
    ok(m.monto === 'Te pide 12,50 Ğ1', 'muestra el monto pedido', m.monto);
    ok(m.comentario === '“Café <b>y</b>”' && !(await ev(`!!document.querySelector('#g1EscaneoModal b')`)), 'y el comentario como texto', m.comentario);
    ok(/sin identidad/.test(m.identidad), 'cuenta sin identidad', m.identidad);
    await ev(`document.querySelector('#g1EscaneoModal [data-g1="cerrar"]').click()`);

    await ev(`handleScannedData(${JSON.stringify(PENDIENTE)})`);
    ok(await listo(`/Novata/.test(document.getElementById('g1EscaneoModal')?.innerText || '')`, 15), 'identidad que no es miembro');
    m = await modalG1();
    ok(m.identidad === 'Novata · identidad esperando certificaciones', 'muestra su estado', m.identidad);
    ok(m.det === '3 certificaciones vigentes (hacen falta 5 para ser miembro)', 'y cuántas certificaciones le faltan', m.det);
    await ev(`document.querySelector('#g1EscaneoModal [data-g1="cerrar"]').click()`);

    await ev(`window.__g1comentarios = [${JSON.stringify(COMENTARIO_VINCULO)}]`);
    await ev(`handleScannedData(${JSON.stringify('june://' + MIEMBRO)})`);
    ok(await listo(`!document.querySelector('#g1EscaneoModal [data-g1="chat"]')?.classList.contains('hidden')`, 15), 'cuenta vinculada: ofrece agregarla');
    m = await modalG1();
    ok(m.chat === 'Agregar a la agenda y chatear' && m.vinculo === 'Chat vinculado: ' + EVM_VINCULADA.address.slice(0, 6) + '...' + EVM_VINCULADA.address.slice(-4) && !m.invitar, 'con la 0x vinculada a la vista', JSON.stringify(m));
    ok(!(await ev(`contacts.some(c => c.address.toLowerCase() === ${JSON.stringify(EVM_VINCULADA.address.toLowerCase())})`)), 'todavía NO está en la agenda (primero se ve el DID)');
    await ev(`document.querySelector('#g1EscaneoModal [data-g1="chat"]').click()`);
    ok(await listo(`contacts.some(c => c.address.toLowerCase() === ${JSON.stringify(EVM_VINCULADA.address.toLowerCase())} && c.g1 === ${JSON.stringify(MIEMBRO)})`, 20), 'al aceptar: contacto con su 0x y su g1');
    const nuevo = await ev(`contacts.find(c => c.address.toLowerCase() === ${JSON.stringify(EVM_VINCULADA.address.toLowerCase())})`);
    ok(nuevo.name === 'TestMiembro', 'nombrado con su seudónimo Ğ1', nuevo.name);
    ok(await listo(`(currentChatContact?.address || '').toLowerCase() === ${JSON.stringify(EVM_VINCULADA.address.toLowerCase())}`, 20), 'y queda abierto su chat');
    await ev(`handleScannedData(${JSON.stringify(MIEMBRO)})`);
    ok(await listo(`document.querySelector('#g1EscaneoModal [data-g1="chat"]')?.textContent === 'Abrir chat'`, 15), 'escanearlo de nuevo: "Abrir chat" (ya está en la agenda)');
    await ev(`document.querySelector('#g1EscaneoModal [data-g1="cerrar"]').click()`);

    await ev(`handleScannedData('esto no es nada')`);
    await sleep(1500);
    ok((await ev(`window.__alertas`)).some(a => /no reconocido/.test(a)), 'un QR cualquiera sigue diciendo "no reconocido"');
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
