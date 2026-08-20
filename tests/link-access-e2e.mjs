// E2E de "Compartir acceso al chat" (CWL1/CWL2/CWL3).
// Tres Chrome headless con perfiles separados: A (dueño del inbox), B (la wallet que
// pide acceso) y C (un tercero con quien chatear). Corre contra XMTP dev real y el
// nodo de respaldo de la caja — no hay mocks.
//
// Cómo correrlo:
//   1. nvm use 22 && corepack enable
//   2. rm -rf .parcel-cache-ui  ← IMPRESCINDIBLE: con caché, Parcel reordena los
//      <script> y Tone.min.js queda después del script clásico, que muere con
//      "Tone is not defined" y la app no arranca.
//      yarn parcel build src/dapp.html --dist-dir /tmp/cwui --public-url ./ --cache-dir .parcel-cache-ui
//      (build OPTIMIZADO: con --no-optimize el orden de scripts tampoco es el de prod)
//   3. cd /tmp/cwui && python3 -m http.server 8817 &
//   4. unset NODE_OPTIONS && node tests/link-access-e2e.mjs
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

    // Espera a que el cliente XMTP exista y esté sincronizado.
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
async function pollFor(dev, expr, tries = 20, delay = 2000) {
    for (let i = 0; i < tries; i++) {
        try { const v = await dev.eval(expr); if (v) return v; } catch (e) { }
        await sleep(delay);
    }
    return false;
}

const A = new Dev('A', 9444);
const B = new Dev('B', 9445);
const C = new Dev('C', 9446);

