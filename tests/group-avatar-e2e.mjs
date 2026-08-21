// E2E de la imagen del grupo: el admin la pone y el resto la ve.
// Dos Chrome headless: A crea el grupo con B, A (admin) elige una imagen desde el
// input de archivo REAL y B tiene que verla al sincronizar. XMTP dev real, sin mocks.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf .parcel-cache-ui   ← con caché Parcel reordena los <script> y Tone queda tarde
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/group-avatar-e2e.mjs
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8817/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = [];
function check(name, ok, extra = '') {
    results.push({ name, ok });
    console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
    return ok;
}

class Dev {
    constructor(label, port) { this.label = label; this.port = port; this.id = 0; this.pending = new Map(); }

    async launch() {
        const dir = fs.mkdtempSync(os.tmpdir() + `/cw-${this.label}-`);
        this.dir = dir;
        this.proc = spawn(CHROME, [
            '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${dir}`,
            '--ignore-certificate-errors', '--window-size=900,1400', 'about:blank',
        ], { stdio: 'ignore' });
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
        const r = await this.rpc('Runtime.evaluate', {
            expression: expr, returnByValue: true, awaitPromise, allowUnsafeEvalBlackholeing: false,
        });
        if (r.result?.exceptionDetails) throw new Error(`${this.label}: ${r.result.exceptionDetails.text} ${r.result.exceptionDetails.exception?.description || ''}`);
        if (r.result?.result?.subtype === 'error') throw new Error(`${this.label}: ${r.result.result.description}`);
        return r.result?.result?.value;
    }

    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(2500); }
    async reload() { await this.rpc('Page.reload'); await sleep(2500); }

    async waitXmtp(timeoutMs = 120000) {
        const t0 = Date.now();
        while (Date.now() - t0 < timeoutMs) {
            const st = await this.eval(`(() => {
                if (!window.chatwalletxmtp) return null;
                try { return window.chatwalletxmtp.inboxId; } catch (e) { return null; }
            })()`);
            if (st) return st;
            await sleep(2000);
        }
        const status = await this.eval(`document.getElementById('status')?.textContent || ''`);
        throw new Error(`${this.label}: XMTP no inicializó en ${timeoutMs}ms (status: "${status}")`);
    }

    kill() { try { this.proc.kill(); } catch { } }
}

const pk = () => '0x' + randomBytes(32).toString('hex');

// Reintenta una expresión hasta que devuelva algo truthy (XMTP tarda en propagar).
async function pollFor(dev, expr, tries = 25, delay = 2000) {
    for (let i = 0; i < tries; i++) {
        try { const v = await dev.eval(expr); if (v) return v; } catch (e) { }
        await sleep(delay);
    }
    return false;
}

const A = new Dev('A', 9494);
const B = new Dev('B', 9495);



