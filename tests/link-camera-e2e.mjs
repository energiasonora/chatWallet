// E2E de "Compartir acceso al chat" PASANDO POR LA CÁMARA (CWL1/CWL2/CWL3).
//
// El test viejo (link-access-e2e.mjs) inyecta los códigos con window.handleScannedData:
// prueba el protocolo, pero saltea justo lo que rompe en la vida real — que el QR se lea
// con una cámara. Acá cada salto viaja por getUserMedia:
//
//   1. el dispositivo que muestra el QR se saca una foto de la TARJETA BLANCA entera
//      (CDP screenshot: es lo que una persona encuadra, y su padding es el quiet zone)
//   2. ffmpeg la monta en una escena cuadrada de 1080x1080 (descentrada y con desenfoque,
//      como una cámara mirando la pantalla del otro teléfono) y escribe un .y4m
//   3. el que escanea corre con la cámara falsa apuntando a ese .y4m, así que html5-qrcode
//      decodifica un video real, no un string inyectado
//
// Lo que NO cubre: el autofoco y la óptica del teléfono. Eso sigue siendo prueba humana.
//
// Cómo correrlo (contra producción, sin build):
//   nvm use 22 && unset NODE_OPTIONS && node tests/link-camera-e2e.mjs
//   SCENE=hard node tests/link-camera-e2e.mjs        ← QR más chico y más borroso
//
// Contra un build local:
//   rm -rf .parcel-cache-ui   ← si no, Parcel reordena los <script> y muere en "Tone is not defined"
//   yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   python3 -m http.server 8819 --directory /tmp/cwui &   ← OJO: 8817 suele estar ocupado por otra
//        sesión, y entonces se prueba un build viejo sin darse cuenta (pasó). Verificar con curl.
//   BASE=http://127.0.0.1:8819/dapp.html node tests/link-camera-e2e.mjs
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'https://chatwallet.org/dapp.html';
const WORK = process.env.WORK || fs.mkdtempSync(path.join(os.tmpdir(), 'cw-cam-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// La escena es CUADRADA a propósito: el escáner pide aspectRatio 1.0, así que el navegador
// recorta los lados del cuadro de la cámara. Un video 16:9 le llega recortado al centro y
// todo lo que quede fuera de ese cuadrado no existe para el decoder (medido: 720x720 sobre
// una fuente de 1280x720). Trabajamos directo en el cuadro que la app realmente ve.
//   easy = el QR ocupa casi todo, centrado y nítido (el mejor caso posible)
//   real = ~55% del lado, descentrado y algo desenfocado (lo que pasa de verdad)
//   hard = chico y borroso (margen de densidad: acá es donde CWL2 debería sufrir primero)
const FRAME = 1080;
const SCENES = {
    easy: { h: 900, blur: 0, pos: 'center' },
    real: { h: 600, blur: 1.2, pos: 'offcenter' },
    hard: { h: 380, blur: 2.2, pos: 'offcenter' },
};
const SCENE = process.env.SCENE || 'real';

const results = [];
function check(name, ok, extra = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
}

class Dev {
    constructor(label, port, camFile) {
        this.label = label; this.port = port; this.camFile = camFile;
        this.id = 0; this.pending = new Map();
    }

    async launch() {
        this.dir = fs.mkdtempSync(path.join(os.tmpdir(), `cw-${this.label}-`));
        const args = [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`,
            '--ignore-certificate-errors', '--window-size=900,1400',
            '--autoplay-policy=no-user-gesture-required',
        ];
        if (this.camFile) {
            // OJO: --use-file-for-fake-video-capture SOLO no alcanza. Sin
            // --use-fake-device-for-media-stream, Chrome ignora el archivo y abre la CÁMARA
            // REAL de la máquina (verificado: el stream traía la webcam del Mac). Los tres
            // flags van juntos siempre.
            args.push('--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream',
                `--use-file-for-fake-video-capture=${this.camFile}`);
        }
        args.push('about:blank');
        this.proc = spawn(CHROME, args, { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const list = await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json();
                const page = list.find(t => t.type === 'page');
                if (page) { await this.connect(page.webSocketDebuggerUrl); return; }
            } catch { }
        }
        throw new Error(`${this.label}: Chrome no levantó`);
    }

    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => {
                await this.rpc('Page.enable'); await this.rpc('Runtime.enable');
                this.ws.addEventListener('message', e => {
                    const m = JSON.parse(e.data);
                    if (m.method === 'Runtime.consoleAPICalled' && process.env.VERBOSE) {
                        console.log(`  [${this.label}]`, m.params.args.map(a => a.value ?? a.description).join(' '));
                    }
                });
                resolve();
            };
            this.ws.onerror = reject;
            this.ws.addEventListener('message', e => {
                const m = JSON.parse(e.data);
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
            });
        });
    }

    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
    }

    async eval(expr, { awaitPromise = true } = {}) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise });
        if (r.result?.exceptionDetails) throw new Error(`${this.label}: ${r.result.exceptionDetails.text} ${r.result.exceptionDetails.exception?.description || ''}`);
        if (r.result?.result?.subtype === 'error') throw new Error(`${this.label}: ${r.result.result.description}`);
        return r.result?.result?.value;
    }

    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(2500); }
    async reload() { await this.rpc('Page.reload'); await sleep(2500); }

    // Foto de la TARJETA BLANCA entera, no del canvas: es lo que una persona ve y encuadra,
    // y su padding es el quiet zone del QR. Fotografiar sólo el canvas infla el resultado
    // (la tinta ocupa todo el cuadro) y esconde justo el problema del margen desperdiciado.
    async shot(selector, file, scale = 3) {
        const box = await this.eval(`(() => {
            const el = document.querySelector(${JSON.stringify(selector)});
            if (!el) return null;
            const card = el.closest('.bg-white') || el;
            const r = card.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        })()`);
        if (!box || !box.width) throw new Error(`${this.label}: no encontré ${selector} en pantalla`);
        const r = await this.rpc('Page.captureScreenshot', {
            format: 'png', captureBeyondViewport: true,
            clip: { x: box.x, y: box.y, width: box.width, height: box.height, scale },
        });
        fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
        return box;
    }

    async waitXmtp(timeoutMs = 120000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const st = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (st) return st;
            await sleep(2000);
        }
        throw new Error(`${this.label}: XMTP no inicializó (status: "${await this.eval(`document.getElementById('status')?.textContent || ''`)}")`);
    }

    kill() { try { this.proc.kill(); } catch { } }
}

// Cuenta los módulos del QR leyendo el canvas. El ojo del finder de arriba a la izquierda
// tiene una barra superior de 7 módulos macizos: esa corrida da el tamaño de módulo.
// (La primera versión medía la fila y0+3 y en los QR densos —módulo de ~2px— eso ya caía en
// la SEGUNDA fila de módulos, donde la corrida es de 1 módulo: de ahí salían "763 módulos".)
async function qrModules(dev, containerSel) {
    return dev.eval(`(() => {
        const c = document.querySelector(${JSON.stringify(containerSel)} + ' canvas');
        if (!c) return null;
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        const dark = (x, y) => d[(y * c.width + x) * 4] < 128;
        let y0 = -1, x0 = -1;
        for (let y = 0; y < c.height && y0 < 0; y++)
            for (let x = 0; x < c.width; x++) if (dark(x, y)) { y0 = y; x0 = x; break; }
        if (y0 < 0) return null;
        // La corrida más larga entre las dos primeras filas del finder (evita el antialiasing).
        let run = 0;
        for (const y of [y0, y0 + 1]) {
            if (y >= c.height) continue;
            let x = x0; while (x < c.width && !dark(x, y)) x++;
            let n = 0; while (x + n < c.width && dark(x + n, y)) n++;
            if (n > run) run = n;
        }
        const module = run / 7;
        const raw = (c.width - 2 * x0) / module;
        // Las versiones válidas van de 21 a 177 módulos, de 4 en 4: encajar a la más cercana
        // sirve de control de sanidad (si la medición se va lejos, se ve en raw).
        const snapped = Math.min(177, Math.max(21, Math.round((raw - 21) / 4) * 4 + 21));
        return {
            modules: snapped, raw: +raw.toFixed(1),
            version: (snapped - 17) / 4,
            moduleCssPx: +(module * 300 / c.width).toFixed(2),   // la tarjeta mide 300px de lado
            sane: Math.abs(raw - snapped) < 3,
        };
    })()`);
}

// Monta el QR en una escena de 1280x720 y escribe el .y4m que va a "ver" la cámara falsa.
function makeCameraFile(pngPath, y4mPath, sceneName = SCENE) {
    const s = SCENES[sceneName];
    const pos = s.pos === 'center'
        ? '(W-w)/2:(H-h)/2'
        : '(W-w)*0.88:(H-h)*0.12';   // pegado a una esquina: el qrbox viejo recortaba al 80% central
    const chain = [`scale=-1:${s.h}`, s.blur ? `gblur=sigma=${s.blur}` : null].filter(Boolean).join(',');
    execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-loop', '1', '-i', pngPath,
        '-f', 'lavfi', '-i', `color=c=0x1b1b1b:s=${FRAME}x${FRAME}`,
        '-filter_complex', `[0:v]${chain}[q];[1:v][q]overlay=${pos}`,
        '-frames:v', '12', '-r', '15', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', y4mPath,
    ]);
    return y4mPath;
}

// Deja el QR de `text` (ya renderizado en `selector` del dispositivo `from`) listo para que
// lo lea `to`. Devuelve los datos del QR (módulos, tamaño de módulo en pantalla).
async function stageQr(from, to, selector, tag, sceneName = SCENE) {
    const png = path.join(WORK, `${tag}.png`);
    await from.shot(selector, png);
    makeCameraFile(png, to.camFile, sceneName);
    return png;
}

// Envuelve captureAndAnalyze para saber QUIÉN leyó: el bucle en vivo o la captura a
// resolución nativa que v2.05 dispara sola cada 4s (para QRs densos suele ser la única que
// lee, y desde afuera las dos terminan igual: en handleScannedData).
async function instrumentCapture(dev) {
    return dev.eval(`(() => {
        if (!window.__capInstalled && typeof captureAndAnalyze === 'function') {
            window.__capInstalled = true;
            const orig = captureAndAnalyze;
            window.captureAndAnalyze = async (silent) => {
                const r = await orig(silent);
                (window.__capTrace = window.__capTrace || []).push(!!r);
                return r;
            };
        }
        window.__capTrace = [];
        return !!window.__capInstalled;
    })()`);
}

// Abre el escáner tocando el botón y espera a que la cámara decodifique algo.
async function scanWith(dev, buttonId, expectPrefix, timeoutMs = 45000) {
    await instrumentCapture(dev);
    await dev.eval(`document.getElementById('scanned-data').textContent = ''`);
    await dev.eval(`document.getElementById(${JSON.stringify(buttonId)}).click()`, { awaitPromise: false });
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
        const got = await dev.eval(`document.getElementById('scanned-data')?.textContent || ''`);
        if (got) {
            const viaCapture = await dev.eval(`(window.__capTrace || []).some(Boolean)`);
            const r = { ms: Date.now() - t0, data: got, via: viaCapture ? 'captura' : 'bucle en vivo' };
            return got.startsWith(expectPrefix) ? r : { ...r, wrong: true };
        }
        await sleep(500);
    }
    const alive = await dev.eval(`!!document.querySelector('#qr-reader video')?.videoWidth`);
    throw new Error(`${dev.label}: la cámara no leyó el ${expectPrefix} en ${timeoutMs}ms (video ${alive ? 'activo' : 'MUERTO'})`);
}

const describeQr = q => q
    ? `versión ${q.version} (${q.modules} módulos, ${q.moduleCssPx}px por módulo en pantalla)${q.sane ? '' : ` ⚠ medición dudosa: ${q.raw}`}`
    : 'no pude medir el QR';

const pk = () => '0x' + randomBytes(32).toString('hex');

const A = new Dev('A', 9464, path.join(WORK, 'camA.y4m'));
const B = new Dev('B', 9465, path.join(WORK, 'camB.y4m'));

try {
    console.log(`\nEscena: ${SCENE} (${JSON.stringify(SCENES[SCENE])})\nBase: ${BASE}\nTrabajo en: ${WORK}`);

    // Los .y4m tienen que existir antes de abrir Chrome, aunque sea con un cuadro cualquiera.
    const blank = path.join(WORK, 'blank.png');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=white:s=600x600', '-frames:v', '1', blank]);
    for (const dev of [A, B]) makeCameraFile(blank, dev.camFile, 'easy');

    console.log('\n── Levantando A y B con cámara falsa ──');
    await Promise.all([A.launch(), B.launch()]);

    for (const dev of [A, B]) {
        await dev.navigate(BASE);
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(pk())})`);
        await dev.reload();
    }
    const addrA = await A.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    console.log(`   A = ${addrA}\n   B = ${addrB}`);

    // La cámara falsa tiene que estar viva antes de meterse en el flujo.
    const camOk = await A.eval(`(async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            const t = s.getVideoTracks()[0].getSettings();
            s.getTracks().forEach(x => x.stop());
            return t.width + 'x' + t.height;
        } catch (e) { return 'ERR:' + e.name; }
    })()`);
    check('La cámara falsa entrega video a getUserMedia', /^\d+x\d+$/.test(camOk), camOk);

    console.log('\n── Esperando XMTP ──');
    const inboxA = await A.waitXmtp(), inboxB = await B.waitXmtp();
    check('A y B arrancan con inboxes distintos', inboxA !== inboxB);

    // ── Salto 1: B muestra CWL1, A lo LEE CON LA CÁMARA ──────────────────
    console.log('\n── Salto 1: A escanea el pedido de B (CWL1) ──');
    await B.eval(`openRequestAccessModal()`);
    for (let i = 0; i < 20 && !(await B.eval(`!!document.querySelector('#requestQr canvas')`)); i++) await sleep(500);
    const req = await B.eval(`LINK_REQ_PREFIX + currentWallet.address + '|' + myCompressedPubKey()`);
    const qr1 = await qrModules(B, '#requestQr');
    console.log(`   CWL1: ${req.length} chars → ${describeQr(qr1)}`);

    await stageQr(B, A, '#requestQr', 'cwl1');
    await A.eval(`openGrantAccessModal()`);
    const scan1 = await scanWith(A, 'grantScanRequestBtn', 'CWL1|');
    check('A lee el CWL1 con la cámara', scan1.data === req, `${scan1.ms}ms por ${scan1.via}`);

    for (let i = 0; i < 20 && (await A.eval(`document.getElementById('grantStepConfirm').classList.contains('hidden')`)); i++) await sleep(500);
    const peer1 = await A.eval(`document.getElementById('grantPeerAddress').textContent`);
    check('El escaneo abre la confirmación con la address de B', peer1?.toLowerCase() === addrB.toLowerCase(), peer1);

    // ── A arma el desafío ────────────────────────────────────────────────
    console.log('\n── A da acceso (arma el CWL2) ──');
    await A.eval(`document.getElementById('grantConfirmBtn').click()`, { awaitPromise: false });
    for (let i = 0; i < 30 && !(await A.eval(`!!(window.cwLinkState().grant?.payload)`)); i++) await sleep(1000);
    if (await A.eval(`!!(window.cwLinkState().grant?.allowReassign) && !window.cwLinkState().grant?.payload`)) {
        console.log('   (B ya tenía inbox propio: reconfirmando la reasignación)');
        await A.eval(`document.getElementById('grantConfirmBtn').click()`, { awaitPromise: false });
        for (let i = 0; i < 30 && !(await A.eval(`!!(window.cwLinkState().grant?.payload)`)); i++) await sleep(1000);
    }
    const grant = await A.eval(`window.cwLinkState().grant`);
    check('A arma el desafío CWL2', !!grant?.payload?.startsWith('CWL2|'), grant?.payload ? `${grant.payload.length} chars` : await A.eval(`document.getElementById('grantAccessStatus').textContent`));

    // ── Salto 2: B LEE el CWL2 (el largo) CON LA CÁMARA ──────────────────
    console.log('\n── Salto 2: B escanea el desafío de A (CWL2 — el QR más denso) ──');
    for (let i = 0; i < 20 && !(await A.eval(`!!document.querySelector('#grantChallengeQr canvas')`)); i++) await sleep(500);
    const qr2 = await qrModules(A, '#grantChallengeQr');
    console.log(`   CWL2: ${grant.payload.length} chars → ${describeQr(qr2)}`);
    await stageQr(A, B, '#grantChallengeQr', 'cwl2');
    const scan2 = await scanWith(B, 'requestScanChallengeBtn', 'CWL2|');
    check('B lee el CWL2 con la cámara', scan2.data === grant.payload, `${scan2.ms}ms por ${scan2.via}`);

    for (let i = 0; i < 20 && (await B.eval(`document.getElementById('requestStepConfirm').classList.contains('hidden')`)); i++) await sleep(500);
    const peer2 = await B.eval(`document.getElementById('requestPeerAddress').textContent`);
    check('El escaneo abre la confirmación con la address de A', peer2?.toLowerCase() === addrA.toLowerCase(), peer2);

    await B.eval(`document.getElementById('requestConfirmBtn').click()`, { awaitPromise: false });
    for (let i = 0; i < 20 && !(await B.eval(`!!(window.cwLinkState().accept?.response)`)); i++) await sleep(500);
    const resp = await B.eval(`window.cwLinkState().accept?.response`);
    check('B firma y arma el CWL3', !!resp?.startsWith('CWL3|'), resp ? `${resp.length} chars` : await B.eval(`document.getElementById('requestAccessStatus').textContent`));

    // ── Salto 3: A LEE el CWL3 CON LA CÁMARA (segundo uso del mismo .y4m) ─
    console.log('\n── Salto 3: A escanea la respuesta de B (CWL3) ──');
    for (let i = 0; i < 20 && !(await B.eval(`!!document.querySelector('#requestResponseQr canvas')`)); i++) await sleep(500);
    const qr3 = await qrModules(B, '#requestResponseQr');
    console.log(`   CWL3: ${resp.length} chars → ${describeQr(qr3)}`);
    await stageQr(B, A, '#requestResponseQr', 'cwl3');
    const scan3 = await scanWith(A, 'grantScanResponseBtn', 'CWL3|');
    check('A lee el CWL3 con la cámara (la cámara falsa cambió de contenido)', scan3.data === resp, `${scan3.ms}ms por ${scan3.via}`);

    for (let i = 0; i < 40 && (await A.eval(`document.getElementById('grantStepDone').classList.contains('hidden')`)); i++) await sleep(1000);
    check('A llega a la pantalla de éxito', await A.eval(`!document.getElementById('grantStepDone').classList.contains('hidden')`),
        await A.eval(`document.getElementById('grantAccessStatus').textContent`));

    // Y que el MODAL esté abierto, no sólo el paso de adentro: el botón de escanear lo cierra
    // para dejar ver la cámara. Mirar sólo #grantStepDone daba verde mientras el usuario, en el
    // teléfono, no veía absolutamente nada al terminar el paso 3 (bug real, ago 19 2026).
    check('…y el modal vuelve a estar VISIBLE (no sólo el paso de adentro)',
        await A.eval(`(() => { const m = document.getElementById('grantAccessModal');
            // OJO: offsetParent SIEMPRE es null en un position:fixed — no sirve para "¿se ve?".
            const cs = getComputedStyle(m), r = m.getBoundingClientRect();
            return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; })()`),
        'si falla: el ✅ y los errores se escriben en un modal oculto');

    const state = await A.eval(`(async () => {
        const s = await chatwalletxmtp.preferences.fetchInboxState();
        return (s.accountIdentifiers || []).map(i => i.identifier.toLowerCase());
    })()`);
    check('El inbox de A quedó con las dos wallets (vinculación real, solo por cámara)',
        state.includes(addrA.toLowerCase()) && state.includes(addrB.toLowerCase()), JSON.stringify(state));

    console.log(`\nQR medidos (tarjeta de 300px): CWL1 v${qr1?.version} · CWL2 v${qr2?.version} · CWL3 v${qr3?.version}`);
} catch (e) {
    check(`Excepción: ${e.message}`, false);
} finally {
    const ok = results.filter(r => r.ok).length;
    console.log(`\n${ok}/${results.length} ✔`);
    if (!process.env.KEEP) { A.kill(); B.kill(); }
    else console.log(`(KEEP: navegadores vivos, archivos en ${WORK})`);
    process.exit(ok === results.length ? 0 : 1);
}
