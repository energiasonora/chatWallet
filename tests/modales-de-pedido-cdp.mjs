// ¿Se distinguen de un vistazo los tres tipos de pedido que puede mandar una dApp?
//
// Antes eran idénticos: misma tarjeta, mismo degradado violeta, mismo '💬' de título. Lo
// único que separaba "firmá este texto" de "mandá plata" era leer el cuerpo.
//
// El test NO copia el markup: extrae del propio src/dapp.html la paleta, la cabecera y los
// dos modales, los ejecuta en un Chrome real con las traducciones reales, y saca una foto
// de cada uno. Después mide sobre el DOM ya pintado —color del botón, etiqueta, ícono— así
// que si alguien vuelve a dejarlos iguales, esto se pone rojo.
//
//   unset NODE_OPTIONS && node tests/modales-de-pedido-cdp.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/, '');
const SALIDA = process.env.SALIDA || '/tmp';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const res = [];
const check = (n, ok, extra = '') => { res.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

const dapp = fs.readFileSync(path.join(RAIZ, 'src/dapp.html'), 'utf8');
const trozo = (desde, hasta) => {
    const i = dapp.indexOf(desde);
    if (i < 0) throw new Error('no encontré en dapp.html: ' + desde);
    const j = dapp.indexOf(hasta, i);
    // Sin este guardia, un terminador que quedó ANTES del trozo devuelve -1 y el slice se
    // lleva el archivo entero: el error sale después, como un SyntaxError incomprensible
    // en la línea 5265 del script inyectado. Que falle acá y diga por qué.
    if (j < 0) throw new Error(`el terminador ${JSON.stringify(hasta)} no aparece después de ${JSON.stringify(desde.slice(0, 40))}`);
    return dapp.slice(i, j);
};
const paleta = trozo('const PEDIDO_ESTILO = {', 'function wcApprove');
const aprobar = trozo('function wcApprove(title, body, confirmLabel, tipo', '\n            function wcToast');
const pagar = trozo('function wcPaymentModal(title, body, confirmLabel)', 'function friendlyTxError');
// Las traducciones reales del bloque es, para que la foto muestre el texto de verdad.
// OJO con el ancla: buscar 'es: {' a secas matchea cualquier clave que termine así
// ('values: {', 'res: {'…) y el diccionario sale de otra parte del archivo. El síntoma es
// mudo — las etiquetas se dibujan con la clave cruda, "req_kind_pay", y la foto parece
// casi bien. Por eso va anclado a la indentación exacta del objeto translations, y por eso
// abajo se exige que las claves que este test usa estén de verdad.
const bloque = (lang) => {
    const m = new RegExp('^ {16}' + lang + ': \\{$', 'm').exec(dapp);
    if (!m) throw new Error('no encontré el bloque de traducciones ' + lang);
    return m.index;
};
const es = dapp.slice(bloque('es'), bloque('en'));
// Desescapado: en el archivo el valor está como TEXTO FUENTE ("…mensaje:\\n\\n\\"{msg}\\"…").
// Metido crudo en la foto, el modal muestra \\n y \\" literales y la captura miente sobre cómo
// se ve de verdad. JSON.parse lo convierte en lo que JavaScript arma al cargar el objeto.
const dic = Object.fromEntries([...es.matchAll(/"([a-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g)]
    .map(m => [m[1], JSON.parse('"' + m[2] + '"')]));
const NECESARIAS = ['req_kind_link', 'req_kind_sign', 'req_kind_pay', 'wc_connect_title',
    'wc_sign_title', 'wc_pay_title', 'wc_connect_cta', 'wc_sign_cta', 'wc_pay_cta', 'wc_reject'];
const faltan = NECESARIAS.filter(k => !dic[k]);
if (faltan.length) { console.error('✗ faltan traducciones en el bloque es: ' + faltan.join(', ')); process.exit(1); }
console.log(`(diccionario es: ${Object.keys(dic).length} claves)`);

class Chr {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-modal-');
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`,
            '--window-size=420,760', 'about:blank'], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const l = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                const pg = l.find(t => t.type === 'page');
                if (pg) return this.connect(pg.webSocketDebuggerUrl);
            } catch { }
        }
        throw new Error('Chrome no levantó');
    }
    connect(url) {
        return new Promise((ok, bad) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => { await this.rpc('Page.enable'); await this.rpc('Runtime.enable'); ok(); };
            this.ws.onerror = bad;
            this.ws.addEventListener('message', e => {
                const m = JSON.parse(e.data);
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
            });
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(r => { this.pending.set(id, r); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async ev(expression) {
        const r = await this.rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
        return r.result?.result?.value;
    }
    kill() { try { this.proc.kill(); } catch { } }
}

(async () => {
    const c = new Chr(9433);
    await c.launch();
    await c.rpc('Page.navigate', { url: 'data:text/html,<meta charset=utf-8><body style="margin:0;background:#0b1020">' });
    await sleep(600);

    // Se inyecta el código REAL, con un t() que usa el diccionario REAL.
    await c.ev(`
        window.__dic = ${JSON.stringify(dic)};
        window.t = (k, v = {}) => (window.__dic[k] || k).replace(/\\{(\\w+)\\}/g, (_, x) => v[x] ?? '');
        window.vibrarPedidoDeFirma = () => {};
        ${paleta}
        ${aprobar}
        ${pagar}
        window.PEDIDO_ESTILO = PEDIDO_ESTILO;
        window.wcApprove = wcApprove; window.wcPaymentModal = wcPaymentModal;
        'ok'`);

    const casos = [
        ['vincular', `wcApprove(t('wc_connect_title'), t('wc_connect_body',{inbox:'78442c84bc…5f314c',chain:42161}), t('wc_connect_cta'), 'vincular')`, '#wc-yes', 'req_kind_link', '🔗'],
        ['firma', `wcApprove(t('wc_sign_title'), t('wc_sign_body',{msg:'Ius Naturalis — firmar el documento QmXk…9dF2'}), t('wc_sign_cta'), 'firma')`, '#wc-yes', 'req_kind_sign', '✍️'],
        ['pago', `wcPaymentModal(t('wc_pay_title'), t('wc_pay_body',{value:'0.0031',to:'0x1c87FD…9A0e3d'}), t('wc_pay_cta'))`, '#pm-yes', 'req_kind_pay', '💸'],
    ];

    const vistos = [];
    for (const [nombre, llamada, btn, clave, icono] of casos) {
        await c.ev(`document.querySelectorAll('body > div').forEach(d => d.remove()); ${llamada}; 'ok'`);
        await sleep(450);
        const info = await c.ev(`(() => {
            const b = document.querySelector('${btn}');
            const card = b.closest('div[style*="border-radius:16px"]');
            const etiqueta = card.querySelector('div[style*="letter-spacing"]');
            return {
                boton: getComputedStyle(b).backgroundImage,
                tinta: getComputedStyle(b).color,
                borde: getComputedStyle(card).borderColor,
                etiqueta: etiqueta ? etiqueta.textContent.trim() : '(sin etiqueta)',
                titulo: card.querySelector('[id$="-title"]').textContent.trim(),
            };
        })()`);
        const png = await c.rpc('Page.captureScreenshot', { format: 'png' });
        const f = path.join(SALIDA, `modal-${nombre}.png`);
        fs.writeFileSync(f, Buffer.from(png.result.data, 'base64'));
        console.log(`\n── ${nombre}  →  ${f}`);
        console.log(`   etiqueta: ${info.etiqueta}`);
        console.log(`   título  : ${info.titulo}`);
        console.log(`   botón   : ${info.boton.slice(0, 60)}  tinta ${info.tinta}`);
        check(`${nombre}: lleva su etiqueta escrita, no sólo color`, info.etiqueta.includes(dic[clave]), info.etiqueta);
        check(`${nombre}: lleva su ícono`, info.etiqueta.includes(icono));
        check(`${nombre}: el título ya no arranca con el 💬 genérico`, !info.titulo.startsWith('💬'), info.titulo);
        vistos.push({ nombre, ...info });
    }

    // Lo que motivó el cambio: que no se parezcan entre sí.
    const botones = new Set(vistos.map(v => v.boton));
    check('los tres botones tienen degradados distintos', botones.size === 3, `${botones.size} distintos de 3`);
    const bordes = new Set(vistos.map(v => v.borde));
    check('los tres bordes de tarjeta son distintos', bordes.size === 3, `${bordes.size} distintos de 3`);
    const pago = vistos.find(v => v.nombre === 'pago');
    check('el de mover plata usa tinta oscura (no se confunde con los otros)',
        pago.tinta.replace(/\s/g, '') === 'rgb(31,41,55)', pago.tinta);

    c.kill();
    const mal = res.filter(x => !x).length;
    console.log(`\n${mal === 0 ? '✅ TODO OK' : `❌ ${mal} fallo(s)`} — ${res.length} chequeos\n`);
    process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
