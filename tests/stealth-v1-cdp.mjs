// El circuito stealth dentro de la app: derivar, pagar y reconocer.
// No mira la UI: ejercita las funciones reales de dapp.html y las contrasta con los vectores
// publicados en github.com/energiasonora/stealthpay. Si las dos definiciones se separan, salta.
const CDP = process.env.CDP || 'http://127.0.0.1:9349';
const BASE = process.env.BASE_URL || 'http://localhost:8837';
const PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const page = (await (await fetch(`${CDP}/json/list`)).json()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const rpc = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async expr => {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    const ex = r.result?.exceptionDetails;
    if (ex) throw new Error('EXCEPCIÓN: ' + (ex.exception?.description || ex.text).slice(0, 400));
    return r.result?.result?.value;
};

await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)}); true`);
await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(7000);
ok(await ev(`!!window.currentWallet`), 'la billetera cargó');

// ── el mensaje y las constantes salen del spec ──
console.log('\n── constantes (StealthPay v1) ──');
const k = await ev(`(() => ({ msg: STEALTHPAY_V1_MESSAGE, ann: STEALTH_ANNOUNCER, scheme: STEALTH_SCHEME_ID }))()`);
ok(k.msg === 'ChatWallet StealthPay v1 — Key Derivation', 'el mensaje de derivación es el del spec', JSON.stringify(k.msg));
ok(k.ann === '0x55649E01B5Df198D18D95b5cc5051630cfD45564', 'el Announcer es el canónico de ERC-5564', k.ann);
ok(k.scheme === 1, 'schemeId 1 (secp256k1 con view tag)');

// ── derivación: mismas llaves que publica el spec ──
console.log('\n── derivación ──');
const META_SPEC = '0x02de477c92f9069ea18ecba4ebd93f1c324124975cd3828946b0dd63967787637c'
                + '02278de5845e02753c0d5a753975a7b411318ea24195fa2e70a1a2a73ac1d22a7a';
const llaves = await ev(`(async () => {
    const l = await derivarLlavesStealth();
    const sp = new ethers.Wallet(l.spendPriv).signingKey.compressedPublicKey;
    const vw = new ethers.Wallet(l.viewPriv).signingKey.compressedPublicKey;
    return { meta: sp + vw.slice(2), spendPriv: l.spendPriv };
})()`);
ok(llaves.meta === META_SPEC, 'la meta-address es la del vector publicado', llaves.meta.slice(0, 22) + '…');

// ── el circuito completo: pagarme a mí mismo y reconocerlo ──
// Se recorre la MISMA matemática que usa executeTransaction, sin tocar la red.
console.log('\n── emisor → receptor ──');
const circuito = await ev(`(async () => {
    const meta = ${JSON.stringify(META_SPEC)};
    const pubSpend = '0x' + meta.slice(2, 68), pubView = '0x' + meta.slice(68);
    const eph = window.Wallet.createRandom();
    const R = eph.signingKey.compressedPublicKey;
    const viewPoint = ec.keyFromPublic(pubView.slice(2), 'hex').getPublic();
    const s = ethers.keccak256('0x' + viewPoint.mul(eph.privateKey.slice(2)).encodeCompressed('hex'));
    const spendPoint = ec.keyFromPublic(pubSpend.slice(2), 'hex').getPublic();
    const stealthAddr = computeAddress('0x' + spendPoint.add(ec.g.mul(s.slice(2))).encodeCompressed('hex'));
    const viewTag = '0x' + s.slice(2, 4);

    // El receptor, con la función real de la app:
    const priv = await llaveDePagoStealth(R, stealthAddr);
    // Y un aviso mentiroso: misma llave efímera, otra dirección.
    const mentira = await llaveDePagoStealth(R, '0x000000000000000000000000000000000000dEaD');
    return { stealthAddr, R, viewTag, priv, mentira,
             addrDeLaPriv: priv ? new ethers.Wallet(priv).address : null };
})()`);
ok(!!circuito.priv, 'el receptor reconoce el pago como suyo');
ok(circuito.addrDeLaPriv === circuito.stealthAddr,
    'y la llave que deriva controla exactamente esa dirección', circuito.stealthAddr);
ok(circuito.mentira === null, 'un aviso con dirección falseada se rechaza');
ok(/^0x[0-9a-f]{2}$/.test(circuito.viewTag), 'el view tag es un byte', circuito.viewTag);

// ── el aviso cw:3 se verifica, no se cree ──
console.log('\n── cw:3 ──');
const guardados = await ev(`(async () => {
    localStorage.removeItem(STEALTH_RECIBIDOS_KEY());
    // Uno legítimo y uno inventado por un atacante.
    await handleStealthPayment(null, { cw: 3, type: 'stealth_payment',
        stealthAddress: ${JSON.stringify(circuito.stealthAddr)},
        ephemeralPubKey: ${JSON.stringify(circuito.R)}, chainId: '8453', amount: '0.01' });
    await handleStealthPayment(null, { cw: 3, type: 'stealth_payment',
        stealthAddress: '0x000000000000000000000000000000000000dEaD',
        ephemeralPubKey: ${JSON.stringify(circuito.R)}, chainId: '8453', amount: '99' });
    return stealthRecibidos();
})()`);
ok(guardados.length === 1, `sólo se guarda el aviso que verifica (${guardados.length})`);
ok(guardados[0] && guardados[0].stealthAddress === circuito.stealthAddr, 'y es el legítimo');
ok(guardados[0] && !('privateKey' in guardados[0]),
    'no se persiste ninguna llave privada: se re-deriva de la semilla', JSON.stringify(Object.keys(guardados[0] || {})));

// ── el escáner y la fila de saldo ──
console.log('\n── escáner y saldo ──');
const esc = await ev(`(() => ({
    escaner: typeof escanearPagosStealth === 'function',
    registrar: typeof registrarStealthRecibido === 'function',
    render: typeof renderStealthBalance === 'function',
    mc: MULTICALL3, chunk: STEALTH_SCAN_CHUNK,
}))()`);
ok(esc.escaner && esc.registrar && esc.render, 'las tres piezas existen');
ok(esc.mc === '0xcA11bde05977b3631167028862bE2a173976CA11', 'Multicall3 canónico', esc.mc);
ok(esc.chunk > 0 && esc.chunk <= 10000, `el rango de bloques respeta el límite de los RPC públicos (${esc.chunk})`);

// El registro es idempotente: el escáner y el cw:3 escriben en el mismo lugar y el mismo
// pago puede llegar por los dos caminos.
const dedup = await ev(`(() => {
    localStorage.removeItem(STEALTH_RECIBIDOS_KEY());
    const p = { stealthAddress: '0x1111111111111111111111111111111111111111',
                ephemeralPubKey: '0x02' + '11'.repeat(32), chainId: '8453', ts: Date.now() };
    const a = registrarStealthRecibido(p);
    const b = registrarStealthRecibido(p);                       // mismo pago, otra vía
    const c = registrarStealthRecibido({ ...p, chainId: '1' });  // otra red: es otro pago
    return { a, b, c, total: stealthRecibidos().length };
})()`);
ok(dedup.a === true, 'el primero se guarda');
ok(dedup.b === false, 'el mismo pago por la otra vía no se duplica');
ok(dedup.c === true, 'la misma dirección en otra red sí es otro pago');
ok(dedup.total === 2, `quedan 2 registros (${dedup.total})`);

// El barrido hacia atrás: sin él, restaurar la wallet en un teléfono nuevo sólo encontraría
// los pagos de los últimos días. Marcado como 'completo' no debe volver a trabajar.
const atras = await ev(`(async () => {
    localStorage.setItem(STEALTH_BACKFILL_CKPT('8453'), 'completo');
    const n = await barrerHaciaAtras(null, null, '8453', '0x' + '11'.repeat(32), null);
    return { conCompleto: n, marca: localStorage.getItem(STEALTH_BACKFILL_CKPT('8453')) };
})()`);
ok(typeof atras.conCompleto === 'number' && atras.conCompleto === 0,
    'marcado completo, el barrido hacia atrás no vuelve a trabajar');
ok(atras.marca === 'completo', 'y la marca se conserva');
ok(await ev(`typeof barrerHaciaAtras === 'function'`), 'el barrido hacia atrás existe');

// La fila se esconde cuando no hay nada: mostrar "0" invitaría a preguntarse dónde está.
const fila = await ev(`(async () => {
    localStorage.removeItem(STEALTH_RECIBIDOS_KEY());
    await renderStealthBalance();
    return document.getElementById('stealthWalletBalanceDisplay').classList.contains('hidden');
})()`);
ok(fila === true, 'sin pagos privados, la fila no aparece');

// ── selección de monedas ──
// Acá vive la propiedad de privacidad: preferir SIEMPRE una sola dirección. Juntar varias
// las vincula entre sí, así que el algoritmo tiene que evitarlo cuando puede y decirlo
// cuando no. Se le enchufan saldos fijos para no depender de la red.
console.log('\n── selección de monedas ──');
const sel = await ev(`(async () => {
    const red = { chainId: 8453, NATIVE_SYMBOL: 'ETH', TOKEN_ADDRESS: null };
    const E = n => ethers.parseEther(n);
    // Se reemplaza la lectura de saldos: lo que se prueba es la ELECCIÓN, no el RPC.
    window.saldosStealth = async () => ({
        esToken: false, decimales: 18,
        detalle: [{ dir: '0x' + '11'.repeat(20), v: E('0.10') },
                  { dir: '0x' + '22'.repeat(20), v: E('0.50') },
                  { dir: '0x' + '33'.repeat(20), v: E('0.30') },
                  { dir: '0x' + '44'.repeat(20), v: E('0.0000001') }],  // polvo: no cubre ni el gas
        dirs: [1,2,3,4], total: E('0.9'),
    });
    window.costoDeGasAprox = async () => E('0.00001');
    const r = {};
    for (const [k, monto] of [['chico','0.05'], ['casiJusto','0.29'], ['justo','0.30'], ['medio','0.35'],
                              ['grande','0.85'], ['imposible','5']]) {
        const x = await seleccionarMonedas(monto, red);
        r[k] = { alcanza: x.alcanza, une: x.une || 0, polvo: x.polvo,
                 dirs: (x.monedas||[]).map(m => m.dir.slice(0,4)),
                 suma: (x.monedas||[]).reduce((a,m)=>a+m.enviar, 0n).toString() };
    }
    return r;
})()`);

// 0.05 entra en la de 0.10: tiene que elegir ESA, no la más grande. Gastar la de 0.50 para
// pagar 0.05 deja una moneda grande partida y desperdicia la chica.
ok(sel.chico.alcanza && sel.chico.une === 1, 'un pago chico sale de una sola dirección');
ok(sel.chico.dirs[0] === '0x11', 'y elige la más chica que alcanza, no la más grande', JSON.stringify(sel.chico.dirs));

ok(sel.casiJusto.alcanza && sel.casiJusto.une === 1, '0.29 entra en una sola');
ok(sel.casiJusto.dirs[0] === '0x33', 'y es la de 0.30, la más chica que alcanza', JSON.stringify(sel.casiJusto.dirs));

// Una moneda NO puede enviar su saldo completo: reserva su propio gas. Pedirle exactamente
// 0.30 a la moneda de 0.30 es imposible, y la selección lo respeta subiendo a la siguiente
// en vez de armar un pago que fallaría recién al ejecutarse.
ok(sel.justo.alcanza && sel.justo.une === 1, '0.30 exacto se paga con una sola');
ok(sel.justo.dirs[0] === '0x22',
    'pero desde la de 0.50: la de 0.30 no puede enviar su saldo entero, guarda el gas',
    JSON.stringify(sel.justo.dirs));

// 0.35 no entra en ninguna sola (la mayor es 0.50 pero menos gas… sí entra). Verificamos
// que igual prefiera una sola antes que juntar.
ok(sel.medio.alcanza && sel.medio.une === 1, '0.35 entra en la de 0.50: una sola, no dos');

// 0.85 obliga a juntar. Tiene que usar las MENOS posibles: 0.50 + 0.30 + 0.10.
ok(sel.grande.alcanza, '0.85 se puede pagar juntando');
ok(sel.grande.une === 3, `junta 3 direcciones, no más (${sel.grande.une})`);

ok(!sel.imposible.alcanza, 'un monto que no alcanza se rechaza, no se paga a medias');
ok(sel.chico.polvo === 1, `el polvo se cuenta aparte: no cubre ni su propio gas (${sel.chico.polvo})`);

// La suma de lo elegido tiene que ser EXACTAMENTE el objetivo: ni de menos (pago incompleto)
// ni de más (regalarle plata al destinatario).
const objetivo = await ev(`ethers.parseEther('0.85').toString()`);
ok(sel.grande.suma === objetivo, 'lo elegido suma exactamente el monto pedido', objetivo);

// ── ya no queda nada del registry propio ──
console.log('\n── el registry viejo se fue ──');
const viejo = await ev(`(() => ({
    abi: typeof REGISTRY_ABI !== 'undefined',
    campo: !!document.getElementById('registry-addr'),
}))()`);
ok(!viejo.abi, 'REGISTRY_ABI ya no existe');
ok(!viejo.campo, 'ni el campo que pedía la dirección a mano');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
