// La simulación que el modal del puente cw:1 muestra ANTES de firmar.
//
// cwDescribirTx lee el calldata; lo que no sabe leer lo declaraba ilegible y el usuario firmaba
// a ciegas. cwSimularTx ejecuta la tx con eth_simulateV1 en el nodo RPC de la red y traduce los
// logs a "qué les pasa a TUS saldos" y "qué permisos otorgás".
//
// Dos partes:
//   1. Lectura de logs contra un provider falso (determinista, sin red).
//   2. Contra RPCs reales, para fijar las formas de respuesta de las que depende el código:
//      Arbitrum One (revierte / otorga permiso), Base (movimiento nativo) e Infura (no lo
//      soporta). Se saltea con SIN_RED=1.
//
//   node tests/wc-simular-tx.mjs

import fs from 'node:fs';
import * as ethers from 'ethers';

const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');
function trozo(desde, hasta) {
    const i = src.indexOf(desde);
    const f = src.indexOf(hasta, i);
    if (i < 0 || f < 0) throw new Error('No encontré el bloque: ' + desde.slice(0, 40));
    return src.slice(i, f);
}
const bloque =
    trozo('async function decimalesDeToken(', '// Devuelve el txResponse') +
    trozo('// ── Simular antes de firmar: qué les pasaría a TUS saldos ─', 'window.cwSimularTx = cwSimularTx;');

const erc20Abi = [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)'
];
const t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');
const corto = a => String(a).slice(0, 8) + '…';

function cargar(eth = ethers) {
    return new Function('ethers', 'erc20Abi', 'provider', 'setTxStatus', 't', 'wcShortId',
        bloque + '\nreturn { cwSimularTx, cwTextoSimulacion };'
    )(eth, erc20Abi, {}, () => { }, t, corto);
}

let ok = 0, mal = 0;
const eq = (a, b, tt) => (String(a) === String(b) ? ok++ : (mal++, console.error(`✗ ${tt}\n    esperaba ${b}\n    obtuve   ${a}`)));
const yes = (c, tt) => (c ? ok++ : (mal++, console.error(`✗ ${tt}`)));

const YO = '0x2222222222222222222222222222222222222222';
const OTRO = '0x3333333333333333333333333333333333333333';
const TOKEN = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const NFT = '0x4444444444444444444444444444444444444444';
const NATIVO = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const top = a => ethers.zeroPadValue(a, 32);
const num = n => ethers.toBeHex(n, 32);
const TR = ethers.id('Transfer(address,address,uint256)');
const AP = ethers.id('Approval(address,address,uint256)');
const APALL = ethers.id('ApprovalForAll(address,address,bool)');
const T1155 = ethers.id('TransferSingle(address,address,address,uint256,uint256)');

// Provider falso: devuelve lo que se le pida para eth_simulateV1; los contratos contestan
// symbol/decimals según una tabla (por dirección).
function falso({ calls, error, colgado }) {
    const tabla = { [TOKEN]: ['USDC', 6n], [NFT]: ['PUNK', 0n] };
    const contrato = addr => ({
        symbol: async () => { const x = tabla[addr.toLowerCase()]; if (!x) throw new Error('mudo'); return x[0]; },
        decimals: async () => { const x = tabla[addr.toLowerCase()]; if (!x) throw new Error('mudo'); return x[1]; }
    });
    const eth = { ...ethers, Contract: function (addr) { return contrato(addr); } };
    const prov = {
        pedidos: [],
        send: async (m, p) => {
            prov.pedidos.push([m, p]);
            if (colgado) return new Promise(() => { });
            if (error) throw error;
            return [{ calls }];
        }
    };
    return { ...cargar(eth), prov };
}

// ── Qué se le manda al nodo ──────────────────────────────────────────────────
{
    const { cwSimularTx, prov } = falso({ calls: [{ status: '0x1', logs: [] }] });
    await cwSimularTx({ to: TOKEN, data: '0xdeadbeef', value: '0xde0b6b3a7640000' }, YO, prov);
    const [m, p] = prov.pedidos[0];
    eq(m, 'eth_simulateV1', 'usa eth_simulateV1');
    const c = p[0].blockStateCalls[0].calls[0];
    eq(c.from, YO, 'simula desde la wallet del usuario');
    eq(c.value, '0xde0b6b3a7640000', 'el valor viaja como quantity');
    eq(p[0].traceTransfers, true, 'pide los movimientos nativos (traceTransfers)');
    eq(p[1], 'latest', 'contra el último bloque');
}

