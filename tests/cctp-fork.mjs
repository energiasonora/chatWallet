// Pasar USDC de Base a Ethereum desde la ficha (Chrome headless por CDP) contra los contratos
// REALES de CCTP v2 en dos forks de anvil. La página cree que habla con mainnet.base.org,
// ethereum-rpc.publicnode.com e iris-api.circle.com: los pedidos se desvían a los forks y a un
// Iris de mentira que corre acá. Este Iris firma como Circle: en el fork de Ethereum se dan de
// alta dos atestadores de prueba (suplantando al attesterManager) y él firma con sus llaves.
// Se corre con tests/run-cctp-fork.sh (buildea, levanta los dos anvil y sirve la web).
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import * as ethers from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8863/dapp.html';
const RPC_BASE = process.env.RPC_BASE || 'http://127.0.0.1:8561';
const RPC_ETH = process.env.RPC_ETH || 'http://127.0.0.1:8562';
const IRIS_PORT = 8864;
const FOTO = process.env.FOTO || '';
const TM = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const MT = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ETH = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const FWD_FEE = 986924n;   // lo que cotizó Iris el 23/10/2026 hacia Ethereum ("med")
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x !== '' ? ' — ' + x : ''}`); if (!c) fallas++; };

const pB = new ethers.JsonRpcProvider(RPC_BASE, 8453, { staticNetwork: true, cacheTimeout: -1 });
const pE = new ethers.JsonRpcProvider(RPC_ETH, 1, { staticNetwork: true, cacheTimeout: -1 });
await pE.send('anvil_autoImpersonateAccount', [true]);
const erc = ['function balanceOf(address) view returns (uint256)'];
const usdcB = new ethers.Contract(USDC_BASE, erc, pB), usdcE = new ethers.Contract(USDC_ETH, erc, pE);
const mtE = new ethers.Contract(MT, ['function attesterManager() view returns (address)', 'function enableAttester(address)',
    'function receiveMessage(bytes,bytes) returns (bool)', 'function usedNonces(bytes32) view returns (uint256)'], pE);

// ── Atestadores de prueba en el fork de Ethereum ──
const atestadores = [ethers.Wallet.createRandom(), ethers.Wallet.createRandom()]
    .sort((a, b) => (BigInt(a.address) < BigInt(b.address) ? -1 : 1));
const manager = await mtE.attesterManager();
await pE.send('anvil_setBalance', [manager, ethers.toQuantity(ethers.parseEther('1'))]);
for (const a of atestadores) {
    const h = await pE.send('eth_sendTransaction', [{ from: manager, to: MT, data: mtE.interface.encodeFunctionData('enableAttester', [a.address]) }]);
    await pE.waitForTransaction(h);
}

const wallet = ethers.Wallet.createRandom();
const slot = a => ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [a, 9]));
async function fondear(p, token, usdc6, eth) {
    await p.send('anvil_setBalance', [wallet.address, ethers.toQuantity(ethers.parseEther(eth))]);
    await p.send('anvil_setStorageAt', [token, slot(wallet.address), ethers.toBeHex(usdc6, 32)]);
}

// ── Iris de mentira ──
// Toma el MessageSent de la quema en el fork de Base y lo completa como Circle: nonce,
// umbral ejecutado, comisión cobrada y vencimiento. Firma keccak(message) con los dos.
const iris = { retener: false, consultas: 0, forwards: 0, mensajes: new Map() };
const IFACE_MS = new ethers.Interface(['event MessageSent(bytes message)']);
const hex = b => ethers.hexlify(b);
async function armarMensaje(txHash) {
    if (iris.mensajes.has(txHash)) return iris.mensajes.get(txHash);
    const rc = await pB.getTransactionReceipt(txHash);
    if (!rc) return null;
    const log = rc.logs.find(l => l.address.toLowerCase() === MT.toLowerCase());
    if (!log) return null;
    const msg = ethers.getBytes(IFACE_MS.parseLog(log).args.message);
    const m = new Uint8Array(msg);
    const nonce = ethers.randomBytes(32);
    m.set(nonce, 12);
    const minUmbral = Number(BigInt(hex(m.slice(140, 144))));
    m.set(ethers.getBytes(ethers.toBeHex(minUmbral, 4)), 144);
    const C = 148;
    const amount = BigInt(hex(m.slice(C + 68, C + 100)));
    const maxFee = BigInt(hex(m.slice(C + 132, C + 164)));
    const hook = hex(m.slice(C + 228));
    const forward = hook.startsWith('0x636374702d666f7277617264');
    const protocolo = minUmbral === 1000 ? (amount * 130n + 999999n) / 1000000n : 0n;
    const fee = protocolo + (forward ? FWD_FEE : 0n);
    if (fee > maxFee) throw new Error(`maxFee ${maxFee} < comisión ${fee}`);
    m.set(ethers.getBytes(ethers.toBeHex(fee, 32)), C + 164);
    if (minUmbral === 1000) m.set(ethers.getBytes(ethers.toBeHex((await pE.getBlockNumber()) + 7200, 32)), C + 196);
    const message = hex(m);
    const digest = ethers.keccak256(message);
    const attestation = ethers.concat(atestadores.map(a => a.signingKey.sign(digest).serialized));
    const r = { message, attestation, eventNonce: hex(nonce), forward, amount, fee, maxFee, umbral: minUmbral, forwardTxHash: null };
    iris.mensajes.set(txHash, r);
    return r;
}
async function entregarComoCircle(r) {   // el Forwarding Service: otro llama receiveMessage
    const relayer = '0x000000000000000000000000000000000000c1c1';
    await pE.send('anvil_setBalance', [relayer, ethers.toQuantity(ethers.parseEther('1'))]);
    const h = await pE.send('eth_sendTransaction', [{ from: relayer, to: MT, data: mtE.interface.encodeFunctionData('receiveMessage', [r.message, r.attestation]) }]);
    await pE.waitForTransaction(h);
    iris.forwards++;
    return h;
}
const servidor = http.createServer(async (req, res) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const u = new URL(req.url, 'http://x');
    const responder = (code, obj) => { res.writeHead(code, cors); res.end(JSON.stringify(obj)); };
    try {
        if (u.pathname.startsWith('/v2/burn/USDC/fees/')) {
            const ff = { low: 690031, med: Number(FWD_FEE), high: 1283818 };
            return responder(200, [{ finalityThreshold: 1000, minimumFee: 1.3, forwardFee: ff }, { finalityThreshold: 2000, minimumFee: 0, forwardFee: ff }]);
        }
        if (u.pathname === '/v2/messages/6') {
            iris.consultas++;
            const tx = u.searchParams.get('transactionHash');
            const r = iris.retener ? null : await armarMensaje(tx);
            if (!r) return responder(404, { error: 'Message not found for provided parameters' });
            if (r.forward && !r.forwardTxHash) r.forwardTxHash = await entregarComoCircle(r);
            return responder(200, { messages: [{
                message: r.message, attestation: r.attestation, eventNonce: r.eventNonce, cctpVersion: 2, status: 'complete',
                decodedMessage: { nonce: r.eventNonce, minFinalityThreshold: String(r.umbral), finalityThresholdExecuted: String(r.umbral),
                    decodedMessageBody: { amount: String(r.amount), maxFee: String(r.maxFee), feeExecuted: String(r.fee) } },
                ...(r.forward ? { forwardState: 'CONFIRMED', forwardTxHash: r.forwardTxHash } : {}),
                delayReason: null,
            }], sourceTxHash: tx });
        }
        responder(404, { error: 'no' });
    } catch (e) { console.log('  [iris]', e.message); responder(500, { error: e.message }); }
});
await new Promise(r => servidor.listen(IRIS_PORT, '127.0.0.1', r));

// ── CDP mínimo ──
const INICIO = `
try { localStorage.setItem('xmtp-chat-wallet', '${wallet.privateKey}'); localStorage.setItem('chatwallet-lang', 'es'); } catch (e) {}
const fetchReal = window.fetch.bind(window);
window.fetch = (url, opts) => {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    if (/^https:\\/\\/(mainnet\\.base\\.org|base-rpc\\.publicnode\\.com)/.test(u)) return fetchReal('${RPC_BASE}', opts);
    if (/^https:\\/\\/(ethereum-rpc\\.publicnode\\.com|eth\\.llamarpc\\.com)/.test(u)) return fetchReal('${RPC_ETH}', opts);
    if (/^https:\\/\\/iris-api\\.circle\\.com/.test(u)) return fetchReal(u.replace('https://iris-api.circle.com', 'http://127.0.0.1:${IRIS_PORT}'), opts);
    return fetchReal(url, opts);
};`;
class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-cctp-');
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const page = (await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json()).find(t => t.type === 'page');
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
                await this.rpc('Emulation.setDeviceMetricsOverride', { width: 412, height: 900, deviceScaleFactor: 2, mobile: true });
                await this.rpc('Page.addScriptToEvaluateOnNewDocument', { source: INICIO });
                resolve();
            };
            this.ws.onerror = reject;
            this.ws.onmessage = e => {
                const m = JSON.parse(e.data);
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
                if (m.method === 'Runtime.consoleAPICalled' && (process.env.VERBOSE || /cctp/.test(JSON.stringify(m.params.args).slice(0, 200))))
                    console.log('  [page]', m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 400));
            };
        });
    }
    rpc(method, params = {}) { const id = ++this.id; return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); }); }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
        return r.result?.result?.value;
    }
    async foto(nombre) {
        if (!FOTO) return;
        const r = await this.rpc('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(`${FOTO}/${nombre}.png`, Buffer.from(r.result.data, 'base64'));
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const ficha = `(() => {
    const el = id => document.getElementById(id), visto = id => !!el(id) && !el(id).classList.contains('hidden');
    const on = sel => [...document.querySelectorAll(sel)].find(b => b.getAttribute('aria-pressed') === 'true')?.getAttribute(sel.slice(1, -1)) || '';
    return { abierta: visto('cctpModal'), desde: el('cctpFrom').value, hacia: el('cctpTo').value,
        desdeTxt: el('cctpFrom').selectedOptions[0]?.textContent || '', cotiz: el('cctpQuote').textContent.replace(/\\s+/g, ' ').trim(),
        err: visto('cctpErr') ? el('cctpErr').textContent : '', go: el('cctpGo').textContent, goOff: el('cctpGo').disabled,
        entrega: on('[data-cctp-ent]'), nota: el('cctpDeliveryNote').textContent,
        items: [...document.querySelectorAll('#cctpPend .cctp-item')].map(i => ({ estado: i.dataset.estado, txt: i.textContent.replace(/\\s+/g, ' ').trim() })),
        badge: [...document.querySelectorAll('.cctp-badge')].map(b => b.classList.contains('hidden') ? '' : b.textContent).join('|') };
})()`;

const dev = new Dev(9414);
try {
    await fondear(pB, USDC_BASE, 15_000_000n, '0.01');
    await fondear(pE, USDC_ETH, 0n, '0.01');
    await dev.launch();
    const arrancar = async () => {
        await dev.rpc('Page.navigate', { url: BASE });
        for (let i = 0; i < 120; i++) { await sleep(500); if (await dev.eval(`typeof window.cwCctpAbrir === 'function' && typeof currentWallet !== 'undefined' && !!currentWallet`).catch(() => false)) break; }
    };
    await arrancar();
    ok(await dev.eval(`currentWallet.address`) === wallet.address, 'la app arrancó con la wallet de prueba');
    const tocar = id => dev.eval(`document.getElementById('${id}').click()`);
    const tipear = v => dev.eval(`(() => { const i = document.getElementById('cctpAmount'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    // Con USDC en las dos redes la ficha abre donde hay más: acá se elige Base a mano.
    const elegirBase = async n => {
        for (const t0 = Date.now(); Date.now() - t0 < 40000; await sleep(300))
            if (await dev.eval(`[...document.getElementById('cctpFrom').options].some(o => o.value === '8453' && /${n}$/.test(o.textContent))`)) break;
        await dev.eval(`(() => { const s = document.getElementById('cctpFrom'); s.value = '8453'; s.dispatchEvent(new Event('change')); })()`);
    };
    const hasta = async (cond, tope = 90000) => { let f; for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(300)) { f = await dev.eval(ficha); if (cond(f)) return f; } return f; };

    console.log('\n▶ la ficha: abre desde la billetera, origen donde hay USDC, destino Ethereum');
    {
        ok(await dev.eval(`!!document.getElementById('cctpOpenBtn') && !!document.getElementById('balCctpBtn')`), 'el botón está en la billetera y en Balances');
        await tocar('cctpOpenBtn');
        const f = await hasta(x => /15,00/.test(x.desdeTxt), 40000);
        ok(f.abierta && f.desde === '8453' && f.hacia === '1', 'Base → Ethereum por defecto', `${f.desde}→${f.hacia}`);
        ok(/Base · 15,00$/.test(f.desdeTxt), 'el selector muestra el saldo de USDC', f.desdeTxt);
        ok(/Poné cuánto/.test(f.cotiz) && f.goOff, 'sin monto no deja seguir');
    }

    console.log('\n▶ 10 USDC, rápida, «lo recibo yo» (hay ETH en Ethereum)');
    {
        await tipear('10');
        let f = await hasta(x => !x.goOff || x.err, 30000);
        ok(f.entrega === 'yo' && /Llega\s*≈ 9,9987 USDC · Ethereum/.test(f.cotiz), 'elige recibir por su cuenta y cotiza lo que llega', f.cotiz.slice(0, 160));
        ok(/hasta 0,0013 USDC/.test(f.cotiz) && /Gas en Ethereum/.test(f.cotiz), 'muestra la comisión y el gas de los dos lados');
        await dev.foto('cctp-1-cotizacion');
        await tocar('cctpGo');
        f = await dev.eval(ficha);
        ok(/Confirmar: pasar 10,00 USDC a Ethereum/.test(f.go) && await pB.getTransactionCount(wallet.address) === 0, 'el primer toque solo pide confirmar', f.go);
        await tipear('10.0');
        f = await dev.eval(ficha);
        ok(f.go === 'Revisar' && f.goOff, 'cambiar el monto anula el «Confirmar» en el acto', f.go);
        f = await hasta(x => !x.goOff, 20000);
        await tocar('cctpGo'); await tocar('cctpGo');
        f = await hasta(x => x.items[0]?.estado === 'listo' || x.items[0]?.estado === 'error', 120000);
        ok(f.items[0]?.estado === 'listo', 'termina: llegó a Ethereum', f.items[0]?.txt);
        ok(/Llegaron 9,9987 USDC a Ethereum/.test(f.items[0]?.txt) && /salida en Base/.test(f.items[0]?.txt) && /llegada en Ethereum/.test(f.items[0]?.txt),
            'la fila dice cuánto llegó y enlaza las dos transacciones');
        ok(await usdcE.balanceOf(wallet.address) === 9_998_700n, 'en Ethereum hay 9,9987 USDC', String(await usdcE.balanceOf(wallet.address)));
        ok(await usdcB.balanceOf(wallet.address) === 5_000_000n, 'en Base quedaron 5 USDC');
        const red = await dev.eval(`optionsList.some(n => n.TOKEN_CHAINID === '1' && n.TOKEN_SYMBOL === 'USDC')`);
        ok(red, 'la app sumó «USDC on Ethereum» a la lista de redes');
        await dev.foto('cctp-2-listo');
    }

    console.log('\n▶ sin ETH en Ethereum: «lo entrega Circle» (Forwarding Service)');
    {
        await pE.send('anvil_setBalance', [wallet.address, '0x0']);
        await dev.eval(`document.getElementById('closeCctp').click()`);
        await tocar('cctpOpenBtn');
        await elegirBase('5,00');
        await tipear('5');
        let f = await hasta(x => !x.goOff || x.err, 30000);
        ok(f.entrega === 'circle' && /unos 0,9869 USDC/.test(f.nota), 'sin gas en destino elige la entrega de Circle y dice cuánto cobra', f.nota);
        ok(/Llega\s*≈ 4,0124 USDC/.test(f.cotiz), 'lo que llega descuenta las dos comisiones', f.cotiz.slice(0, 120));
        await tocar('cctpGo'); await tocar('cctpGo');
        f = await hasta(x => x.items[0]?.estado === 'listo' || x.items[0]?.estado === 'error', 120000);
        ok(f.items[0]?.estado === 'listo' && iris.forwards === 1, 'Circle lo emitió en Ethereum', f.items[0]?.txt);
        ok(await usdcE.balanceOf(wallet.address) === 9_998_700n + 4_012_426n, 'llegó lo prometido', String(await usdcE.balanceOf(wallet.address)));
        ok(await pE.getTransactionCount(wallet.address) === 1, 'la wallet no firmó nada en Ethereum esta vez');
    }

    console.log('\n▶ si la app se cierra a mitad de camino, al volver sigue sola');
    {
        await fondear(pB, USDC_BASE, 3_000_000n, '0.01');
        await pE.send('anvil_setBalance', [wallet.address, ethers.toQuantity(ethers.parseEther('0.01'))]);
        iris.retener = true;
        await dev.eval(`document.getElementById('closeCctp').click()`);
        await tocar('cctpOpenBtn');
        await elegirBase('3,00');
        await dev.eval(`document.querySelector('[data-cctp-vel="estandar"]').click()`);
        await tipear('3');
        let f = await hasta(x => !x.goOff || x.err, 30000);
        ok(/sin comisión/.test(f.cotiz) && /15 a 20 minutos/.test(f.cotiz) && f.entrega === 'yo', 'la estándar no cobra comisión y avisa que tarda', f.cotiz.slice(0, 140));
        await tocar('cctpGo'); await tocar('cctpGo');
        f = await hasta(x => x.items[0]?.estado === 'atestando', 60000);
        ok(/Esperando la firma de Circle \(15 a 20 min\)/.test(f.items[0]?.txt) && /1 en curso/.test(f.badge), 'espera la firma y el botón avisa «1 en curso»', f.badge);
        await arrancar();   // recarga: como cerrar y volver a abrir la app
        ok(await usdcE.balanceOf(wallet.address) === 14_011_126n, 'mientras tanto no llegó nada');
        iris.retener = false;
        const t0 = Date.now();
        let b;
        for (; Date.now() - t0 < 90000; await sleep(1000)) { b = await usdcE.balanceOf(wallet.address); if (b > 14_011_126n) break; }
        ok(b === 17_011_126n, 'sin abrir la ficha, la app lo recibió sola al volver', String(b));
        await tocar('cctpOpenBtn');
        f = await hasta(x => x.items[0]?.estado === 'listo', 10000);
        ok(/Llegaron 3,00 USDC/.test(f.items[0]?.txt) && !/en curso/.test(f.badge), 'la fila quedó en listo y ya no hay nada en curso', f.items[0]?.txt);
        await dev.foto('cctp-3-retomado');
    }
} catch (e) {
    console.log('💥', e.stack || e);
    fallas++;
} finally {
    dev.kill();
    servidor.close();
}
console.log(fallas ? `\n❌ ${fallas} falla(s)` : '\n✅ todo bien');
process.exit(fallas ? 1 : 0);
