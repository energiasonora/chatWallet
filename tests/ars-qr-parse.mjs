// Banco de pruebas del lector de QR argentino (Transferencias 3.0 / EMVCo).
//
// Usa el parser canónico del protocolo P2P.me (@p2pdotme/sdk/qr-parsers) en vez de uno
// propio, para que ChatWallet lea exactamente lo mismo que va a leer el proveedor de
// liquidez del otro lado. Acá se arman QR sintéticos con CRC16-CCITT correcto: sirve para
// probar el circuito sin tener que ir a fotografiar un kiosco.
//
// Correr:  node tests/ars-qr-parse.mjs        (Node 22, sin NODE_OPTIONS)

import { parseQR } from '@p2pdotme/sdk/qr-parsers';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
    else { fail++; console.log(`  ❌ ${nombre}${extra ? ' — ' + extra : ''}`); }
};

// ── Armado de QR EMVCo ────────────────────────────────────────────────────────
// El CRC va sobre los BYTES UTF-8, no sobre los caracteres JS. Con "CAFÉ" la diferencia
// existe y da otro checksum, así que esto tiene que coincidir con lo que hace el parser.
function crc16ccitt(s) {
    let crc = 0xFFFF;
    for (const b of new TextEncoder().encode(s)) {
        crc ^= b << 8;
        for (let j = 0; j < 8; j++) crc = (crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}
// EMVCo declara la longitud en BYTES, no en caracteres. Con JS hay que medir en UTF-8 a mano
// o "CAFÉ" (4 caracteres, 5 bytes) sale con la longitud mal y el QR queda corrupto.
const tag = (t, v) => t + String(Buffer.byteLength(v, 'utf8')).padStart(2, '0') + v;

function armarQr({ pais = 'AR', moneda = '032', comercio = 'COMERCIO', ciudad = 'BUENOS AIRES', monto = null } = {}) {
    let p = tag('00', '01') + tag('01', monto ? '12' : '11')
        + tag('26', tag('00', 'ar.com.mercadolibre') + tag('01', '0011223344'))
        + tag('52', '5411') + tag('53', moneda);
    if (monto) p += tag('54', monto);
    p += tag('58', pais) + tag('59', comercio) + tag('60', ciudad) + '6304';
    return p + crc16ccitt(p);
}

const parse = (qrData, currency = 'ARS', sellPrice = 1450) => parseQR({ qrData, currency, sellPrice });

// ── Casos ─────────────────────────────────────────────────────────────────────
console.log('\n▶ QR argentino válido');
{
    const qr = armarQr({ comercio: 'KIOSCO LA ESQUINA', monto: '1500.00' });
    const r = await parse(qr);
    check('lo acepta', r.isOk(), r.isErr() ? `${r.error.code}: ${r.error.message}` : '');
    if (r.isOk()) {
        check('devuelve el nombre del comercio', r.value.paymentAddress === 'KIOSCO LA ESQUINA',
            `devolvió ${JSON.stringify(r.value.paymentAddress)}`);
        // Hallazgo importante: el parser argentino NO devuelve el monto (a diferencia del
        // boliviano, que devuelve el QR entero). Si esto algún día cambia, este test avisa.
        check('NO trae monto (limitación conocida del parser ARS)', r.value.amount === undefined,
            `trajo ${JSON.stringify(r.value.amount)}`);
    }
}

console.log('\n▶ QR sin monto (estático, el comercio lo tipea)');
{
    const r = await parse(armarQr({ comercio: 'VERDULERIA DON JOSE' }));
    check('lo acepta igual', r.isOk(), r.isErr() ? r.error.code : '');
    if (r.isOk()) check('nombre correcto', r.value.paymentAddress === 'VERDULERIA DON JOSE');
}

console.log('\n▶ Nombres con acentos y ñ (la mitad de los comercios argentinos)');
{
    const r = await parse(armarQr({ comercio: 'CAFE MARTINEZ' }));
    check('un nombre ASCII se lee entero', r.isOk() && r.value.paymentAddress === 'CAFE MARTINEZ',
        r.isErr() ? r.error.code : JSON.stringify(r.value.paymentAddress));
}

// ── BUG CONOCIDO RÍO ARRIBA (@p2pdotme/sdk 1.2.19) ────────────────────────────
// El CRC del SDK sí mide en bytes UTF-8 (calculateCRC16 usa TextEncoder), pero el recorrido
// TLV lee esa longitud en bytes y después corta con substring(), que cuenta CARACTERES.
// Con "CAFÉ MARTÍNEZ" —13 caracteres, 15 bytes— se lleva 2 caracteres de más y el nombre
// del comercio sale contaminado con el arranque del tag siguiente ("...60").
// El QR se acepta igual (el checksum cierra), así que el síntoma es un nombre sucio en
// pantalla, no un rechazo. Por eso ChatWallet extrae el nombre por su cuenta, midiendo en
// bytes (cwArsMerchantName en dapp.html), y sólo usa parseQR para validar.
// Estos checks fijan el comportamiento ACTUAL: si río arriba lo arreglan, fallan y avisan.
console.log('  (bug conocido río arriba: con acentos el nombre sale contaminado)');
for (const nombre of ['CAFÉ MARTÍNEZ', 'ÑANDÚ SRL', 'ALMACÉN "EL ÑOQUI"']) {
    const r = await parse(armarQr({ comercio: nombre }));
    const sobra = Buffer.byteLength(nombre, 'utf8') - nombre.length;
    check(`${nombre}: el QR se acepta`, r.isOk(), r.isErr() ? r.error.code : '');
    if (r.isOk()) {
        const leido = r.value.paymentAddress;
        check(`${nombre}: sigue contaminado con ${sobra} caracteres de más`,
            leido.startsWith(nombre) && leido.length === nombre.length + sobra,
            `leyó ${JSON.stringify(leido)} — ¿lo arreglaron río arriba?`);
    }
}

console.log('\n▶ Rechazos');
{
    const bueno = armarQr({ comercio: 'TEST' });
    const roto = bueno.slice(0, -4) + '0000';
    const r1 = await parse(roto);
    check('rechaza checksum inválido', r1.isErr() && r1.error.code === 'INVALID_QR',
        r1.isOk() ? 'lo aceptó' : r1.error.code);

    const r2 = await parse(armarQr({ pais: 'BR', moneda: '986' }));
    check('rechaza un QR que no es argentino', r2.isErr(), r2.isOk() ? 'lo aceptó' : '');

    const r3 = await parse('');
    check('rechaza cadena vacía', r3.isErr());

    const r4 = await parse('0x1234567890abcdef1234567890abcdef12345678');
    check('rechaza una address ethereum', r4.isErr());

    const r5 = await parse('https://chatwallet.org/dapp?address=0xabc');
    check('rechaza un link de invitación', r5.isErr());
}


// ── Regresión: el guardia nuevo no puede robarle QR a las ramas viejas ────────
// isArsQr() se evalúa en handleScannedData junto a los otros prefijos, así que lo único
// que puede romper es que dé true para algo que no es un QR argentino. Se prueba la
// función sola, sin ejecutar handlers: los caminos viejos terminan en alert() cuando no
// reconocen algo, y un alert congela la página entera.
console.log('\n▶ Regresión: no le roba QR a las otras ramas del escáner');
const isArsQr = d => typeof d === 'string' && d.length > 24
    && d.includes('5303032') && d.includes('5802AR');

const ajenos = [
    ['transacción fría (CWT1|)', 'CWT1|{"from":"0x1111111111111111111111111111111111111111","to":"0x2222222222222222222222222222222222222222","value":"1000000000000000","chainId":8453}'],
    ['transacción firmada (CWS1|)', 'CWS1|0x02f8720182...'],
    ['mensaje offline (CWM1|)', 'CWM1|0x1111111111111111111111111111111111111111|0x02aa|firma|cifrado'],
    ['contactos (CWC1|)', 'CWC1|1|1|eyJjIjpbXX0='],
    ['compartir chat (CWL1|)', 'CWL1|0x1111111111111111111111111111111111111111|reto'],
    ['enlace de invitación', 'https://chatwallet.org/dapp?address=0x1111111111111111111111111111111111111111&pk=0x02aa'],
    ['solicitud de pago (cw:2)', 'https://chatwallet.org/dapp?pay=1&to=0x1111111111111111111111111111111111111111&value=1000&chainId=8453'],
    ['sesión de dApp', 'chatwallet://wc?uri=wc:abc123@2'],
    ['address pelada', '0x1111111111111111111111111111111111111111'],
    ['frase mnemónica', 'legal winner thank year wave sausage worth useful legal winner thank yellow'],
    ['QR de Brasil (PIX)', '00020126580014BR.GOV.BCB.PIX0136abc5204541153039865802BR5913LOJA TESTE6009SAO PAULO63041D3D'],
];
for (const [nombre, payload] of ajenos) check(`no se queda con ${nombre}`, !isArsQr(payload));

// Y el complemento: que sí agarre lo suyo.
check('sí agarra un QR argentino', isArsQr(armarQr({ comercio: 'TEST', monto: '10' })));

console.log(`\n${fail === 0 ? '✅' : '❌'} ${ok} bien, ${fail} mal (total)\n`);
process.exit(fail === 0 ? 0 : 1);
