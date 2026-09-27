// Lector de QR de Ğ1 (src/js/g1-billetera.js → leerQrG1). Los casos siguen la prueba de
// Cesium² (cesium2s/src/app/scan/payment-request.spec.ts); los vectores de clave v1 y su
// suma de control se sacaron con @polkadot/util-crypto aparte (27/9/2026).
// Correr:  node tests/g1-qr.mjs        (Node 22, sin NODE_OPTIONS)
import { leerQrG1 } from '../src/js/g1-billetera.js';

let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); } };
const V1 = [
    { pk: 'US517G5965aydkZ46HS38QLi7UQiSojurfbQfKCELFx', ck: 'Gqp', g1: 'g1K8z3GB5niRiZszrkJNYBFUJZhdbeqVyjkNj9XD8r3DaCnhV' },
    { pk: '144aLB2AXRPXCkyeVpyU8kHr4p56Vhwfy8cdz1unGjHR', ck: 'H2n', g1: 'g1JzoGB4VjWJTDyEpcuXa8KZdNi2sBp93XEzoeqaopU3vdX4g' },
    { pk: 'Cs8KY3PiWrCMAytMsBRQo8EdGbticVtdvufLnb2UhXh', ck: 'HPK', g1: 'g1K3kkX5sKyDgqJ43hubVf3gVVGDfqzZJZKbpuJsNoz89dhwA' },
];
const A = V1[0].g1;
const SOPHIE = 'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH';

console.log('Formatos');
const sola = leerQrG1(SOPHIE);
check('dirección sola → perfil, no pago', sola && sola.g1 === SOPHIE && !sola.esPago && sola.monto === null);
for (const e of ['june://', 'g1://', 'duniter:key/', 'JUNE://']) {
    const r = leerQrG1(`${e}${A}?amount=12.50&comment=Caf%C3%A9%20%26%20pain`);
    check(`${e} con monto y comentario`, r && r.g1 === A && r.monto === 1250 && r.comentario === 'Café & pain' && r.esPago, JSON.stringify(r));
}
check('coma decimal', leerQrG1(`june://${A}?amount=2,5`)?.monto === 250);
check('sin monto', leerQrG1(`june://${A}`)?.monto === null);
check('espacios alrededor', leerQrG1(`  ${SOPHIE}\n`)?.g1 === SOPHIE);

console.log('Claves v1 (vectores de @polkadot/util-crypto)');
for (const v of V1) {
    check(`${v.pk.slice(0, 8)}… → g1`, leerQrG1(v.pk)?.g1 === v.g1, leerQrG1(v.pk)?.g1);
    check(`${v.pk.slice(0, 8)}…:${v.ck} suma válida`, leerQrG1(`${v.pk}:${v.ck}`)?.g1 === v.g1);
}
check('suma de control mala → null', leerQrG1(`${V1[0].pk}:xxx`) === null);
check('duniter:key/ con clave v1 y suma', leerQrG1(`duniter:key/${V1[2].pk}:${V1[2].ck}?amount=1`)?.g1 === V1[2].g1);

console.log('Rechazos');
for (const a of ['-1', '0', 'NaN', 'Infinity', '1e3', '1.001', '9007199254740992', '']) {
    check(`monto ${JSON.stringify(a)}`, leerQrG1(`june://${A}?amount=${a}`) === null);
}
check('otra moneda (gtest)', leerQrG1(`june://${A}?amount=1&currency=gtest`) === null);
check('monto duplicado', leerQrG1(`june://${A}?amount=1&amount=10`) === null);
check('unidad DU', leerQrG1(`june://${A}?amount=1&unit=du`) === null);
check('URL cualquiera', leerQrG1(`https://example.org/${A}?amount=1`) === null);
check('g1://sso-login', leerQrG1('g1://sso-login?amount=1') === null);
check('dirección con checksum SS58 roto', leerQrG1(SOPHIE.slice(0, -1) + 'x') === null);
check('dirección sola con consulta (no es pago)', leerQrG1(`${SOPHIE}?amount=1`) === null);
check('0x no es Ğ1', leerQrG1('0x2222222222222222222222222222222222222222') === null);

console.log(`\n${ok} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