// ── Saldos: sale token, entra nativo, y lo que no es mío no cuenta ───────────
{
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x1', logs: [
        { address: TOKEN, topics: [TR, top(YO), top(OTRO)], data: num(500_000000n) },
        { address: TOKEN, topics: [TR, top(OTRO), top(YO)], data: num(20_000000n) },
        { address: TOKEN, topics: [TR, top(OTRO), top(OTRO)], data: num(999n) },
        { address: NATIVO, topics: [TR, top(OTRO), top(YO)], data: num(10n ** 17n) },
    ] }] });
    const s = await cwSimularTx({ to: OTRO, data: '0x12345678' }, YO, prov);
    eq(s.estado, 'ok', 'simulación exitosa');
    const usdc = s.cambios.find(c => c.token === TOKEN);
    eq(usdc && usdc.delta, -480_000000n, 'neto del token: −500 +20');
    const eth = s.cambios.find(c => c.token === NATIVO);
    eq(eth && eth.delta, 10n ** 17n, 'entra moneda nativa');
    const txt = cwTextoSimulacion(s, 'ETH');
    yes(txt.includes('− 480.0 USDC'), 'texto: sale USDC con sus decimales reales\n' + txt);
    yes(txt.includes('+ 0.1 ETH'), 'texto: entra ETH con el símbolo de la red');
    yes(txt.includes('wc_sim_caveat'), 'siempre aclara que no es garantía');
    yes(!txt.includes('999'), 'transferencias entre terceros no aparecen');
}

// ── Permisos: el vaciado de mañana ───────────────────────────────────────────
{
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x1', logs: [
        { address: TOKEN, topics: [AP, top(YO), top(OTRO)], data: num(2n ** 256n - 1n) },
        { address: TOKEN, topics: [AP, top(YO), top(OTRO)], data: num(0n) },           // revocación
        { address: NFT, topics: [APALL, top(YO), top(OTRO)], data: num(1n) },
        { address: NFT, topics: [APALL, top(YO), top(OTRO)], data: num(0n) },          // revocación
        { address: NFT, topics: [AP, top(YO), top(OTRO), num(7n)], data: '0x' },        // ERC-721
        { address: TOKEN, topics: [AP, top(OTRO), top(YO)], data: num(5n) },            // permiso ajeno
    ] }] });
    const s = await cwSimularTx({ to: TOKEN, data: '0x12345678' }, YO, prov);
    eq(s.permisos.length, 3, 'tres permisos otorgados (las revocaciones y los ajenos no cuentan)');
    const txt = cwTextoSimulacion(s, 'ETH');
    yes(txt.includes('wc_sim_approve {') && txt.includes('"amount":"wc_tx_unlimited"'), 'el permiso infinito se dice SIN LÍMITE\n' + txt);
    yes(txt.includes('wc_sim_approve_all') && txt.includes('"sym":"PUNK"'), 'ApprovalForAll se nombra');
    yes(txt.includes('wc_sim_approve_nft') && txt.includes('"id":"7"'), 'el approve de un NFT dice cuál');
    yes(!txt.includes('wc_sim_nothing'), 'con permisos no dice "no pasa nada"');
}

// ── NFTs ─────────────────────────────────────────────────────────────────────
{
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x1', logs: [
        { address: NFT, topics: [TR, top(YO), top(OTRO), num(42n)], data: '0x' },
        { address: NFT, topics: [T1155, top(OTRO), top(OTRO), top(YO)], data: abi.encode(['uint256', 'uint256'], [3n, 5n]) },
    ] }] });
    const txt = cwTextoSimulacion(await cwSimularTx({ to: NFT, data: '0x12345678' }, YO, prov), 'ETH');
    yes(txt.includes('− PUNK #42'), 'sale un ERC-721\n' + txt);
    yes(txt.includes('+ 5 × PUNK #3'), 'entran 5 de un ERC-1155');
}

// ── Nada que mostrar ─────────────────────────────────────────────────────────
{
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x1', logs: [] }] });
    const txt = cwTextoSimulacion(await cwSimularTx({ to: OTRO, data: '0x12345678' }, YO, prov), 'ETH');
    yes(txt.includes('wc_sim_nothing'), 'sin logs dice que no mueve nada');
}

// ── Token mudo: se identifica por dirección, no se inventa un símbolo ────────
{
    const MUDO = '0x5555555555555555555555555555555555555555';
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x1', logs: [
        { address: MUDO, topics: [TR, top(YO), top(OTRO)], data: num(10n ** 18n) },
    ] }] });
    const txt = cwTextoSimulacion(await cwSimularTx({ to: MUDO, data: '0x12345678' }, YO, prov), 'ETH');
    yes(txt.includes('− 1.0 0x555555…'), 'sin symbol() usa la dirección\n' + txt);
}

