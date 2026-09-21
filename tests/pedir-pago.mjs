// "Solicitar pago": elegir QUÉ token se pide, y que del otro lado se lea y se pague ESE.
//
// El defecto que había debajo del pedido de "poder elegir el token": el pedido viajaba sólo
// con el chainId. Del otro lado, la tarjeta buscaba "la primera red de mi lista con ese
// chainId" — que para Arbitrum es ETH—, así que pedir 10 USDC llegaba como "Te solicitaron
// 10 ETH", y el botón Pagar abría el envío en la red que estuviera activa.
//
// Sin XMTP: se usa el modal y la tarjeta reales con una conversación de mentira.
// Correr:  ./tests/run-pedir-pago.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8847/dapp.html';
const PORT = 9401;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-pedir-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
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
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE });
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof redParaCompartir === 'function' && typeof createTransactionCard === 'function'`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar');

    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    // Mi lista: ETH nativo de Arbitrum PRIMERO (así es en la vida real) y USDC después.
    await ev(`(() => {
        optionsList = [
          { TOKEN_CHAIN_NAME: 'Arbitrum One', TOKEN_CHAINID: '42161', NATIVE_SYMBOL: 'ETH',
            API: 'https://arb1.arbitrum.io/rpc', EXPLORER: 'https://arbiscan.io/' },
          { TOKEN_CHAIN_NAME: 'USDC (ARBITRUM ONE)', TOKEN_CHAINID: '42161', NATIVE_SYMBOL: 'ETH',
            TOKEN_ADDRESS: '${USDC}', TOKEN_SYMBOL: 'USDC',
            API: 'https://arbitrum-mainnet.infura.io/v3/b17405e634bd40308be3eb4fa2485c9a',
            rpc: ['https://arbitrum-mainnet.infura.io/v3/b17405e634bd40308be3eb4fa2485c9a', 'https://arb1.arbitrum.io/rpc'],
            EXPLORER: 'https://arbiscan.io/' },
        ];
        currentTokenIndex = 0;
        window.__enviado = null;
        currentConversation = { peerAddress: '0x2222222222222222222222222222222222222222',
                                sendText: async (txt) => { window.__enviado = txt; } };
        pingWake = () => { };
        return true;
    })()`);

    console.log('\n── pedir: se elige el token ──');
    const modal = await ev(`(() => {
        document.getElementById('headerRequestBtn').click();
        const sel = document.getElementById('payReqToken');
        return { hay: !!sel, opciones: sel ? [...sel.options].map(o => o.textContent) : [],
                 elegida: sel ? sel.value : null, simbolo: document.getElementById('payReqSymbol')?.textContent };
    })()`);
    ok(modal.hay, 'el modal trae un selector de token', JSON.stringify(modal));
    ok(modal.opciones.length === 2, 'con todas las redes/tokens de tu lista', JSON.stringify(modal.opciones));
    ok(modal.elegida === '0' && modal.simbolo === 'ETH', 'arranca en el que tenés activo', JSON.stringify(modal));

    const cambio = await ev(`(() => {
        const sel = document.getElementById('payReqToken');
        sel.value = '1'; sel.dispatchEvent(new Event('change'));
        return document.getElementById('payReqSymbol').textContent;
    })()`);
    ok(cambio === 'USDC', 'al elegir USDC, el símbolo junto al monto cambia', JSON.stringify(cambio));

    await ev(`(async () => {
        document.getElementById('payReqAmount').value = '10';
        document.getElementById('payReqSend').click();
        for (let i = 0; i < 20 && !window.__enviado; i++) await new Promise(r => setTimeout(r, 100));
        return true;
    })()`);
    const enviado = await ev(`window.__enviado`);
    const pedido = JSON.parse(String(enviado || '').replace('[TRANSACTION]', '') || '{}');
    ok(pedido.type === 'request' && pedido.amount === 10, 'sale el pedido de 10', JSON.stringify(pedido).slice(0, 120));
    ok(pedido.network && pedido.network.TOKEN_ADDRESS === USDC && pedido.network.TOKEN_SYMBOL === 'USDC',
        'y dice QUÉ token es: el contrato de USDC viaja en el mensaje', JSON.stringify(pedido.network));
    ok(pedido.chainId === '42161', 'el chainId suelto sigue, para las versiones viejas', JSON.stringify(pedido.chainId));
    ok(pedido.network && pedido.network.API === 'https://arb1.arbitrum.io/rpc',
        'el RPC con clave de Infura NO se reparte: va el de repuesto sin clave', JSON.stringify(pedido.network && pedido.network.API));
    ok(!/b17405e634bd40308be3eb4fa2485c9a/.test(enviado), 'la clave no aparece en ningún lado del mensaje');

    console.log('\n── del otro lado: la tarjeta ──');
    const tarjeta = await ev(`(() => createTransactionCard(${JSON.stringify(pedido)}, 'received'))()`);
    ok(/10\s*<span[^>]*>USDC/.test(tarjeta) || />10 <span class="text-lg text-gray-400">USDC</.test(tarjeta),
        'dice "10 USDC", no "10 ETH"', (tarjeta.match(/text-2xl[^<]*<\/?[^>]*>[^<]*/) || [''])[0]);
    ok(/handlePayRequest\('10', 1\)/.test(tarjeta), 'y Pagar apunta al USDC de mi lista (índice 1), no a la red activa',
        (tarjeta.match(/handlePayRequest\([^)]*\)/) || ['—'])[0]);

    const vieja = await ev(`(() => createTransactionCard({ type: 'request', amount: 10, chainId: '42161' }, 'received'))()`);
    ok(/handlePayRequest\('10', 0\)/.test(vieja) && /ETH/.test(vieja),
        'un pedido viejo (sólo chainId) se lee como la moneda NATIVA de esa cadena', (vieja.match(/handlePayRequest\([^)]*\)/) || ['—'])[0]);

    const ajena = await ev(`(() => createTransactionCard({ type: 'request', amount: 5, chainId: '8453',
        network: { TOKEN_CHAIN_NAME: 'DEGEN (BASE)', TOKEN_CHAINID: '8453', TOKEN_ADDRESS: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
                   TOKEN_SYMBOL: 'DEGEN', NATIVE_SYMBOL: 'ETH', API: 'https://mainnet.base.org' } }, 'received'))()`);
    ok(!/handlePayRequest/.test(ajena), 'si no tengo ese token, no hay botón de pagar en otra cosa');
    ok(/agregá DEGEN \(BASE\)/.test(ajena), 'y se dice que primero hay que agregarlo', (ajena.match(/Para pagar[^<]*/) || ['—'])[0]);
    ok(/addSharedNetwork/.test(ajena), 'con el botón para agregarlo ahí mismo');

    console.log('\n── lo que manda el otro no se ejecuta ──');
    // La tarjeta se arma con innerHTML y todo lo de txData lo escribió el otro. Se dibuja cada
    // caso en un <template> (que no ejecuta nada) y se mira qué elementos y atributos quedaron.
    const inerte = async (txData) => ev(`(() => {
        const tpl = document.createElement('template');
        tpl.innerHTML = createTransactionCard(${JSON.stringify(txData)}, 'received');
        const todos = [...tpl.content.querySelectorAll('*')];
        return {
            imgs: tpl.content.querySelectorAll('img, script, iframe').length,
            manejadores: todos.flatMap(el => [...el.attributes].filter(a => /^on/i.test(a.name))
                .map(a => el.tagName + '.' + a.name + '=' + a.value)),
            links: [...tpl.content.querySelectorAll('a')].map(a => a.getAttribute('href')),
        };
    })()`);
    const r1 = await inerte({ type: 'request', amount: '<img src=x onerror=alert(1)>', chainId: '42161' });
    ok(r1.imgs === 0, 'un monto con HTML adentro queda como texto', JSON.stringify(r1));
    ok(!r1.manejadores.some(m => /alert/.test(m)), 'y no deja ningún onerror/onclick propio', JSON.stringify(r1.manejadores));

    const r2 = await inerte({ type: 'request', amount: "1'); alert(1);//", chainId: '42161' });
    ok(!r2.manejadores.some(m => /alert/.test(m)), 'un monto que intenta cerrar el onclick no llega al onclick', JSON.stringify(r2.manejadores));

    const r3 = await inerte({ type: 'request', amount: 1, chainId: '8453',
        network: { TOKEN_CHAIN_NAME: "Base' onmouseover='alert(1)", TOKEN_CHAINID: '8453', NATIVE_SYMBOL: '<b>ETH</b>',
                   API: 'https://mainnet.base.org' } });
    // Se mira el NOMBRE del atributo: que "onmouseover" aparezca como texto dentro del onclick
    // es justamente lo correcto (quedó como dato del nombre de la red, entre comillas).
    ok(!r3.manejadores.some(m => /^[A-Z0-9]+\.onmouseover=/i.test(m)), 'un nombre de red con comilla no escapa del onclick=\'…\'', JSON.stringify(r3.manejadores));
    ok(r3.manejadores.filter(m => /addSharedNetwork/.test(m)).length === 1, 'el botón de agregar la red sigue funcionando', JSON.stringify(r3.manejadores));

    const r4 = await inerte({ type: 'send', amount: 1, txHash: '0x' + 'ab'.repeat(32),
        network: { TOKEN_CHAIN_NAME: 'X', TOKEN_CHAINID: '1', NATIVE_SYMBOL: 'ETH', EXPLORER: 'javascript:alert(1)//' } });
    ok(r4.links.every(h => /^https?:/i.test(h || '')), 'un explorador javascript: no se vuelve link', JSON.stringify(r4.links));
    const r5 = await inerte({ type: 'send', amount: 1, txHash: '0x' + 'ab'.repeat(32),
        network: { TOKEN_CHAIN_NAME: 'X', TOKEN_CHAINID: '1', NATIVE_SYMBOL: 'ETH', EXPLORER: 'https://etherscan.io/' } });
    ok(r5.links.length === 1 && /^https:\/\/etherscan\.io\/tx\/0x/.test(r5.links[0]), 'uno de verdad sí', JSON.stringify(r5.links));

    console.log('\n── pagar abre el envío en el token pedido ──');
    const pago = await ev(`(async () => {
        currentTokenIndex = 0;
        window.__cambios = [];
        switchNetwork = async (i) => { window.__cambios.push(i); currentTokenIndex = i; };
        updateBalance = async () => { };
        await handlePayRequest('10', 1);
        return { cambios: window.__cambios, activa: currentTokenIndex,
                 monto: document.getElementById('amount').value,
                 abierto: !document.getElementById('sendModal').classList.contains('hidden') };
    })()`);
    ok(pago.cambios.join() === '1' && pago.activa === 1, 'cambia al USDC antes de abrir el envío', JSON.stringify(pago));
    ok(pago.monto === '10' && pago.abierto, 'y abre el envío con los 10 cargados', JSON.stringify(pago));
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
