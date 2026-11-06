// ¿Qué pasa con el USDC cuando un pago de QR por P2P.me sale mal DESPUÉS de mandar el QR?
// Contra el Diamond REAL en un fork de Base, con el motor extraído de src/dapp.html.
//
//   A. el comerciante recibe el QR y cancela la orden;
//   B. el comerciante recibe el QR y desaparece: la orden vence y cualquiera la barre
//      (autoCancelExpiredOrders, lo mismo que hace el executor de P2P.me);
//   C. la disputa: raiseDispute sobre una orden completada, antes y después de los 30 min.
//
//   tests/run-p2p-cancelacion-fork.sh

import fs from 'node:fs';
import * as ethers from 'ethers';
import { createRelayIdentity } from '@p2pdotme/sdk/orders';

const RPC = process.env.RPC || 'http://127.0.0.1:8548';
const DIAMOND = '0x4cad6eC90e65baBec9335cAd728DDC610c316368';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');
const i = src.indexOf('// ── Motor de pago P2P.me (orden PAY) ─');
const f = src.indexOf('// ── fin del motor de pago P2P.me ──', i);
if (i < 0 || f < 0) throw new Error('No encontré el motor de pago en src/dapp.html');
const M = new Function('ethers', 'fetch', 'crypto', 'CW_P2P_DIAMOND', 'CW_P2P_USDC', 'window', 'console',
    src.slice(i, f) + '\nreturn { cwP2pPagarQr, CW_P2P_PAGO_ABI };')(ethers, fetch, globalThis.crypto, DIAMOND, USDC, {}, { ...console, warn: () => { } });

