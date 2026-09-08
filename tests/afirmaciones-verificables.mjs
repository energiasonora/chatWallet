// Lo que la app afirma en público tiene que ser cierto y comprobable.
//
// Hubo dos textos que no lo eran: "sin token" en la dapp y "sin preventa" en la landing.
// Las dos son falsas — existe CWLT en Arbitrum One y hubo una preventa real con compradores.
// Una afirmación que se cae abriendo la propia app es peor que no decir nada.
//
// No necesita navegador: son los archivos fuente.   node tests/afirmaciones-verificables.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/, '');
let fails = 0;
const ok = (c, m, extra = '') => { console.log(`${c ? '✅' : '❌'} ${m}${extra ? ' — ' + extra : ''}`); if (!c) fails++; };

const dapp = fs.readFileSync(path.join(RAIZ, 'src/dapp.html'), 'utf8');
const landing = fs.readFileSync(path.join(RAIZ, 'src/index.html'), 'utf8');

// ── afirmaciones que los hechos desmienten ──
console.log('── nada que la cadena desmienta ──');
const prohibidas = [
    [/sin\s+token\b/i, '"sin token" — existe CWLT en Arbitrum One'],
    [/\bno\s+token\b/i, '"no token" — existe CWLT en Arbitrum One'],
    [/sans\s+token\b/i, '"sans token" — existe CWLT en Arbitrum One'],
    [/sin\s+preventa/i, '"sin preventa" — hubo preventa real, con compradores'],
    [/no\s+token\s+presale/i, '"no token presale" — hubo preventa real'],
    [/sans\s+prévente/i, '"sans prévente" — hubo preventa real'],
];
for (const [archivo, texto] of [['dapp.html', dapp], ['index.html', landing]]) {
    // Sólo el texto visible: los comentarios de código no le hablan a nadie.
    const visible = texto.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [re, porque] of prohibidas) {
        const m = visible.match(re);
        ok(!m, `${archivo}: no afirma ${porque}`, m ? `encontrado: "${m[0]}"` : '');
    }
}

// ── y el token que muestra es el de verdad ──
console.log('\n── la app apunta al token real ──');
const MAINNET = '0x4697bDe7F6B40790D11C9Ab7628Fa4827fcE8bAe';   // CWLT en Arbitrum One
const TESTNET = '0x2aC45C33602E1a8450302100F1897BFF6C91a5d6';   // el del ensayo, en Sepolia
const bloque = dapp.slice(dapp.indexOf('const generalOptions'), dapp.indexOf('const generalOptions') + 1200);
ok(bloque.includes(MAINNET), 'generalOptions usa el CWLT de Arbitrum One');
ok(!bloque.includes(TESTNET), 'y no el de testnet, que mostraba un saldo inexistente');
ok(/CHATWALLET_RPC[^,]*arb1\.arbitrum\.io/.test(bloque), 'con un RPC de Arbitrum One');

console.log(`\n${fails === 0 ? '✅ todo en orden' : `❌ ${fails} fallo(s)`}`);
process.exit(fails === 0 ? 0 : 1);