try {
    console.log('\n── Levantando los dos dispositivos ──');
    await Promise.all([A.launch(), B.launch(), C.launch()]);

    const pkA = pk(), pkB = pk(), pkC = pk();
    for (const [dev, k] of [[A, pkA], [B, pkB], [C, pkC]]) {
        await dev.navigate(BASE);
        // El SW cachea dapp.html y ya nos mordió antes: fuera para el test.
        await dev.eval(`(async () => { for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); })()`);
        await dev.eval(`localStorage.setItem('xmtp-chat-wallet', ${JSON.stringify(k)})`);
        await dev.reload();
    }

    const addrA = await A.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    const addrB = await B.eval(`new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address`);
    console.log(`   A = ${addrA}\n   B = ${addrB}`);

    console.log('\n── Esperando XMTP en los dos ──');
    const inboxA = await A.waitXmtp();
    const inboxB = await B.waitXmtp();
    await C.waitXmtp();
    console.log(`   inbox A = ${inboxA}\n   inbox B = ${inboxB}`);
    check('A y B arrancan con inboxes distintos', inboxA !== inboxB);

    // ── Estado previo en A: contactos + lápida + respaldo subido ──────────
    console.log('\n── Sembrando estado en A (contactos, bloqueado, respaldo) ──');
    const ghost = '0x' + randomBytes(20).toString('hex');
    const friend = '0x' + randomBytes(20).toString('hex');
    await A.eval(`(async () => {
        contacts.push({ name: 'Amiga de prueba', address: ${JSON.stringify(friend)}, unreadCount: 0,
            lastMessage: null, lastMessageTimestamp: 0, status: 'offline', lastSeen: null, avatar: ANON_AVATAR, pubKey: null });
        await saveContacts();
        await setTombstone(${JSON.stringify(ghost)}, { blocked: true, left: false, name: 'Bloqueado de prueba' });
        await msgStorePut([{ id: 'e2e-' + Date.now(), peer: ${JSON.stringify(friend.toLowerCase())}, dir: 'sent',
            typeId: 'text', content: 'mensaje sembrado para el test', ts: Date.now(), sender: null }]);
        markChatBackupDirty();
    })()`).catch(e => { console.log('   (seed parcial:', e.message, ')'); });

    // Identidad: A tiene perfil propio y B tiene OTRO. El perfil va con el inbox, así que
    // después de adoptar el acceso B tiene que quedar mostrándose como A, no como B.
    await A.eval(`(() => { localStorage.setItem('chatwallet-user-profile', JSON.stringify(
        { alias: 'energiasonora', links: 'https://chatwallet.org', avatar: '' })); updateUserProfile(); })()`);
    await B.eval(`(() => { localStorage.setItem('chatwallet-user-profile', JSON.stringify(
        { alias: 'la-vieja-de-B', links: '', avatar: '' })); updateUserProfile(); })()`);

    const backedUp = await A.eval(`(async () => { try { await chatBackupNow(); return true; } catch (e) { return 'ERR:' + e.message; } })()`);
    check('A sube un respaldo al nodo soberano', backedUp === true, backedUp === true ? '' : String(backedUp));

    // ── Paso 1: B genera el pedido (CWL1) ────────────────────────────────
    console.log('\n── Paso 1: B pide acceso ──');
    await B.eval(`openRequestAccessModal()`);
    const req = await B.eval(`LINK_REQ_PREFIX + currentWallet.address + '|' + myCompressedPubKey()`);
    check('B genera un pedido CWL1 con address + pubkey',
        req.startsWith('CWL1|') && req.includes(addrB) && req.split('|')[2]?.length === 66, req.slice(0, 60) + '…');

    // ── Paso 2: A lo recibe y arma el desafío (CWL2) ─────────────────────
    console.log('\n── Paso 2: A da acceso ──');
    await A.eval(`window.handleScannedData(${JSON.stringify(req)})`);
    const confirmVisible = await A.eval(`!document.getElementById('grantStepConfirm').classList.contains('hidden')
        && document.getElementById('grantPeerAddress').textContent`);
    check('A muestra la pantalla de confirmación con la address de B',
        String(confirmVisible).toLowerCase() === addrB.toLowerCase(), String(confirmVisible));

    await A.eval(`document.getElementById('grantConfirmBtn').click()`, { awaitPromise: false });
    // unsafe_addAccountSignatureText + ECIES + respaldo: dar tiempo de red.
    for (let i = 0; i < 30 && !(await A.eval(`!!(window.cwLinkState().grant?.payload)`)); i++) await sleep(1000);

    // B ya venía usando XMTP con su propia wallet, así que tiene inbox propio: el flujo
    // exige una segunda confirmación explícita antes de reasignarlo. Ese es el caso normal.
    const needsReassign = await A.eval(`!!(window.cwLinkState().grant?.allowReassign) && !window.cwLinkState().grant?.payload`);
    check('A avisa que la otra wallet ya tiene chat propio y pide reconfirmar', needsReassign === true,
        await A.eval(`document.getElementById('grantConfirmBtn').textContent`));
    if (needsReassign) {
        await A.eval(`document.getElementById('grantConfirmBtn').click()`, { awaitPromise: false });
        for (let i = 0; i < 30 && !(await A.eval(`!!(window.cwLinkState().grant?.payload)`)); i++) await sleep(1000);
    }

    const grant = await A.eval(`window.cwLinkState().grant`);
    check('A obtiene un signatureRequestId de XMTP', !!grant?.signatureRequestId, grant?.signatureRequestId || await A.eval(`document.getElementById('grantAccessStatus').textContent`));
    check('A arma el desafío CWL2 (texto a firmar + BK cifrada)',
        !!grant?.payload && grant.payload.startsWith('CWL2|'), grant?.payload ? `${grant.payload.length} chars` : '');
    check('El desafío NO lleva la BK en claro',
        !!grant?.payload && !grant.payload.includes(await A.eval(`(async () => await chatBackupExportKey())()`)));

    const challengeVisible = await A.eval(`!document.getElementById('grantStepChallenge').classList.contains('hidden')`);
    check('A pasa a la pantalla del QR del desafío', challengeVisible === true);

    // ── Paso 3: B firma ──────────────────────────────────────────────────
    console.log('\n── Paso 3: B firma el desafío ──');
    const bkBefore = await B.eval(`(async () => await chatBackupExportKey())()`);
    await B.eval(`window.handleScannedData(${JSON.stringify(grant.payload)})`);
    const peerShown = await B.eval(`document.getElementById('requestPeerAddress').textContent`);
    check('B muestra de quién es el inbox al que se va a asociar', peerShown?.toLowerCase() === addrA.toLowerCase(), peerShown);

    await B.eval(`document.getElementById('requestConfirmBtn').click()`, { awaitPromise: false });
    for (let i = 0; i < 20 && !(await B.eval(`!!(window.cwLinkState().accept?.response)`)); i++) await sleep(500);

    const bkAfter = await B.eval(`(async () => await chatBackupExportKey())()`);
    const bkA = await A.eval(`(async () => await chatBackupExportKey())()`);
    check('B importa la clave de respaldo de A (y no es la que tenía)', bkAfter === bkA && bkAfter !== bkBefore);

    const resp = await B.eval(`window.cwLinkState().accept?.response`);
    check('B devuelve una respuesta CWL3 firmada',
        !!resp && resp.startsWith('CWL3|') && resp.split('|')[2]?.length === 132, resp ? resp.slice(0, 50) + '…' : await B.eval(`document.getElementById('requestAccessStatus').textContent`));
    const sigOk = await B.eval(`ethers.verifyMessage(window.cwLinkState().accept.text, window.cwLinkState().accept.response.split('|')[2]).toLowerCase() === currentWallet.address.toLowerCase()`);
    check('La firma de B verifica contra el texto del desafío', sigOk === true);

    // ── Paso 4: A aplica ─────────────────────────────────────────────────
    console.log('\n── Paso 4: A aplica la asociación ──');
    await A.eval(`window.handleScannedData(${JSON.stringify(resp)})`, { awaitPromise: true });
    for (let i = 0; i < 40 && (await A.eval(`document.getElementById('grantStepDone').classList.contains('hidden')`)); i++) await sleep(1000);
    const doneVisible = await A.eval(`!document.getElementById('grantStepDone').classList.contains('hidden')`);
    check('A llega a la pantalla de éxito', doneVisible === true,
        doneVisible ? '' : await A.eval(`document.getElementById('grantAccessStatus').textContent`));

    const stateA = await A.eval(`(async () => {
        const s = await chatwalletxmtp.preferences.fetchInboxState();
        return { inboxId: s.inboxId, accounts: (s.accountIdentifiers || []).map(i => i.identifier.toLowerCase()) };
    })()`);
    check('El inbox de A ahora incluye la wallet de B',
        stateA.accounts.includes(addrB.toLowerCase()) && stateA.accounts.includes(addrA.toLowerCase()),
        JSON.stringify(stateA.accounts));

    const listed = await A.eval(`(async () => { await renderLinkedAccounts(); return document.getElementById('linkedAccountsList').textContent; })()`);
    check('Configuración lista la wallet vinculada con botón Quitar',
        listed.toLowerCase().includes(addrB.slice(0, 10).toLowerCase()) && listed.includes('Quitar'), listed.replace(/\s+/g, ' ').trim());

    // ── Paso 5: B activa y reinicia ──────────────────────────────────────
    console.log('\n── Paso 5: B activa el acceso y reinicia ──');
    await B.eval(`document.getElementById('requestActivateBtn').click()`, { awaitPromise: false });
    await sleep(3000);
    const epoch = await B.eval(`localStorage.getItem('cw-xmtp-db-epoch-' + new ethers.Wallet(localStorage.getItem('xmtp-chat-wallet')).address.toLowerCase())`);
    check('B abre una base local nueva (época 1)', epoch === '1', String(epoch));

    const inboxB2 = await B.waitXmtp(180000);
    check('B entra al MISMO inbox que A', inboxB2 === inboxA, `${inboxB2} vs ${inboxA}`);

    // El restore corre dentro de setupXmtpService; darle margen a bajar y descifrar el blob.
    await sleep(8000);
    const dataB = await B.eval(`(async () => ({
        contacts: contacts.map(c => c.name),
        hasFriend: contacts.some(c => c.address.toLowerCase() === ${JSON.stringify(friend.toLowerCase())}),
        tombstones: (await loadTombstones(), Object.keys(tombstones || {})),
        msgs: await msgStoreCount(),
    }))()`);
    check('B recupera el contacto de A', dataB.hasFriend === true, JSON.stringify(dataB.contacts));
    check('B recupera la lápida del bloqueado',
        dataB.tombstones.map(t => t.toLowerCase()).includes(ghost.toLowerCase()), JSON.stringify(dataB.tombstones));
    check('B recupera mensajes del historial', dataB.msgs > 0, `${dataB.msgs} mensajes`);

    // La identidad sigue al permiso: B deja de ser "la-vieja-de-B" y pasa a mostrarse como A.
    const idB = await B.eval(`(() => {
        const p = JSON.parse(localStorage.getItem('chatwallet-user-profile') || 'null');
        return { alias: p && p.alias, links: p && p.links,
                 sidebar: document.getElementById('userProfileName')?.textContent || '' };
    })()`);
    check('B adopta el perfil del inbox (alias de A, no el suyo)', idB.alias === 'energiasonora',
        `alias=${idB.alias} links=${idB.links}`);
    check('…y la barra lateral de B ya muestra esa identidad', idB.sidebar === 'energiasonora', idB.sidebar);

    // Y el perfil viejo de B no se perdió: quedó en el archivo, junto con su historial.
    const archProfile = await B.eval(`(async () => {
        const list = JSON.parse(localStorage.getItem('cw-history-archives') || '[]');
        if (!list.length) return null;
        const rec = await archiveGet(list[list.length - 1].id);
        return rec && rec.blob && rec.blob.profile ? rec.blob.profile.alias : null;
    })()`);
    check('El perfil viejo de B queda archivado (no se pierde)', archProfile === 'la-vieja-de-B', String(archProfile));

    // ── Paso 6: la seed de A nunca viajó ─────────────────────────────────
    const seedLeak = await B.eval(`localStorage.getItem('xmtp-chat-wallet')`);
    check('La llave privada de B sigue siendo la suya (la seed de A no viajó)',
        seedLeak === pkB && seedLeak !== pkA);

    // ── Paso 7: un tercero chatea y B (wallet distinta) lee y responde ────
    console.log('\n── Paso 7: chat real con un tercero ──');
    const marker = 'e2e-' + randomBytes(4).toString('hex');
    const sent = await C.eval(`(async () => {
        const conv = await chatwalletxmtp.conversations.createDmWithIdentifier(
            { identifier: ${JSON.stringify(addrA.toLowerCase())}, identifierKind: 0 });
        await conv.sendText('hola ' + ${JSON.stringify(marker)});
        return conv.id;
    })()`);
    check('C abre un DM contra la wallet de A y manda un mensaje', !!sent, sent);

    const seenByB = await pollFor(B, `(async () => {
        await chatwalletxmtp.conversations.syncAll();
        for (const c of await chatwalletxmtp.conversations.list()) {
            for (const m of await c.messages()) {
                if (typeof m.content === 'string' && m.content.includes(${JSON.stringify(marker)})) return true;
            }
        }
        return false;
    })()`, 30);
    check('B (wallet distinta, dispositivo nuevo) recibe el mensaje dirigido a A', seenByB === true);

    const reply = 'respuesta ' + marker;
    const replied = await B.eval(`(async () => {
        await chatwalletxmtp.conversations.syncAll();
        for (const c of await chatwalletxmtp.conversations.list()) {
            for (const m of await c.messages()) {
                if (typeof m.content === 'string' && m.content.includes(${JSON.stringify(marker)})) {
                    await c.sendText(${JSON.stringify(reply)});
                    return true;
                }
            }
        }
        return false;
    })()`);
    check('B puede responder en esa conversación', replied === true);

    const seenByC = await pollFor(C, `(async () => {
        await chatwalletxmtp.conversations.syncAll();
        for (const c of await chatwalletxmtp.conversations.list()) {
            for (const m of await c.messages()) {
                if (typeof m.content === 'string' && m.content === ${JSON.stringify(reply)}) return true;
            }
        }
        return false;
    })()`, 30);
    check('C recibe la respuesta de B como si viniera de A', seenByC === true);

    const stillLinked = await A.eval(`(async () => {
        const s = await chatwalletxmtp.preferences.fetchInboxState();
        return (s.accountIdentifiers || []).length;
    })()`);
    check('El inbox sigue con las dos wallets antes de revocar', stillLinked === 2, String(stillLinked));

    // ── MEDICIÓN: ¿puede B salirse SOLO del inbox prestado? ───────────────────────
    // El botón manual "↩ Mi identidad" hoy devuelve el alias pero deja los chats heredados
    // (los del dueño) puestos: estado incoherente. Devolverle también SUS chats exige salir
    // del inbox, y para eso B tendría que poder quitarse a sí mismo. Eso no está medido.
    console.log('\n── MEDICIÓN: ¿B puede quitarse a sí mismo del inbox prestado? ──');
    const autoQuit = await B.eval(`(async () => {
        try {
            await chatwalletxmtp.removeAccount({ identifier: currentWallet.address.toLowerCase(), identifierKind: 0 });
            const st = await chatwalletxmtp.preferences.fetchInboxState();
            return { ok: true, accounts: (st.accountIdentifiers || []).map(i => i.identifier.toLowerCase()) };
        } catch (e) { return { ok: false, err: e.message }; }
    })()`);
    console.log('   removeAccount sobre sí mismo →', JSON.stringify(autoQuit));
    const salioSolo = autoQuit.ok === true && Array.isArray(autoQuit.accounts)
        && !autoQuit.accounts.includes(addrB.toLowerCase());
    // Queda como aserción del hecho MEDIDO, no como deseo: si algún día XMTP lo permitiera,
    // esto se pone en rojo y hay que volver a mirar el diseño de la salida.
    check('XMTP NO deja que el prestado se saque solo (sólo el dueño puede)', salioSolo === false,
        autoQuit.ok ? 'ahora SÍ puede: revisar el diseño' : `rechazo: ${autoQuit.err}`);

    // ── Paso 8: A revoca el acceso de B ──────────────────────────────────
    console.log('\n── Paso 8: A quita el acceso ──');
    // Por el botón real de Configuración, que pide dos toques (el primero avisa).
    await A.eval(`(async () => { await renderLinkedAccounts(); })()`);
    await A.eval(`document.querySelector('.unlink-account-btn').click()`, { awaitPromise: false });
    await sleep(500);
    check('El botón Quitar avisa antes de ejecutar',
        (await A.eval(`document.querySelector('.unlink-account-btn').textContent`)) === 'Confirmar');
    await A.eval(`document.querySelector('.unlink-account-btn').click()`, { awaitPromise: false });
    await sleep(15000);
    const removed = await A.eval(`(async () => {
        try {
            const s = await chatwalletxmtp.preferences.fetchInboxState();
            return (s.accountIdentifiers || []).map(i => i.identifier.toLowerCase());
        } catch (e) { return 'ERR:' + e.message; }
    })()`);
    check('A puede quitarle el acceso a B',
        Array.isArray(removed) && !removed.includes(addrB.toLowerCase()) && removed.includes(addrA.toLowerCase()),
        JSON.stringify(removed));

    // Quitar la cuenta tiene que cortar el acceso FUTURO. Lo ya descargado sigue en el
    // dispositivo de B: esto mide lo primero, no lo segundo.
    const after = 'post-revoke ' + marker;
    await C.eval(`(async () => {
        const conv = await chatwalletxmtp.conversations.createDmWithIdentifier(
            { identifier: ${JSON.stringify(addrA.toLowerCase())}, identifierKind: 0 });
        await conv.sendText(${JSON.stringify(after)});
    })()`);
    const stillReceives = await pollFor(B, `(async () => {
        try { await chatwalletxmtp.conversations.syncAll(); } catch (e) { return false; }
        for (const c of await chatwalletxmtp.conversations.list()) {
            for (const m of await c.messages()) {
                if (typeof m.content === 'string' && m.content === ${JSON.stringify(after)}) return true;
            }
        }
        return false;
    })()`, 8, 3000);
    check('Revocado, B ya NO recibe los mensajes nuevos de A', stillReceives === false,
        stillReceives ? 'SIGUE RECIBIENDO' : '');

    const stillSees = await A.eval(`(async () => {
        await chatwalletxmtp.conversations.syncAll();
        for (const c of await chatwalletxmtp.conversations.list()) {
            for (const m of await c.messages()) {
                if (typeof m.content === 'string' && m.content === ${JSON.stringify(after)}) return true;
            }
        }
        return false;
    })()`);
    check('A sigue recibiendo con normalidad después de revocar', stillSees === true);

    // ── Paso 9: la vuelta al DID propio, disparada por la REVOCACIÓN ──────────────
    // El usuario lo pidió remoto: si la wallet dueña te saca, el dispositivo revocado vuelve
    // solo a su identidad, su historial y su inbox. Acá se prueba ese camino entero.
    console.log('\n── Paso 9: B vuelve solo a su DID ──');
    const senal = await B.eval(`(async () => {
        const out = {};
        try {
            const st = await chatwalletxmtp.preferences.fetchInboxState();
            out.accounts = (st.accountIdentifiers || []).map(i => i.identifier.toLowerCase());
        } catch (e) { out.accounts = 'THROW: ' + e.message; }
        out.miAddress = currentWallet.address.toLowerCase();
        return out;
    })()`);
    check('B puede DETECTAR la revocación (fetchInboxState responde y ya no lo incluye)',
        Array.isArray(senal.accounts) && !senal.accounts.includes(senal.miAddress),
        JSON.stringify(senal.accounts));

    // Se borra la marca a propósito: así se prueba el camino MÁS difícil, el de quien adoptó
    // antes de que la marca existiera (v2.10). La detección no debe depender de ella — alcanza
    // con que el inbox donde estamos ya no tenga nuestra address.
    await B.eval(`localStorage.removeItem('cw-adopted-inbox-' + currentWallet.address.toLowerCase())`);
    const reverted = await B.eval(`checkAdoptedAccessRevoked()`);
    check('El chequeo dispara la vuelta al DID propio', reverted === true, String(reverted));

    // La vuelta programa un location.reload() a los 1200ms. Sin esperarlo, waitXmtp lee la
    // página VIEJA —donde chatwalletxmtp todavía apunta al inbox del dueño— y devuelve al
    // instante un valor que ya no significa nada (me comió dos corridas).
    await sleep(8000);
    const inboxB3 = await B.waitXmtp(180000);
    // Medido: XMTP le devuelve a esta address SU inbox de siempre (mismo id que antes de la
    // adopción) en las dos corridas bien medidas. La aserción igual pide sólo lo que de verdad
    // importa —que deje de ser el inbox del dueño— porque el id lo decide XMTP, no nosotros.
    check('B sale del inbox del dueño y vuelve a uno PROPIO', !!inboxB3 && inboxB3 !== inboxA,
        inboxB3 === inboxB ? 'y es el mismo de antes de adoptar' : `inbox nuevo (el original era ${inboxB.slice(0, 12)}…)`);

    await sleep(4000);
    const backB = await B.eval(`(async () => {
        const p = JSON.parse(localStorage.getItem('chatwallet-user-profile') || 'null');
        const arch = JSON.parse(localStorage.getItem('cw-history-archives') || '[]');
        return {
            alias: p && p.alias,
            sidebar: document.getElementById('userProfileName')?.textContent || '',
            adoptedMark: localStorage.getItem('cw-adopted-inbox-' + currentWallet.address.toLowerCase()),
            bk: await chatBackupExportKey(),
            razones: arch.map(a => a.reason),
        };
    })()`);
    check('B vuelve a su identidad propia', backB.alias === 'la-vieja-de-B' && backB.sidebar === 'la-vieja-de-B',
        `alias=${backB.alias} sidebar=${backB.sidebar}`);
    check('La llave de respaldo vuelve a ser la suya (deja de escribir con la de A)',
        backB.bk !== bkA, backB.bk === bkA ? 'SIGUE CON LA DE A' : '');
    check('El historial adoptado queda archivado, no borrado a ciegas',
        backB.razones.includes('revoked'), JSON.stringify(backB.razones));
    check('Se limpia la marca de inbox adoptado', backB.adoptedMark === null, String(backB.adoptedMark));

} catch (e) {
    console.error('\n💥', e.message);
    results.push({ name: 'excepción: ' + e.message, ok: false });
} finally {
    const ok = results.filter(r => r.ok).length;
    console.log(`\n──────────── ${ok}/${results.length} ────────────`);
    for (const r of results) if (!r.ok) console.log('   FALLA:', r.name);
    A.kill(); B.kill(); C.kill();
    process.exit(ok === results.length ? 0 : 1);
}
