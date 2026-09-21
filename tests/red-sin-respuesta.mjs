// Cambiar a una red cuyo nodo (RPC) no contesta dejaba el saldo en "Cargando..." para
// siempre: ethers espera 5 minutos antes de rendirse, y el catch se iba sin tocar la
// pantalla. Pasó de verdad al cambiar a Ethereum mainnet (20/9/2026).
//
// Acá se usa el updateBalance() real con un provider que nunca contesta, y se verifica que
// la pantalla lo diga y que, si la red tiene otros RPC, rote sola hasta uno que ande.
//
// Correr:  ./tests/run-red-sin-respuesta.sh

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8845/dapp.html';
const PORT = 9399;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-rpc-');
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
        try { listo = (await ev(`typeof updateBalance === 'function' && typeof avisarRedSinRespuesta === 'function'`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar');

    // Escenario: wallet cargada, red elegida, y un nodo que se hace el muerto.
    const preparar = (red, getBalance) => `(() => {
        isOffline = false;
        currentWallet = { address: '0x1111111111111111111111111111111111111111' };
        optionsList = [${red}];
        currentTokenIndex = 0;
        provider = { getBalance: ${getBalance} };
        setBalanceText('main', 'Cargando...');
        document.querySelectorAll('.cw-notif').forEach(n => n.remove());
        return document.getElementById('balanceDisplay').textContent;
    })()`;
    const NUNCA = `() => new Promise(() => { })`;   // no resuelve nunca: el RPC colgado

    console.log('\n── un nodo que no contesta ──');
    const antes = await ev(preparar(`{ TOKEN_CHAIN_NAME: 'Ethereum', NATIVE_SYMBOL: 'ETH', API: 'https://muerto.example' }`, NUNCA));
    ok(/Cargando/.test(antes), 'arranca en "Cargando..."', JSON.stringify(antes));
    const t0 = Date.now();
    await ev(`updateBalance()`);
    const tardo = Date.now() - t0;
    const texto = await ev(`document.getElementById('balanceDisplay').textContent`);
    ok(tardo < 20000, `se rinde en ${Math.round(tardo / 1000)} s (ethers solo esperaría 5 minutos)`);
    ok(!/Cargando/.test(texto), 'y el saldo deja de decir "Cargando..."', JSON.stringify(texto));
    ok(/Sin respuesta|No answer/i.test(texto), 'dice que la red no respondió', JSON.stringify(texto));
    const aviso = await ev(`[...document.querySelectorAll('.cw-notif')].map(n => (n.innerText || '').replace(/\\s+/g, ' ').trim())`);
    ok(aviso.some(x => /no responde/i.test(x)), 'y hay un aviso que lo explica', JSON.stringify(aviso));
    ok(aviso.some(x => /Administrar redes/i.test(x)), 'con la salida: cambiar el RPC', JSON.stringify(aviso));
    const tocable = await ev(`[...document.querySelectorAll('.cw-notif')].some(n => n.classList.contains('cwn-click'))`);
    ok(tocable === true, 'el aviso se puede tocar para ir a arreglarlo');

    console.log('\n── con alternativas, rota sola ──');
    // El primer RPC cuelga; el segundo responde. La red trae ambos (los guarda el diccionario).
    const rotado = await ev(`(async () => {
        isOffline = false;
        currentWallet = { address: '0x1111111111111111111111111111111111111111' };
        optionsList = [{ TOKEN_CHAIN_NAME: 'Ethereum', NATIVE_SYMBOL: 'ETH',
                         API: 'https://muerto.example', rpc: ['https://muerto.example', 'https://vivo.example'] }];
        currentTokenIndex = 0;
        window.ethers.JsonRpcProvider = function (url) {
            this.url = url;
            this.getBalance = () => url.includes('vivo')
                ? Promise.resolve(1230000000000000000n)
                : new Promise(() => { });
        };
        provider = new window.ethers.JsonRpcProvider('https://muerto.example');
        setBalanceText('main', 'Cargando...');
        document.querySelectorAll('.cw-notif').forEach(n => n.remove());
        await updateBalance();
        return { texto: document.getElementById('balanceDisplay').textContent,
                 apiGuardada: optionsList[0].API,
                 avisos: document.querySelectorAll('.cw-notif').length };
    })()`);
    ok(/1\.23/.test(rotado.texto), 'muestra el saldo del RPC que sí anda', JSON.stringify(rotado));
    ok(rotado.apiGuardada === 'https://vivo.example', 'y se queda con ese RPC para la próxima', JSON.stringify(rotado.apiGuardada));
    ok(rotado.avisos === 0, 'sin molestar con avisos: se resolvió solo', JSON.stringify(rotado.avisos));

    console.log('\n── una red vieja, sin repuestos, se cura sola ──');
    // La que ya está guardada (agregada antes de este arreglo) tiene un solo RPC. Si ese se
    // muere, se le buscan los otros nodos de su cadena en el diccionario y se reintenta.
    const curada = await ev(`(async () => {
        allChainsData = [{ chainId: 1, name: 'Ethereum Mainnet',
            rpc: ['https://muerto.example', 'https://vivo.example'], nativeCurrency: { symbol: 'ETH' } }];
        isOffline = false;
        currentWallet = { address: '0x1111111111111111111111111111111111111111' };
        optionsList = [{ TOKEN_CHAIN_NAME: 'Ethereum', TOKEN_CHAINID: '1', NATIVE_SYMBOL: 'ETH',
                         API: 'https://muerto.example' }];   // sin rpc: como quedó guardada
        currentTokenIndex = 0;
        window.ethers.JsonRpcProvider = function (url) {
            this.url = url;
            this.getBalance = () => url.includes('vivo')
                ? Promise.resolve(4560000000000000000n)
                : new Promise(() => { });
        };
        provider = new window.ethers.JsonRpcProvider('https://muerto.example');
        setBalanceText('main', 'Cargando...');
        document.querySelectorAll('.cw-notif').forEach(n => n.remove());
        await updateBalance();
        return { texto: document.getElementById('balanceDisplay').textContent,
                 rpc: optionsList[0].rpc, api: optionsList[0].API };
    })()`);
    ok(/4\.56/.test(curada.texto), 'termina mostrando el saldo, sin que el usuario toque nada', JSON.stringify(curada));
    ok(Array.isArray(curada.rpc) && curada.rpc.length === 2, 'le quedan los repuestos guardados', JSON.stringify(curada.rpc));
    ok(curada.api === 'https://vivo.example', 'y se queda en el nodo que anda', JSON.stringify(curada.api));

    console.log('\n── la red nueva se guarda con los RPC de repuesto ──');
    // Sin esto no hay a dónde rotar: es la razón por la que Ethereum mainnet se quedaba colgada.
    const alta = await ev(`(async () => {
        allChainsData = [{ chainId: 1, name: 'Ethereum Mainnet',
            rpc: ['https://uno.example', 'https://\${CLAVE}.example', 'wss://dos.example', 'https://tres.example'],
            nativeCurrency: { symbol: 'ETH' }, explorers: [{ url: 'https://etherscan.io' }] }];
        const chainInput = document.getElementById('networkChainId');
        chainInput.value = '1';
        await handleAutocomplete({ target: chainInput });
        const ds = { ...document.getElementById('networkRpcUrl').dataset };
        document.getElementById('editNetworkIndex').value = '';
        const antes = optionsList.length;
        handleAddNewNetwork({ preventDefault() { } });
        const nueva = optionsList[optionsList.length - 1];
        return { ds, creada: optionsList.length > antes, rpc: nueva && nueva.rpc, api: nueva && nueva.API,
                 nombre: nueva && nueva.TOKEN_CHAIN_NAME };
    })()`);
    ok(alta.ds.paraChain === '1', 'el autocompletado anota para qué cadena son', JSON.stringify(alta.ds));
    ok(JSON.parse(alta.ds.alternativas || '[]').length === 2,
        'se queda con los http usables (fuera los de clave y los wss)', alta.ds.alternativas);
    ok(alta.creada === true, 'la red se agrega', JSON.stringify(alta.nombre));
    ok(Array.isArray(alta.rpc) && alta.rpc.length === 2 && alta.rpc[0] === alta.api,
        'y queda guardada con su lista de RPC, empezando por el elegido', JSON.stringify(alta.rpc));
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
