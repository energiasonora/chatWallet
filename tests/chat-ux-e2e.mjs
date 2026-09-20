// Las cuatro quejas del chat, contra XMTP real con dos navegadores:
//   · responder tiene que llegar COMO respuesta (con la cita), no como mensaje suelto
//   · copiar y reenviar tienen que existir en el picker — y reenviar, ADEMÁS, funcionar
//   · los emojis de la barrita tienen que ser editables
// El bug de la respuesta era que se mandaba el contenido ya codificado en vez del objeto
// más su content type: el receptor no veía typeId 'reply' y dibujaba una burbuja pelada.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import fs from 'node:fs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8840/dapp';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; return c; };

class Dev {
    constructor(label, port) { this.label = label; this.port = port; this.id = 0; this.pending = new Map(); this.errores = []; }
    async launch() {
        // Si quedó un Chrome de una corrida anterior escuchando en este puerto, el spawn nuevo
        // se muere en silencio y el test se ata al VIEJO: con la página vieja, los errores viejos
        // y un veredicto que no corresponde al código de ahora. Dos horas de confusión.
        try {
            const r = await fetch(`http://127.0.0.1:${this.port}/json/version`);
            if (r.ok) throw new Error(`el puerto ${this.port} ya lo tiene otro Chrome: cerralo antes de correr`);
        } catch (e) { if (/ya lo tiene otro Chrome/.test(e.message)) throw e; }
        this.dir = fs.mkdtempSync(os.tmpdir() + `/cw-${this.label}-`);
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run',
            '--no-default-browser-check', `--remote-debugging-port=${this.port}`,
            `--user-data-dir=${this.dir}`, '--window-size=900,1400', 'about:blank'], { stdio: 'ignore' });
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
            this.ws.onopen = async () => { await this.rpc('Page.enable'); await this.rpc('Runtime.enable'); resolve(); };
            this.ws.onerror = reject;
            this.ws.addEventListener('message', e => {
                const m = JSON.parse(e.data);
                // Un error adentro de un listener (un onclick, por ejemplo) no vuelve por el
                // eval: queda sólo en la consola. Sin esto, un botón roto se ve como "no pasó nada".
                if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error')
                    this.errores.push((m.params.args || []).map(a => a.description || a.value || '').join(' ').slice(0, 300));
                if (m.method === 'Runtime.exceptionThrown')
                    this.errores.push('EXCEPCIÓN: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || '').slice(0, 300));
                if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
            });
        });
    }
    rpc(method, params = {}) {
        const id = ++this.id;
        return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); });
    }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        const ex = r.result?.exceptionDetails;
        if (ex) throw new Error(`[${this.label}] ` + (ex.exception?.description || ex.text).slice(0, 300));
        return r.result?.result?.value;
    }
    async navigate(url) { await this.rpc('Page.navigate', { url }); await sleep(3000); }
    async waitXmtp(ms = 180000) {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            const v = await this.eval(`(() => { try { return window.chatwalletxmtp?.inboxId || null; } catch (e) { return null; } })()`);
            if (v) return v;
            await sleep(2000);
        }
        return null;
    }
    async abrirChat(addr) {
        await this.eval(`(async () => {
            let c = contacts.find(x => (x.address||'').toLowerCase() === ${JSON.stringify(addr)}.toLowerCase());
            if (!c) { c = { name: 'peer', address: ${JSON.stringify(addr)}, unreadCount: 0, status: 'offline' };
                      contacts.push(c); await saveContacts(); }
            await startChatWithContact(c);
            return true;
        })()`);
        for (let i = 0; i < 40; i++) { await sleep(1500); if (await this.eval(`!!currentConversation`)) break; }
    }
    kill() {
        // SIGKILL: con el TERM por defecto Chrome a veces sobrevive y se queda con el puerto.
        try { this.proc.kill('SIGKILL'); } catch { }
        try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { }
    }
}

// ── Antes de encender nada: los dos errores que dejaron mudo a "reenviar" ─────
// Los dos son invisibles en el navegador (uno tira ReferenceError adentro de un listener,
// el otro cuelga el worker sin devolver error), así que se revisan sobre el archivo.
const fuente = fs.readFileSync('src/dapp.html', 'utf8');

