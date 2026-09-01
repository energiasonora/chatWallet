// El panel de modo frío tiene que hablar el idioma elegido, en los tres.
// Prende el modo frío (modal de confirmación → splash) y lee lo que quedó en pantalla.
const CDP = process.env.CDP || 'http://127.0.0.1:9347';
const BASE = process.env.BASE_URL || 'http://localhost:8835';
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
const ir = async url => { await rpc('Page.navigate', { url }); await sleep(1500); };

// Lo que cada idioma tiene que decir. Palabras que sólo existen en ese idioma:
// si el panel se quedara en español, ninguna aparecería.
const ESPERADO = {
    es: { titulo: 'Modo frío activado', modal: /modo frío/i,        splash: /desconectada de internet/i, ok: 'Entendido', mudanza: 'ChatWallet se muda' },
    en: { titulo: 'Cold mode is on',    modal: /cold mode/i,        splash: /disconnected from the internet/i, ok: 'Got it', mudanza: 'ChatWallet is moving' },
    fr: { titulo: 'Mode hors ligne activé', modal: /hors ligne/i,   splash: /déconnecté d'internet/i, ok: 'Compris', mudanza: 'ChatWallet déménage' },
};

const LEER = sel => `(() => { const e = document.querySelector(${JSON.stringify(sel)});
    return e ? (e.innerText || '').replace(/\\s+/g, ' ').trim() : null; })()`;

for (const lang of ['es', 'en', 'fr']) {
    console.log(`\n── ${lang} ──`);
    await ir(BASE + '/dapp.html');
    await ev(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(PK)});
              localStorage.setItem('chatwallet-lang', ${JSON.stringify(lang)}); true`);
    await ir(BASE + '/dapp.html');
    for (let i = 0; i < 30 && !(await ev(`!!window.currentWallet`)); i++) await sleep(500);

    // El modal de confirmación, tal como lo abre el switch de Configuración.
    await ev(`document.getElementById('coldModeSwitch').click(); true`);
    await sleep(600);
    const modal = await ev(LEER('#offlineModeModal'));
    console.log('   modal:  ' + (modal || '(vacío)').slice(0, 120));
    ok(!!modal && ESPERADO[lang].modal.test(modal), `el modal de confirmación está en ${lang}`);
    ok(!/Vas a pasar la wallet/.test(modal || '') || lang === 'es',
        'y no quedó texto en español', lang === 'es' ? '' : (modal || '').slice(0, 60));

    // Confirmar → splash.
    await ev(`document.getElementById('confirmOfflineModeBtn').click(); true`);
    await sleep(1200);
    const splash = await ev(LEER('#coldModeSplash'));
    console.log('   splash: ' + (splash || '(vacío)').slice(0, 160));
    ok(!!splash, 'el splash aparece');
    ok((splash || '').includes(ESPERADO[lang].titulo), `título en ${lang}`, ESPERADO[lang].titulo);
    ok(ESPERADO[lang].splash.test(splash || ''), `el cuerpo está en ${lang}`);
    ok((splash || '').includes(ESPERADO[lang].ok), `el botón dice "${ESPERADO[lang].ok}"`);

    // Las tres filas: cada una tiene rótulo Y descripción (el <strong> partido en dos hojas
    // se rompería dejando una mitad vacía, y el innerText no lo delataría a simple vista).
    const filas = await ev(`(() => [...document.querySelectorAll('#coldModeSplash [data-i18n-key^="cold_splash_f"]')]
        .map(e => (e.textContent || '').trim()))()`);
    ok(filas.length === 6, `seis hojas de texto en las tres filas (${filas.length})`);
    ok(filas.every(x => x.length > 2), 'ninguna quedó vacía', JSON.stringify(filas.filter(x => x.length <= 2)));

    // Nada del panel se quedó sin clave: ningún texto suelto sin traducir.
    const sinClave = await ev(`(() => {
        const out = [];
        for (const raiz of ['#coldModeSplash', '#offlineModeModal'])
            for (const n of document.querySelector(raiz).querySelectorAll('*')) {
                if (n.children.length) continue;                       // sólo hojas
                const txt = (n.textContent || '').trim();
                // Sin letras no hay idioma: la × de cerrar y los emojis decorativos
                // (🔌 ✍️ 📷) se ven igual en los tres, no necesitan clave.
                if (!txt || !/\\p{L}/u.test(txt)) continue;
                if (!n.hasAttribute('data-i18n-key') && !n.closest('[data-i18n-key]')) out.push(txt.slice(0, 40));
            }
        return out;
    })()`);
    ok(sinClave.length === 0, 'no quedan textos sin data-i18n-key', JSON.stringify(sinClave));

    // El splash de mudanza sólo se dibuja en la build dev (IS_NATIVE && XMTP_ENV==='dev'),
    // pero su markup está en el DOM igual: translateUI ya lo tocó, así que se puede leer
    // sin dispararlo. Es el cartel que ven los que quedaron en la red vieja.
    const mig = await ev(`(() => {
        const raiz = document.getElementById('migrationSplash');
        const sinClave = [], vacias = [];
        for (const n of raiz.querySelectorAll('*')) {
            if (n.children.length) continue;
            const txt = (n.textContent || '').trim();
            if (/^[0-9]$/.test(txt)) continue;                 // los números 1/2/3 de los pasos
            if (!txt) { if (n.hasAttribute('data-i18n-key')) vacias.push(n.getAttribute('data-i18n-key')); continue; }
            if (!/\\p{L}/u.test(txt)) continue;
            if (!n.hasAttribute('data-i18n-key')) sinClave.push(txt.slice(0, 40));
        }
        return { sinClave, vacias, texto: (raiz.innerText || '').replace(/\\s+/g, ' ').trim() };
    })()`);
    console.log('   mudanza: ' + mig.texto.slice(0, 110));
    ok(mig.sinClave.length === 0, 'el splash de mudanza no tiene textos sin clave', JSON.stringify(mig.sinClave));
    ok(mig.vacias.length === 0, 'ninguna clave del splash de mudanza quedó vacía', JSON.stringify(mig.vacias));
    ok(mig.texto.includes(ESPERADO[lang].mudanza), `y está en ${lang}`, ESPERADO[lang].mudanza);
}

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
