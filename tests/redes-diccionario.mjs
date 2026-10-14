// «Añadir red»: lista viva + copia incluida, elección del nodo sano y freno al RPC de otra cadena.
// La página corre en Chrome headless (CDP). La lista viva y los nodos son de mentira (se
// intercepta fetch), así cada caso es determinista; la copia incluida es la real del build.
// Se corre con tests/run-redes-diccionario.sh.
import { spawn } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import * as ethers from 'ethers';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE || 'http://127.0.0.1:8854/dapp.html';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x !== '' ? ' — ' + x : ''}`); if (!c) fallas++; };

const INICIO = `
try { localStorage.setItem('xmtp-chat-wallet', '${ethers.Wallet.createRandom().privateKey}'); localStorage.setItem('chatwallet-lang', 'es'); } catch (e) {}
window.__vivo = true; window.__pedidosVivos = 0;
const NODOS = { 'rpc-lento.test': [0, 400], 'rpc-rapido.test': [0, 30], 'rpc-tortuga.test': [0, 2200], 'rpc-otra.test': [1, 20], 'solo.test': [777002, 20] };
const fetchReal = window.fetch.bind(window);
const esperar = ms => new Promise(r => setTimeout(r, ms));
window.fetch = async (url, opts) => {
    const u = typeof url === 'string' ? url : (url && url.url) || '';
    if (u.startsWith('https://chainid.network/')) {
        window.__pedidosVivos++;
        if (!window.__vivo) throw new TypeError('Failed to fetch');
        const copia = await (await fetchReal('chainsv1.json')).json();
        return new Response(JSON.stringify([...copia,
            { name: 'Red Nueva', chainId: 777001, infoURL: 'https://www.rpc-lento.test', nativeCurrency: { symbol: 'NUE', decimals: 18 }, explorers: [{ url: 'https://explora.test' }],
              rpc: ['http://inseguro.test', 'https://rpc-muerto.test', 'wss://rpc-rapido.test', 'https://rpc-lento.test', 'https://rpc-otra.test', 'https://rpc-rapido.test', 'https://con-llave.test/\${API_KEY}'] },
            { name: 'Red Oficial Lenta', chainId: 777005, infoURL: 'https://rpc-tortuga.test', nativeCurrency: { symbol: 'LEN', decimals: 18 }, rpc: ['https://rpc-tortuga.test', 'https://rpc-lento.test', 'https://rpc-rapido.test'] },
            { name: 'Red Sin Sitio', chainId: 777004, nativeCurrency: { symbol: 'SIN', decimals: 18 }, rpc: ['https://rpc-muerto.test', 'https://rpc-lento.test', 'https://rpc-rapido.test'] },
            { name: 'Red Muerta', chainId: 777003, nativeCurrency: { symbol: 'MUE', decimals: 18 }, rpc: ['https://rpc-muerto.test', 'https://rpc-otra.test'] }]));
    }
    const m = u.match(/^https?:\\/\\/([a-z.-]+\\.test)/);
    if (m) {
        const nodo = NODOS[m[1]];
        if (!nodo) throw new TypeError('Failed to fetch');
        await esperar(nodo[1]);
        // Los nodos con 0 atienden a la cadena que el formulario tenga escrita en ese momento.
        const id = nodo[0] || Number(document.getElementById('networkChainId').value);
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: '0x' + id.toString(16) }));
    }
    return fetchReal(url, opts);
};`;

class Dev {
    constructor(port) { this.port = port; this.id = 0; this.pending = new Map(); }
    async launch() {
        this.dir = fs.mkdtempSync(os.tmpdir() + '/cw-redes-');
        this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
            `--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`, '--window-size=420,900', 'about:blank'], { stdio: 'ignore' });
        for (let i = 0; i < 60; i++) {
            await sleep(500);
            try {
                const page = (await (await fetch(`http://127.0.0.1:${this.port}/json/list`)).json()).find(t => t.type === 'page');
                if (page) return this.connect(page.webSocketDebuggerUrl);
            } catch { }
        }
        throw new Error('Chrome no levantó');
    }
    connect(url) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(url);
            this.ws.onopen = async () => {
                await this.rpc('Page.enable'); await this.rpc('Runtime.enable');
                await this.rpc('Page.addScriptToEvaluateOnNewDocument', { source: INICIO });
                resolve();
            };
            this.ws.onerror = reject;
            this.ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); } };
        });
    }
    rpc(method, params = {}) { const id = ++this.id; return new Promise(res => { this.pending.set(id, res); this.ws.send(JSON.stringify({ id, method, params })); }); }
    async eval(expr) {
        const r = await this.rpc('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
        if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
        return r.result?.result?.value;
    }
    kill() { try { this.proc.kill(); } catch { } try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch { } }
}

