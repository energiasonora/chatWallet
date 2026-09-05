// Relayer de ChatWallet: transmite una autorización firmada y paga el gas.
//
// Por qué existe: una dirección stealth con USDC y sin nativo no puede gastar nada — no
// tiene con qué pagar gas, y mandárselo desde la billetera principal la vincularía, que es
// justo lo que el esquema evita. ERC-3009 deja firmar la transferencia SIN mandar
// transacción; alguien más la transmite. Ese alguien es esto.
//
// EL PROBLEMA CENTRAL NO ES TRANSMITIR, ES NO SER UN SURTIDOR.
// Un endpoint abierto que paga gas se vacía en horas. Acá se resuelve así:
//   1. el que pide firma DOS autorizaciones: el pago, y una comisión para el relayer;
//   2. la comisión tiene que cubrir el gas estimado con margen, o se rechaza;
//   3. antes de gastar un centavo se SIMULAN las dos con eth_call — si alguna revierte,
//      se rechaza sin haber tocado la cadena;
//   4. sólo se aceptan tokens de una lista blanca: esto no transmite llamadas arbitrarias.
// El reintento no es un riesgo: el nonce de ERC-3009 lo consume el propio token.
import express from 'express';
import cors from 'cors';
import { ethers } from 'ethers';
import fs from 'node:fs';

const PORT = process.env.RELAY_PORT || 3200;

// Límite de tasa. El dinero ya está protegido por la comisión, pero cada pedido dispara
// simulaciones contra el RPC — que son gratis para quien las pide y no para nosotros. Sin
// esto, quemar la cuota del proveedor cuesta un bucle de cinco líneas.
const VENTANA_MS = 60_000, MAX_POR_VENTANA = 20;
const visitas = new Map();
function limitar(req, res, next) {
    const quien = (req.headers['cf-connecting-ip'] || req.ip || 'anon').toString();
    const ahora = Date.now();
    const v = (visitas.get(quien) || []).filter(t => ahora - t < VENTANA_MS);
    if (v.length >= MAX_POR_VENTANA)
        return res.status(429).json({ error: 'demasiados pedidos, probá en un minuto' });
    v.push(ahora); visitas.set(quien, v);
    // Poda: sin esto el Map crece para siempre en un servicio que no se reinicia.
    if (visitas.size > 5000) for (const [k, ts] of visitas)
        if (!ts.some(t => ahora - t < VENTANA_MS)) visitas.delete(k);
    next();
}

