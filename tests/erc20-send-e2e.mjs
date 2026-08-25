// E2E del envío de ERC-20 por el camino real de la app (Chrome headless por CDP + RPC falso).
//
// El test unitario (tests/erc20-send.mjs) prueba el helper. Este prueba el CABLEADO: que
// executeTransaction, con "USDC on Base" elegido, firme y transmita una llamada a transfer()
// del contrato de USDC — y no una transferencia de ETH nativo, que es lo que hacía antes.
//
// No toca la red: intercepta window.fetch y responde el JSON-RPC a mano, así que la
// transacción firmada queda capturada y se decodifica acá con ethers.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. yarn parcel build src/dapp.html --dist-dir /tmp/cwerc20 --public-url ./ --cache-dir .parcel-cache-erc20
//   3. cd /tmp/cwerc20 && python3 -m http.server 8819 &
//   4. unset NODE_OPTIONS && node tests/erc20-send-e2e.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import * as ethers from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8819/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, extra = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
}

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const CLAVE = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const YO = new ethers.Wallet(CLAVE).address;
const VOS = '0x2222222222222222222222222222222222222222';

// ── RPC falso: se instala ANTES de que la app arranque ────────────────────────
// Devuelve saldos gordos y captura todo eth_sendRawTransaction en window.__enviadas.
const RPC_FALSO = `
const YO = ${JSON.stringify(YO)};
window.__enviadas = [];
const HEX = n => '0x' + BigInt(n).toString(16);
const PALABRA = n => BigInt(n).toString(16).padStart(64, '0');
function responder(m) {
    const p = m.params || [];
    switch (m.method) {
        case 'eth_chainId': return '0x2105';
        case 'net_version': return '8453';
        case 'eth_blockNumber': return '0x100';
        case 'eth_getBlockByNumber': return {
            number: '0x100', hash: '0x' + '11'.repeat(32), parentHash: '0x' + '22'.repeat(32),
            timestamp: '0x66c00000', baseFeePerGas: '0x5f5e100', gasLimit: '0x1c9c380',
            gasUsed: '0x5208', miner: '0x' + '00'.repeat(20), difficulty: '0x0',
            extraData: '0x', transactions: []
        };
        case 'eth_gasPrice': return '0x3b9aca00';
        case 'eth_maxPriorityFeePerGas': return '0x5f5e100';
        case 'eth_getBalance': return HEX(10n ** 17n);          // 0.1 ETH para el gas
        case 'eth_getTransactionCount': return '0x0';
        case 'eth_estimateGas': return '0xea60';
        case 'eth_call': {
            const data = (p[0] && p[0].data) || '0x';
            if (data.startsWith('0x313ce567')) return '0x' + PALABRA(6);        // decimals() = 6
            if (data.startsWith('0x70a08231')) return '0x' + PALABRA(1000000000n); // balanceOf = 1000 USDC
            if (data.startsWith('0x95d89b41'))                                   // symbol() = "USDC"
                return '0x' + PALABRA(32) + PALABRA(4) + '55534443'.padEnd(64, '0');
            return '0x' + PALABRA(0);
        }
        case 'eth_sendRawTransaction':
            window.__enviadas.push(p[0]);
            // El hash tiene que ser el de VERDAD o ethers rechaza la respuesta y wait() nunca
            // resuelve: sin esto el test no llega a probar el camino de éxito.
            return window.ethers.keccak256(p[0]);
        case 'eth_getTransactionReceipt': return {
            transactionHash: p[0], transactionIndex: '0x0', blockNumber: '0x101',
            blockHash: '0x' + '11'.repeat(32), from: YO, to: null, cumulativeGasUsed: '0xea60',
            gasUsed: '0xea60', effectiveGasPrice: '0x3b9aca00', contractAddress: null,
            logs: [], logsBloom: '0x' + '00'.repeat(256), status: '0x1', type: '0x2'
        };
        case 'eth_getTransactionByHash': return null;
        default: return null;
    }
}
const fetchReal = window.fetch.bind(window);
window.__vistos = [];
window.fetch = async (url, opts) => {
    // OJO: ethers manda el cuerpo como Uint8Array, no como string. Si sólo se mira el caso
    // string, el pedido se escapa al RPC de verdad y el test miente sin fallar.
    const cuerpo = opts && opts.body;
    let texto = null;
    if (typeof cuerpo === 'string') texto = cuerpo;
    else if (cuerpo && typeof cuerpo.byteLength === 'number') texto = new TextDecoder().decode(cuerpo);
    if (!texto || texto.indexOf('jsonrpc') < 0) return fetchReal(url, opts);
    const pedido = JSON.parse(texto);
    (Array.isArray(pedido) ? pedido : [pedido]).forEach(m => window.__vistos.push(m.method));
    const uno = m => ({ jsonrpc: '2.0', id: m.id, result: responder(m) });
    const salida = Array.isArray(pedido) ? pedido.map(uno) : uno(pedido);
    return new Response(JSON.stringify(salida), { status: 200, headers: { 'content-type': 'application/json' } });
};
localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(CLAVE)});
`;

