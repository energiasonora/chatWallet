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
