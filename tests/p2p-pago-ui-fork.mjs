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
    throw new Error(`la orden ${orderId} no llegó al estado ${estado}: quedó en ${Number((await d.getOrdersById(orderId)).status)} · ${JSON.stringify(await dev.eval(ficha)).slice(0, 400)}`);
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
    return { abierta: visto('payQrModal'), estado: el('payQrStatus').textContent, estadoClase: el('payQrStatus').className, costo: el('payQrCost').textContent, saldo: el('payQrBalance').textContent,
        fee: visto('payQrFee') ? el('payQrFee').textContent : '', pagar: visto('payQrPay'), pagarTxt: el('payQrPay').textContent, pagarOff: el('payQrPay').disabled,
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

    const aviso = `(() => { const el = id => document.getElementById(id);
        return { abierto: !el('p2pActivarModal').classList.contains('hidden'), cotiz: el('p2pActCotiz').textContent, fija: el('p2pActFija').textContent,
            spread: el('p2pActSpread').textContent, texto: el('p2pActivarModal').textContent }; })()`;
    console.log('\n▶ sin activar: el primer toque abre el aviso');
    {
        await fondear(40_000_000n, '0.02');
        await escanear(QR); await tipear('20.000');
        let f = await hasta(x => /USDC/.test(x.costo) && /Tenés/.test(x.saldo) && /ChatWallet/.test(x.fee), 30000);
        ok(f.abierta && f.pagar && f.pagarTxt === 'Pagar con USDC (experimental)' && /cw-aviso-verde/.test(f.estadoClase), 'la ficha ofrece pagar (experimental) sin trucos', f.pagarTxt);
        ok(/\+ 0,0\d{3} de ChatWallet \(0,5 %, solo si se completa\)/.test(f.fee), 'la comisión de ChatWallet está a la vista en la ficha', f.fee);
        await tocar('payQrPay');
        let a = await dev.eval(aviso);
        for (let i = 0; i < 50 && /^(…|—)$/.test(a.fija); i++) { await sleep(300); a = await dev.eval(aviso); }
        ok(a.abierto && /^1 USDC = \$/.test(a.cotiz) && /0,05 USDC en pagos de hasta 10 USDC/.test(a.fija) && /%/.test(a.spread),
            'el aviso trae la cotización, el spread y la comisión fija leídos del contrato', `${a.cotiz} · ${a.spread} · ${a.fija}`);
        ok(/0,5 %, solo si el pago se completa/.test(a.texto) && /300 USDC/.test(a.texto) && /vuelve entero/.test(a.texto) && /no se puede cancelar/.test(a.texto) && /t\.me\/p2pmeargentina/.test(a.texto),
            'y dice ChatWallet 0,5 %, el límite, qué pasa si falla y dónde reclamar');
        ok(await p.getTransactionCount(wallet.address) === 0, 'abrir el aviso no manda nada');
        await dev.foto('0-aviso');
        await tocar('p2pActNo');
        a = await dev.eval(aviso);
        ok(!a.abierto && await dev.eval(`localStorage.getItem('cw-p2p-pago')`) === null, '«Ahora no» lo cierra sin activar');
        await tocar('payQrPay'); await tocar('p2pActOk');
        f = await hasta(x => /^Pagar con 12,/.test(x.pagarTxt), 5000);
        ok(!(await dev.eval(aviso)).abierto && await dev.eval(`localStorage.getItem('cw-p2p-pago')`) === '1', '«Entiendo, activar» lo deja activado para la próxima');
    }

    console.log('\n▶ pago completo: $ 20.000 a CAFÉ MARTÍNEZ');
    {
        let f = await dev.eval(ficha);
        ok(/^Pagar con 12,\d\d USDC$/.test(f.pagarTxt) && !f.pagarOff, 'el botón dice cuánto USDC sale', f.pagarTxt);
        await tocar('payQrPay');
        f = await dev.eval(ficha);
        ok(/confirmar/i.test(f.pagarTxt) && /20\.000/.test(f.pagarTxt) && /\+ 0,0\d{3} de ChatWallet/.test(f.pagarTxt) && await p.getTransactionCount(wallet.address) === 0,
            'el primer toque sólo pide confirmar, con el monto en pesos y la comisión de ChatWallet', f.pagarTxt);
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
        f = await hasta(x => /Comisión de ChatWallet/.test(x.progreso), 20000);
        ok(/Comisión de ChatWallet: 0,0\d{3} USDC\./.test(f.progreso), 'y dice la comisión de ChatWallet que se cobró', f.progreso);
        f = await hasta(x => /Tenés 27,/.test(x.saldo), 15000);
        ok(/Tenés 27,\d\d USDC/.test(f.saldo) && !f.pagar, 'la ficha muestra el saldo nuevo y no deja pagar dos veces el mismo QR', f.saldo);
        const monto = (await d.getOrdersById(orderId)).amount, cw = (monto * 50n + 9999n) / 10000n;
        ok(40_000_000n - await usdc.balanceOf(wallet.address) === monto + cw, 'en cadena salió lo de la orden + el 0,5 % de ChatWallet', `${ethers.formatUnits(monto, 6)} + ${ethers.formatUnits(cw, 6)}`);
        const reg = JSON.parse(await dev.eval(`localStorage.getItem('cw-p2p-ordenes-${wallet.address.toLowerCase()}')`) || '[]')[0];
        ok(reg?.orderId === String(orderId) && reg.estado === 'completada' && reg.comercio === 'CAFÉ MARTÍNEZ' && reg.fiat === 20000 && /^0x/.test(reg.comisionTx || ''),
            'queda anotada con su número para reclamar (y la comisión cobrada)', JSON.stringify(reg));
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

    console.log('\n▶ pago chico: la ficha, el botón y lo que sale dicen el mismo número');
    {
        await escanear(QR); await tipear('500');
        const f = await hasta(x => x.pagar && /\+/.test(x.fee), 30000);
        const n = (f.costo.match(/^(0,\d{4}) USDC$/) || [])[1];
        ok(!!n && f.pagarTxt === 'Pagar con ' + n + ' USDC' && /0,0500 de comisión del protocolo/.test(f.fee) && /de ChatWallet/.test(f.fee), 'el total incluye las dos comisiones y el botón repite el mismo número', f.costo + ' · ' + f.pagarTxt + ' · ' + f.fee);
        const antes = await usdc.balanceOf(wallet.address);
        await tocar('payQrPay'); await tocar('payQrPay');
        const orderId = await ordenNueva(vistas);
        const { m } = await comercianteAcepta(orderId);
        await esperarEstado(orderId, 2);
        await hasta(x => /custodia/.test(x.progreso), 20000);
        await enviar(m, d.interface.encodeFunctionData('completeOrder', [orderId, '']));
        await hasta(x => /Pagado/.test(x.progreso), 30000);
        const reg = JSON.parse(await dev.eval(`localStorage.getItem('cw-p2p-ordenes-${wallet.address.toLowerCase()}')`) || '[]').find(o => o.orderId === String(orderId));
        for (let i = 0; i < 40 && !(reg?.comisionTx); i++) await sleep(300);
        const salio = Number(ethers.formatUnits(antes - await usdc.balanceOf(wallet.address), 6)).toLocaleString('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
        ok(salio === n, 'y, con la comisión de ChatWallet, es exactamente lo que sale de la wallet', salio + ' · ficha ' + n);
        await tocar('payQrOk');
    }

    // ── Se cerró la app con el QR ya enviado: la revisión termina lo que quedó ──
    const registro = async id => JSON.parse(await dev.eval(`localStorage.getItem('cw-p2p-ordenes-${wallet.address.toLowerCase()}')`) || '[]').find(o => o.orderId === String(id));
    const recargar = async () => {
        await dev.rpc('Page.reload', {});
        for (let i = 0; i < 120; i++) { await sleep(500); if (await dev.eval(`typeof window.cwP2pRevisarOrdenes === 'function' && typeof currentWallet !== 'undefined' && !!currentWallet`).catch(() => false)) break; }
    };
    const pagarYCerrar = async (comercio) => {
        await escanear(armarQr(comercio, '15000.00'));
        await hasta(x => x.pagar && !x.pagarOff, 30000);
        await tocar('payQrPay'); await tocar('payQrPay');
        const orderId = await ordenNueva(vistas);
        const { m } = await comercianteAcepta(orderId);
        await esperarEstado(orderId, 2);
        for (let i = 0; i < 50 && (await registro(orderId))?.estado !== 'enviada'; i++) await sleep(200);
        ok((await registro(orderId))?.estado === 'enviada', `${comercio}: el QR salió y la orden quedó anotada antes de cerrar`);
        await recargar();
        return { orderId, m };
    };
    // La revisión espera la respuesta del usuario: se dispara sin esperarla y se mira la ventanita.
    const pregunta = () => dev.eval(`(() => { const m = document.getElementById('p2pPreguntaModal');
        return m && !m.classList.contains('hidden') ? document.getElementById('p2pPreguntaTitulo').textContent + ' | ' + document.getElementById('p2pPreguntaTexto').textContent : ''; })()`);
    const disparar = () => dev.eval(`(window.cwP2pRevisarOrdenes(), true)`);
    const esperarPregunta = async (tope = 45000) => {
        for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(1000)) { await disparar(); const q = await pregunta(); if (q) return q; }
        return '';
    };
    const revisarHasta = async (id, cond, tope = 45000) => {
        for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(1000)) { await disparar(); const r = await registro(id); if (cond(r)) return r; }
        return registro(id);
    };

    console.log('\n▶ cerrar la app antes de que termine: al volver, PREGUNTA por la comisión');
    {
        await fondear(40_000_000n, '0.02');
        const antes = await usdc.balanceOf(wallet.address);
        const { orderId, m } = await pagarYCerrar('ALMACÉN');
        await enviar(m, d.interface.encodeFunctionData('completeOrder', [orderId, '']));
        const nonce = await p.getTransactionCount(wallet.address);
        const q = await esperarPregunta();
        const r0 = await registro(orderId);
        const tiro = ethers.parseUnits(r0?.usdc || '0', 6);
        ok(/Falta la comisión de ChatWallet/.test(q) && q.includes('#' + orderId) && /0,0\d+ USDC/.test(q), 'al volver pregunta por la comisión, con el número de orden y el monto', q);
        ok(await p.getTransactionCount(wallet.address) === nonce && antes - await usdc.balanceOf(wallet.address) === tiro, 'mientras no contesta, no sale nada de la wallet');
        await dev.foto('5-pregunta-comision');
        await tocar('p2pPreguntaSi');
        const r = await revisarHasta(orderId, x => !!x?.comisionTx);
        const monto = (await d.getOrdersById(orderId)).amount, cw = (monto * 50n + 9999n) / 10000n;
        ok(/^0x/.test(r?.comisionTx || '') && r.comision === ethers.formatUnits(cw, 6) && antes - await usdc.balanceOf(wallet.address) === tiro + cw, 'con «Pagar comisión» sale el 0,5 %', JSON.stringify(r));
        await disparar(); await sleep(2000);
        ok(!(await pregunta()) && antes - await usdc.balanceOf(wallet.address) === tiro + cw, 'y no se vuelve a preguntar ni a cobrar');
    }

    console.log('\n▶ «Ahora no»: no se cobra y no se insiste');
    {
        await fondear(40_000_000n, '0.02');
        const { orderId, m } = await pagarYCerrar('VERDULERÍA');
        await enviar(m, d.interface.encodeFunctionData('completeOrder', [orderId, '']));
        const q = await esperarPregunta();
        ok(/Falta la comisión/.test(q), 'pregunta', q.slice(0, 40));
        const nonce = await p.getTransactionCount(wallet.address);
        await tocar('p2pPreguntaNo');
        await sleep(1500);
        const r = await registro(orderId);
        ok(r?.comisionRechazada === true && !r.comisionTx && await p.getTransactionCount(wallet.address) === nonce, '«Ahora no» no manda nada y queda anotado', JSON.stringify(r));
        await recargar();
        await disparar(); await sleep(3000);
        ok(!(await pregunta()), 'ni después de reabrir la app se vuelve a preguntar');
    }

    console.log('\n▶ el comerciante no paga: nada se manda solo; a la hora ofrece recuperar el USDC');
    {
        await fondear(40_000_000n, '0.02');
        const { orderId } = await pagarYCerrar('FERRETERÍA');
        ok(await usdc.balanceOf(wallet.address) < 40_000_000n, 'el USDC está en custodia');
        const nonce = await p.getTransactionCount(wallet.address);
        await p.send('evm_increaseTime', [15 * 60]); await p.send('evm_mine', []);
        await disparar(); await sleep(4000);
        ok(!(await pregunta()) && await p.getTransactionCount(wallet.address) === nonce && Number((await d.getOrdersById(orderId)).status) === 2,
            'vencida a los 15 min: la app no manda nada (el protocolo la barre con su propio proceso)');
        await p.send('evm_increaseTime', [50 * 60]); await p.send('evm_mine', []);
        const q = await esperarPregunta();
        ok(/siguen retenidos/.test(q) && q.includes('#' + orderId), 'pasada la hora, ofrece recuperarlo', q);
        await dev.foto('6-recuperar');
        await tocar('p2pPreguntaSi');
        const r = await revisarHasta(orderId, x => x?.estado === 'cancelada');
        ok(r?.estado === 'cancelada' && Number((await d.getOrdersById(orderId)).status) === 4, 'con «Recuperar mis USDC» se barre la orden', JSON.stringify(r));
        ok(await usdc.balanceOf(wallet.address) === 40_000_000n && !r.comisionTx, 'el USDC vuelve entero y ChatWallet no cobra nada');
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
