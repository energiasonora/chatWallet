// Pago de un QR por P2P.me (orden PAY) de punta a punta contra el Diamond REAL, en un fork de Base.
//
// El motor se EXTRAE de src/dapp.html y se evalúa: se prueba lo que se envía, no una copia.
// Lo único simulado es el comerciante: se toma a uno de los que el contrato dice asignables,
// se lo suplanta en anvil y hace lo que hace su app: acepta la orden publicando una llave,
// descifra el QR (con NUESTRO descifrado y con el del SDK oficial) y la cierra.
//
//   anvil --fork-url https://mainnet.base.org --port 8548 &   node tests/p2p-pago-fork.mjs
//   (o directamente tests/run-p2p-pago-fork.sh)

import fs from 'node:fs';
import * as ethers from 'ethers';
import { decryptPaymentAddress, encryptPaymentAddress, createRelayIdentity } from '@p2pdotme/sdk/orders';

const RPC = process.env.RPC || 'http://127.0.0.1:8548';
const DIAMOND = '0x4cad6eC90e65baBec9335cAd728DDC610c316368';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');
const i = src.indexOf('// ── Motor de pago P2P.me (orden PAY) ─');
const f = src.indexOf('// ── fin del motor de pago P2P.me ──', i);
if (i < 0 || f < 0) throw new Error('No encontré el motor de pago en src/dapp.html');
const motor = new Function('ethers', 'fetch', 'crypto', 'CW_P2P_DIAMOND', 'CW_P2P_USDC', 'window', 'console',
    src.slice(i, f) + '\nreturn { cwP2pPagarQr, cwP2pCifrar, cwP2pDescifrar, cwP2pSobreDestino, cwP2pCotizarPago, cwP2pElegirCircle, CW_P2P_PAGO_ABI };');
const callado = { ...console, warn: () => { } };
const cargar = (fetchFn = fetch) => motor(ethers, fetchFn, globalThis.crypto, DIAMOND, USDC, {}, callado);
const M = cargar();

