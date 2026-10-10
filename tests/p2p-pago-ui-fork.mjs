// Pagar un QR desde la FICHA (Chrome headless por CDP) contra el Diamond real en un fork de Base.
// La página cree que habla con mainnet.base.org: sus pedidos RPC se desvían al fork de anvil.
// El comerciante lo hace este script, suplantando en anvil a uno de los asignables.
// Se corre con tests/run-p2p-pago-ui-fork.sh (buildea, levanta anvil y sirve la web).
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import * as ethers from 'ethers';
import { decryptPaymentAddress, createRelayIdentity } from '@p2pdotme/sdk/orders';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8853/dapp.html';
const RPC = process.env.RPC || 'http://127.0.0.1:8548';
const FOTO = process.env.FOTO || '';
const DIAMOND = '0x4cad6eC90e65baBec9335cAd728DDC610c316368';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x !== '' ? ' — ' + x : ''}`); if (!c) fallas++; };

// ── QR estático de comercio (sin monto), con acento ──
function crc16(s) {
    let crc = 0xFFFF;
    for (const b of new TextEncoder().encode(s)) { crc ^= b << 8; for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF; }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
const tag = (t, v) => t + String(Buffer.byteLength(v, 'utf8')).padStart(2, '0') + v;
function armarQr(comercio, monto = null) {
    let s = tag('00', '01') + tag('01', monto ? '12' : '11') + tag('43', tag('00', 'com.mercadolibre') + tag('01', 'https://mpago.la/pos/137071689'))
        + tag('52', '5411') + tag('53', '032') + (monto ? tag('54', monto) : '') + tag('58', 'AR') + tag('59', comercio) + tag('60', 'CABA') + '6304';
    return s + crc16(s);
}

// ── El fork y el comerciante de mentira ──
const p = new ethers.JsonRpcProvider(RPC, 8453, { staticNetwork: true, cacheTimeout: -1 });
await p.send('anvil_autoImpersonateAccount', [true]);
const ORD = 'tuple(uint256 amount,uint256 fiatAmount,uint256 placedTimestamp,uint256 completedTimestamp,uint256 userCompletedTimestamp,address acceptedMerchant,address user,address recipientAddr,string pubkey,string encUpi,bool userCompleted,uint8 status,uint8 orderType,tuple(uint8 raisedBy,uint8 status,uint256 redactTransId,uint256 accountNumber) disputeInfo,uint256 id,string userPubKey,string encMerchantUpi,uint256 acceptedAccountNo,uint256[] assignedAccountNos,bytes32 currency,uint256 preferredPaymentChannelConfigId,uint256 circleId)';
const d = new ethers.Contract(DIAMOND, [
    `function getOrdersById(uint256) view returns (${ORD})`,
    `event OrderPlaced(uint256 indexed orderId,address indexed user,address indexed merchant,uint256 amount,uint8 orderType,uint256 placedTimestamp,${ORD} _order)`,
    'function getAssignableMerchantsFromCircle(uint256,uint256,bytes32,address,uint256,uint256,int256,uint256) view returns (address[])',
    'function acceptOrder(uint256,string,string)', 'function completeOrder(uint256,string)'], p);
const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)'], p);

const wallet = ethers.Wallet.createRandom();
async function fondear(usdc6, eth) {
    await p.send('anvil_setBalance', [wallet.address, ethers.toQuantity(ethers.parseEther(eth))]);
    await p.send('anvil_setStorageAt', [USDC, ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [wallet.address, 9])), ethers.toBeHex(usdc6, 32)]);
}
// La orden que abrió la página: su número queda en data-orden de la línea de progreso.
// (Pedirle los eventos al fork lo manda a buscar río arriba y el RPC público lo limita.)
async function ordenNueva(vistas, tope = 180000) {
    for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(400)) {
        const id = await dev.eval(`document.getElementById('payQrProgress').dataset.orden || ''`);
        if (id && !vistas.has(id)) { vistas.add(id); return BigInt(id); }
    }
    throw new Error('la página nunca abrió la orden');
}
async function enviar(desde, data) {
    await p.send('anvil_setBalance', [desde, ethers.toQuantity(ethers.parseEther('0.01'))]);
    const h = await p.send('eth_sendTransaction', [{ from: desde, to: DIAMOND, data, gas: '0x300000' }]);
    return (await p.waitForTransaction(h)).status === 1;
}
async function comercianteAcepta(orderId) {
    const o = await d.getOrdersById(orderId), llave = createRelayIdentity();
    const data = d.interface.encodeFunctionData('acceptOrder', [orderId, '', llave.publicKey]);
    for (const m of await d.getAssignableMerchantsFromCircle(o.circleId, 30n, o.currency, o.user, o.amount, o.fiatAmount, 2n, 0n)) {
        try { await p.call({ from: m, to: DIAMOND, data }); if (await enviar(m, data)) return { m, llave }; } catch (e) { }
    }
    throw new Error('nadie pudo aceptar la orden');
}
async function esperarEstado(orderId, estado, tope = 120000) {
    for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(400)) {
        const o = await d.getOrdersById(orderId);
        if (Number(o.status) === estado) return o;
    }
    throw new Error(`la orden ${orderId} no llegó al estado ${estado}`);
}

// ── CDP mínimo ──
const INICIO = `
try { localStorage.setItem('xmtp-chat-wallet', '${wallet.privateKey}'); localStorage.setItem('chatwallet-lang', 'es'); } catch (e) {}
const fetchReal = window.fetch.bind(window);
window.fetch = (url, opts) => {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    if (/^https:\\/\\/(mainnet\\.base\\.org|base-rpc\\.publicnode\\.com)/.test(u)) return fetchReal('${RPC}', opts);
    return fetchReal(url, opts);
};`;
class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-p2p-');
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
                if (m.method === 'Runtime.consoleAPICalled' && process.env.VERBOSE) console.log('  [page]', m.params.args.map(a => a.value ?? a.description).join(' ').slice(0, 300));
            };
        });
    }
    rpc(method, params = {}) { const id = ++this.id; return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); }); }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
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
    return { abierta: visto('payQrModal'), estado: el('payQrStatus').textContent, costo: el('payQrCost').textContent, saldo: el('payQrBalance').textContent,
        pagar: visto('payQrPay'), pagarTxt: el('payQrPay').textContent, pagarOff: el('payQrPay').disabled,
        frenar: visto('payQrStop'), progreso: visto('payQrProgress') ? el('payQrProgress').textContent : '', progresoClase: el('payQrProgress').className };
})()`;