const dev = new Dev(9413);
await dev.launch();
const form = `(() => ({ nombre: networkNameInput.value, rpc: networkRpcUrlInput.value, exp: networkExplorerUrlInput.value,
    simbolo: document.getElementById('nativeSymbol').value, alt: networkRpcUrlInput.dataset.alternativas || '',
    estado: document.getElementById('networkRpcStatus').textContent, oculto: document.getElementById('networkRpcStatus').classList.contains('hidden'),
    color: document.getElementById('networkRpcStatus').className, redes: optionsList.length }))()`;
const tipear = (id) => dev.eval(`(() => { networkChainIdInput.value = '${id}'; networkChainIdInput.dispatchEvent(new Event('input', { bubbles: true })); })()`);
const hasta = async (cond, tope = 15000) => { for (const t0 = Date.now(); Date.now() - t0 < tope; await sleep(150)) { const f = await dev.eval(form); if (cond(f)) return f; } return dev.eval(form); };
const guardar = () => dev.eval(`handleAddNewNetwork({ preventDefault() {} }).then(() => true)`);

try {
    await dev.rpc('Page.navigate', { url: BASE });
    for (let i = 0; i < 80 && !(await dev.eval(`typeof handleAutocomplete === 'function' && typeof optionsList !== 'undefined' && !!document.getElementById('networkRpcStatus')`).catch(() => false)); i++) await sleep(500);

    // ── 1. Sin lista viva: la copia incluida alcanza, y ya trae Arc ──
    await dev.eval(`window.__vivo = false; openAddNetworkModal()`);
    await tipear(5042002);
    let f = await hasta(x => x.nombre);
    ok(f.nombre === 'Arc Network Testnet' && f.simbolo === 'USDC', 'sin lista viva, la copia incluida conoce Arc (5042002)', `${f.nombre} · ${f.simbolo}`);
    ok(/^https:\/\//.test(f.rpc) && /^https:\/\//.test(f.exp), 'trae RPC y explorador https', f.rpc);

    await tipear(777001);
    await sleep(1200);
    f = await dev.eval(form);
    ok(f.nombre === 'Arc Network Testnet', 'una red que la copia no conoce, sin lista viva, no pisa nada');

    // ── 2. Con lista viva: aparece la red nueva y queda el nodo sano más rápido ──
    await dev.eval(`window.__vivo = true; closeAddNetworkModal(); openAddNetworkModal()`);
    await tipear(777001);
    f = await hasta(x => /Responden/.test(x.estado));
    ok(f.nombre === 'Red Nueva' && f.simbolo === 'NUE' && f.exp === 'https://explora.test', 'la lista viva suma una red que la copia no tiene', f.nombre);
    ok(f.rpc === 'https://rpc-lento.test' && /oficial/.test(f.estado), 'queda el nodo de la propia red aunque otro sea más rápido', f.rpc);
    ok(f.alt === JSON.stringify(['https://rpc-lento.test', 'https://rpc-rapido.test']), 'de repuesto quedan sólo los sanos, sin el muerto ni el de otra cadena', f.alt);
    ok(/Responden 2 de 4/.test(f.estado) && /text-green-400/.test(f.color), 'avisa cuántos responden (http, ws y con llave ni se prueban)', f.estado);

    const pedidosTrasExito = await dev.eval(`window.__pedidosVivos`);

    // ── 3. Guardar ──
    const antes = f.redes;
    await guardar();
    f = await dev.eval(form);
    const guardada = await dev.eval(`(() => { const r = optionsList.find(n => n.TOKEN_CHAINID === '777001'); return r ? { api: r.API, rpc: r.rpc, sim: r.NATIVE_SYMBOL } : null; })()`);
    ok(f.redes === antes + 1 && guardada?.api === 'https://rpc-lento.test' && guardada.rpc?.length === 2, 'la red se guarda con su nodo y el repuesto', JSON.stringify(guardada));

    // ── 4. RPC de otra cadena: no se guarda ──
    await dev.eval(`openAddNetworkModal(); networkChainIdInput.value = '777009'; networkNameInput.value = 'Trucha'; networkRpcUrlInput.value = 'https://rpc-otra.test'; document.getElementById('nativeSymbol').value = 'TRU'`);
    await guardar();
    f = await dev.eval(form);
    ok(f.redes === antes + 1 && /otra red \(chain ID 1, no 777009\)/.test(f.estado), 'un RPC que contesta otro chain ID frena el guardado y dice cuál', f.estado);

    // ── 5. RPC mudo: se guarda igual (nodo privado o sin red) ──
    await dev.eval(`networkRpcUrlInput.value = 'https://rpc-muerto.test'`);
    await guardar();
    f = await dev.eval(form);
    ok(f.redes === antes + 2, 'un RPC que no contesta se guarda igual, con aviso');

    // ── 6. Ningún nodo vivo ──
    await dev.eval(`openAddNetworkModal()`);
    await tipear(777003);
    f = await hasta(x => /Ningún/.test(x.estado));
    ok(/Ningún nodo/.test(f.estado) && /text-amber-400/.test(f.color) && f.nombre === 'Red Muerta', 'si ninguno responde lo dice, y deja completar a mano', f.estado);

    // ── 6b. Sin nodo de la propia red: el primero sano en el orden de la lista ──
    await dev.eval(`openAddNetworkModal()`);
    await tipear(777004);
    f = await hasta(x => /Responden/.test(x.estado));
    ok(f.rpc === 'https://rpc-rapido.test' && /más rápido/.test(f.estado) && /2 de 3/.test(f.estado), 'sin nodo oficial queda el más rápido de los sanos', `${f.rpc} · ${f.estado}`);

    // ── 6c. El oficial responde, pero lentísimo: queda el más rápido y el oficial de repuesto ──
    await dev.eval(`openAddNetworkModal()`);
    await tipear(777005);
    f = await hasta(x => /Responden/.test(x.estado));
    ok(f.rpc === 'https://rpc-rapido.test' && f.alt === JSON.stringify(['https://rpc-rapido.test', 'https://rpc-lento.test', 'https://rpc-tortuga.test']) && /más rápido/.test(f.estado),
        'un oficial que tarda más de 1,5 s cede el lugar al más rápido y queda último de repuesto', f.alt);

    // ── 7. Tipear rápido: gana el último ──
    await dev.eval(`openAddNetworkModal()`);
    await tipear(777001); await tipear(8453);
    f = await hasta(x => /Responden|Ningún/.test(x.estado), 20000);
    ok(/base/i.test(f.nombre) && !/\.test/.test(f.rpc), 'una prueba vieja no pisa a la red que quedó escrita', `${f.nombre} · ${f.rpc}`);
    ok(await dev.eval(`window.__pedidosVivos`) === pedidosTrasExito, 'una vez que la lista viva llegó, no se vuelve a pedir en la sesión', pedidosTrasExito);

    // ── 8. Al reabrir, el aviso se limpia ──
    await dev.eval(`openAddNetworkModal()`);
    f = await dev.eval(form);
    ok(f.oculto && !f.estado, 'el aviso de nodos no queda pegado al reabrir el formulario');
} catch (e) { ok(false, 'el test se cayó', e.message); }
finally { dev.kill(); }
console.log(fallas ? `\n${fallas} fallas` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
