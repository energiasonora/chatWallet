// El cableado del relayer, desde la app, contra un fork de Base con USDC real.
// Lo que se prueba es la promesa entera: una dirección stealth SIN nativo paga USDC.
// Si esto pasa, la fila de StealthWallet puede dejar de decir "en espera".
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8841';
const FORK = 'http://127.0.0.1:8545';
const RELAY = 'http://127.0.0.1:3300';
const RELAYER_ADDR = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';   // llave de prueba del relayer local
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const execMod = await import('node:child_process');
const execSyncPre = c => execMod.execSync(c).toString().trim().split(/\s+/)[0];

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-relaycli-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--remote-debugging-port=9399', `--user-data-dir=${dir}`, 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
        const l = await (await fetch('http://127.0.0.1:9399/json/list')).json();
        const p = l.find(t => t.type === 'page');
        if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
            ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
            break; }
    } catch { }
}
const rpc = (m, p = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
await rpc('Page.enable'); await rpc('Runtime.enable');
const ev = async x => {
    const r = await rpc('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true });
    const e = r.result?.exceptionDetails;
    if (e) throw new Error('EXCEPCIÓN: ' + (e.exception?.description || e.text).slice(0, 400));
    return r.result?.result?.value;
};

try {
    // Una wallet de prueba; su dirección stealth sale de la derivación real de la app.
    const semilla = '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('');
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(2500);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(semilla)}); true`);
    await rpc('Page.navigate', { url: BASE + '/dapp.html' }); await sleep(8000);
    ok(await ev(`!!window.currentWallet`), 'la app cargó con la wallet de prueba');

    // Apuntar la app al fork y al relayer local. RELAY_BASE es const: se pisa el fetch.
    await ev(`
        provider = new window.ethers.JsonRpcProvider(${JSON.stringify(FORK)});
        optionsList[currentTokenIndex] = Object.assign({}, optionsList[currentTokenIndex],
            { chainId: 8453, NAME: 'Base', NATIVE_SYMBOL: 'ETH',
              TOKEN_ADDRESS: ${JSON.stringify(USDC)}, TOKEN_SYMBOL: 'USDC', TOKEN_DECIMALS: 6 });
        const _f = window.fetch;
        window.fetch = (u, o) => _f(String(u).replace('https://relay.chatwallet.org', ${JSON.stringify(RELAY)}), o);
        true`);

    // Fabricar un pago stealth recibido: se deriva con las funciones REALES de la app.
    const pago = await ev(`(async () => {
        const { spendPriv, viewPriv } = await derivarLlavesStealth();
        const spendPub = new ethers.Wallet(spendPriv).signingKey.compressedPublicKey;
        const viewPub  = new ethers.Wallet(viewPriv).signingKey.compressedPublicKey;
        const meta = spendPub + viewPub.slice(2);
        const eph = window.Wallet.createRandom();
        const R = eph.signingKey.compressedPublicKey;
        const vp = ec.keyFromPublic(viewPub.slice(2), 'hex').getPublic();
        const s = ethers.keccak256('0x' + vp.mul(eph.privateKey.slice(2)).encodeCompressed('hex'));
        const sp = ec.keyFromPublic(spendPub.slice(2), 'hex').getPublic();
        const dir = computeAddress('0x' + sp.add(ec.g.mul(s.slice(2))).encodeCompressed('hex'));
        localStorage.removeItem(STEALTH_RECIBIDOS_KEY());
        registrarStealthRecibido({ stealthAddress: dir, ephemeralPubKey: R, chainId: '8453', ts: Date.now() });
        return { dir, priv: await llavePrivadaDeStealth(dir) };
    })()`);
    ok(!!pago.priv, 'la app deriva la llave de su dirección stealth', pago.dir);
    ok(new (await import('ethers')).ethers.Wallet(pago.priv).address === pago.dir,
        'y esa llave controla esa dirección');
    console.log(`   dirección stealth: ${pago.dir}`);
    process.env.__DIR = pago.dir;
    fs.writeFileSync('/tmp/stealth-dir.txt', pago.dir);

    // Fondear esa dirección con USDC (y con CERO nativo: es el punto).
    const { execSync } = execMod;
    const mm = execSync(`cast call ${USDC} "masterMinter()(address)" --rpc-url ${FORK}`).toString().trim().split(/\s+/)[0];
    execSync(`cast rpc anvil_impersonateAccount ${mm} --rpc-url ${FORK}`, { stdio: 'ignore' });
    execSync(`cast rpc anvil_setBalance ${mm} 0xde0b6b3a7640000 --rpc-url ${FORK}`, { stdio: 'ignore' });
    execSync(`cast send ${USDC} "configureMinter(address,uint256)" ${mm} 1000000000000 --from ${mm} --unlocked --rpc-url ${FORK}`, { stdio: 'ignore' });
    execSync(`cast send ${USDC} "mint(address,uint256)" ${pago.dir} 20000000 --from ${mm} --unlocked --rpc-url ${FORK}`, { stdio: 'ignore' });
    const nativo = execSync(`cast balance ${pago.dir} --rpc-url ${FORK}`).toString().trim();
    const usdcBal = execSync(`cast call ${USDC} "balanceOf(address)(uint256)" ${pago.dir} --rpc-url ${FORK}`).toString().trim().split(/\s+/)[0];
    ok(usdcBal === '20000000', `la dirección stealth tiene 20 USDC (${usdcBal})`);
    ok(nativo === '0', 'y CERO nativo: no puede pagar su propio gas', nativo);

    // La fila deja de decir "en espera" porque hay relayer fondeado.
    const fila = await ev(`(async () => { await renderStealthBalance();
        const f = document.getElementById('stealthWalletBalanceDisplay');
        return { oculta: f.classList.contains('hidden'), gastable: f.dataset.gastable,
                 estado: document.getElementById('stealthWalletBalanceState').textContent,
                 valor: document.getElementById('stealthWalletBalanceValue').textContent }; })()`);
    ok(fila.gastable === '1', 'la fila dice GASTABLE, no "en espera"', JSON.stringify(fila));

    // ── El camino de la UI ──
    // Lo anterior probó la función. Esto prueba lo que de verdad usa una persona: el selector
    // "Privado", la selección de monedas, y el aviso ANTES de confirmar.
    console.log('\n── desde la interfaz ──');
    const ui = await ev(`(async () => {
        await refrescarOrigenFondos();
        const caja = document.getElementById('origenFondos');
        const visible = !caja.classList.contains('hidden');
        document.getElementById('origenPrivado').click();
        document.getElementById('amount').value = '5';
        await refrescarAvisoPrivado();
        const av = document.getElementById('origenPrivadoAviso');
        const sel = await seleccionarMonedas('5', optionsList[currentTokenIndex]);
        return { visible, privado: pagarDesdePrivado,
                 aviso: (av.textContent || '').trim(), avisoOculto: av.classList.contains('hidden'),
                 alcanza: sel.alcanza, une: sel.une, esToken: sel.esToken,
                 comision: sel.gas ? sel.gas.toString() : null };
    })()`);
    ok(ui.visible, 'con ERC-20 y relayer fondeado, el selector de origen aparece');
    ok(ui.privado === true, 'se puede elegir pagar desde lo privado');
    ok(ui.esToken === true && ui.alcanza === true, 'la selección de monedas resuelve el pago en token');
    ok(ui.une === 1, `sale de una sola dirección (${ui.une})`);
    ok(!ui.avisoOculto && /comisi[oó]n/i.test(ui.aviso),
        'y el aviso dice la comisión ANTES de confirmar', ui.aviso);

    // Y el pago de verdad.
    // Destino ALEATORIO y medición por diferencia. Una dirección "obvia" como 0x…bEEF ya
    // tiene saldo real en Base: asumir que arranca en cero convierte un pago correcto en un
    // fallo, y peor, un pago fallido en un éxito si el saldo previo coincidiera.
    const DESTINO = new (await import('ethers')).ethers.Wallet(
        '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map(b => b.toString(16).padStart(2, '0')).join('')).address;
    // Foto de los TRES saldos antes de pagar. Medir absolutos falla por motivos que no tienen
    // nada que ver con el código: el destino puede tener saldo previo, y el relayer acumula
    // comisiones de corridas anteriores. Lo único que se sostiene es la diferencia.
    const saldoUsdc = a => BigInt(execSyncPre(`cast call ${USDC} "balanceOf(address)(uint256)" ${a} --rpc-url ${FORK}`));
    const antesDest = saldoUsdc(DESTINO);
    const antesRelay = saldoUsdc(RELAYER_ADDR);
    const antesStealth = saldoUsdc(pago.dir);
    const r = await ev(`(async () => { try {
        const tx = await pagarTokenDesdeStealth(${JSON.stringify(pago.dir)}, ${JSON.stringify(DESTINO)}, 5000000n, optionsList[currentTokenIndex]);
        return { ok: true, tx };
    } catch (e) { return { ok: false, error: String(e.message || e).slice(0, 200) }; } })()`);
    ok(r.ok, 'el pago se transmite por el relayer', r.ok ? r.tx : r.error);

    const dDest = saldoUsdc(DESTINO) - antesDest;
    const dRelay = saldoUsdc(RELAYER_ADDR) - antesRelay;
    const dStealth = antesStealth - saldoUsdc(pago.dir);
    ok(dDest === 5000000n, `al destinatario le entraron exactamente 5 USDC (${dDest})`);

    // Del lado de quien pagó: lo que salió tiene que aparecer ENTERO del otro lado, repartido
    // entre destinatario y relayer. Comparar contra una cotización pedida ahora no sirve: el
    // precio del gas cambia entre el pago y la comprobación, y ese ruido haría fallar un pago
    // correcto. Lo que no puede pasar es que se evapore nada.
    ok(dStealth === dDest + dRelay,
        `lo que salió de la stealth aparece entero entre destino y relayer, sin fugas (${dStealth})`,
        `${dDest} + ${dRelay}`);
    // Y la comisión tiene que ser chica: un cobro desbocado es tan bug como una fuga.
    ok(dRelay > 0n && dRelay < 2000000n,
        `la comisión es razonable (${(Number(dRelay)/1e6).toFixed(6)} USDC)`);
    const finalNativo = execSync(`cast balance ${pago.dir} --rpc-url ${FORK}`).toString().trim();
    ok(finalNativo === '0', 'la dirección stealth NUNCA tuvo nativo — esa es toda la idea');
} finally {
    try { proc.kill(); } catch { } try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