// Lista blanca. Sin esto el relayer sería un ejecutor de llamadas arbitrarias pagado por vos.
// Sólo tokens con ERC-3009 verificado (transferWithAuthorization).
const TOKENS = {
    1: { 'USDC': { addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', dec: 6 } },
    8453: { 'USDC': { addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', dec: 6 } },
};
const RPC = {
    1: process.env.RPC_1 || 'https://ethereum-rpc.publicnode.com',
    8453: process.env.RPC_8453 || 'https://mainnet.base.org',
};

const ERC3009_ABI = [
    "function transferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce,uint8 v,bytes32 r,bytes32 s)",
    "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
    "function balanceOf(address) view returns (uint256)",
];

// Cuánto se cobra: el gas estimado con margen. No es una tarifa inventada — si el gas sube
// entre la cotización y el envío, el margen es lo que evita relayear a pérdida.
const MARGEN = 150n;   // 150% del gas estimado
const GAS_POR_AUTORIZACION = 100000n;
// Las dos autorizaciones van en UNA transacción por Multicall3, que está desplegado con la
// misma dirección en toda red EVM. Medido en un fork de Base: 138.670 gas contra 205.704 en
// dos transacciones — 33% menos, porque la segunda llamada encuentra el storage del token ya
// caliente y se paga una sola tarifa base.
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
    "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[])"
];
const GAS_ATOMICO = 145000n;

// ── Contabilidad ───────────────────────────────────────────────────────────
// A propósito NO se guardan direcciones ni hashes de transacción. El relayer ve quién paga y
// quién cobra; escribirlo en un archivo convertiría este servicio en la base de datos de
// vinculación que todo el esquema stealth existe para evitar. Con monto, comisión, gas y
// fecha alcanza para saber cuánto se movió y cuánto se ganó.
const LIBRO = process.env.RELAY_LEDGER || new URL('./libro.jsonl', import.meta.url).pathname;

function anotar(fila) {
    try {
        fs.appendFileSync(LIBRO, JSON.stringify({ ts: Date.now(), ...fila }) + '\n');
    } catch (e) { console.warn('[libro]', e.message); }
}

function leerLibro() {
    try {
        return fs.readFileSync(LIBRO, 'utf8').split('\n').filter(Boolean)
            .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
}

const proveedores = {};
function proveedor(chainId) {
    if (!RPC[chainId]) throw new Error(`red no soportada: ${chainId}`);
    return proveedores[chainId] ||= new ethers.JsonRpcProvider(RPC[chainId]);
}

// ¿Hay Multicall3 en esta red? Se pregunta a la cadena y se cachea: ChatWallet deja agregar
// redes propias, y no todas lo tienen. Sin él se cae a dos transacciones, que funciona igual
// pero no es atómico — y eso hay que decirlo, no esconderlo.
const _multicall = {};
async function hayMulticall(prov) {
    const id = String((await prov.getNetwork()).chainId);
    if (id in _multicall) return _multicall[id];
    try { return _multicall[id] = (await prov.getCode(MULTICALL3)) !== '0x'; }
    catch { return false; }
}

let _firmante = null;
// Perezoso a propósito: el server tiene que poder arrancar sin llave y contestar /info.
// Sólo el endpoint que gasta gas exige la llave. (Misma lección que server.js.)
function firmante(chainId) {
    if (!process.env.RELAYER_PRIVATE_KEY) throw Object.assign(
        new Error('el relayer no tiene llave configurada'), { statusCode: 503 });
    return new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, proveedor(chainId));
}
function direccionRelayer() {
    if (!process.env.RELAYER_PRIVATE_KEY) return null;
    return (_firmante ||= new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY)).address;
}

// Precio en unidades del token que hay que pagarle al relayer por transmitir.
// Se cobra en el MISMO token que se mueve: la dirección stealth no tiene nativo, que es
// todo el motivo por el que existe esto.
export async function cotizar(chainId, simbolo) {
    const t = TOKENS[chainId]?.[simbolo];
    if (!t) throw Object.assign(new Error('token no soportado'), { statusCode: 400 });
    const prov = proveedor(chainId);
    const fee = await prov.getFeeData();
    const precioGas = fee.maxFeePerGas || fee.gasPrice || 0n;
    // Si hay Multicall3 va todo en una y sale más barato: cobrar el precio de dos sería
    // cobrar de más por un trabajo que no se hace.
    const atomico = await hayMulticall(prov);
    const gas = atomico ? GAS_ATOMICO : GAS_POR_AUTORIZACION * 2n;
    const costoNativo = precioGas * gas * MARGEN / 100n;
    // Conversión nativo→token. Sin oráculo se usa una referencia configurable: para el uso
    // real hay que enchufar un precio. Se expone para que el cliente lo vea, no se esconde.
    const usdPorNativo = Number(process.env.NATIVE_USD || 3000);
    const costoUsd = Number(ethers.formatEther(costoNativo)) * usdPorNativo;
    const unidades = BigInt(Math.ceil(costoUsd * 10 ** t.dec));
    // ¿Puede el relayer pagar de verdad en ESTA red? Decir sólo "tengo llave" es inútil: el
    // cliente armaría y firmaría un pedido condenado a fallar. Se informa antes de firmar.
    let saldo = 0n;
    try { const r = direccionRelayer(); if (r) saldo = await prov.getBalance(r); } catch { }
    const porOperacion = precioGas * gas;
    return { chainId, simbolo, token: t.addr, decimales: t.dec, atomico,
             gasPrecio: precioGas.toString(), costoNativo: costoNativo.toString(),
             comision: unidades.toString(), comisionLegible: (Number(unidades) / 10 ** t.dec).toFixed(6),
             relayer: direccionRelayer(), referenciaUsdNativo: usdPorNativo,
             fondeado: saldo >= porOperacion * 3n,   // margen: no aceptar con lo justo para una
             saldoRelayer: ethers.formatEther(saldo),
             operacionesRestantes: porOperacion > 0n ? Number(saldo / porOperacion) : 0 };
}

// Valida la forma del pedido SIN tocar la cadena. Separado a propósito: es lo que se puede
// testear sin red, y es donde vive la defensa contra el abuso.
export function validarPedido(cuerpo, cotizacion) {
    const { chainId, simbolo, pago, comision } = cuerpo || {};
    const err = m => Object.assign(new Error(m), { statusCode: 400 });
    if (!TOKENS[chainId]?.[simbolo]) throw err('token no soportado');
    for (const [n, a] of [['pago', pago], ['comision', comision]]) {
        if (!a) throw err(`falta la autorización de ${n}`);
        for (const k of ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce', 'v', 'r', 's'])
            if (a[k] === undefined || a[k] === null) throw err(`a la autorización de ${n} le falta ${k}`);
        if (!ethers.isAddress(a.from) || !ethers.isAddress(a.to)) throw err(`direcciones inválidas en ${n}`);
    }
    // Las dos tienen que salir de la MISMA dirección: si no, alguien podría hacer que otro
    // pague su comisión.
    if (pago.from.toLowerCase() !== comision.from.toLowerCase())
        throw err('el pago y la comisión tienen que salir de la misma dirección');
    // La comisión tiene que venir a NOSOTROS. Sin esto el relayer paga gas y no cobra.
    const yo = direccionRelayer();
    if (!yo) throw Object.assign(new Error('el relayer no tiene llave configurada'), { statusCode: 503 });
    if (comision.to.toLowerCase() !== yo.toLowerCase())
        throw err('la comisión tiene que ir a la dirección del relayer');
    // Y tiene que alcanzar. Acá es donde se corta el surtidor.
    if (BigInt(comision.value) < BigInt(cotizacion.comision))
        throw err(`la comisión no cubre el gas: se pidió ${cotizacion.comision}, vino ${comision.value}`);
    // Nonces distintos, o el token rechaza la segunda.
    if (String(pago.nonce).toLowerCase() === String(comision.nonce).toLowerCase())
        throw err('las dos autorizaciones no pueden compartir el nonce');
    return true;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.set('trust proxy', true);

app.get('/api/relay/info', limitar, async (req, res) => {
    try {
        const chainId = Number(req.query.chainId || 8453);
        const simbolo = String(req.query.simbolo || 'USDC');
        res.json(await cotizar(chainId, simbolo));
    } catch (e) { res.status(e.statusCode || 500).json({ error: e.message }); }
});

app.post('/api/relay/erc3009', limitar, async (req, res) => {
    try {
        const { chainId, simbolo, pago, comision } = req.body || {};
        const cot = await cotizar(chainId, simbolo);
        // Cortar acá con un motivo claro, en vez de fallar con un error opaco del RPC
        // después de que la persona ya firmó.
        if (!cot.fondeado) {
            anotar({ chainId, simbolo, ok: false, motivo: 'sin-gas' });
            return res.status(503).json({
                error: 'el relayer no tiene gas suficiente en esta red',
                red: chainId, saldo: cot.saldoRelayer, direccion: cot.relayer });
        }
        try { validarPedido(req.body, cot); }
        catch (e) { anotar({ chainId, simbolo, ok: false, motivo: 'rechazado' }); throw e; }

        const w = firmante(chainId);
        const token = new ethers.Contract(cot.token, ERC3009_ABI, w);

        // Simular ANTES de gastar. Si alguna revierte (nonce usado, saldo insuficiente,
        // firma mal armada) se rechaza sin haber puesto un centavo.
        for (const [n, a] of [['pago', pago], ['comision', comision]]) {
            try {
                await token.transferWithAuthorization.staticCall(
                    a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s);
            } catch (e) {
                anotar({ chainId, simbolo, ok: false, motivo: 'simulacion-' + n });
                return res.status(400).json({ error: `la autorización de ${n} no pasa la simulación`,
                                              detalle: String(e.shortMessage || e.message).slice(0, 200) });
            }
        }

        // En UNA transacción, o en ninguna. Con dos transacciones separadas ningún orden es
        // justo: comisión primero cobra aunque el pago falle, pago primero deja al relayer
        // pagando gas de arriba. Multicall3 con allowFailure:false revierte entero.
        // El riesgo se mueve del usuario al relayer, que es donde corresponde: el relayer es
        // el que puede simular antes (y lo hace, arriba) y el que cobra por el servicio.
        if (cot.atomico) {
            const mc = new ethers.Contract(MULTICALL3, MULTICALL3_ABI, w);
            const iface = new ethers.Interface(ERC3009_ABI);
            const dato = a => iface.encodeFunctionData('transferWithAuthorization',
                [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s]);
            const tx = await mc.aggregate3([
                { target: cot.token, allowFailure: false, callData: dato(comision) },
                { target: cot.token, allowFailure: false, callData: dato(pago) },
            ]);
            const rec = await tx.wait();
            anotar({ chainId, simbolo, ok: true, atomico: true,
                     monto: String(pago.value), comision: String(comision.value),
                     gas: rec.gasUsed.toString(),
                     gasWei: (rec.gasUsed * (rec.gasPrice || 0n)).toString() });
            return res.json({ ok: true, atomico: true, tx: tx.hash,
                              bloque: rec.blockNumber, gas: rec.gasUsed.toString() });
        }

        // Sin Multicall3 no hay atomicidad posible. Se avisa en la respuesta en vez de
        // fingir que es lo mismo.
        const txC = await token.transferWithAuthorization(
            comision.from, comision.to, comision.value, comision.validAfter,
            comision.validBefore, comision.nonce, comision.v, comision.r, comision.s);
        await txC.wait();
        const txP = await token.transferWithAuthorization(
            pago.from, pago.to, pago.value, pago.validAfter,
            pago.validBefore, pago.nonce, pago.v, pago.r, pago.s);
        const rec = await txP.wait();

        res.json({ ok: true, atomico: false, txComision: txC.hash, txPago: txP.hash,
                   bloque: rec.blockNumber });
    } catch (e) {
        console.error('[relay]', e);
        res.status(e.statusCode || 500).json({ error: e.message });
    }
});

// ── Métricas ───────────────────────────────────────────────────────────────
// Agregados del libro más el estado en cadena. Lo que NO hay acá —direcciones, hashes— es
// deliberado: ver §Contabilidad.
// El panel se sirve desde acá y no desde el sitio: así ver las métricas no depende de un
// deploy de chatwallet.org, y el relayer se puede mover de máquina sin dejar una página huérfana.
app.get('/', (req, res) => {
    res.sendFile(new URL('./panel.html', import.meta.url).pathname);
});

app.get('/api/relay/metricas', async (req, res) => {
    try {
        const libro = leerLibro();
        const ahora = Date.now(), DIA = 86400000;
        const dec = (chainId, simbolo) => TOKENS[chainId]?.[simbolo]?.dec ?? 6;

        const resumen = (filas) => {
            const okey = filas.filter(f => f.ok);
            let movido = 0n, ganado = 0n, gastado = 0n;
            for (const f of okey) {
                const d = 10n ** BigInt(dec(f.chainId, f.simbolo));
                movido += BigInt(f.monto || 0);
                ganado += BigInt(f.comision || 0);
                gastado += BigInt(f.gasWei || 0);
            }
            const rechazos = {};
            for (const f of filas) if (!f.ok) rechazos[f.motivo || '?'] = (rechazos[f.motivo || '?'] || 0) + 1;
            return {
                operaciones: okey.length, rechazadas: filas.length - okey.length, rechazos,
                movidoUsdc: (Number(movido) / 1e6).toFixed(2),
                ganadoUsdc: (Number(ganado) / 1e6).toFixed(6),
                gastadoEth: ethers.formatEther(gastado),
            };
        };

        // Margen: lo que se ganó en token contra lo que costó en nativo. Sin oráculo se usa
        // la misma referencia con la que se cotiza, y se dice cuál es.
        const usd = Number(process.env.NATIVE_USD || 3000);
        const total = resumen(libro);
        const margenUsd = Number(total.ganadoUsdc) - Number(total.gastadoEth) * usd;

        const redes = {};
        for (const id of Object.keys(TOKENS).map(Number)) {
            try {
                const prov = proveedor(id), r = direccionRelayer();
                const [saldo, fee] = await Promise.all([prov.getBalance(r), prov.getFeeData()]);
                const porOp = (fee.maxFeePerGas || fee.gasPrice || 0n) * GAS_ATOMICO;
                redes[id] = { saldo: ethers.formatEther(saldo),
                              gasGwei: Number((fee.maxFeePerGas || fee.gasPrice || 0n)) / 1e9,
                              operacionesRestantes: porOp > 0n ? Number(saldo / porOp) : 0,
                              multicall: await hayMulticall(prov) };
            } catch (e) { redes[id] = { error: String(e.message).slice(0, 60) }; }
        }

        res.json({
            relayer: direccionRelayer(),
            desde: libro.length ? new Date(libro[0].ts).toISOString() : null,
            total,
            ultimas24h: resumen(libro.filter(f => ahora - f.ts < DIA)),
            ultimos30d: resumen(libro.filter(f => ahora - f.ts < 30 * DIA)),
            margenUsdAprox: margenUsd.toFixed(4), referenciaUsdNativo: usd,
            redes,
            nota: 'sin direcciones ni hashes: el libro no guarda con quién se operó',
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/relay/salud', async (req, res) => {
    const redes = {};
    for (const id of Object.keys(TOKENS).map(Number)) {
        try {
            const r = direccionRelayer();
            redes[id] = r ? ethers.formatEther(await proveedor(id).getBalance(r)) : null;
        } catch { redes[id] = 'sin RPC'; }
    }
    res.json({ ok: true, relayer: direccionRelayer(), conLlave: !!process.env.RELAYER_PRIVATE_KEY,
               saldoPorRed: redes });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => console.log(`relayer en :${PORT}  ·  ${direccionRelayer() || 'SIN LLAVE'}`));
}
export { app, TOKENS, ERC3009_ABI };
