// Link de invitación: la 0x sale de la clave pública (?pk=) y un par address/pk que no
// coincide no deja la pk en el contacto (hasta la 3.109 se guardaba tal cual: un link con tu
// 0x y la clave de otro le entregaba a ese otro los mensajes offline cifrados "para vos").
//
// Uso: servir el build en :8817 (python3 -m http.server 8817 -d dist-respaldo-test) y
//      node tests/invitacion-pk-cdp.mjs
import { spawn } from 'node:child_process';
import os from 'node:os';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9463;
const APP = process.env.APP_URL || 'http://localhost:8817/dapp.html';
const MI_PK = '0x584bf778404a370bc90c7ef5c1aef766bc3aff5761a02d69d1294d843513b06c'; // la wallet que abre el link
// Quien invita (llave de prueba) y un tercero que arma links truchos.
const INVITA_PRIV = '0x' + '11'.repeat(32);
const TRUCHO_PRIV = '0x' + '22'.repeat(32);

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✅' : '❌'} ${msg}`); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${os.tmpdir()}/cdp-cw-invpk-${Date.now()}`,
    '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });

let id = 0; const pending = new Map(); let ws;
const rpc = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); reject(new Error('timeout ' + method)); } }, 30000);
});
const ev = (expr) => rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    .then(r => { if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result?.value; });

try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
        try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find(t => t.type === 'page'); } catch { }
        await sleep(300);
    }
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id).resolve(d.result || d); pending.delete(d.id); } };
    await rpc('Page.enable'); await rpc('Runtime.enable');

    await rpc('Page.navigate', { url: APP }); await sleep(2500);
    await ev(`(async()=>{for(const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
        localStorage.clear(); localStorage.setItem('xmtp-chat-wallet', '${MI_PK}'); })()`);
    await rpc('Page.reload', { ignoreCache: true });
    for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`typeof currentWallet!=='undefined' && !!currentWallet`)) break; }

    const k = await ev(`(()=>{const a=new ethers.Wallet('${INVITA_PRIV}'), b=new ethers.Wallet('${TRUCHO_PRIV}');
        return {addr:a.address, pk:a.signingKey.compressedPublicKey.slice(2), truchoPk:b.signingKey.compressedPublicKey.slice(2)}})()`);
    const BASE = 'https://chatwallet.org/dapp';

    // ── Derivación ──
    ok(await ev(`cwAddressDePk('03ee1b340c80295bb60ada66e0396a44b70c479a857c357b37883d27efe030aaf8')`) === '0xe14F241B23AC40487FAEDf68fFf2a6c693780f82',
        'la pk de una invitación real da su 0x');
    ok(await ev(`cwAddressDePk('${k.pk}')`) === k.addr, 'cwAddressDePk = dirección de la llave');
    ok(await ev(`cwAddressDePk('04${k.pk.slice(2)}')`) === null, 'prefijo que no es de clave comprimida → null');
    ok(await ev(`cwAddressDePk('02' + 'ff'.repeat(32))`) === null, 'x fuera del cuerpo (no es un punto) → null');

    // ── Lectura del link ──
    ok(await ev(`extractAddressFromData('${BASE}?pk=${k.pk}')`) === k.addr, 'link con sólo ?pk= → dirección derivada');
    ok(await ev(`extractPubKeyFromData('${BASE}?pk=${k.pk}')`) === k.pk, 'link con sólo ?pk= → la pk vale');
    ok(await ev(`extractPubKeyFromData('${BASE}?address=${k.addr}&pk=${k.pk}')`) === k.pk, 'par que coincide → la pk vale');
    ok(await ev(`extractPubKeyFromData('${BASE}?address=${k.addr.toLowerCase()}&pk=${k.pk}')`) === k.pk, 'coincide aunque la 0x venga en minúsculas');
    ok(await ev(`extractPubKeyFromData('${BASE}?address=${k.addr}&pk=${k.truchoPk}')`) === null, 'par trucho (0x de uno, pk de otro) → pk descartada');
    ok(await ev(`extractAddressFromData('${BASE}?address=${k.addr}&pk=${k.truchoPk}')`) === k.addr, 'par trucho: la 0x del link se respeta');
    ok(await ev(`extractAddressFromData('${BASE}?address=${k.addr}')`) === k.addr, 'link viejo sin pk sigue andando');

    // ── De punta a punta: el contacto que queda ──
    const contacto = (a) => ev(`(()=>{const c=contacts.find(c=>c.address.toLowerCase()==='${a.toLowerCase()}'); return c?{pubKey:c.pubKey||null}:null})()`);
    await ev(`void handleScannedData('${BASE}?address=${k.addr}&pk=${k.truchoPk}').catch(()=>{})`); await sleep(2500);
    let c = await contacto(k.addr);
    ok(!!c, 'el link trucho igual agrega el contacto por su 0x');
    ok(c && c.pubKey === null, 'pero sin la pk de otro');
    await ev(`void handleScannedData('${BASE}?pk=${k.pk}').catch(()=>{})`); await sleep(2500);
    c = await contacto(k.addr);
    ok(c && c.pubKey === k.pk, 'el link con sólo ?pk= completa la pk del mismo contacto');
    ok(await ev(`contacts.filter(c=>c.address.toLowerCase()==='${k.addr.toLowerCase()}').length`) === 1, 'un solo contacto, sin duplicar');
    // Un @nombre.eth resuelve la 0x después de leer la pk: handleScannedAddress también la comprueba.
    await ev(`void handleScannedAddress('${k.addr}', '${k.truchoPk}', {greet:'qr'}).catch(()=>{})`); await sleep(2500);
    c = await contacto(k.addr);
    ok(c && c.pubKey === k.pk, 'handleScannedAddress con pk ajena no pisa la buena');
} catch (e) {
    console.error('💥', e); fails++;
} finally {
    chrome.kill();
    console.log(fails ? `\n${fails} fallas` : '\nTodo OK');
    process.exit(fails ? 1 : 0);
}
