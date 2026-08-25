// Envío de ERC-20 desde el formulario de la wallet.
//
// Lo que se prueba NO es una copia: se extraen las funciones de src/dapp.html y se evalúan,
// así el test verifica el código que se envía y no una réplica que puede derivar.
//
// El bug que motivó esto: executeTransaction armaba { to, value: parseEther(amount) } para
// TODA red. Con "USDC on Base" elegido, eso no mandaba USDC mal: mandaba ETH.
//
//   node tests/erc20-send.mjs

import fs from 'node:fs';
import * as realEthers from 'ethers';

const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');

const DESDE = '// ── ERC-20: el saldo de un token NO es la moneda de la cadena ──';
const HASTA = 'let txWaitTicker = null;';
const i = src.indexOf(DESDE);
const f = src.indexOf(HASTA, i);
if (i < 0 || f < 0) throw new Error('No encontré el bloque ERC-20 en src/dapp.html');
const bloque = src.slice(i, f);

// El bloque usa estos nombres del ámbito del script clásico; se los inyectamos.
function cargar({ ethers, erc20Abi, provider, setTxStatus }) {
    return new Function('ethers', 'erc20Abi', 'provider', 'setTxStatus',
        bloque + '\nreturn { esRedDeToken, decimalesDeToken, enviarToken };'
    )(ethers, erc20Abi, provider, setTxStatus);
}

const erc20Abi = [
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)'
];

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const YO = '0x1111111111111111111111111111111111111111';
const VOS = '0x2222222222222222222222222222222222222222';

const REDES = {
    baseNativa: { TOKEN_CHAIN_NAME: 'Base', TOKEN_CHAINID: '8453', NATIVE_SYMBOL: 'ETH' },
    usdcBase: {
        TOKEN_CHAIN_NAME: 'USDC on Base', TOKEN_CHAINID: '8453', NATIVE_SYMBOL: 'ETH',
        TOKEN_ADDRESS: USDC_BASE, TOKEN_SYMBOL: 'USDC', DECIMALS: 6
    }
};

// Banco de pruebas: contrato y provider falsos, ethers real para todo lo aritmético.
function banco({ decimales = 6n, decimalesFalla = false, saldoToken = 1000000000n,
                 saldoNativo = 10n ** 16n } = {}) {
    const llamadas = [];
    const mensajes = [];
    const contrato = {
        decimals: async () => { if (decimalesFalla) throw new Error('sin red'); return decimales; },
        balanceOf: async (a) => { llamadas.push(['balanceOf', a]); return saldoToken; },
        transfer: Object.assign(
            async (to, monto) => { llamadas.push(['transfer', to, monto]); return { hash: '0xdeadbeef' }; },
            { estimateGas: async () => 60000n }
        )
    };
    const ethers = { ...realEthers, Contract: function () { return contrato; } };
    const provider = {
        getBalance: async () => saldoNativo,
        getFeeData: async () => ({ maxFeePerGas: 10n ** 8n, gasPrice: 10n ** 8n })
    };
    const api = cargar({ ethers, erc20Abi, provider, setTxStatus: (m) => mensajes.push(String(m)) });
    return { api, llamadas, mensajes, signer: { address: YO } };
}

let ok = 0, mal = 0;
const eq = (a, b, t) => (String(a) === String(b) ? ok++ : (mal++, console.error(`✗ ${t}\n    esperaba ${b}\n    obtuve   ${a}`)));
const yes = (c, t) => (c ? ok++ : (mal++, console.error(`✗ ${t}`)));

// ── Qué es una red de token ──────────────────────────────────────────────────
{
    const { api } = banco();
    yes(api.esRedDeToken(REDES.usdcBase) === true, 'USDC on Base es red de token');
    yes(api.esRedDeToken(REDES.baseNativa) === false, 'Base nativa NO es red de token');
    yes(api.esRedDeToken({ TOKEN_ADDRESS: 'no-es-una-address' }) === false, 'address inválida no cuenta');
    yes(api.esRedDeToken(null) === false, 'red nula no rompe');
}

