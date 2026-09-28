// Nombres ENS y el link chatwallet.org/@nombre (v3.59).
//
// Qué se mide, en Chrome de verdad y contra Ethereum mainnet de verdad (RPC público):
//   · vitalik.eth y jesse.base.eth (CCIP-read) resuelven; un nombre inexistente no;
//   · xunorus.eth VENCIÓ el 17/4/2026 y el registro todavía guarda la dirección vieja:
//     resolveName la devuelve igual, la app NO (pagarle a eso es pagarle a un nombre libre);
//   · el reverse de vitalik vuelve verificado;
//   · qué destino sale de cada forma de link (/@x, ?to=, ethereum:, @x, x.eth);
//   · el link abierto en frío (?to=) llega a handleScannedAddress con la dirección resuelta,
//     y uno con un nombre que no existe avisa sin pintar HTML ajeno;
//   · la pista debajo del destinatario en "Enviar";
//   · la lista de chats NO interpreta como HTML el alias ni el último mensaje del otro.
//
// Correr:  ./tests/run-ens-arroba.sh      (sólo la parte XSS contra otra build: XSS_ONLY=1)

import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8845/dapp.html';
const XSS_ONLY = process.env.XSS_ONLY === '1';
const PORT = 9395;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

const VITALIK = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const JESSE = '0x2211d1D0020DAEA8039E46Cf1367962070d77DA9';