const dev = new Dev(9412);
try {
    await dev.launch();
    await dev.rpc('Page.navigate', { url: BASE });
    for (let i = 0; i < 120; i++) { await sleep(500); if (await dev.eval(`typeof window.handleScannedData === 'function' && !!(window.currentWallet || (typeof currentWallet !== 'undefined' && currentWallet))`).catch(() => false)) break; }
    ok(await dev.eval(`(typeof currentWallet !== 'undefined' && currentWallet ? currentWallet.address : '')`) === wallet.address, 'la app arrancó con la wallet de prueba');

    const escanear = async qr => { await dev.eval(`window.handleScannedData(${JSON.stringify(qr)})`); };
    const tipear = async v => dev.eval(`(() => { const i = document.getElementById('payQrAmountInput'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    const tocar = id => dev.eval(`document.getElementById('${id}').click()`);
    const hasta = async (cond, tope = 120000) => { for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(300)) { const f = await dev.eval(ficha); if (cond(f)) return f; } return dev.eval(ficha); };
    const QR = armarQr('CAFÉ MARTÍNEZ');
    const vistas = new Set();

    console.log('\n▶ apagado (como le llega a todo el mundo)');
    {
        await fondear(40_000_000n, '0.02');
        await escanear(QR); await tipear('20.000');
        const f = await hasta(x => /USDC/.test(x.costo) && /Tenés/.test(x.saldo), 30000);
        ok(f.abierta && !f.pagar && /Todavía no se puede pagar/.test(f.estado), 'sin activar no hay botón de pagar y la ficha lo dice', f.estado.slice(0, 50));
    }

    console.log('\n▶ cinco toques en la bandera lo prenden');
    {
        for (let i = 0; i < 5; i++) await tocar('payQrFlag');
        const f = await hasta(x => x.pagar, 5000);
        ok(f.pagar && /experimental/i.test(f.estado), 'aparece el botón y el aviso de experimental', f.pagarTxt);
        ok(await dev.eval(`localStorage.getItem('cw-p2p-pago')`) === '1', 'queda guardado para la próxima');
    }

    console.log('\n▶ pago completo: $ 20.000 a CAFÉ MARTÍNEZ');
    {
        let f = await dev.eval(ficha);
        ok(/^Pagar con 12,\d\d USDC$/.test(f.pagarTxt) && !f.pagarOff, 'el botón dice cuánto USDC sale', f.pagarTxt);
        await tocar('payQrPay');
        f = await dev.eval(ficha);
        ok(/confirmar/i.test(f.pagarTxt) && /20\.000/.test(f.pagarTxt) && await p.getTransactionCount(wallet.address) === 0,
            'el primer toque sólo pide confirmar, con el monto en pesos', f.pagarTxt);
        await dev.foto('1-confirmar');
        await tocar('payQrPay');
        const orderId = await ordenNueva(vistas);
        f = await hasta(x => x.frenar && /comerciante/.test(x.progreso));
        ok(f.frenar && !f.pagar && /Esperando que un comerciante/.test(f.progreso), 'abierta la orden: espera a un comerciante y ofrece frenar', f.progreso.slice(0, 60));
        await dev.foto('2-esperando');
        await escanear(armarQr('OTRO COMERCIO', '999.00'));
        ok((await dev.eval(`document.getElementById('payQrMerchant').textContent`)) === 'CAFÉ MARTÍNEZ', 'otro QR escaneado en el medio no pisa la ficha del pago en curso');
        const { m, llave } = await comercianteAcepta(orderId);
        const o = await esperarEstado(orderId, 2);
        const r = await decryptPaymentAddress({ encrypted: o.encUpi, recipientIdentity: llave });
        ok(r.isOk() && r.value === QR, 'el comerciante descifra exactamente el QR escaneado', r.isOk() ? '' : r.error.message);
        f = await hasta(x => /custodia/.test(x.progreso), 20000);
        ok(/custodia/.test(f.progreso) && !f.frenar, 'enviado el QR: avisa que el USDC está en custodia y ya no ofrece frenar', f.progreso.slice(0, 70));
        await enviar(m, d.interface.encodeFunctionData('completeOrder', [orderId, '']));
        f = await hasta(x => /Pagado/.test(x.progreso), 30000);
        ok(/Pagado: .*20\.000.* por 12,\d\d USDC\. Orden #\d+\./.test(f.progreso) && /emerald/.test(f.progresoClase), 'cierra en verde con monto, USDC y número de orden', f.progreso);
        f = await hasta(x => /Tenés 27,/.test(x.saldo), 15000);
        ok(/Tenés 27,\d\d USDC/.test(f.saldo) && !f.pagar, 'la ficha muestra el saldo nuevo y no deja pagar dos veces el mismo QR', f.saldo);
        ok(40_000_000n - await usdc.balanceOf(wallet.address) === (await d.getOrdersById(orderId)).amount, 'en cadena salió exactamente lo de la orden');
        const reg = JSON.parse(await dev.eval(`localStorage.getItem('cw-p2p-ordenes-${wallet.address.toLowerCase()}')`) || '[]')[0];
        ok(reg?.orderId === String(orderId) && reg.estado === 'completada' && reg.comercio === 'CAFÉ MARTÍNEZ' && reg.fiat === 20000, 'queda anotada con su número para reclamar', JSON.stringify(reg));
        await dev.foto('3-pagado');
        await tocar('payQrOk');
    }

    console.log('\n▶ frenar antes de mandar el QR');
    {
        const antes = await usdc.balanceOf(wallet.address);
        await escanear(armarQr('KIOSCO', '15000.00'));
        let f = await hasta(x => x.pagar && !x.pagarOff, 30000);
        await tocar('payQrPay'); await tocar('payQrPay');
        const orderId = await ordenNueva(vistas);
        await hasta(x => x.frenar && /Esperando/.test(x.progreso));
        await tocar('payQrStop');
        f = await hasta(x => /Frenado/.test(x.progreso), 20000);
        ok(/Frenado\. El QR no se envió y tus USDC no se movieron/.test(f.progreso) && f.pagar, 'frenar: lo dice claro y deja reintentar', f.progreso.slice(0, 80));
        const o = await d.getOrdersById(orderId);
        ok(o.encUpi === '' && await usdc.balanceOf(wallet.address) === antes, 'el QR no salió y no se movió ni un USDC');
        await tocar('payQrOk');
    }

    console.log('\n▶ sin plata para el gas');
    {
        await p.send('anvil_setBalance', [wallet.address, '0x0']);
        const n = await p.getTransactionCount(wallet.address);
        await escanear(armarQr('KIOSCO', '15000.00'));
        await hasta(x => x.pagar && !x.pagarOff, 30000);
        await tocar('payQrPay'); await tocar('payQrPay');
        const f = await hasta(x => /gas/.test(x.progreso), 20000);
        ok(/Falta ETH en Base para el gas/.test(f.progreso) && /rojo/.test(f.progresoClase) && await p.getTransactionCount(wallet.address) === n, 'lo dice en rojo y no manda ninguna transacción', f.progreso);
        await dev.foto('4-sin-gas');
    }
} catch (e) { console.log('✗ excepción:', e.message); fallas++; }
finally { dev.kill(); }
console.log(fallas ? `\n✗ ${fallas} fallas` : '\n✓ todo bien');
process.exit(fallas ? 1 : 0);