console.log('── el archivo, antes de abrir el navegador ──');
// 1) Nada del <script type="module"> puede llamarse desde el <script> clásico: son scopes
//    distintos. escHtml() vivía en el módulo y reenviar lo llamaba desde el clásico.
const bloquesScript = [];
for (let i = 0; ;) {
    const a = fuente.indexOf('<script', i); if (a < 0) break;
    const g = fuente.indexOf('>', a), f = fuente.indexOf('</script>', g);
    if (g < 0 || f < 0) break;
    bloquesScript.push([fuente.slice(a + 7, g), fuente.slice(g + 1, f)]);
    i = f + 9;                      // seguir DESPUÉS del cierre: un "<script>" citado adentro no cuenta
}
const declara = /^\s{0,20}(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const nombresDe = (txt) => [...txt.matchAll(declara)].map(m => m[1]);
const enModulos = bloquesScript.filter(([a]) => a.includes('type="module"')).map(([, c]) => c).join('\n');
const enClasico = bloquesScript.filter(([a]) => !a.includes('type=') && !a.includes('src=')).map(([, c]) => c).join('\n');
const declaradosClasico = new Set(nombresDe(enClasico));
const expuestos = new Set([...enModulos.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)].map(m => m[1]));
const cruzados = [...new Set(nombresDe(enModulos))].filter(n =>
    !declaradosClasico.has(n) && !expuestos.has(n) &&
    new RegExp('(?<![.\\w$])' + n + '\\s*\\(').test(enClasico));
ok(cruzados.length === 0, 'nada del <script type="module"> se llama desde el clásico sin pasar por window',
    cruzados.join(', '));

// 2) identifierKind es el enum numérico del SDK. Con la cadena 'Ethereum' la llamada no
//    falla: se cuelga, y el usuario ve el timeout genérico un minuto después.
const kinds = [...fuente.matchAll(/identifierKind:\s*([^,\s}]+)/g)].map(m => m[1]);
ok(kinds.every(k => /^\d+$/.test(k)), 'identifierKind siempre numérico, nunca el nombre',
    [...new Set(kinds.filter(k => !/^\d+$/.test(k)))].join(', '));

const A = new Dev('ana', 9381);
const B = new Dev('beto', 9382);
const C = new Dev('carlos', 9383);   // el destino del reenvío

