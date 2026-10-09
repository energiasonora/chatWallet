// Pestaña Balances (todas las redes, una llamada por red, filas ocultables) + valor en la moneda elegida debajo del saldo. Un Chrome headless, red real
// (RPC públicos + Chainlink en Base + P2P.me), sin XMTP.
// Para ver números distintos de cero, la lectura se apunta a una dirección pública con fondos
// (vitalik.eth): sólo se LEEN saldos, no se firma nada.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf /tmp/cwui .parcel-cache-ui
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/balances-cdp.mjs   (SHOT=archivo.png guarda captura)
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const PORT = 9497;
const RICO = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
function check(name, ok, extra = '') {
    if (!ok) fails++;
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-bal-');
const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank',
], { stdio: 'ignore' });

let ws, seq = 0;
const pending = new Map();
const errores = [];
const rpc = (method, params = {}) => new Promise(res => {
    const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params }));
});
async function ev(expr) {
    const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text);
    return r.result?.result?.value;
}
async function pollFor(expr, tries = 40, delay = 500) {
    for (let i = 0; i < tries; i++) { try { const v = await ev(expr); if (v) return v; } catch { } await sleep(delay); }
    return false;
}
// Listo = la pasada terminó: total pintado y la nota ya no dice "Actualizando…" (lo pintado
// antes sale de lo guardado y puede ser de la pasada anterior).
const listo = `(() => {
    const t = document.getElementById('balTotal').textContent;
    const n = document.getElementById('balTotalNote').textContent;
    return t !== '…' && !/Actualizando|Leyendo/.test(n) && t;
})()`;
const pliegues = `[...document.querySelectorAll('#balList .bal-fold')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())`;
// Filas de la sección principal (las que no están dentro de un pliegue).
const principales = `[...document.querySelectorAll('#balList > .bal-row')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())`;
const filas = `[...document.querySelectorAll('#balList .bal-row')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())`;

