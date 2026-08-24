// Banco de pruebas del lector de QR de pago (EMVCo / Transferencias 3.0).
//
// Dos cosas se verifican acá:
//   1. Que el olfateador y el lector propios hagan lo que decimos.
//   2. **Paridad con el protocolo**: que nuestro veredicto coincida con el de
//      @p2pdotme/sdk para todo el corpus. El SDK ya NO viaja en el bundle (pesaba 7,7 KB
//      gzip para todo el mundo por una función que sirve en un país), así que la garantía
//      de leer lo mismo que el proveedor de liquidez del otro lado pasó de estar enviada a
//      estar testeada. Si río arriba cambian el criterio, esto se pone rojo.
//
// Las funciones NO se copian: se extraen de src/dapp.html y se evalúan. Así se prueba el
// código que realmente se envía, y una copia no puede derivar en silencio.
//
// Correr:  node tests/ars-qr-parse.mjs        (Node 22, sin NODE_OPTIONS)

import fs from 'node:fs';
import { parseQR } from '@p2pdotme/sdk/qr-parsers';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
    else { fail++; console.log(`  ❌ ${nombre}${extra ? ' — ' + extra : ''}`); }
};

// ── Traer el código real de la app ────────────────────────────────────────────
const DAPP = 'src/dapp.html';
const src = fs.readFileSync(DAPP, 'utf8');
const DESDE = '// ═══════════════════ QR de pago de comercio (EMVCo) ═══════════════════';
const HASTA = 'window.cwArsCrcOk = cwArsCrcOk;';
const i = src.indexOf(DESDE), f = src.indexOf(HASTA);
if (i < 0 || f < 0) {
    console.error(`✗ No encontré el bloque de QR de pago en ${DAPP}. ¿Le cambiaron los marcadores?`);
    process.exit(1);
}
globalThis.window = globalThis;   // el bloque hace window.x = x
const { cwEmvTags, cwSniffPaymentQr, cwArsCrcOk, CW_PAYMENT_QR } =
    new Function(src.slice(i, f + HASTA.length) +
        '\nreturn { cwEmvTags, cwSniffPaymentQr, cwArsCrcOk, CW_PAYMENT_QR };')();

