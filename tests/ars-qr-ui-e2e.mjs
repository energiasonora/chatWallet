// E2E del reconocimiento de QR argentino en la interfaz (Chrome headless por CDP).
// Comprueba lo que ve el usuario: que escanear el QR de un comercio abra la ficha con el
// nombre y el monto, que un nombre con acento salga ENTERO (el bug de bytes del parser río
// arriba), y que un QR dañado lo diga en rojo en vez de fallar callado.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf .parcel-cache-ui
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/ars-qr-ui-e2e.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, extra = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
}

// ── Armado de QR EMVCo argentino (longitudes y CRC en bytes UTF-8) ────────────
function crc16ccitt(s) {
    let crc = 0xFFFF;
    for (const b of new TextEncoder().encode(s)) {
        crc ^= b << 8;
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
const tag = (t, v) => t + String(Buffer.byteLength(v, 'utf8')).padStart(2, '0') + v;
function armarQr({ pais = 'AR', moneda = '032', comercio = 'COMERCIO', monto = null } = {}) {
    let p = tag('00', '01') + tag('01', monto ? '12' : '11')
        + tag('26', tag('00', 'ar.com.mercadolibre') + tag('01', '0011223344'))
        + tag('52', '5411') + tag('53', moneda);
    if (monto) p += tag('54', monto);
    p += tag('58', pais) + tag('59', comercio) + tag('60', 'BUENOS AIRES') + '6304';
    return p + crc16ccitt(p);
}

// ── RPC falso: la cotización sin tocar la red ────────────────────────────────
// Valores reales del Diamond en Base el 25/8/2026, 6 decimales. getPriceConfig devuelve una
// tupla ESTÁTICA, así que se codifica como sus cuatro palabras pegadas, sin offset.
const PRECIO = { compra: 1601870000n, venta: 1554530000n, offset: 4000000n, spread: 3000000n };
const RPC_FALSO = `
const PAL = n => BigInt(n).toString(16).padStart(64, '0');
const fetchReal = window.fetch.bind(window);
window.fetch = async (url, opts) => {
    // OJO: ethers manda el cuerpo como Uint8Array, no como string. Si sólo se mira el caso
    // string, el pedido se escapa al RPC de verdad y el test miente sin fallar.
    const cuerpo = opts && opts.body;
    let texto = null;
    if (typeof cuerpo === 'string') texto = cuerpo;
    else if (cuerpo && typeof cuerpo.byteLength === 'number') texto = new TextDecoder().decode(cuerpo);
    if (!texto || texto.indexOf('jsonrpc') < 0) return fetchReal(url, opts);
    const responder = m => {
        if (m.method === 'eth_chainId') return '0x2105';
        if (m.method === 'eth_call') return '0x' + PAL(${PRECIO.compra}n) + PAL(${PRECIO.venta}n) +
            PAL(${PRECIO.offset}n) + PAL(${PRECIO.spread}n);
        if (m.method === 'eth_blockNumber') return '0x100';
        return null;
    };
    const pedido = JSON.parse(texto);
    const uno = m => ({ jsonrpc: '2.0', id: m.id, result: responder(m) });
    const salida = Array.isArray(pedido) ? pedido.map(uno) : uno(pedido);
    return new Response(JSON.stringify(salida), { status: 200, headers: { 'content-type': 'application/json' } });
};
try { localStorage.removeItem('cw-precio-p2p-ARS'); } catch (e) {}
`;

// ── CDP mínimo ────────────────────────────────────────────────────────────────
class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-ars-');
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
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
        return r.result?.result?.value;
    }
    async goto(url) {
        await this.rpc('Page.navigate', { url });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            if (await this.eval('typeof window.handleScannedData === "function"')) return;
        }
        throw new Error('la app no terminó de cargar');
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const leerFicha = `(() => {
    const m = document.getElementById('payQrModal');
    return {
        abierto: !!m && !m.classList.contains('hidden'),
        comercio: (document.getElementById('payQrMerchant') || {}).textContent,
        monto: (document.getElementById('payQrAmount') || {}).textContent,
        nota: (document.getElementById('payQrNote') || {}).textContent,
        notaRoja: ((document.getElementById('payQrNote') || {}).className || '').includes('text-red'),
        notaAmbar: ((document.getElementById('payQrNote') || {}).className || '').includes('text-amber'),
        esquema: (document.getElementById('payQrScheme') || {}).textContent,
        costoVisible: !!document.getElementById('payQrCostRow') &&
            !document.getElementById('payQrCostRow').classList.contains('hidden'),
        costo: (document.getElementById('payQrCost') || {}).textContent,
        tasa: (document.getElementById('payQrRate') || {}).textContent,
        bandera: (document.getElementById('payQrFlag') || {}).textContent,
    };
})()`;

const dev = new Dev(9411);
try {
    await dev.launch();
    await dev.goto(BASE);
    console.log('app cargada\n');

    const escanear = async qr => {
        await dev.eval(`window.handleScannedData(${JSON.stringify(qr)})`);
        await sleep(400);
        return dev.eval(leerFicha);
    };
    const cerrar = () => dev.eval(`document.getElementById('payQrOk').click()`);

    console.log('▶ QR de comercio con monto');
    {
        const f = await escanear(armarQr({ comercio: 'KIOSCO LA ESQUINA', monto: '1500.00' }));
        check('abre la ficha del QR argentino', f.abierto);
        check('muestra el nombre del comercio', f.comercio === 'KIOSCO LA ESQUINA', f.comercio);
        check('muestra el monto en pesos', /1[.,]500/.test(f.monto || ''), f.monto);
        check('la nota no es de error', !f.notaRoja, f.nota);
        check('muestra la bandera argentina', f.bandera === '🇦🇷', f.bandera);
        check('dice el esquema', /Transferencias 3\.0/.test(f.esquema || ''), f.esquema);
        await cerrar();
        check('el botón cierra la ficha', !(await dev.eval(leerFicha)).abierto);
    }

    console.log('\n▶ Nombre con acento y ñ (el bug de bytes del parser río arriba)');
    for (const nombre of ['CAFÉ MARTÍNEZ', 'ALMACÉN ÑOQUI']) {
        const f = await escanear(armarQr({ comercio: nombre, monto: '850.50' }));
        check(`${nombre} sale entero, sin basura pegada`, f.comercio === nombre, f.comercio);
        await cerrar();
    }

    console.log('\n▶ QR estático (sin monto)');
    {
        const f = await escanear(armarQr({ comercio: 'VERDULERIA DON JOSE' }));
        check('avisa que el monto lo pone el comercio', /comercio/i.test(f.monto || ''), f.monto);
        await cerrar();
    }

    console.log('\n▶ QR dañado');
    {
        const bueno = armarQr({ comercio: 'TEST', monto: '100' });
        const f = await escanear(bueno.slice(0, -4) + '0000');
        check('igual abre la ficha (no se pierde el escaneo)', f.abierto);
        check('avisa en rojo que el código no cierra', f.notaRoja, f.nota);
        await cerrar();
    }

    console.log('\n▶ País reconocido pero sin plugin todavía');
    {
        // La prueba de que el mecanismo es genérico y no un `if` argentino disfrazado:
        // un QR peruano se reconoce, se dice de dónde es, y se avisa que falta la pieza.
        const f = await escanear(armarQr({ pais: 'PE', moneda: '604', comercio: 'BODEGA SAN MARTIN' }));
        check('abre la ficha igual', f.abierto);
        check('dice de qué país es', /Per[úu]/.test(f.esquema || ''), f.esquema);
        check('avisa en ámbar que falta el plugin', f.notaAmbar, f.nota);
        check('no inventa comercio ni monto', f.comercio === '—' && f.monto === '—', `${f.comercio} / ${f.monto}`);
        await cerrar();
    }

    console.log('\n▶ Cuánto sale en USDC');
    {
        // La pregunta que uno se hace parado en el kiosco. 5000 / 1554,53 = 3,2164.
        await dev.eval(`window.handleScannedData(${JSON.stringify(armarQr({ comercio: 'KIOSCO LA ESQUINA', monto: '5000.00' }))})`);
        await sleep(1200);   // la cotización llega DESPUÉS de la ficha, a propósito
        const f = await dev.eval(leerFicha);
        check('aparece la tarjeta del costo', f.costoVisible, f.costo);
        check('dice cuántos USDC son', /3,22\s*USDC/.test(f.costo || ''), f.costo);
        check('muestra la cotización usada', /1\.554,53/.test(f.tasa || ''), f.tasa);
        check('y el spread, sin letra chica', /3\s*%/.test(f.tasa || ''), f.tasa);
        await cerrar();
    }
    {
        // Sin monto en el QR no hay cuenta que hacer, pero la cotización sigue sirviendo.
        await dev.eval(`window.handleScannedData(${JSON.stringify(armarQr({ comercio: 'FERRETERIA' }))})`);
        await sleep(1200);
        const f = await dev.eval(leerFicha);
        check('con monto abierto no inventa un costo', (f.costo || '').trim() === '—', f.costo);
        check('pero igual muestra la cotización', /1\.554,53/.test(f.tasa || ''), f.tasa);
        await cerrar();
    }
    {
        // País sin plugin: no corresponde mostrar precio de nada.
        await dev.eval(`window.handleScannedData(${JSON.stringify(armarQr({ pais: 'PE', moneda: '604', comercio: 'BODEGA' }))})`);
        await sleep(900);
        check('sin plugin no se muestra costo', !(await dev.eval(leerFicha)).costoVisible);
        await cerrar();
    }

    console.log('\n▶ No se mete con los otros QR');
    {
        await dev.eval(`window.handleScannedData("0x1111111111111111111111111111111111111111")`);
        await sleep(400);
        check('una address no abre la ficha argentina', !(await dev.eval(leerFicha)).abierto);
    }
} finally {
    dev.kill();
}

const mal = results.filter(r => !r.ok).length;
console.log(`\n${mal === 0 ? '✅' : '❌'} ${results.length - mal} bien, ${mal} mal\n`);
process.exit(mal === 0 ? 0 : 1);
