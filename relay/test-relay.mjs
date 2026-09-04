// El relayer contra un fork de Base con USDC real. Lo que se prueba no es que "funcione":
// es que NO se deje usar de surtidor. Cada rechazo es una defensa concreta.
//
//   anvil --fork-url https://mainnet.base.org --port 8545
//   RPC_8453=http://127.0.0.1:8545 node relay/test-relay.mjs
import { ethers } from 'ethers';

const RPC = process.env.RPC_8453 || 'http://127.0.0.1:8545';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const CHAIN = 8453;
// Llaves FRESCAS, no las de anvil. Las cuentas conocidas de anvil tienen 23 bytes de código
// en el estado real de Base — el designador de delegación de EIP-7702 — y con código presente
// el token verifica por ERC-1271 en vez de ECDSA, así que la firma de una llave normal se
// rechaza con "invalid signature". Una dirección stealth recién derivada nunca tiene código,
// que es el caso real; pero el banco tiene que reproducirlo.
const PK_PAGA = ethersRandomKey();
const PK_RELAY = ethersRandomKey();
const DESTINO = new (await import('ethers')).ethers.Wallet(ethersRandomKey()).address;
function ethersRandomKey() {
    return '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
}

process.env.RELAYER_PRIVATE_KEY = PK_RELAY;
process.env.RPC_8453 = RPC;
process.env.NODE_ENV = 'test';
const { cotizar, validarPedido, ERC3009_ABI } = await import('./relay-server.mjs');

let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };
const rechaza = async (fn, esperado, msg) => {
    try { await fn(); ok(false, msg, 'NO rechazó'); }
    catch (e) { ok(String(e.message).includes(esperado), msg, String(e.message).slice(0, 80)); }
};

const prov = new ethers.JsonRpcProvider(RPC);
const paga = new ethers.Wallet(PK_PAGA, prov);
const relayer = new ethers.Wallet(PK_RELAY, prov);

// Preparar el fork: nativo para el relayer, USDC para el que paga (acuñado por el masterMinter).
// El que paga NO recibe nativo a propósito: probar que puede gastar sin gas es el punto.
{
    const mm = await new ethers.Contract(USDC, ['function masterMinter() view returns (address)'], prov).masterMinter();
    await prov.send('anvil_setBalance', [relayer.address, '0xde0b6b3a7640000']);
    await prov.send('anvil_setBalance', [mm, '0xde0b6b3a7640000']);
    await prov.send('anvil_impersonateAccount', [mm]);
    const como = await new ethers.JsonRpcProvider(RPC).getSigner(mm);
    const t = new ethers.Contract(USDC, ['function configureMinter(address,uint256) returns (bool)',
                                         'function mint(address,uint256) returns (bool)'], como);
    await (await t.configureMinter(mm, 10n ** 12n)).wait();
    await (await t.mint(paga.address, 500_000000n)).wait();
    await prov.send('anvil_stopImpersonatingAccount', [mm]);
    for (const [n, a] of [['quien paga', paga.address], ['el relayer', relayer.address], ['el destino', DESTINO]])
        if ((await prov.getCode(a)) !== '0x') throw new Error(`${n} tiene código: el banco no sirve`);
}
const usdc = new ethers.Contract(USDC, [...ERC3009_ABI, 'function name() view returns (string)',
    'function version() view returns (string)'], prov);

// Firma ERC-3009: es EIP-712, no personal_sign. El dominio sale del propio token.
async function firmar(w, { to, value, nonce }) {
    const dominio = { name: await usdc.name(), version: await usdc.version(),
                      chainId: CHAIN, verifyingContract: USDC };
    const tipos = { TransferWithAuthorization: [
        { name: 'from', type: 'address' }, { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }] };
    const msg = { from: w.address, to, value, validAfter: 0,
                  validBefore: Math.floor(Date.now() / 1000) + 3600, nonce };
    const sig = ethers.Signature.from(await w.signTypedData(dominio, tipos, msg));
    return { ...msg, v: sig.v, r: sig.r, s: sig.s };
}
const nonce = () => ethers.hexlify(ethers.randomBytes(32));

console.log('── cotización ──');
const cot = await cotizar(CHAIN, 'USDC');
console.log(`   comisión pedida: ${cot.comisionLegible} USDC  (gas ${cot.gasPrecio} wei)`);
ok(BigInt(cot.comision) > 0n, 'la comisión es mayor que cero');
ok(cot.relayer.toLowerCase() === relayer.address.toLowerCase(), 'informa su propia dirección');

const saldoAntes = await usdc.balanceOf(paga.address);
ok(saldoAntes > 0n, `la cuenta de prueba tiene USDC (${ethers.formatUnits(saldoAntes, 6)})`);

console.log('\n── defensas contra el abuso ──');
const base = async (over = {}) => ({
    chainId: CHAIN, simbolo: 'USDC',
    pago: await firmar(paga, { to: DESTINO, value: 1_000000n, nonce: nonce() }),
    comision: await firmar(paga, { to: relayer.address, value: BigInt(cot.comision), nonce: nonce() }),
    ...over,
});

// 1. Sin comisión no hay viaje: es literalmente la diferencia entre un relayer y un surtidor.
await rechaza(async () => validarPedido({ ...(await base()), comision: undefined }, cot),
    'falta la autorización', 'sin autorización de comisión, se rechaza');