const dir = fs.mkdtempSync(os.tmpdir() + '/cw-ens-');
const proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
let ws, id = 0; const pend = new Map();
try {
    for (let i = 0; i < 40 && !ws; i++) {
        await sleep(500);
        try {
            const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
            const pg = l.find(t => t.type === 'page');
            if (pg) ws = new WebSocket(pg.webSocketDebuggerUrl);
        } catch { }
    }
    if (!ws) throw new Error('Chrome no levantó');
    await new Promise((res, bad) => { ws.onopen = res; ws.onerror = bad; });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
    const rpc = (method, params = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => {
        const r = await rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error((ex.exception?.description || ex.text || '').slice(0, 300));
        return r.result?.result?.value;
    };
    await rpc('Page.enable'); await rpc('Runtime.enable');
    await rpc('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await rpc('Page.navigate', { url: BASE });
    let listo = false;
    for (let i = 0; i < 60 && !listo; i++) {
        await sleep(1000);
        try { listo = (await ev(`typeof renderContacts === 'function' && typeof contacts !== 'undefined'`)) === true; } catch { }
    }
    if (!listo) throw new Error('la página no terminó de cargar (renderContacts no existe)');

    console.log('\n── la lista de chats no ejecuta lo que escribe el otro ──');
    const xss = await ev(`(async () => {
        window.__xss = 0;
        const bomba = '<img src=x onerror="window.__xss++">';
        contacts = [
          { name: '0xe14f...1b7a', selfAlias: bomba, address: '0xe14f241b7a6a1b1f6bd0e0dd6bd0e0dd6bd01b7a',
            lastMessage: bomba, lastMessageTimestamp: Date.now(), status: 'offline', unreadCount: 0 },
          { name: 'Amigo" onerror="window.__xss++', address: '0x2222222222222222222222222222222222222222',
            avatar: 'x" onerror="window.__xss++', lastMessage: 'hola', lastMessageTimestamp: Date.now(), status: 'offline', unreadCount: 0 },
        ];
        renderContacts();
        await new Promise(r => setTimeout(r, 400));
        const lista = document.getElementById('contactsListSidebar');
        return { xss: window.__xss, imgsX: lista.querySelectorAll('img[src="x"]').length,
                 texto: (lista.querySelector('.contact-item p.font-semibold')?.innerText || '') };
    })()`);
    ok(xss.xss === 0 && xss.imgsX === 0, 'ningún onerror corrió', JSON.stringify(xss));
    ok(xss.texto.includes('<img'), 'el alias se ve como texto, tal cual lo escribió', JSON.stringify(xss.texto));

    if (!XSS_ONLY) {
        console.log('\n── resolver nombres contra mainnet ──');
        const res = await ev(`(async () => {
            const r = async n => { try { return await cwResolverEns(n); } catch (e) { return 'ERR ' + e.message; } };
            return {
                vitalik: await r('Vitalik.ETH'),
                jesse: await r('jesse.base.eth'),
                xunorus: await r('xunorus.eth'),
                nada: await r('noexiste-zzq91.eth'),
                basura: await r('<b>.eth'),
                reverse: await cwNombreEnsDe('${VITALIK}'),
                reverseNada: await cwNombreEnsDe('0x2222222222222222222222222222222222222222'),
                pelado: await cwDireccionDeDestino('@vitalik'),
                dir: await cwDireccionDeDestino('${VITALIK.toLowerCase()}'),
            };
        })()`);
        ok(res.vitalik?.address === VITALIK && res.vitalik?.name === 'vitalik.eth',
            'Vitalik.ETH → su dirección, con el nombre normalizado', JSON.stringify(res.vitalik));
        ok(res.jesse?.address === JESSE, 'jesse.base.eth (CCIP-read hacia Base) resuelve', JSON.stringify(res.jesse));
        ok(res.xunorus === null, 'xunorus.eth vencido NO resuelve (aunque el registro guarde la dirección vieja)', JSON.stringify(res.xunorus));
        ok(res.nada === null && res.basura === null, 'inexistente y basura → null, sin tirar', JSON.stringify([res.nada, res.basura]));
        ok(res.reverse === 'vitalik.eth', 'reverse de vitalik verificado', JSON.stringify(res.reverse));
        ok(res.reverseNada === null, 'una dirección sin nombre → null', JSON.stringify(res.reverseNada));
        ok(res.pelado?.address === VITALIK, '"@vitalik" se lee como vitalik.eth', JSON.stringify(res.pelado));
        ok(res.dir?.address === VITALIK && res.dir?.name === null, 'una 0x pasa derecho, con checksum', JSON.stringify(res.dir));

        console.log('\n── qué destino sale de cada link ──');
        const casos = {
            'https://chatwallet.org/@xunorus': 'xunorus',
            'https://chatwallet.org/@vitalik.eth': 'vitalik.eth',
            'https://chatwallet.org/%40vitalik.eth': null,
            'https://chatwallet.org/dapp.html?to=vitalik.eth': 'vitalik.eth',
            'https://chatwallet.org/dapp?address=vitalik.eth': 'vitalik.eth',
            [`https://chatwallet.org/dapp?address=${VITALIK}`]: null,     // lo sigue atendiendo extractAddressFromData
            'https://evil.example/@xunorus': null,
            'ethereum:vitalik.eth@1': 'vitalik.eth',
            'vitalik.eth': 'vitalik.eth',
            '@xunorus': '@xunorus',
            'xunorus': null,                                             // una palabra suelta en un QR no es un nombre
            [VITALIK]: null,
        };
        const salidas = await ev(`(${JSON.stringify(Object.keys(casos))}).map(k => cwDestinoDeLink(k))`);
        Object.entries(casos).forEach(([k, esperado], i) =>
            ok(salidas[i] === esperado, `${k} → ${JSON.stringify(esperado)}`, salidas[i] === esperado ? '' : JSON.stringify(salidas[i])));

        console.log('\n── el link abierto en frío ──');
        const frio = await ev(`(async () => {
            const llamadas = [];
            const orig = handleScannedAddress;
            handleScannedAddress = async (a, pk, o) => { llamadas.push({ a, o }); };
            document.querySelectorAll('.cw-notif').forEach(n => n.remove());
            history.replaceState({}, '', location.pathname + '?to=vitalik.eth');
            await handleUrlParameters();
            const quedo = location.search;
            history.replaceState({}, '', location.pathname + '?to=' + encodeURIComponent('<img src=x onerror=window.__xss++>'));
            await handleUrlParameters();
            await new Promise(r => setTimeout(r, 300));
            const aviso = [...document.querySelectorAll('.cw-notif')].map(n => n.innerText).join(' | ');
            handleScannedAddress = orig;
            return { llamadas, quedo, aviso, xss: window.__xss };
        })()`);
        ok(frio.llamadas.length === 1 && frio.llamadas[0].a === VITALIK, '?to=vitalik.eth abre el chat con SU dirección', JSON.stringify(frio.llamadas));
        ok(frio.llamadas[0]?.o?.ensName === 'vitalik.eth' && frio.llamadas[0]?.o?.greet === 'link', 'y lleva el nombre y el saludo de link', JSON.stringify(frio.llamadas[0]?.o));
        ok(frio.quedo === '', 'el ?to= se borra de la barra (recargar no vuelve a saludar)', JSON.stringify(frio.quedo));
        ok(/no existe o venció/.test(frio.aviso) && frio.xss === 0, 'un nombre que no existe avisa, como texto', JSON.stringify(frio.aviso));

        console.log('\n── la pista del destinatario en "Enviar" ──');
        const pista = await ev(`(async () => {
            const inp = document.getElementById('recipientAddress');
            const hint = document.getElementById('recipientEnsHint');
            inp.value = 'vitalik.eth'; inp.dispatchEvent(new Event('input'));
            const mientras = hint.innerText;
            for (let i = 0; i < 40 && !/0x/.test(hint.innerText); i++) await new Promise(r => setTimeout(r, 250));
            const bien = { txt: hint.innerText, clase: hint.className };
            inp.value = 'noexiste-zzq91.eth'; inp.dispatchEvent(new Event('input'));
            for (let i = 0; i < 40 && !/no existe/.test(hint.innerText); i++) await new Promise(r => setTimeout(r, 250));
            const mal = hint.innerText;
            document.getElementById('sendForm').reset();
            return { mientras, bien, mal, oculto: hint.classList.contains('hidden') };
        })()`);
        ok(/Buscando vitalik\.eth/.test(pista.mientras), 'mientras resuelve, lo dice', JSON.stringify(pista.mientras));
        ok(pista.bien.txt === '→ ' + VITALIK && /green/.test(pista.bien.clase), 'y después muestra a qué dirección va', JSON.stringify(pista.bien));
        ok(/no existe o venció/.test(pista.mal), 'un nombre inexistente, en rojo', JSON.stringify(pista.mal));
        ok(pista.oculto, 'al resetear el formulario la pista se va', JSON.stringify(pista.oculto));

        console.log('\n── un contacto con .eth ──');
        const conEns = await ev(`(() => {
            contacts = [{ name: '0xd8da...6045', ensName: 'vitalik.eth', selfAlias: 'Otro nombre', address: '${VITALIK}',
                          lastMessage: 'gm', lastMessageTimestamp: Date.now(), status: 'offline', unreadCount: 0 }];
            renderContacts();
            const p = document.querySelector('#contactsListSidebar .contact-item p.font-semibold');
            return { nombre: p.innerText.trim(), marcado: p.classList.contains('contact-unconfirmed') };
        })()`);
        ok(conEns.nombre === 'vitalik.eth', 'arriba va su .eth, por encima del alias libre', JSON.stringify(conEns));
        ok(!conEns.marcado, 'y no se marca "sin confirmar": está verificado on-chain', JSON.stringify(conEns));
    }
} finally {
    try { ws && ws.close(); } catch { }
    try { proc.kill('SIGKILL'); } catch { }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { }
}
console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