try {
    for (let i = 0; i < 60 && !ws; i++) {
        await sleep(500);
        try {
            const page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === 'page');
            if (page) {
                ws = new WebSocket(page.webSocketDebuggerUrl);
                await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
            }
        } catch { ws = null; }
    }
    ws.addEventListener('message', e => {
        const m = JSON.parse(e.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errores.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    });
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Page.navigate', { url: BASE }); await sleep(2500);
    await ev(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify('0x' + randomBytes(32).toString('hex'))})`);
    await rpc('Page.reload');
    await pollFor(`!!currentWallet && !document.getElementById('appNav').classList.contains('hidden')`, 60);
    await ev(`window.alert = () => {}`);

    // ── La pestaña existe donde estaba Docs, y Docs sigue oculta ──
    const nav = await ev(`[...document.querySelectorAll('#appNav .nav-btn')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.dataset.view)`);
    // Se mira lo que SE VE (getComputedStyle), no la clase: Docs tenía .hidden y se veía igual.
    check('barra: Wallet, Historial, Balances', JSON.stringify(nav) === JSON.stringify(['walletView', 'historyView', 'balancesView']), JSON.stringify(nav));

    // ── Wallet nueva, todo en cero: nada arriba, todo plegado abajo ──
    await ev(`document.getElementById('balancesNavBtn').click()`);
    check('abre la vista', await ev(`document.getElementById('balancesView').classList.contains('active')`) === true);
    const t0 = await pollFor(listo, 60);
    const p0 = await ev(pliegues);
    check('wallet vacía: sin filas arriba, con el aviso', (await ev(principales)).length === 0 && /No tenés saldo/.test(await ev(`document.getElementById('balList').innerText`)));
    check('las vacías y las testnets, plegadas', p0.some(p => /Sin saldo \(\d+\)/.test(p)) && p0.some(p => /Testnets \(3\)/.test(p)), JSON.stringify(p0));
    check('total en USD por defecto', /US\$/.test(t0), t0);
    // Una llamada por red: las 10 entradas por defecto son 6 redes distintas.
    check('lee todas las redes de la lista', (await ev(`[...cwRedesAgrupadas().values()].flat().length`)) === (await ev(`optionsList.filter(n => n.API).length`)));

    // ── Con fondos (lectura de una dirección pública) ──
    await ev(`currentWallet = { ...currentWallet, address: ${JSON.stringify(RICO)} }`);
    await ev(`cwPintarBalances(true)`);
    const t1 = await pollFor(listo, 60);
    const f1 = await ev(filas);
    console.log('   total:', t1); (await ev(principales)).forEach(f => console.log('   ·', f));
    check('total con fondos > 0', /[1-9]/.test(t1), t1);
    const p1 = await ev(principales);
    check('las 7 redes con saldo, arriba (ya no hay tope de 6)', p1.length === 7, p1.length + ' filas');
    check('USDC on Base e Hyperliquid incluidas', p1.some(f => /USDC on Base/.test(f)) && p1.some(f => /Hyperliquid/.test(f)));
    check('ordenado por valor (la primera tiene el %)', /%/.test(p1[0] || '') && /^Base /.test(p1[0] || ''), p1[0]);

    // ── Ocultar una fila: deja de sumar, pasa a Ocultas, y vuelve ──
    const totalAntes = await ev(`document.getElementById('balTotal').textContent`);
    const claveBase = await ev(`cwClaveFila(optionsList.find(n => n.TOKEN_CHAIN_NAME === 'Base'))`);
    await ev(`document.querySelector('#balList > .bal-row .bal-hide[data-key="${claveBase}"]').click()`);
    await sleep(300);
    const totalSinBase = await ev(`document.getElementById('balTotal').textContent`);
    check('ocultar Base baja el total', totalSinBase !== totalAntes && !(await ev(principales)).some(f => /^Base /.test(f)), `${totalAntes} → ${totalSinBase}`);
    check('y aparece en Ocultas (1)', (await ev(pliegues)).some(p => /Ocultas \(1\)/.test(p)));
    check('el ojo no cambió de pantalla', await ev(`document.getElementById('balancesView').classList.contains('active')`) === true);
    check('se recuerda', (await ev(`localStorage.getItem(CW_BAL_OCULTAS_KEY())`)).includes(claveBase));
    await ev(`[...document.querySelectorAll('#balList .bal-fold')].find(b => /Ocultas/.test(b.innerText)).click()`);
    await ev(`document.querySelector('#balList .bal-hide[data-key="${claveBase}"]').click()`);
    await sleep(300);
    check('volver a mostrarla restaura el total', await ev(`document.getElementById('balTotal').textContent`) === totalAntes);

    // ── Abre al instante con lo guardado ──
    await ev(`void cwPintarBalances()`);   // sin esperar: lo que importa es lo que se ve ANTES de la red
    await sleep(50);
    const inmediato = await ev(`document.getElementById('balTotal').textContent`);
    const notaInm = await ev(`document.getElementById('balTotalNote').textContent`);
    check('al reabrir: total al instante, desde lo guardado', /[1-9]/.test(inmediato) && /Actualizando/.test(notaInm), `${inmediato} | ${notaInm}`);
    await pollFor(listo, 60);
    check('nota de precios', /Chainlink/.test(await ev(`document.getElementById('balTotalNote').textContent`)));

    const precios = await ev(`cwPreciosUsd()`);
    check('precios de Chainlink: ETH, BTC, EUR, BNB, HYPE, USDC', ['ETH', 'BTC', 'EUR', 'BNB', 'HYPE', 'USDC'].every(k => precios[k] > 0), JSON.stringify(precios));

    // ── Cambio de moneda: se sincroniza con Configuración y repinta ──
    for (const [m, re] of [['EUR', /€/], ['ARS', /ARS/], ['BTC', /BTC/], ['ETH', /ETH/]]) {
        await ev(`(() => { const s = document.getElementById('balCurrency'); s.value = '${m}'; s.dispatchEvent(new Event('change')); })()`);
        await sleep(300);
        const tm = await pollFor(listo, 60);
        check(`total en ${m}`, re.test(tm) && /[1-9]/.test(tm), tm);
    }
    check('Configuración quedó en la misma moneda', await ev(`document.getElementById('settingsCurrency').value`) === 'ETH');
    check('persistida', await ev(`localStorage.getItem('cw-moneda')`) === 'ETH');

    // ── Ojito: oculta los montos ──
    await ev(`toggleHideBalance()`);
    await pollFor(listo, 60);
    check('ocultar saldo tapa el total', await ev(`document.getElementById('balTotal').textContent`) === '••••');
    await ev(`toggleHideBalance()`);

    // ── Valor debajo del saldo principal: tocar USDC on Base lleva a la wallet ──
    await ev(`(() => { const s = document.getElementById('balCurrency'); s.value = 'ARS'; s.dispatchEvent(new Event('change')); })()`);
    await pollFor(listo, 60);
    const primera = await ev(`document.querySelector('#balList > .bal-row').dataset.netIndex`);
    await ev(`document.querySelector('#balList > .bal-row p').click()`);
    check('tocar una fila vuelve a la wallet', await pollFor(`document.getElementById('walletView').classList.contains('active')`) === true);
    const fiat = await pollFor(`(() => { const t = document.getElementById('balanceFiat').textContent; return /ARS/.test(t) && t; })()`, 40);
    console.log('   saldo:', await ev(`document.getElementById('balanceDisplay').textContent`), '|', fiat);
    check('debajo del saldo: ≈ en ARS', /^≈ ARS/.test(fiat || ''), fiat);
    check('y quedó elegida la red tocada', String(await ev(`currentTokenIndex`)) === String(primera));

    if (process.env.SHOT) {
        await ev(`document.getElementById('balancesNavBtn').click()`);
        await ev(`(() => { const s = document.getElementById('balCurrency'); s.value = 'USD'; s.dispatchEvent(new Event('change')); })()`);
        await pollFor(listo, 60); await sleep(500);
        const shot = await rpc('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(process.env.SHOT, Buffer.from(shot.result.data, 'base64'));
        console.log('   captura →', process.env.SHOT);
    }
    // ── Las favoritas ya no tienen tope ──
    const r = await ev(`(() => {
        optionsList.forEach(n => n.isFavorite = false);
        const btn = i => ({ stopPropagation() {}, currentTarget: { dataset: { index: String(i) } } });
        for (let i = 0; i < optionsList.length; i++) toggleFavorite(btn(i));
        return optionsList.filter(n => n.isFavorite).length === optionsList.length;
    })()`);
    check('se pueden marcar todas las favoritas', r === true);
    const nuestros = errores.filter(e => /cw[A-Z]|balances|Balance/i.test(e));
    check('sin excepciones de este código', nuestros.length === 0, nuestros.join(' | ').slice(0, 300));
} catch (e) {
    fails++; console.error('💥', e);
} finally {
    try { proc.kill(); } catch { }
}
console.log(fails ? `\n${fails} fallas` : '\nTodo verde');
process.exit(fails ? 1 : 0);
