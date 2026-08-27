// Cotización del protocolo P2P.me leída directo del Diamond en Base.
//
// Las funciones se EXTRAEN de src/dapp.html y se evalúan: el test prueba lo que se envía,
// no una copia que puede derivar. Y el último bloque compara nuestra lectura contra la del
// SDK (@p2pdotme/sdk, que vive en devDependencies y no viaja en el bundle): si río arriba
// cambian la función, el encoding o los decimales, falla acá y no en un kiosco.
//
//   node tests/p2p-price.mjs

import fs from 'node:fs';
import * as ethers from 'ethers';
import { createPrices } from '@p2pdotme/sdk/prices';

const src = fs.readFileSync(new URL('../src/dapp.html', import.meta.url), 'utf8');

const DESDE = '// ── Cotización del protocolo P2P.me ─';
const HASTA = 'window.cwPrecioP2P = cwPrecioP2P;';
const i = src.indexOf(DESDE);
const f = src.indexOf(HASTA, i);
if (i < 0 || f < 0) throw new Error('No encontré el bloque de cotización en src/dapp.html');
const bloque = src.slice(i, f);

// Valores reales leídos del Diamond en Base el 25/8/2026 (6 decimales).
const ARS = { buyPrice: 1601870000n, sellPrice: 1554530000n, buyPriceOffset: 4000000n, baseSpread: 3000000n };

function almacen() {
    const m = new Map();
    return {
        getItem: k => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: k => m.delete(k),
        _m: m
    };
}

// Carga el bloque con un ethers real salvo Contract, que se sustituye para no tocar la red.
function cargar({ devuelve, falla = false, localStorage = almacen() } = {}) {
    const llamadas = [];
    const fakeEthers = {
        ...ethers,
        JsonRpcProvider: function (url) { llamadas.push(['provider', url]); },
        Contract: function (addr, abi) {
            llamadas.push(['contract', addr]);
            return {
                getPriceConfig: async (b32) => {
                    llamadas.push(['getPriceConfig', b32]);
                    if (falla) throw new Error('RPC caído');
                    return devuelve;
                }
            };
        }
    };
    const api = new Function('ethers', 'localStorage', 'window',
        bloque + '\nreturn { cwPrecioP2P, cwPrecioEdadMin, CW_PRECIO_KEY, CW_P2P_DIAMOND, CW_P2P_RPC };'
    )(fakeEthers, localStorage, {});
    return { ...api, llamadas, localStorage };
}

const tupla = o => Object.assign([o.buyPrice, o.sellPrice, o.buyPriceOffset, o.baseSpread], o);

let ok = 0, mal = 0;
const eq = (a, b, t) => (String(a) === String(b) ? ok++ : (mal++, console.error(`✗ ${t}\n    esperaba ${b}\n    obtuve   ${a}`)));
const yes = (c, t) => (c ? ok++ : (mal++, console.error(`✗ ${t}`)));
const cerca = (a, b, tol, t) => (Math.abs(a - b) < tol ? ok++ : (mal++, console.error(`✗ ${t}: ${a} vs ${b}`)));

// ── Lectura y decodificación ─────────────────────────────────────────────────
{
    const { cwPrecioP2P, llamadas } = cargar({ devuelve: tupla(ARS) });
    const p = await cwPrecioP2P('ARS');
    eq(llamadas.find(l => l[0] === 'contract')[1], '0x4cad6eC90e65baBec9335cAd728DDC610c316368', 'pega contra el Diamond');
    eq(llamadas.find(l => l[0] === 'getPriceConfig')[1],
        ethers.encodeBytes32String('ARS'), 'la moneda va como bytes32');
    cerca(p.compra, 1601.87, 1e-9, 'compra con 6 decimales');
    cerca(p.venta, 1554.53, 1e-9, 'venta con 6 decimales');
    cerca(p.spread, 3, 1e-9, 'spread 3 %');
    yes(typeof p.cuando === 'number' && p.cuando > 0, 'queda la marca de tiempo');
}

// ── La cuenta que ve el usuario ──────────────────────────────────────────────
{
    const { cwPrecioP2P } = cargar({ devuelve: tupla(ARS) });
    const p = await cwPrecioP2P('ARS');
    cerca(5000 / p.venta, 3.2164, 1e-4, 'un QR de $5.000 sale 3,2164 USDC');
    cerca(1000 / p.venta, 0.6433, 1e-4, 'un QR de $1.000 sale 0,6433 USDC');
    // Contra el precio de COMPRA daría 3,1213: usar el lado equivocado son 3 % de diferencia.
    yes(Math.abs(5000 / p.compra - 5000 / p.venta) > 0.09, 'compra y venta NO dan lo mismo');
}