// ── El monto sale con los decimales del TOKEN, no con 18 ─────────────────────
{
    const { api, llamadas, signer } = banco();
    const r = await api.enviarToken(signer, REDES.usdcBase, VOS, '5');
    yes(r && r.hash === '0xdeadbeef', 'la transferencia se transmite');
    const t = llamadas.find(l => l[0] === 'transfer');
    yes(!!t, 'se llamó a transfer()');
    eq(t[1], VOS, 'el destinatario es el contacto, no el contrato');
    eq(t[2], 5000000n, '5 USDC son 5000000 unidades (6 decimales)');
    // Con el bug viejo esto habría sido parseEther('5') = 5e18 en el campo value.
    yes(t[2] !== realEthers.parseEther('5'), 'NO se usa parseEther');
}

// ── El contrato manda sobre el DECIMALS configurado a mano ───────────────────
{
    // Red mal configurada por el usuario: dice 18, el contrato dice 6.
    const malConfig = { ...REDES.usdcBase, DECIMALS: 18 };
    const { api, llamadas, signer } = banco({ decimales: 6n });
    await api.enviarToken(signer, malConfig, VOS, '5');
    eq(llamadas.find(l => l[0] === 'transfer')[2], 5000000n, 'gana decimals() del contrato');
}
{
    // Si decimals() no responde, se cae al configurado en vez de romper.
    const { api, llamadas, signer } = banco({ decimalesFalla: true });
    await api.enviarToken(signer, REDES.usdcBase, VOS, '5');
    eq(llamadas.find(l => l[0] === 'transfer')[2], 5000000n, 'sin decimals() usa el DECIMALS de la red');
}

// ── Los frenos: nada sale si no puede salir bien ─────────────────────────────
{
    const { api, llamadas, mensajes, signer } = banco({ saldoToken: 1000000n });   // 1 USDC
    const r = await api.enviarToken(signer, REDES.usdcBase, VOS, '5');
    eq(r, null, 'saldo de token insuficiente no transmite');
    yes(!llamadas.some(l => l[0] === 'transfer'), 'no se llamó a transfer()');
    yes(/insuficiente/i.test(mensajes.join(' ')), 'avisa que falta saldo');
    yes(/1\.0 USDC/.test(mensajes.join(' ')), 'dice cuánto hay, en unidades del token');
}
{
    const { api, llamadas, mensajes, signer } = banco({ saldoNativo: 0n });
    const r = await api.enviarToken(signer, REDES.usdcBase, VOS, '5');
    eq(r, null, 'sin nativo para el gas no transmite');
    yes(!llamadas.some(l => l[0] === 'transfer'), 'no se llamó a transfer() sin gas');
    yes(/gas/i.test(mensajes.join(' ')), 'el mensaje habla del gas');
    yes(/ETH/.test(mensajes.join(' ')), 'aclara que el gas se paga en la moneda nativa');
}
{
    const { api, mensajes, signer } = banco();
    const r = await api.enviarToken(signer, REDES.usdcBase, VOS, '5.1234567');   // 7 decimales
    eq(r, null, 'más decimales de los que admite el token no transmite');
    yes(/6 decimales/.test(mensajes.join(' ')), 'dice cuántos decimales admite');
}
{
    const { api, mensajes, signer } = banco();
    eq(await api.enviarToken(signer, REDES.usdcBase, VOS, '0'), null, 'monto cero no transmite');
}

// ── El calldata: lo que de verdad viaja (circuito frío y puente) ─────────────
{
    const iface = new realEthers.Interface(erc20Abi);
    const data = iface.encodeFunctionData('transfer', [VOS, 5000000n]);
    eq(data.slice(0, 10), '0xa9059cbb', 'el selector de transfer(address,uint256)');
    eq((data.length - 2) / 2, 68, '4 bytes de selector + 2 palabras de 32');

    // Lo que hace la wallet fría al recibir un CWT1: decodificar antes de firmar.
    const p = iface.parseTransaction({ data });
    eq(p.name, 'transfer', 'la wallet fría reconoce transfer()');
    eq(p.args[0], VOS, 'el destinatario sobrevive al viaje por QR');
    eq(p.args[1], 5000000n, 'el monto sobrevive al viaje por QR');

    // Y no debe aceptar cualquier cosa: approve() se parsea, pero no es transfer.
    const otro = iface.parseTransaction({ data: iface.encodeFunctionData('approve', [VOS, 1n]) });
    yes(otro.name !== 'transfer', 'approve() no pasa por transfer()');
    // Calldata que el ABI no conoce: parseTransaction devuelve null → no se firma.
    eq(iface.parseTransaction({ data: '0x12345678' }), null, 'calldata desconocida no se decodifica');
}

console.log(`\n${mal ? '✗' : '✓'} erc20-send: ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