try {
    console.log('── dos identidades ──');
    for (const d of [A, B]) {
        await d.launch();
        await d.navigate(BASE + '.html');
        await d.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
        await d.navigate(BASE + '.html');
        ok(!!(await d.waitXmtp()), `${d.label} tiene identidad XMTP`);
    }
    const addrA = await A.eval(`currentWallet.address`);
    const addrB = await B.eval(`currentWallet.address`);
    await A.abrirChat(addrB);
    await B.abrirChat(addrA);

    console.log('\n── el picker tiene lo que faltaba ──');
    const picker = await A.eval(`(() => {
        // Se construye sin depender del long-press, que no se puede simular fiable por CDP.
        const p = ensureReactionPicker();
        const botones = [...p.querySelectorAll('button')];
        return { total: botones.length,
                 titulos: botones.map(b => b.title).filter(Boolean),
                 emojis: botones.filter(b => /\\p{Emoji}/u.test(b.textContent) && !b.title).map(b => b.textContent) };
    })()`);
    ok(picker.titulos.some(x => /Copiar|Copy/i.test(x)), 'hay botón de copiar', JSON.stringify(picker.titulos));
    ok(picker.titulos.some(x => /Reenviar|Forward/i.test(x)), 'hay botón de reenviar');
    ok(picker.titulos.some(x => /emojis/i.test(x)), 'hay botón para editar los emojis');

    console.log('\n── los emojis de la barrita se pueden cambiar ──');
    const emo = await A.eval(`(() => {
        const antes = emojisRapidos();
        guardarEmojisRapidos(['🔥','🚀','🧉']);
        const despues = emojisRapidos();
        const enPicker = [...ensureReactionPicker().querySelectorAll('button')].map(b => b.textContent);
        guardarEmojisRapidos([]);                       // volver al defecto
        return { antes, despues, enPicker, vuelta: emojisRapidos() };
    })()`);
    ok(emo.despues.join('') === '🔥🚀🧉', 'se guardan los elegidos', emo.despues.join(''));
    ok(emo.enPicker.includes('🧉'), 'y el picker se reconstruye con ellos');
    ok(emo.vuelta.length === 6, 'vaciarlo restaura los de fábrica, no deja el picker mudo', emo.vuelta.join(''));

    console.log('\n── responder: el bug ──');
    await A.eval(`(async () => { await currentConversation.sendText('mensaje original de ana'); })()`);
    await sleep(20000);
    const idEnB = await B.eval(`(async () => {
        for (let i = 0; i < 30; i++) {
            const m = [...msgTextById.entries()].find(([, v]) => v.text === 'mensaje original de ana');
            if (m) return m[0];
            await new Promise(r => setTimeout(r, 1500));
        }
        return null;
    })()`);
    ok(!!idEnB, 'beto recibió el mensaje original');

    // Beto responde usando el mismo camino que la UI.
    await B.eval(`(async () => {
        const enc = new window.ReplyCodec().encode(
            { reference: ${JSON.stringify(idEnB)}, content: 'esto es una respuesta', contentType: window.ContentTypeText },
            { codecFor: () => new window.TextCodec() });
        await currentConversation.send(enc);
    })()`);
    await sleep(22000);

    // Lo que importa: ¿le llega a Ana COMO respuesta?
    const enAna = await A.eval(`(async () => {
        for (let i = 0; i < 30; i++) {
            // Sin sync(): el worker WASM puede no volver nunca y colgar el test entero.
            // messages() pega en la base local, que el stream ya viene llenando.
            const ms = await currentConversation.messages({ limit: 50n });
            const r = ms.find(m => m.contentType?.typeId === 'reply');
            if (r) return { tipo: r.contentType.typeId, ref: r.content?.reference || r.content?.referenceId || null,
                            texto: typeof r.content?.content === 'string' ? r.content.content : null };
            await new Promise(res => setTimeout(res, 1500));
        }
        const ms = await currentConversation.messages({ limit: 50n });
        return { tipos: ms.map(m => m.contentType?.typeId) };
    })()`);
    ok(enAna.tipo === 'reply', 'llega con content type "reply", no como texto suelto', JSON.stringify(enAna));
    ok(enAna.ref === idEnB, 'y apunta al mensaje original');
    ok(enAna.texto === 'esto es una respuesta', 'con el texto correcto adentro');

    // Y la cita se dibuja en pantalla.
    const cita = await A.eval(`(async () => {
        for (let i = 0; i < 20; i++) {
            const q = document.querySelector('#messagesContainer .reply-quote');
            if (q) return (q.innerText || '').replace(/\\s+/g, ' ').trim();
            await new Promise(r => setTimeout(r, 1500));
        }
        return null;
    })()`);
    ok(!!cita, 'y en pantalla se dibuja la cita del original', String(cita).slice(0, 60));

    // La respuesta también tiene que QUEDAR guardada: el contenido de una respuesta no es
    // texto plano y trae un BigInt del SDK, con el que JSON.stringify revienta. La excepción
    // subía hasta el stream y el mensaje no se guardaba nunca — sin guardar no hay respaldo
    // soberano ni reconciliación entre las dos puntas.
    const guardada = await A.eval(`(async () => {
        for (let i = 0; i < 20; i++) {
            const recs = await msgStoreGetByPeer(${JSON.stringify(addrB)}.toLowerCase());
            const r = recs.find(x => (x.content || '').includes('esto es una respuesta'));
            if (r) return { typeId: r.typeId, dir: r.dir };
            await new Promise(res => setTimeout(res, 1500));
        }
        return null;
    })()`);
    ok(!!guardada, 'la respuesta queda en el almacén local (antes la mataba un BigInt)', JSON.stringify(guardada));
    ok(!A.errores.some(x => /serialize a BigInt/i.test(x)), 'y no hubo ninguna excepción de BigInt en el camino',
        A.errores.filter(x => /BigInt/i.test(x)).join(' | ').slice(0, 200));

    // ── Reenviar de verdad ────────────────────────────────────────────────────
    // Hasta acá el test sólo miraba que el BOTÓN existiera. Existía, y no hacía nada:
    // abrirReenviar() llamaba a escHtml(), que vivía en un <script type="module"> y desde el
    // script clásico no se ve — ReferenceError adentro del listener, silencioso. Por eso ahora
    // se aprieta el botón real y se sigue el mensaje hasta el tercer dispositivo.
    console.log('\n── reenviar: del picker al otro contacto ──');
    await C.launch();
    await C.navigate(BASE + '.html');
    await C.eval(`localStorage.setItem('xmtp-chat-wallet', '0x' + ${JSON.stringify(randomBytes(32).toString('hex'))})`);
    await C.navigate(BASE + '.html');
    ok(!!(await C.waitXmtp()), 'carlos tiene identidad XMTP');
    const addrC = await C.eval(`currentWallet.address`);

    // Carlos entra en la agenda de Ana, pero Ana sigue parada en el chat con Beto.
    await A.eval(`(async () => {
        if (!contacts.find(c => (c.address||'').toLowerCase() === ${JSON.stringify(addrC)}.toLowerCase()))
            contacts.push({ name: 'carlos', address: ${JSON.stringify(addrC)}, unreadCount: 0, status: 'offline' });
        await saveContacts();
        return contacts.length;
    })()`);

    const convAntes = await A.eval(`currentConversation?.id || null`);
    const abierto = await A.eval(`(() => {
        const par = [...msgTextById.entries()].find(([, v]) => v.text === 'mensaje original de ana');
        if (!par) return { error: 'no encuentro el mensaje en el hilo de ana' };
        showReactionPicker(par[0], document.getElementById('messagesContainer'));
        const btn = [...document.querySelectorAll('#reactionPicker button')].find(b => /Reenviar|Forward/i.test(b.title || ''));
        if (!btn) return { error: 'no hay botón de reenviar en el picker' };
        btn.click();                                    // el camino real, con su onclick y todo
        const modal = document.getElementById('forwardModal');
        return {
            visible: !!modal && !modal.classList.contains('hidden'),
            destinos: [...document.querySelectorAll('#forwardList button')].map(b => b.innerText.trim()),
        };
    })()`);
    ok(abierto.visible === true, 'el botón abre el modal (antes tiraba ReferenceError y no pasaba nada)', JSON.stringify(abierto));
    ok((abierto.destinos || []).some(x => /carlos/i.test(x)), 'y lista a carlos como destino', JSON.stringify(abierto.destinos));
    ok(!(abierto.destinos || []).some(x => /beto/i.test(x)), 'sin ofrecer el chat donde ya estás');

    await A.eval(`(() => {
        const b = [...document.querySelectorAll('#forwardList button')].find(x => /carlos/i.test(x.innerText));
        b.click();
        return true;
    })()`);
    await sleep(2000);
    ok(await A.eval(`document.getElementById('forwardModal').classList.contains('hidden')`),
        'al elegir destino el modal se cierra');
    // Lo que le dice a Ana: si el envío falla, el aviso es lo único que ella ve.
    const aviso = await A.eval(`(async () => {
        for (let i = 0; i < 20; i++) {
            const t = [...document.querySelectorAll('.cw-notif')].map(n => (n.innerText || '').trim());
            if (t.some(x => /Reenviado|Forwarded|No se pudo|Could not/i.test(x))) return t;
            await new Promise(r => setTimeout(r, 1500));
        }
        return [];
    })()`);
    ok((aviso || []).some(x => /Reenviado a|Forwarded to/i.test(x)), 'y le avisa a ana que salió', JSON.stringify(aviso));
    ok(await A.eval(`(currentConversation?.id || null) === ${JSON.stringify(convAntes)}`),
        'y ana sigue parada en el chat con beto, no la mudó el reenvío');

    const llego = await C.eval(`(async () => {
        for (let i = 0; i < 40; i++) {
            try {
                await chatwalletxmtp.conversations.syncAll();
                const convs = await chatwalletxmtp.conversations.list();
                for (const cv of convs) {
                    const ms = await cv.messages({ limit: 50n });
                    if (ms.some(m => typeof m.content === 'string' && m.content === 'mensaje original de ana')) return true;
                }
            } catch (e) { }
            await new Promise(r => setTimeout(r, 2000));
        }
        return false;
    })()`);
    ok(llego === true, 'y el mensaje reenviado le llega a carlos',
        A.errores.filter(x => /reenviar/i.test(x)).join(' | '));

} finally { A.kill(); B.kill(); C.kill(); }

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