// ── CDP mínimo ────────────────────────────────────────────────────────────────
class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-erc20-');
        this.proc = spawn(CHROME, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`,
            '--ignore-certificate-errors', '--window-size=900,1400', 'about:blank',
        ], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                const page = list.find(t => t.type === 'page');
                if (page) return this.connect(page.webSocketDebuggerUrl);
            } catch { }
        }
        throw new Error('Chrome no levantó');
    }
    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => {
                await this.rpc('Page.enable'); await this.rpc('Runtime.enable');
                await this.rpc('Page.addScriptToEvaluateOnNewDocument', { source: RPC_FALSO });
                resolve();
            };
            this.ws.onerror = reject;
            this.ws.onmessage = e => {
                const m = JSON.parse(e.data);
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
                if (m.method === 'Runtime.consoleAPICalled' && process.env.VERBOSE) {
                    console.log('  [page]', m.params.args.map(a => a.value ?? a.description).join(' '));
                }
            };
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error(JSON.stringify(ex).slice(0, 400));
        return r.result?.result?.value;
    }
    async goto(url) {
        await this.rpc('Page.navigate', { url });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            if (await this.eval('typeof window.executeTransaction === "function"')) return;
        }
        throw new Error('la app no terminó de cargar');
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const iface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);

const dev = new Dev(9413);
try {
    await dev.launch();
    await dev.goto(BASE);
    console.log('app cargada, wallet', YO, '\n');

    const elegirRed = async (nombre) => {
        const idx = await dev.eval(`optionsList.findIndex(n => n.TOKEN_CHAIN_NAME === ${JSON.stringify(nombre)})`);
        if (idx < 0) throw new Error('no existe la red ' + nombre);
        await dev.eval(`switchNetwork(${idx})`);
        await sleep(600);
        return dev.eval(`optionsList[currentTokenIndex].TOKEN_CHAIN_NAME`);
    };
    const enviar = async (dest, monto) => {
        // En el camino de éxito la app limpia el cartel de estado y avisa con cwNotify, así que
        // el testigo de "salió bien" es la notificación, no el texto del cartel.
        await dev.eval(`(() => {
            window.__enviadas = []; window.__notis = [];
            if (!window.__notiEnganchada) {
                const orig = window.cwNotify;
                window.cwNotify = o => { window.__notis.push(o && o.title); return orig(o); };
                window.__notiEnganchada = true;
            }
        })()`);
        await dev.eval(`executeTransaction(${JSON.stringify(dest)}, ${JSON.stringify(monto)})`);
        await sleep(1200);
        const crudas = await dev.eval(`window.__enviadas`);
        const estado = await dev.eval(`(document.getElementById('txStatus')||{}).textContent || ''`);
        const notis = await dev.eval(`window.__notis`);
        return { crudas, estado, notis };
    };

    // ── 1. USDC on Base: tiene que salir un transfer(), no ETH ────────────────
    console.log('▶ USDC on Base');
    check('la red queda seleccionada', await elegirRed('USDC on Base') === 'USDC on Base');
    const { crudas, estado, notis } = await enviar(VOS, '5');
    if (!check('se transmitió una transacción', crudas.length === 1, estado.slice(0, 120))) {
        throw new Error('sin transacción: ' + estado);
    }
    const tx = ethers.Transaction.from(crudas[0]);
    check('va al CONTRATO de USDC, no al destinatario', tx.to === USDC_BASE, tx.to);
    check('value es CERO (no manda ETH)', tx.value === 0n, String(tx.value));
    check('el calldata es transfer(address,uint256)', tx.data.slice(0, 10) === '0xa9059cbb', tx.data.slice(0, 10));
    const args = iface.parseTransaction({ data: tx.data }).args;
    check('el destinatario real va en el calldata', args[0] === VOS, args[0]);
    check('5 USDC = 5000000 unidades (6 decimales)', args[1] === 5000000n, String(args[1]));
    check('NO usó parseEther (5e18)', args[1] !== ethers.parseEther('5'));
    check('la firma recupera la wallet', tx.from === YO, tx.from);
    check('chainId 8453', tx.chainId === 8453n, String(tx.chainId));
    check('la app la da por confirmada', notis.some(n => /Transacci/.test(n || '')), JSON.stringify(notis));

    // ── 2. Base nativa: el camino viejo sigue intacto ─────────────────────────
    console.log('\n▶ Base (nativa) — control de regresión');
    check('la red queda seleccionada', await elegirRed('Base') === 'Base');
    const nat = await enviar(VOS, '0.001');
    if (check('se transmitió una transacción', nat.crudas.length === 1, nat.estado.slice(0, 120))) {
        const t2 = ethers.Transaction.from(nat.crudas[0]);
        check('va derecho al destinatario', t2.to === VOS, t2.to);
        check('el value lleva el monto', t2.value === ethers.parseEther('0.001'), String(t2.value));
        check('sin calldata', t2.data === '0x', t2.data);
    }

    // ── 3. Stealth + token: tiene que FRENAR, no mandar nativo ────────────────
    console.log('\n▶ Meta-address stealth con una red de token');
    check('la red queda seleccionada', await elegirRed('USDC on Base') === 'USDC on Base');
    const meta = '0x' + 'ab'.repeat(66);   // 134 caracteres: lo que isStealthAddress considera stealth
    const st = await enviar(meta, '5');
    check('no transmite nada', st.crudas.length === 0, String(st.crudas.length));
    check('explica que la meta-address solo recibe la moneda nativa', /nativa|ETH/.test(st.estado), st.estado.slice(0, 120));

    // ── 4. Circuito frío: lo que se firma es el calldata, y la ficha lo dice ──
    console.log('\n▶ Transacción fría (CWT1 → CWS1) con un token');
    await elegirRed('USDC on Base');
    await dev.eval(`(() => {
        window.__firmadas = [];
        if (!window.__firmaEnganchada) {
            const orig = window.showSignedTxModal;
            window.showSignedTxModal = d => { window.__firmadas.push(d); return orig(d); };
            window.__firmaEnganchada = true;
        }
    })()`);
    const qrFrio = await dev.eval(`prepareColdTx(${JSON.stringify(YO)}, ${JSON.stringify(VOS)}, '5').then(r => r.qrData)`);
    check('el QR frío se arma', typeof qrFrio === 'string' && qrFrio.startsWith('CWT1|'));

    await dev.eval(`handleIncomingColdTx(${JSON.stringify(qrFrio)})`);
    await sleep(300);
    const ficha = await dev.eval(`(document.getElementById('coldTxSignDetails')||{}).textContent || ''`);
    check('la ficha muestra al destinatario real', ficha.includes(VOS));
    check('la ficha muestra el monto del token', /5\.0 USDC/.test(ficha), ficha.slice(0, 160));
    check('la ficha muestra las unidades crudas', /5000000 unidades/.test(ficha));
    check('la ficha identifica el contrato del token', ficha.includes(USDC_BASE));

    await dev.eval(`confirmColdTxSign()`);
    await sleep(300);
    const firmadas = await dev.eval(`window.__firmadas`);
    if (check('se firmó y se mostró la tx', firmadas.length === 1, JSON.stringify(firmadas).slice(0, 80))) {
        const tf = ethers.Transaction.from(firmadas[0].replace('CWS1|', ''));
        check('la firma fría va al contrato', tf.to === USDC_BASE, tf.to);
        check('la firma fría lleva el calldata', tf.data.slice(0, 10) === '0xa9059cbb', tf.data.slice(0, 10));
        const a = iface.parseTransaction({ data: tf.data }).args;
        check('destinatario y monto sobreviven a la firma', a[0] === VOS && a[1] === 5000000n, `${a[0]} / ${a[1]}`);
        check('value cero también en frío', tf.value === 0n, String(tf.value));
        check('firmada por la wallet fría', tf.from === YO, tf.from);
    }

    // Un QR que MIENTE sobre los decimales: el número lindo cambia, pero las unidades crudas
    // no, y son las que el usuario puede contrastar. Esa es toda la defensa disponible offline.
    const qrMentiroso = await dev.eval(`(() => {
        const p = JSON.parse(new TextDecoder().decode(b64urlDecode(${JSON.stringify(qrFrio)}.slice(5))));
        p.tok.dec = 18;
        return 'CWT1|' + b64urlEncode(new TextEncoder().encode(JSON.stringify(p)));
    })()`);
    await dev.eval(`handleIncomingColdTx(${JSON.stringify(qrMentiroso)})`);
    await sleep(300);
    const fichaMentira = await dev.eval(`(document.getElementById('coldTxSignDetails')||{}).textContent || ''`);
    check('las unidades crudas delatan la mentira', /5000000 unidades/.test(fichaMentira), fichaMentira.slice(0, 160));
    check('y el QR se atribuye los decimales', /18 decimales declarados por el QR/.test(fichaMentira));
    await dev.eval(`hideColdTxSignModal()`);

    // Calldata que la wallet fría no sabe leer: no se firma a ciegas.
    const qrOpaco = await dev.eval(`(() => {
        const p = JSON.parse(new TextDecoder().decode(b64urlDecode(${JSON.stringify(qrFrio)}.slice(5))));
        p.tx.data = new ethers.Contract(p.tx.to, erc20Abi).interface.encodeFunctionData('approve', [${JSON.stringify(VOS)}, 1n]);
        return 'CWT1|' + b64urlEncode(new TextEncoder().encode(JSON.stringify(p)));
    })()`);
    await dev.eval(`handleIncomingColdTx(${JSON.stringify(qrOpaco)})`);
    await sleep(300);
    check('un calldata que no es transfer() no se acepta', await dev.eval(`pendingColdTx === null`));

} finally {
    dev.kill();
}

const malos = results.filter(r => !r.ok);
console.log(`\n${malos.length ? '❌' : '✅'} erc20-send-e2e: ${results.length - malos.length}/${results.length}`);
process.exit(malos.length ? 1 : 0);