let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x !== '' ? ' — ' + x : ''}`); if (!c) fallas++; };
const u = v => ethers.formatUnits(v, 6);
const QR = '00020101021143530016com.mercadolibre0129https://mpago.la/pos/1370716895011000000000005204970053030325802AR5913CAFÉ MARTÍNEZ6004CABA6304ABCD';

const p = new ethers.JsonRpcProvider(RPC, 8453, { staticNetwork: true, cacheTimeout: -1 });
try { await p.getBlockNumber(); } catch { console.log('✗ no hay fork en ' + RPC); process.exit(2); }
await p.send('anvil_autoImpersonateAccount', [true]);
const d = new ethers.Contract(DIAMOND, [...M.CW_P2P_PAGO_ABI,
    'function acceptOrder(uint256 _orderId,string _userEncUpi,string _pubKey)',
    'function completeOrder(uint256 _orderId,string merchantUpi)',
    'function cancelOrder(uint256 _orderId)',
    'function autoCancelExpiredOrders(uint256[] orderIds)',
    'function isOrderExpired(uint256 orderId) view returns (bool)',
    'function raiseDispute(uint256 _orderId,uint256 redactTransId)'], p);
const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)'], p);

async function walletNueva(usdc6) {
    const w = ethers.Wallet.createRandom().connect(p);
    await p.send('anvil_setBalance', [w.address, ethers.toQuantity(ethers.parseEther('0.02'))]);
    const slot = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [w.address, 9]));
    await p.send('anvil_setStorageAt', [USDC, slot, ethers.toBeHex(usdc6, 32)]);
    return w;
}
async function como(desde, fn, args) {
    const data = d.interface.encodeFunctionData(fn, args);
    await p.send('anvil_setBalance', [desde, ethers.toQuantity(ethers.parseEther('0.01'))]);
    try { await p.call({ from: desde, to: DIAMOND, data }); } catch (e) { return { ok: false, motivo: e.shortMessage || e.reason || e.message }; }
    const h = await p.send('eth_sendTransaction', [{ from: desde, to: DIAMOND, data, gas: '0x400000' }]);
    return { ok: (await p.waitForTransaction(h)).status === 1 };
}
async function comercianteAcepta(orderId) {
    const o = await d.getOrdersById(orderId);
    const llave = createRelayIdentity();
    for (const m of await d.getAssignableMerchantsFromCircle(o.circleId, 30n, o.currency, o.user, o.amount, o.fiatAmount, 2n, 0n)) {
        if ((await como(m, 'acceptOrder', [orderId, '', llave.publicKey])).ok) return m;
    }
    throw new Error('ningún comerciante pudo aceptar ' + orderId);
}
const avanzar = async s => { await p.send('evm_increaseTime', [s]); await p.send('evm_mine', []); };
const estado = async id => Number((await d.getOrdersById(id)).status);

// Paga hasta mandar el QR; `alEnviar(orderId, comerciante)` decide qué hace el comerciante después.
async function pagarHastaEnviar(w, fiat6, alEnviar, esperaCierreMs = 60000) {
    let acepto = null, despues = null;
    const res = await M.cwP2pPagarQr({
        firmante: w, iso: 'ARS', qr: QR, fiat6, cadaMs: 250, esperaAceptarMs: 150000, esperaCierreMs,
        onPaso: (paso, x) => {
            if (paso === 'esperando') acepto = comercianteAcepta(x.orderId);
            if (paso === 'enviada') despues = acepto.then(m => alEnviar(x.orderId, m));
        },
    });
    return { res, despues: await despues };
}

const INICIAL = 100_000_000n, FIAT = 25_000_000_000n;   // 100 USDC; $ 25.000 ≈ 15 USDC

// ── A. El comerciante recibe el QR y cancela ──
{
    const w = await walletNueva(INICIAL);
    let enCustodia = null;
    const { res, despues } = await pagarHastaEnviar(w, FIAT, async (id, m) => {
        enCustodia = INICIAL - await usdc.balanceOf(w.address);
        return como(m, 'cancelOrder', [id]);
    });
    ok(enCustodia > 0n, 'A · al mandar el QR el USDC sale de la wallet', `${u(enCustodia)} USDC en custodia`);
    ok(despues?.ok, 'A · el comerciante puede cancelar una orden PAID', despues?.motivo || '');
    ok(res.estado === 'cancelada' && res.motivo === 'DESPUES_DE_ENVIAR', 'A · el motor lo ve como cancelada después de enviar', `orden ${res.orderId}`);
    const fin = await usdc.balanceOf(w.address);
    ok(fin === INICIAL, 'A · el USDC vuelve ENTERO a la wallet, comisión incluida (y ChatWallet no cobra nada)', `${u(fin)} de ${u(INICIAL)}`);
}

// ── B. El comerciante recibe el QR y desaparece: vence y se barre ──
{
    const w = await walletNueva(INICIAL);
    const { res } = await pagarHastaEnviar(w, FIAT, async () => null, 1500);
    const id = res.orderId;
    ok(res.estado === 'pendiente' && await estado(id) === 2, 'B · sin cierre del comerciante la orden queda PAID', `orden ${id}`);
    const enCustodia = INICIAL - await usdc.balanceOf(w.address);
    // ¿Cuándo vence una PAID? Se busca el primer minuto en que el contrato la da por vencida.
    let vencio = null, antes = 0;
    for (const min of [5, 10, 15, 30, 60, 120, 360, 1440]) {
        await avanzar((min - antes) * 60); antes = min;
        if (await d.isOrderExpired(id)) { vencio = min; break; }
    }
    ok(vencio !== null, 'B · una orden PAID abandonada termina venciendo', vencio !== null ? `vencida en el tramo de ${vencio} min` : 'no venció ni en un día');
    const extraño = ethers.Wallet.createRandom().address;
    const barrido = await como(extraño, 'autoCancelExpiredOrders', [[id]]);
    ok(barrido.ok && await estado(id) === 4, 'B · cualquiera puede barrerla (autoCancelExpiredOrders) y queda CANCELLED', barrido.motivo || '');
    const fin = await usdc.balanceOf(w.address);
    ok(fin === INICIAL, 'B · y el USDC vuelve entero a la wallet', `${u(fin)} de ${u(INICIAL)} (estuvieron en custodia ${u(enCustodia)})`);
}

// ── C. La disputa: sólo sobre una orden completada y desde los 30 min ──
{
    const w = await walletNueva(INICIAL);
    const { res, despues } = await pagarHastaEnviar(w, FIAT, (id, m) => como(m, 'completeOrder', [id, '']));
    const id = res.orderId;
    ok(despues?.ok && res.estado === 'completada' && await estado(id) === 3, 'C · orden completada (y el motor lo ve)', `orden ${id} · cadena: ${await estado(id)} ${despues?.motivo || ''}`);
    const dw = d.connect(w);
    const temprano = await dw.raiseDispute.staticCall(id, 1234n).then(() => 'pasó', e => e.shortMessage || e.reason || 'revirtió');
    ok(temprano !== 'pasó', 'C · antes de los 30 min el contrato no deja disputar', temprano);
    await avanzar(31 * 60);
    const tx = await dw.raiseDispute(id, 1234n).then(t => t.wait()).then(r => r.status === 1, e => e.shortMessage || e.message);
    const o = await d.getOrdersById(id);
    ok(tx === true && Number(o.disputeInfo.status) === 1, 'C · a los 31 min el usuario abre la disputa desde su wallet', `redactTransId ${o.disputeInfo.redactTransId}, raisedBy ${o.disputeInfo.raisedBy}`);
    const otra = await dw.raiseDispute.staticCall(id, 1234n).then(() => 'pasó', e => e.shortMessage || e.reason || 'revirtió');
    ok(otra !== 'pasó', 'C · no se puede disputar dos veces', otra);
}

console.log(fallas ? `\n✗ ${fallas} fallas` : '\n✓ todo bien');
process.exit(fallas ? 1 : 0);