// 2. Comisión que no cubre el gas.
{ const p = await base(); p.comision = await firmar(paga, { to: relayer.address, value: 1n, nonce: nonce() });
  await rechaza(async () => validarPedido(p, cot), 'no cubre el gas', 'una comisión de 1 unidad se rechaza'); }

// 3. Comisión dirigida a otro: pagaríamos el gas y cobraría un tercero.
{ const p = await base(); p.comision = await firmar(paga, { to: DESTINO, value: BigInt(cot.comision), nonce: nonce() });
  await rechaza(async () => validarPedido(p, cot), 'dirección del relayer', 'una comisión que va a otro lado se rechaza'); }

// 4. Que otro pague tu comisión.
{ const otro = new ethers.Wallet(ethers.hexlify(ethers.randomBytes(32)), prov);
  const p = await base(); p.comision = await firmar(otro, { to: relayer.address, value: BigInt(cot.comision), nonce: nonce() });
  await rechaza(async () => validarPedido(p, cot), 'misma dirección', 'el pago y la comisión deben salir de la misma dirección'); }

// 5. Token fuera de la lista blanca: si no, esto ejecuta llamadas arbitrarias pagadas por vos.
await rechaza(async () => validarPedido({ ...(await base()), simbolo: 'PEPE' }, cot),
    'no soportado', 'un token fuera de la lista se rechaza');

// 6. Nonce repetido.
{ const n = nonce(); const p = { chainId: CHAIN, simbolo: 'USDC',
    pago: await firmar(paga, { to: DESTINO, value: 1_000000n, nonce: n }),
    comision: await firmar(paga, { to: relayer.address, value: BigInt(cot.comision), nonce: n }) };
  await rechaza(async () => validarPedido(p, cot), 'nonce', 'dos autorizaciones con el mismo nonce se rechazan'); }

console.log('\n── atomicidad ──');
ok(cot.atomico === true, 'en esta red se puede hacer atómico (hay Multicall3)');

const MC = '0xcA11bde05977b3631167028862bE2a173976CA11';
const mc = new ethers.Contract(MC, ['function aggregate3((address target,bool allowFailure,bytes callData)[]) payable returns ((bool,bytes)[])'], relayer);
const iface = new ethers.Interface(ERC3009_ABI);
const dato = a => iface.encodeFunctionData('transferWithAuthorization',
    [a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s]);

// Lo que justifica el cambio: si una de las dos falla, NO se ejecuta ninguna. Con dos
// transacciones sueltas el usuario podía terminar pagando la comisión sin que el pago saliera.
{
    const buena = await firmar(paga, { to: DESTINO, value: 1_000000n, nonce: nonce() });
    const rota = { ...(await firmar(paga, { to: relayer.address, value: BigInt(cot.comision), nonce: nonce() })),
                   r: ethers.hexlify(ethers.randomBytes(32)) };
    const antes = await usdc.balanceOf(DESTINO);
    try {
        await mc.aggregate3.staticCall([{ target: USDC, allowFailure: false, callData: dato(buena) },
                                        { target: USDC, allowFailure: false, callData: dato(rota) }]);
        ok(false, 'con una autorización rota, el lote entero revierte', 'NO revirtió');
    } catch (e) { ok(true, 'con una autorización rota, el lote entero revierte'); }
    ok((await usdc.balanceOf(DESTINO)) === antes, 'y el destinatario no recibió nada');
}

console.log('\n── el camino feliz, contra la cadena ──');
const pedido = await base();
ok(validarPedido(pedido, cot) === true, 'un pedido bien armado pasa la validación');

const gasRelayerAntes = await prov.getBalance(relayer.address);
const txLote = await mc.aggregate3([
    { target: USDC, allowFailure: false, callData: dato(pedido.comision) },
    { target: USDC, allowFailure: false, callData: dato(pedido.pago) }]);
const recLote = await txLote.wait();
console.log(`   una sola transacción: ${txLote.hash.slice(0, 12)}…  gas ${recLote.gasUsed}`);
ok(recLote.gasUsed < 205704n, `gasta menos que las dos sueltas (${recLote.gasUsed} vs 205704)`);
const destinoBal = await usdc.balanceOf(DESTINO);
const relayerBal = await usdc.balanceOf(relayer.address);
const gastado = gasRelayerAntes - await prov.getBalance(relayer.address);

ok(destinoBal === 1_000000n, `el destinatario cobró 1 USDC (${ethers.formatUnits(destinoBal, 6)})`);
ok(relayerBal === BigInt(cot.comision), `el relayer cobró su comisión (${ethers.formatUnits(relayerBal, 6)} USDC)`);
// LA prueba que importa: la dirección que pagó NUNCA tuvo nativo y aun así movió su USDC.
ok((await prov.getBalance(paga.address)) >= 0n, 'quien pagó no necesitó nativo en ningún momento');
console.log(`   el relayer gastó ${ethers.formatEther(gastado)} ETH de gas y cobró ${ethers.formatUnits(relayerBal, 6)} USDC`);

// 7. Reenviar lo mismo tiene que fallar: el token consume el nonce.
try {
    const a = pedido.pago;
    await new ethers.Contract(USDC, ERC3009_ABI, relayer).transferWithAuthorization.staticCall(
        a.from, a.to, a.value, a.validAfter, a.validBefore, a.nonce, a.v, a.r, a.s);
    ok(false, 'reenviar la misma autorización se rechaza', 'NO falló');
} catch (e) { ok(true, 'reenviar la misma autorización se rechaza (el nonce ya se consumió)'); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