// ── Armado de QR EMVCo (longitudes y CRC en bytes UTF-8) ─────────────────────
// EMVCo declara la longitud en BYTES, no en caracteres, y el CRC va sobre bytes. Con JS
// hay que medir en UTF-8 a mano o "CAFÉ" (4 caracteres, 5 bytes) sale mal en los dos.
function crc16ccitt(s) {
    let crc = 0xFFFF;
    for (const b of new TextEncoder().encode(s)) {
        crc ^= b << 8;
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
const tag = (t, v) => t + String(Buffer.byteLength(v, 'utf8')).padStart(2, '0') + v;
function armarQr({ pais = 'AR', moneda = '032', comercio = 'COMERCIO', monto = null } = {}) {
    let p = tag('00', '01') + tag('01', monto ? '12' : '11')
        + tag('26', tag('00', 'ar.com.mercadolibre') + tag('01', '0011223344'))
        + tag('52', '5411') + tag('53', moneda);
    if (monto) p += tag('54', monto);
    p += tag('58', pais) + tag('59', comercio) + tag('60', 'BUENOS AIRES') + '6304';
    return p + crc16ccitt(p);
}

// ── El olfateador ─────────────────────────────────────────────────────────────
console.log('\n▶ Olfateador: reconoce el país por los tags 58 y 53');
{
    const ar = cwSniffPaymentQr(armarQr({ comercio: 'KIOSCO' }));
    check('reconoce Argentina', ar && ar.id === 'ars', JSON.stringify(ar));
    check('Argentina está lista (tiene plugin)', ar && ar.listo === true);

    const pe = cwSniffPaymentQr(armarQr({ pais: 'PE', moneda: '604', comercio: 'BODEGA' }));
    check('reconoce Perú', pe && pe.id === 'pen', JSON.stringify(pe));
    check('Perú NO está listo todavía', pe && pe.listo === false);

    const bo = cwSniffPaymentQr(armarQr({ pais: 'BO', moneda: '068' }));
    check('reconoce Bolivia', bo && bo.id === 'bob');

    // Que el mecanismo sea genérico y no un `if` argentino disfrazado.
    check('la tabla cubre más de un país', Object.keys(CW_PAYMENT_QR).length >= 4);

    const br = cwSniffPaymentQr(armarQr({ pais: 'BR', moneda: '986' }));
    check('un país sin entrada devuelve null', br === null, JSON.stringify(br));
}

console.log('\n▶ Olfateador: reconoce aunque el QR esté dañado');
{
    // Si el recorrido TLV se corta, el respaldo por subcadena lo agarra igual — para poder
    // decirle al usuario QUÉ le pasa en vez de "QR no reconocido".
    const roto = armarQr({ comercio: 'TEST' }).replace('5411', '54XX');
    check('un TLV cortado sigue reconociéndose como argentino',
        (cwSniffPaymentQr(roto) || {}).id === 'ars');
}

// ── El lector ─────────────────────────────────────────────────────────────────
console.log('\n▶ Lector: comercio y monto');
{
    const t1 = cwEmvTags(armarQr({ comercio: 'KIOSCO LA ESQUINA', monto: '1500.00' }));
    check('saca el nombre del comercio', t1['59'] === 'KIOSCO LA ESQUINA', t1['59']);
    check('saca el monto', t1['54'] === '1500.00', t1['54']);
    const t2 = cwEmvTags(armarQr({ comercio: 'VERDULERIA DON JOSE' }));
    check('un QR estático no trae monto', t2['54'] === undefined);
}

console.log('\n▶ Lector: acentos y ñ (la mitad de los comercios argentinos)');
for (const nombre of ['CAFE MARTINEZ', 'CAFÉ MARTÍNEZ', 'ÑANDÚ SRL', 'ALMACÉN "EL ÑOQUI"']) {
    check(`${nombre} sale entero`, cwEmvTags(armarQr({ comercio: nombre }))['59'] === nombre,
        cwEmvTags(armarQr({ comercio: nombre }))['59']);
}

console.log('\n▶ Veredicto del checksum');
{
    const bueno = armarQr({ comercio: 'TEST', monto: '100' });
    check('acepta un CRC correcto', cwArsCrcOk(bueno) === true);
    check('rechaza un CRC alterado', cwArsCrcOk(bueno.slice(0, -4) + '0000') === false);
    check('rechaza si falta el tag 63', cwArsCrcOk(bueno.slice(0, -8)) === false);
    check('rechaza cadena vacía', cwArsCrcOk('') === false);
    check('rechaza algo que no es cadena', cwArsCrcOk(null) === false);
}

// ── Paridad con el protocolo ──────────────────────────────────────────────────
console.log('\n▶ Paridad: mismo veredicto que @p2pdotme/sdk');
{
    const bueno = armarQr({ comercio: 'KIOSCO LA ESQUINA', monto: '1500.00' });
    const corpus = [
        ['válido con monto', bueno],
        ['válido sin monto', armarQr({ comercio: 'VERDULERIA' })],
        ['válido con acentos', armarQr({ comercio: 'CAFÉ MARTÍNEZ' })],
        ['válido con ñ', armarQr({ comercio: 'ÑANDÚ SRL' })],
        ['CRC alterado', bueno.slice(0, -4) + '0000'],
        ['sin tag 63', bueno.slice(0, -8)],
        ['truncado a la mitad', bueno.slice(0, Math.floor(bueno.length / 2))],
        ['CRC en minúsculas', bueno.slice(0, -4) + bueno.slice(-4).toLowerCase()],
        ['con espacios alrededor', '  ' + bueno + '  '],
    ];
    for (const [nombre, qr] of corpus) {
        const suyo = (await parseQR({ qrData: qr, currency: 'ARS', sellPrice: 1 })).isOk();
        const nuestro = !!cwSniffPaymentQr(qr) && cwArsCrcOk(qr.trim());
        check(`${nombre}: coincide (${suyo ? 'válido' : 'inválido'})`, suyo === nuestro,
            `SDK dice ${suyo}, nosotros ${nuestro}`);
    }
}

console.log('\n▶ El bug de bytes del SDK sigue ahí (y nosotros no lo tenemos)');
for (const nombre of ['CAFÉ MARTÍNEZ', 'ÑANDÚ SRL']) {
    const qr = armarQr({ comercio: nombre });
    const suyo = await parseQR({ qrData: qr, currency: 'ARS', sellPrice: 1 });
    const sobra = Buffer.byteLength(nombre, 'utf8') - nombre.length;
    const leidoSdk = suyo.isOk() ? suyo.value.paymentAddress : '(rechazado)';
    check(`el SDK devuelve ${nombre} con ${sobra} caracteres de más`,
        leidoSdk === nombre + qr.slice(qr.indexOf(nombre) + nombre.length, qr.indexOf(nombre) + nombre.length + sobra),
        `leyó ${JSON.stringify(leidoSdk)} — ¿lo arreglaron río arriba?`);
    check(`nosotros devolvemos ${nombre} limpio`, cwEmvTags(qr)['59'] === nombre);
}

// ── Regresión: el olfateador no le roba QR a las otras ramas del escáner ─────
console.log('\n▶ Regresión: no le roba QR a las otras ramas del escáner');
{
    const ajenos = [
        ['transacción fría (CWT1|)', 'CWT1|{"from":"0x1111111111111111111111111111111111111111","to":"0x2222222222222222222222222222222222222222","value":"1","chainId":8453}'],
        ['transacción firmada (CWS1|)', 'CWS1|0x02f8720182...'],
        ['mensaje offline (CWM1|)', 'CWM1|0x1111111111111111111111111111111111111111|0x02aa|firma|cifrado'],
        ['contactos (CWC1|)', 'CWC1|1|1|eyJjIjpbXX0='],
        ['compartir chat (CWL1|)', 'CWL1|0x1111111111111111111111111111111111111111|reto'],
        ['enlace de invitación', 'https://chatwallet.org/dapp?address=0x1111111111111111111111111111111111111111&pk=0x02aa'],
        ['solicitud de pago (cw:2)', 'https://chatwallet.org/dapp?pay=1&to=0x1111111111111111111111111111111111111111&value=1000&chainId=8453'],
        ['sesión de dApp', 'chatwallet://wc?uri=wc:abc123@2'],
        ['address pelada', '0x1111111111111111111111111111111111111111'],
        ['frase mnemónica', 'legal winner thank year wave sausage worth useful legal winner thank yellow'],
        ['QR de PIX brasileño', '00020126580014BR.GOV.BCB.PIX0136abc5204541153039865802BR5913LOJA TESTE6009SAO PAULO63041D3D'],
        ['cadena vacía', ''],
    ];
    for (const [nombre, payload] of ajenos) check(`no se queda con ${nombre}`, cwSniffPaymentQr(payload) === null);
    check('sí agarra un QR argentino', cwSniffPaymentQr(armarQr({ comercio: 'TEST', monto: '10' })) !== null);
}

console.log(`\n${fail === 0 ? '✅' : '❌'} ${ok} bien, ${fail} mal\n`);
process.exit(fail === 0 ? 0 : 1);