// ── Caché ────────────────────────────────────────────────────────────────────
{
    const { cwPrecioP2P, llamadas } = cargar({ devuelve: tupla(ARS) });
    await cwPrecioP2P('ARS');
    await cwPrecioP2P('ARS');
    eq(llamadas.filter(l => l[0] === 'getPriceConfig').length, 1, 'la segunda lectura no vuelve a la red');
}
{
    // Cotización vieja en disco: hay que ir a buscarla de nuevo.
    const ls = almacen();
    const viejo = { iso: 'ARS', compra: 1, venta: 1000, spread: 3, cuando: Date.now() - 40 * 60000 };
    ls.setItem('cw-precio-p2p-ARS', JSON.stringify(viejo));
    const { cwPrecioP2P, llamadas } = cargar({ devuelve: tupla(ARS), localStorage: ls });
    const p = await cwPrecioP2P('ARS');
    eq(llamadas.filter(l => l[0] === 'getPriceConfig').length, 1, 'una cotización vieja se renueva');
    cerca(p.venta, 1554.53, 1e-9, 'y gana la nueva');
}
{
    // Vieja EN DISCO y sin red: se devuelve igual, pero se puede decir de cuándo es.
    const ls = almacen();
    const viejo = { iso: 'ARS', compra: 1, venta: 1000, spread: 3, cuando: Date.now() - 40 * 60000 };
    ls.setItem('cw-precio-p2p-ARS', JSON.stringify(viejo));
    const { cwPrecioP2P, cwPrecioEdadMin } = cargar({ falla: true, localStorage: ls });
    const p = await cwPrecioP2P('ARS');
    eq(p && p.venta, 1000, 'sin red vuelve la cotización guardada');
    eq(cwPrecioEdadMin(p), 40, 'y se sabe que tiene 40 minutos');
}
{
    // Sin red y sin nada guardado: null, no un precio inventado.
    const { cwPrecioP2P } = cargar({ falla: true });
    eq(await cwPrecioP2P('ARS'), null, 'sin red ni caché no hay precio');
}
{
    // Una moneda que el protocolo no cotiza vuelve en cero. Cero no es un precio.
    const { cwPrecioP2P } = cargar({
        devuelve: tupla({ buyPrice: 0n, sellPrice: 0n, buyPriceOffset: 0n, baseSpread: 0n })
    });
    eq(await cwPrecioP2P('BOB'), null, 'un precio cero se rechaza');
}

// ── Paridad con el SDK ───────────────────────────────────────────────────────
// Un adaptador ethers→PublicClientLike de unas líneas — sólo acá, en el test. Si el SDK
// llamara a otra función, codificara la moneda distinto o leyera otros campos, se ve.
{
    const visto = [];
    const publicClient = {
        async readContract({ address, functionName, args }) {
            visto.push({ address, functionName, args });
            return { ...ARS };            // viem devuelve las tuplas con nombre
        }
    };
    const prices = createPrices({ publicClient, diamondAddress: '0x4cad6eC90e65baBec9335cAd728DDC610c316368' });
    const r = await prices.getPriceConfig({ currency: 'ARS' });
    yes(r.isOk?.() ?? true, 'el SDK contesta bien');
    const suyo = r.isOk?.() ? r.value : r;

    eq(visto[0].functionName, 'getPriceConfig', 'el SDK llama a la misma función');
    eq(visto[0].args[0], ethers.encodeBytes32String('ARS'), 'y codifica ARS con el mismo bytes32');
    eq(visto[0].address.toLowerCase(), '0x4cad6ec90e65babec9335cad728ddc610c316368', 'contra el mismo contrato');

    const { cwPrecioP2P } = cargar({ devuelve: tupla(ARS) });
    const nuestro = await cwPrecioP2P('ARS');
    cerca(Number(suyo.sellPrice) / 1e6, nuestro.venta, 1e-9, 'misma venta que el SDK');
    cerca(Number(suyo.buyPrice) / 1e6, nuestro.compra, 1e-9, 'misma compra que el SDK');
    cerca(Number(suyo.baseSpread) / 1e6, nuestro.spread, 1e-9, 'mismo spread que el SDK');
}

console.log(`\n${mal ? '✗' : '✓'} p2p-price: ${ok}/${ok + mal}`);
process.exit(mal ? 1 : 0);
