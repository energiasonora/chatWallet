// Empaqueta cw-monero.mjs (+ monero-ts) a ../src/static/monero/, fuera de Parcel.
import { build } from 'esbuild';
import fs from 'node:fs';
const salida = new URL('../src/static/monero/', import.meta.url).pathname;
fs.mkdirSync(salida, { recursive: true });
const vacio = new URL('./vacio.cjs', import.meta.url).pathname;
const agente = new URL('./agente.cjs', import.meta.url).pathname;
const sinWasm = new URL('./sin-wasm.cjs', import.meta.url).pathname;
const nodeQueNoHay = /^(child_process|fs|path|net|tls)$/;
await build({
    entryPoints: ['cw-monero.mjs'], bundle: true, format: 'iife', globalName: 'cwMonero',
    platform: 'browser', target: 'es2020', minify: true, legalComments: 'none',
    outfile: salida + 'cw-monero.js', define: { global: 'globalThis' }, inject: ['./shim.js'],
    plugins: [{
        name: 'cw', setup(b) {
            b.onResolve({ filter: /^#monero-ts\/monero\.js$/ }, () => ({ path: sinWasm }));
            b.onResolve({ filter: nodeQueNoHay }, () => ({ path: vacio }));
            b.onResolve({ filter: /^https?$/ }, () => ({ path: agente }));
        }
    }],
});
fs.copyFileSync('node_modules/monero-ts/dist/monero.worker.js', salida + 'monero.worker.js');
for (const f of ['cw-monero.js', 'monero.worker.js']) console.log(f, (fs.statSync(salida + f).size / 1048576).toFixed(2), 'MB');