// ── Fracasos: cada uno se dice distinto ──────────────────────────────────────
{
    const { cwSimularTx, cwTextoSimulacion, prov } = falso({ calls: [{ status: '0x0', logs: [],
        error: { code: 3, message: 'execution reverted: ERC20: transfer amount exceeds balance' } }] });
    const s = await cwSimularTx({ to: TOKEN, data: '0x12345678' }, YO, prov);
    eq(s.estado, 'revierte', 'status 0x0 = revierte');
    eq(s.motivo, 'ERC20: transfer amount exceeds balance', 'el motivo sin el prefijo');
    yes(cwTextoSimulacion(s).startsWith('wc_sim_revert'), 'texto de revert');
}
{
    const err = Object.assign(new Error('insufficient funds for intrinsic transaction cost'), { code: 'INSUFFICIENT_FUNDS' });
    const { cwSimularTx, prov } = falso({ error: err });
    eq((await cwSimularTx({ to: TOKEN, data: '0x12' }, YO, prov)).estado, 'sin-fondos', 'el nodo que valida saldo → sin fondos');
}
{
    const err = Object.assign(new Error('could not coalesce error'), { info: { error: { code: -32601, message: 'The method eth_simulateV1 does not exist/is not available' } } });
    const { cwSimularTx, prov } = falso({ error: err });
    eq((await cwSimularTx({ to: TOKEN, data: '0x12' }, YO, prov)).estado, 'no-disponible', 'método inexistente → no disponible');
}
{
    const { cwSimularTx, prov } = falso({ colgado: true });
    const t0 = Date.now();
    const s = await cwSimularTx({ to: TOKEN, data: '0x12' }, YO, prov);
    eq(s.estado, 'no-disponible', 'un nodo colgado no bloquea el modal');
    yes(Date.now() - t0 < 7000, 'corta a los ~6 s');
}

// ── Contra RPCs reales ───────────────────────────────────────────────────────
if (!process.env.SIN_RED) {
    const { cwSimularTx, cwTextoSimulacion } = cargar();
    const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const VACIA = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';   // hardhat #1: sin USDC en Arbitrum
    const DEAD = '0x000000000000000000000000000000000000dEaD';
    const iface = new ethers.Interface(erc20Abi);
    const arb = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc', 42161, { staticNetwork: true });

    const r1 = await cwSimularTx({ to: USDC_ARB, data: iface.encodeFunctionData('transfer', [DEAD, 1n]) }, VACIA, arb);
    eq(r1.estado, 'revierte', '[arb1] transferir USDC que no tenés → revierte');
    yes(/exceeds balance/.test(r1.motivo || ''), '[arb1] con el motivo del contrato: ' + r1.motivo);

    const r2 = await cwSimularTx({ to: USDC_ARB, data: iface.encodeFunctionData('approve', [DEAD, ethers.MaxUint256]) }, VACIA, arb);
    eq(r2.estado, 'ok', '[arb1] approve se simula');
    const p = r2.permisos && r2.permisos[0];
    yes(p && p.sym === 'USDC' && p.spender === DEAD.toLowerCase() && p.monto === ethers.MaxUint256, '[arb1] y aparece el permiso infinito de USDC');
    console.log('\n' + cwTextoSimulacion(r2, 'ETH') + '\n');

    // Base no valida saldo con validation:false: se ve el movimiento nativo aunque la cuenta esté vacía.
    const base = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
    const r3 = await cwSimularTx({ to: DEAD, data: '0x', value: '0x' + (10n ** 16n).toString(16) }, VACIA, base);
    if (r3.estado === 'ok') {
        const n = r3.cambios.find(c => c.token === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
        eq(n && n.delta, -(10n ** 16n), '[base] sale 0.01 ETH (traceTransfers)');
    } else {
        eq(r3.estado, 'sin-fondos', '[base] o el nodo valida el saldo');
    }

    const infura = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/b17405e634bd40308be3eb4fa2485c9a', 11155111, { staticNetwork: true });
    eq((await cwSimularTx({ to: DEAD, data: '0x12' }, VACIA, infura)).estado, 'no-disponible', '[infura] no soporta el método → no disponible');
}

console.log(`\n${mal ? '✗' : '✓'} wc-simular-tx: ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