let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x !== '' ? ' — ' + x : ''}`); if (!c) fallas++; };
const u = v => ethers.formatUnits(v, 6);

// QR con acentos: lo que se cifra son bytes UTF-8 y tiene que volver idéntico.
const QR = '00020101021143530016com.mercadolibre0129https://mpago.la/pos/1370716895011000000000005204970053030325802AR5913CAFÉ MARTÍNEZ6004CABA6304ABCD';

// ── 1. El cifrado, en las dos direcciones contra el SDK oficial ──
{
    const comerciante = createRelayIdentity(), orden = createRelayIdentity();
    const sobre = await M.cwP2pCifrar(comerciante.publicKey, M.cwP2pSobreDestino(orden.privateKey, QR));
    const r = await decryptPaymentAddress({ encrypted: sobre, recipientIdentity: comerciante });
    ok(r.isOk() && r.value === QR, 'lo que ciframos lo descifra el SDK oficial', r.isErr() ? r.error.message : `${sobre.length / 2} bytes`);
    const suyo = await encryptPaymentAddress({ paymentAddress: QR, recipientPublicKey: comerciante.publicKey, senderIdentity: orden });
    const claro = JSON.parse(await M.cwP2pDescifrar(comerciante.privateKey, suyo.value));
    ok(claro.message === QR, 'lo que cifra el SDK lo desciframos nosotros');
    const nuestro = JSON.parse(M.cwP2pSobreDestino(orden.privateKey, QR));
    ok(ethers.recoverAddress(ethers.keccak256(ethers.toUtf8Bytes(QR)), nuestro.signature) === ethers.getAddress(orden.address)
        && nuestro.signature.length === claro.signature.length, 'la firma del QR es de la llave de la orden y tiene la forma de la del SDK');
    let roto = false;
    try { await M.cwP2pDescifrar(comerciante.privateKey, sobre.slice(0, -2) + (sobre.endsWith('00') ? '01' : '00')); } catch { roto = true; }
    ok(roto, 'un sobre tocado no se descifra');
}

// ── 2. El fork ──
const p = new ethers.JsonRpcProvider(RPC, 8453, { staticNetwork: true, cacheTimeout: -1 });
try { await p.getBlockNumber(); } catch { console.log('✗ no hay fork en ' + RPC + ' (ver el encabezado)'); process.exit(2); }
await p.send('anvil_autoImpersonateAccount', [true]);
const d = new ethers.Contract(DIAMOND, [...M.CW_P2P_PAGO_ABI,
    'function acceptOrder(uint256 _orderId,string _userEncUpi,string _pubKey)',
    'function completeOrder(uint256 _orderId,string merchantUpi)'], p);
const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)'], p);
const ARS = ethers.encodeBytes32String('ARS');

async function walletNueva(usdc6, eth = '0.02') {
    const w = ethers.Wallet.createRandom().connect(p);
    await p.send('anvil_setBalance', [w.address, ethers.toQuantity(ethers.parseEther(eth))]);
    // FiatToken v2.2: el saldo vive en el slot 9 (balanceAndBlacklistStates).
    const slot = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [w.address, 9]));
    await p.send('anvil_setStorageAt', [USDC, slot, ethers.toBeHex(usdc6, 32)]);
    return w;
}

// El comerciante de mentira. Devuelve con qué llave aceptó, para descifrar después.
async function comercianteAcepta(orderId) {
    const o = await d.getOrdersById(orderId);
    const llave = createRelayIdentity();
    const candidatos = await d.getAssignableMerchantsFromCircle(o.circleId, 30n, o.currency, o.user, o.amount, o.fiatAmount, 2n, 0n);
    const data = d.interface.encodeFunctionData('acceptOrder', [orderId, '', llave.publicKey]);
    for (const m of candidatos) {
        try {
            await p.call({ from: m, to: DIAMOND, data });
            await p.send('anvil_setBalance', [m, ethers.toQuantity(ethers.parseEther('0.01'))]);
            const h = await p.send('eth_sendTransaction', [{ from: m, to: DIAMOND, data, gas: '0x200000' }]);
            if ((await p.waitForTransaction(h)).status === 1) return { m, llave };
        } catch (e) { }
    }
    throw new Error('ningún comerciante asignable pudo aceptar la orden ' + orderId);
}
async function comercianteCierra(orderId, m) {
    const data = d.interface.encodeFunctionData('completeOrder', [orderId, '']);
    const h = await p.send('eth_sendTransaction', [{ from: m, to: DIAMOND, data, gas: '0x300000' }]);
    return (await p.waitForTransaction(h)).status === 1;
}

// Corre un pago entero con el comerciante de mentira enganchado a los avisos del motor.
async function pagar(w, fiat6, extra = {}) {
    const pasos = [];
    let acepto = null, visto = null, cerro = null;
    const res = await M.cwP2pPagarQr({
        firmante: w, iso: 'ARS', qr: QR, fiat6, cadaMs: 250, esperaAceptarMs: 150000, esperaCierreMs: 60000, ...extra,
        onPaso: (paso, datos) => {
            pasos.push(paso);
            if (paso === 'esperando' && !extra.sinComerciante) acepto = comercianteAcepta(datos.orderId);
            if (paso === 'enviada') cerro = (async () => {
                const { m, llave } = await acepto;
                const o = await d.getOrdersById(datos.orderId);
                const r = await decryptPaymentAddress({ encrypted: o.encUpi, recipientIdentity: llave });
                visto = { sdk: r.isOk() ? r.value : r.error.message, estado: Number(o.status), llaveOrden: o.userPubKey,
                    firmante: ethers.SigningKey.recoverPublicKey(ethers.keccak256(ethers.toUtf8Bytes(QR)), JSON.parse(await M.cwP2pDescifrar(llave.privateKey, o.encUpi)).signature) };
                return comercianteCierra(datos.orderId, m);
            })();
        },
    });
    if (cerro) await cerro;
    return { res, pasos, visto };
}

// ── 3. Pago normal: $ 25.000 (≈ 15,76 USDC, sin comisión) ──
{
    const w = await walletNueva(100_000_000n);
    const fiat6 = 25_000_000_000n;
    const cot = await M.cwP2pCotizarPago(p, 'ARS', fiat6, w.address);
    ok(cot.usdc * cot.venta >= fiat6 * 1_000_000n && (cot.usdc - 1n) * cot.venta < fiat6 * 1_000_000n, 'la cotización redondea el USDC para arriba, lo justo',
        `${u(cot.usdc)} USDC a ${u(cot.venta)} · límite ${u(cot.limite)} · comisión ${u(cot.fee)}`);
    const { res, pasos, visto } = await pagar(w, fiat6);
    ok(pasos.join('>') === 'cotizando>colocando>colocada>aprobando>esperando>aceptada>enviando>enviada>completada', 'pasos en orden', pasos.join(' › '));
    ok(res.estado === 'completada', 'la orden queda COMPLETED', `orden ${res.orderId}`);
    ok(visto?.sdk === QR, 'el comerciante descifra el QR exacto con el SDK oficial', visto?.sdk === QR ? `${QR.length} caracteres` : String(visto?.sdk));
    ok(visto?.estado === 2, 'al mandar el QR la orden pasa a PAID');
    ok(visto?.firmante?.slice(4) === visto?.llaveOrden, 'el QR va firmado por la llave publicada en la orden');
    const o = await d.getOrdersById(res.orderId), x = await d.getAdditionalOrderDetails(res.orderId);
    ok(x.actualFiatAmount === fiat6, 'el comerciante tiene que pagar los pesos EXACTOS del QR', u(x.actualFiatAmount));
    ok(100_000_000n - await usdc.balanceOf(w.address) === res.usdc && res.usdc === x.actualUsdtAmount && res.usdc <= cot.total,
        'de la wallet sale lo que dice la orden, y no más que lo cotizado', `${u(res.usdc)} USDC (cotizado ${u(cot.total)})`);
    ok(await usdc.allowance(w.address, DIAMOND) === 0n, 'no queda permiso de gasto colgado');
    ok(o.userPubKey.length === 128 && !o.userPubKey.includes(w.signingKey.publicKey.slice(4, 40)), 'la llave publicada en la orden no es la de la wallet');
}

// ── 4. Orden chica: $ 5.000 (≈ 3,15 USDC) paga la comisión fija ──
{
    const w = await walletNueva(10_000_000n);
    const fiat6 = 5_000_000_000n;
    const cot = await M.cwP2pCotizarPago(p, 'ARS', fiat6, w.address);
    const { res } = await pagar(w, fiat6);
    const x = await d.getAdditionalOrderDetails(res.orderId);
    ok(res.estado === 'completada' && cot.fee > 0n && x.fixedFeePaid === cot.fee, 'orden chica: se completa y cobra la comisión fija', `${u(cot.fee)} USDC`);
    ok(10_000_000n - await usdc.balanceOf(w.address) === res.usdc && res.usdc <= cot.total && x.actualFiatAmount === fiat6,
        'sale USDC + comisión y los pesos son exactos', `${u(res.usdc)} USDC`);
}

// ── 5. Frenar a tiempo: nadie acepta y el usuario corta → no se manda el QR, ni un USDC menos ──
{
    const w = await walletNueva(50_000_000n);
    let cortar = false;
    const pasos = [];
    const res = await M.cwP2pPagarQr({ firmante: w, iso: 'ARS', qr: QR, fiat6: 20_000_000_000n, cadaMs: 250, cortar: () => cortar,
        onPaso: (paso) => { pasos.push(paso); if (paso === 'esperando') setTimeout(() => { cortar = true; }, 600); } });
    const o = await d.getOrdersById(res.orderId);
    ok(res.estado === 'abandonada' && res.motivo === 'USUARIO' && Number(o.status) === 0 && o.encUpi === '', 'cortar antes de mandar el QR: la orden queda sin QR', pasos.join(' › '));
    ok(await usdc.balanceOf(w.address) === 50_000_000n, 'y el USDC nunca salió de la wallet');
    // El usuario no puede cancelarla (el contrato no lo autoriza): vence sola.
    const dd = new ethers.Contract(DIAMOND, ['function cancelOrder(uint256)', 'function isOrderExpired(uint256) view returns (bool)'], w);
    let puede = true; try { await dd.cancelOrder.staticCall(res.orderId); } catch { puede = false; }
    await p.send('evm_increaseTime', [200]); await p.send('evm_mine', []);
    ok(!puede && await dd.isOrderExpired(res.orderId), 'el contrato no deja cancelarla al usuario, pero a los 180 s está vencida');
}

// ── 6. Rechazos antes de gastar gas ──
{
    const cod = async fn => { try { await fn(); return 'no falló'; } catch (e) { return e.codigo || e.message; } };
    const pobre = await walletNueva(1_000_000n);
    ok(await cod(() => M.cwP2pPagarQr({ firmante: pobre, iso: 'ARS', qr: QR, fiat6: 20_000_000_000n })) === 'SIN_SALDO', 'sin USDC suficiente: SIN_SALDO');
    const sinGas = await walletNueva(50_000_000n, '0');
    ok(await cod(() => M.cwP2pPagarQr({ firmante: sinGas, iso: 'ARS', qr: QR, fiat6: 20_000_000_000n })) === 'SIN_GAS', 'sin ETH para el gas: SIN_GAS');
    const rico = await walletNueva(5_000_000_000n);
    ok(await cod(() => M.cwP2pPagarQr({ firmante: rico, iso: 'ARS', qr: QR, fiat6: 2_000_000_000_000n })) === 'SOBRE_LIMITE', 'por encima del límite de la wallet: SOBRE_LIMITE');
    ok(await p.getTransactionCount(pobre.address) + await p.getTransactionCount(sinGas.address) + await p.getTransactionCount(rico.address) === 0, 'ninguno de los tres llegó a mandar una transacción');
}

// ── 7. Sin subgraph igual encuentra el circle (repuesto validado en cadena) ──
{
    const sinRed = cargar(async () => { throw new Error('subgraph caído'); });
    const w = await walletNueva(50_000_000n);
    const fiat6 = 20_000_000_000n;
    const cot = await sinRed.cwP2pCotizarPago(p, 'ARS', fiat6, w.address);
    const conRed = await M.cwP2pElegirCircle(p, cot, fiat6, w.address);
    const sin = await sinRed.cwP2pElegirCircle(p, cot, fiat6, w.address);
    ok(sin === conRed, 'con el subgraph caído elige el mismo circle', `circle ${sin}`);
}

console.log(fallas ? `\n✗ ${fallas} fallas` : '\n✓ todo bien');
process.exit(fallas ? 1 : 0);