try {
    console.log('\n── Levantando los dos dispositivos ──');
    await Promise.all([A.launch(), B.launch()]);

    for (const [dev, k] of [[A, pk()], [B, pk()]]) {
        await dev.navigate(BASE);
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(k)})`);
        await dev.reload();
    }

    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    console.log('\n── Esperando XMTP en los dos ──');
    await A.waitXmtp();
    await B.waitXmtp();

    // ── A crea el grupo con B ────────────────────────────────────────────
    console.log('\n── A crea el grupo "Los del barrio" con B ──');
    const gid = await A.eval(`(async () => {
        const r = await createGroupChat('Los del barrio', [${JSON.stringify(addrB)}]);
        await startChatWithContact(r.contact);
        return r.conv.id;
    })()`);
    check('A crea el grupo y lo abre', !!gid, gid || '');

    // ── A abre la info del grupo: es admin, tiene que ver el lapicito ────
    await A.eval(`openGroupInfo()`);
    await sleep(2500);
    const hintA = await A.eval(`!document.getElementById('groupInfoAvatarHint').classList.contains('hidden')`);
    check('A (admin) ve el lapicito sobre la imagen', hintA === true);
    const beforeSrc = await A.eval(`document.getElementById('groupInfoAvatar').src.slice(0, 30)`);
    check('arranca con el avatar de grupo por defecto', /^data:image\/svg/.test(beforeSrc), beforeSrc);

    // ── El botón tiene que acusar recibo aunque el selector no llegue a abrirse ──
    console.log('\n── A toca el avatar: acuse inmediato ──');
    await A.eval(`document.getElementById('groupInfoAvatarBtn').click()`, { awaitPromise: false });
    await sleep(500);
    const acuse = await A.eval(`document.getElementById('groupInfoStatus').textContent`);
    check('tocar el avatar dice algo en el acto', /Elegí una imagen/.test(acuse || ''), acuse);

    // ── Un archivo que no se puede decodificar avisa, y avisa fuerte ─────
    console.log('\n── A elige algo que no es una imagen ──');
    await A.eval(`(() => {
        const input = document.getElementById('groupAvatarUpload');
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array([1,2,3,4])], 'roto.png', { type: 'image/png' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`, { awaitPromise: false });
    await sleep(3500);
    const errTxt = await A.eval(`document.getElementById('groupInfoStatus').textContent`);
    check('el error se explica en el modal', /No se pudo leer esa imagen/.test(errTxt || ''), errTxt);
    const errToast = await A.eval(`[...document.querySelectorAll('#cwNotifs .cw-notif')].map(e=>e.textContent).join(' | ')`);
    check('y también sale por la pila de notificaciones', /No se pudo leer esa imagen/.test(errToast || ''), errToast.slice(0, 80));

    // ── A elige una FOTO de verdad (600x400): se llena el input y se dispara
    //    'change', así corre el handler real — recortador incluido. ────────
    console.log('\n── A elige una foto y la recorta ──');
    await A.eval(`(async () => {
        const c = document.createElement('canvas'); c.width = 600; c.height = 400;
        const g = c.getContext('2d');
        const grd = g.createLinearGradient(0, 0, 600, 400);
        grd.addColorStop(0, '#f97316'); grd.addColorStop(1, '#4f46e5');
        g.fillStyle = grd; g.fillRect(0, 0, 600, 400);
        g.fillStyle = '#fff'; g.font = 'bold 120px sans-serif'; g.fillText('CW', 60, 260);
        const blob = await new Promise(r => c.toBlob(r, 'image/png'));
        const input = document.getElementById('groupAvatarUpload');
        const dt = new DataTransfer();
        dt.items.add(new File([blob], 'foto.png', { type: 'image/png' }));
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);

    const cropOpen = await pollFor(A, `!document.getElementById('imgCropModal').classList.contains('hidden')`, 15, 800);
    check('se abre el recortador antes de subir nada', cropOpen === true);
    const cropCovers = await A.eval(`(() => {
        const st = window.cwCropState ? window.cwCropState() : null;   // el encuadre siempre tapa el cuadrado, sin huecos
        return !!st && st.img.width * st.scale >= st.out - 0.5 && st.img.height * st.scale >= st.out - 0.5;
    })()`).catch(() => 'no-expuesto');
    if (cropCovers !== 'no-expuesto') check('el encuadre cubre el cuadro (sin bordes vacíos)', cropCovers === true);

    // Acercar un poco y confirmar, como haría un dedo.
    await A.eval(`(() => {
        const z = document.getElementById('imgCropZoom');
        z.value = '1.6'; z.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('imgCropOk').click();
    })()`, { awaitPromise: false });

    const savedA = await pollFor(A, `(() => {
        const s = document.getElementById('groupInfoAvatar').src;
        return /^data:image\\/(webp|jpeg)/.test(s) ? s.length : 0;
    })()`, 30, 2000);
    check('A guarda la imagen y la ve en el modal', !!savedA, savedA ? `${savedA} chars` : await A.eval(`document.getElementById('groupInfoStatus').textContent`));

    // Lo que QUEDA GUARDADO en el grupo es lo que tiene que entrar en 2048 caracteres.
    const stored = await A.eval(`(async () => {
        const conv = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)});
        return conv.imageUrl || '';
    })()`);
    check('lo guardado entra en el campo de XMTP (2048 chars)', stored.length > 0 && stored.length <= 2048,
        `${stored.length} chars · ${stored.slice(0, 46)}…`);
    check('y NO es la foto entera embutida en el campo',
        stored.startsWith('https://') || stored.length < 2048,
        stored.startsWith('https://') ? 'URL del nodo soberano' : 'miniatura inline (plan B)');
    console.log(`   modo: ${stored.startsWith('https://') ? 'nodo IPFS' : 'inline'}`);

    const okToast = await A.eval(`[...document.querySelectorAll('#cwNotifs .cw-notif')].map(e=>e.textContent).join(' | ')`);
    check('el éxito también se avisa arriba', /Imagen del grupo actualizada/.test(okToast || ''), okToast.slice(0, 80));

    const hdrA = await A.eval(`document.getElementById('chatHeaderAvatar').src.slice(0,20)`);
    check('A ve la imagen nueva en el header del chat', /^data:image\/(webp|jpeg)/.test(hdrA), hdrA);

    const rowA = await A.eval(`(() => { const c = contacts.find(c => c.isGroup); return c && c.avatar ? c.avatar.slice(0,20) : ''; })()`);
    check('A la guarda en la fila de la lista de chats', /^data:image\/(webp|jpeg)/.test(rowA), rowA);

    const scrollable = await A.eval(`(() => {
        const box = document.querySelector('#groupInfoModal > div');
        const cs = getComputedStyle(box);
        return cs.overflowY === 'auto' && box.getBoundingClientRect().height <= window.innerHeight;
    })()`);
    check('el modal entra en la pantalla y scrollea (el estado no queda afuera)', scrollable === true);

    // ── B, del otro lado, tiene que verla ────────────────────────────────
    console.log('\n── B sincroniza y la ve ──');
    const seenB = await pollFor(B, `(async () => {
        await chatwalletxmtp.conversations.sync();
        const conv = await chatwalletxmtp.conversations.getConversationById(${JSON.stringify(gid)});
        if (!conv) return 0;
        try { await conv.sync(); } catch (e) {}
        return (conv.imageUrl || '').length;
    })()`, 30, 3000);
    check('a B le llega la imagen del grupo por XMTP', !!seenB, seenB ? `${seenB} chars` : 'sin imagen');

    const rowB = await pollFor(B, `(async () => {
        await syncGroupsFromXmtp();
        const c = contacts.find(c => c.isGroup);
        return c && c.avatar && c.avatar !== GROUP_AVATAR ? 1 : 0;
    })()`, 15, 2000);
    check('B la muestra en su lista de chats', rowB === 1);

    // ── B NO es admin: no puede cambiarla ────────────────────────────────
    console.log('\n── B no es admin ──');
    await B.eval(`(async () => { const c = contacts.find(c => c.isGroup); await startChatWithContact(c); })()`);
    await sleep(3000);
    await B.eval(`openGroupInfo()`);
    await sleep(3000);
    const hintB = await B.eval(`document.getElementById('groupInfoAvatarHint').classList.contains('hidden')`);
    check('B no ve el lapicito', hintB === true);
    await B.eval(`document.getElementById('groupInfoAvatarBtn').click()`, { awaitPromise: false });
    await sleep(500);
    const stB = await B.eval(`document.getElementById('groupInfoStatus').textContent`);
    check('a B se le explica por qué no puede', /admin/i.test(stB || ''), stB);

} catch (e) {
    console.error('\n💥', e);
    results.push({ name: 'el test terminó sin explotar', ok: false });
} finally {
    A.kill(); B.kill();
    const ok = results.filter(r => r.ok).length;
    console.log(`\n──────────\n${ok}/${results.length} checks en verde`);
    process.exit(ok === results.length ? 0 : 1);
}
