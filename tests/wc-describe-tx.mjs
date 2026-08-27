// Lo que el modal del puente cw:1 le dice al usuario ANTES de firmar.
//
// El bug que motivó esto: el resumen se armaba con `tx.value`, que en un ERC-20 es cero. El
// modal decía "0 ETH" mientras el calldata movía 500 USDC. La operación era correcta; la
// pantalla no informaba, y aprobar sin saber qué se aprueba es todo el riesgo del puente.
//
// Se extraen las funciones reales de src/dapp.html (las dos: los helpers de token y el
// descriptor), así el test prueba lo que se envía.
//
//   node tests/wc-describe-tx.mjs

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
    trozo('// ── ERC-20: el saldo de un token NO es la moneda de la cadena ──', 'let txWaitTicker = null;') +
    trozo('// ── Qué dice DE VERDAD la transacción que pide una dApp ─', 'window.cwDescribirTx = cwDescribirTx;');

const erc20Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const VOS = '0x2222222222222222222222222222222222222222';
const iface = new ethers.Interface(erc20Abi);

// `t` devuelve la clave y sus parámetros: así el test verifica QUÉ plantilla se eligió y con
// qué datos, sin depender de la redacción en castellano.
const t = (k, p) => k + (p ? ' ' + JSON.stringify(p) : '');

function cargar({ simbolo = 'USDC', decimales = 6n, tokenMudo = false } = {}) {
    const contrato = {
        symbol: async () => { if (tokenMudo) throw new Error('sin contrato'); return simbolo; },
        decimals: async () => { if (tokenMudo) throw new Error('sin contrato'); return decimales; },
        balanceOf: async () => 0n,
        transfer: Object.assign(async () => ({ hash: '0x' }), { estimateGas: async () => 0n })
    };
    const fakeEthers = {
        ...ethers,
        // Sin runner devuelve la interfaz real (para parsear); con runner, el contrato falso.
        Contract: function (addr, abi, runner) {
            return runner ? contrato : { interface: iface };
        }
    };
    return new Function('ethers', 'erc20Abi', 'provider', 'setTxStatus', 't', 'wcShortId',
        bloque + '\nreturn { cwDescribirTx };'
    )(fakeEthers, erc20Abi, {}, () => { }, t, a => String(a).slice(0, 8) + '…');
}

let ok = 0, mal = 0;
const eq = (a, b, tt) => (String(a) === String(b) ? ok++ : (mal++, console.error(`✗ ${tt}\n    esperaba ${b}\n    obtuve   ${a}`)));
const yes = (c, tt) => (c ? ok++ : (mal++, console.error(`✗ ${tt}`)));

const RED_BNB = { NATIVE_SYMBOL: 'BNB', TOKEN_CHAINID: '56' };
const RED_BASE = { NATIVE_SYMBOL: 'ETH', TOKEN_CHAINID: '8453' };

// ── Nativo: el símbolo sale de la red, no está clavado en "ETH" ──────────────
{
    const { cwDescribirTx } = cargar();
    const d = await cwDescribirTx({ to: VOS, value: '0xde0b6b3a7640000' }, RED_BNB, {});
    yes(d.resumen.includes('1.0 BNB'), 'el resumen usa la moneda de la red: ' + d.resumen);
    yes(!d.resumen.includes('ETH'), 'y no dice ETH en BNB Chain');
    yes(d.cuerpo.startsWith('wc_tx_body'), 'usa la plantilla nativa');
    yes(d.cuerpo.includes('"sym":"BNB"'), 'y le pasa el símbolo correcto');
}

// ── transfer(): el caso que antes mostraba "0 ETH" ───────────────────────────
{
    const { cwDescribirTx } = cargar();
    const data = iface.encodeFunctionData('transfer', [VOS, 500000000n]);   // 500 USDC, 6 dec
    const d = await cwDescribirTx({ to: USDC, value: '0x0', data }, RED_BASE, {});
    yes(d.cuerpo.startsWith('wc_tx_token'), 'usa la plantilla de token');
    yes(d.cuerpo.includes('"amount":"500.0"'), 'el monto sale del calldata: ' + d.cuerpo);
    yes(d.cuerpo.includes('"sym":"USDC"'), 'el símbolo se lee del contrato');
    yes(d.cuerpo.includes('"to":"' + VOS + '"'), 'el destinatario es el del calldata, no el contrato');
    yes(d.cuerpo.includes('"token":"' + USDC + '"'), 'y el contrato del token queda a la vista');
    yes(d.resumen.includes('500.0 USDC'), 'el resumen ya no dice 0 ETH: ' + d.resumen);
    yes(!/0 ETH/.test(d.resumen), 'literalmente: no dice "0 ETH"');
}

// ── approve(): el permiso infinito hay que nombrarlo ─────────────────────────
{
    const { cwDescribirTx } = cargar();
    const infinito = (2n ** 256n) - 1n;
    const data = iface.encodeFunctionData('approve', [VOS, infinito]);
    const d = await cwDescribirTx({ to: USDC, value: '0x0', data }, RED_BASE, {});
    yes(d.cuerpo.startsWith('wc_tx_approve'), 'usa la plantilla de permiso');
    yes(d.cuerpo.includes('wc_tx_unlimited'), 'un permiso infinito se dice SIN LÍMITE');
    eq(d.peligro, true, 'y queda marcado como peligroso');
    yes(d.resumen.startsWith('⚠'), 'el resumen lo distingue de una transferencia');
}
{
    const { cwDescribirTx } = cargar();
    const data = iface.encodeFunctionData('approve', [VOS, 100000000n]);   // 100 USDC
    const d = await cwDescribirTx({ to: USDC, value: '0x0', data }, RED_BASE, {});
    yes(d.cuerpo.includes('"amount":"100.0"'), 'un permiso acotado muestra su tope');
    yes(!d.peligro, 'y no se marca como peligroso');
}

// ── Lo que no se sabe leer se dice ───────────────────────────────────────────
{
    const { cwDescribirTx } = cargar();
    const d = await cwDescribirTx({ to: USDC, value: '0x0', data: '0xdeadbeef' + '11'.repeat(32) }, RED_BASE, {});
    yes(d.cuerpo.startsWith('wc_tx_unknown'), 'calldata desconocida se declara desconocida');
    yes(d.cuerpo.includes('"selector":"0xdeadbeef"'), 'muestra el selector');
    yes(d.cuerpo.includes('"bytes":36'), 'y cuánto se está por firmar');
    yes(d.resumen.startsWith('?'), 'el resumen no aparenta haber entendido');
}

// ── Un token que no contesta no rompe la aprobación ──────────────────────────
{
    const { cwDescribirTx } = cargar({ tokenMudo: true });
    const data = iface.encodeFunctionData('transfer', [VOS, 500000000000000000n]);
    const d = await cwDescribirTx({ to: USDC, value: '0x0', data }, RED_BASE, {});
    yes(d.cuerpo.startsWith('wc_tx_token'), 'sigue describiendo la transferencia');
    yes(d.cuerpo.includes('wc_tx_tokens'), 'sin símbolo dice "tokens" en vez de inventar uno');
    yes(d.cuerpo.includes('"amount":"0.5"'), 'y cae a 18 decimales: ' + d.cuerpo);
}

console.log(`\n${mal ? '✗' : '✓'} wc-describe-tx: ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
