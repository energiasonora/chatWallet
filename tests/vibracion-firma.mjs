// ¿Vibra el celular cuando algo pide una firma?
//
// Este test existe porque el modo de falla es SILENCIOSO en las dos puntas:
//   · Sin android.permission.VIBRATE, navigator.vibrate() no tira error ni devuelve
//     false: no hace nada. El APK 3.28 se empaquetó sin el permiso y por eso las cuatro
//     vibraciones que la app ya tenía (escáner, swipe, picker, tirar-para-recargar) eran
//     código muerto — funcionaban en Chrome y nunca en el APK, que es donde se usan.
//   · Y si el minificador se comiera la llamada, el build seguiría saliendo verde.
// Por eso se mira el manifest, la fuente Y el bundle construido.
//
//   unset NODE_OPTIONS && node tests/vibracion-firma.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/, '');
const res = [];
const check = (n, ok, extra = '') => { res.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

const manifest = fs.readFileSync(path.join(RAIZ, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const dapp = fs.readFileSync(path.join(RAIZ, 'src/dapp.html'), 'utf8');

// ── 1. El permiso, sin el cual todo lo demás es decorativo ──
check('el APK declara android.permission.VIBRATE',
    /<uses-permission\s+android:name="android\.permission\.VIBRATE"\s*\/>/.test(manifest));

// ── 2. El helper y su patrón ──
check('existe vibrarPedidoDeFirma()', /function vibrarPedidoDeFirma\(\)/.test(dapp));
check('usa dos pulsos, no el toque seco de las otras vibraciones',
    /navigator\.vibrate\?\.\(\[0,\s*45,\s*110,\s*45\]\)/.test(dapp));

// ── 3. Cada pedido de firma lo llama. Se ancla en la línea que ABRE cada modal, así que
//       si alguien mueve la apertura y se olvida la vibración, esto se pone rojo.
const sitios = [
    ['dApp por cw:1 (personal_sign / eth_sendTransaction)',
        /vibrarPedidoDeFirma\(\);\s*\n\s*ov\.querySelector\('#wc-title'\)/],
    ['pago que llega de una dApp por cw:2',
        /function wcPaymentModal\([^)]*\)\s*\{\s*\n\s*vibrarPedidoDeFirma\(\);/],
    ['dar acceso al chat a otra wallet',
        /grantShowStep\('confirm'\);[\s\S]{0,120}?vibrarPedidoDeFirma\(\);/],
    ['transacción fría llegada por QR',
        /getElementById\('coldTxSignModal'\);\s*\n\s*vibrarPedidoDeFirma\(\);/],
    ['confirmación de envío (el slider)',
        /getElementById\('confirmTxModal'\);\s*\n\s*vibrarPedidoDeFirma\(\);/],
];
for (const [nombre, re] of sitios) check(`vibra: ${nombre}`, re.test(dapp));

// El modal que el usuario abre por su cuenta NO tiene que vibrar: no es un pedido, es él.
check('openGrantAccessModal() NO vibra (lo abre el usuario, no es un pedido)',
    !/function openGrantAccessModal\(\)[\s\S]*?vibrarPedidoDeFirma/.test(
        dapp.slice(dapp.indexOf('function openGrantAccessModal()'),
                   dapp.indexOf('function closeGrantAccessModal()'))));

// ── 4. Que sobreviva al build: un minificador podría comerse la llamada y nadie se entera.
const candidatos = ['public/dapp.html', 'dist-vibra/dapp.html', 'dist/dapp.html']
    .map(d => path.join(RAIZ, d)).filter(f => fs.existsSync(f));
if (candidatos.length === 0) {
    console.log('⚠️  Sin build a mano: no se pudo verificar el bundle (corré parcel y repetí).');
} else {
    for (const f of candidatos) {
        const build = fs.readFileSync(f, 'utf8');
        const rel = f.replace(RAIZ + '/', '');
        // Ojo: public/ puede ser un build viejo, anterior a este cambio. Sólo se exige el
        // patrón si el bundle ya conoce el helper.
        if (!/vibrarPedidoDeFirma/.test(build)) { console.log(`⚠️  ${rel} es anterior a este cambio, se saltea.`); continue; }
        check(`${rel}: el patrón de dos pulsos sobrevivió al build`,
            /navigator\.vibrate\?\.\(\[0,45,110,45\]\)/.test(build));
        check(`${rel}: las 5 llamadas siguen ahí`,
            (build.match(/vibrarPedidoDeFirma/g) || []).length >= 6);   // 1 definición + 5 usos
    }
}

const mal = res.filter(x => !x).length;
console.log(`\n${mal === 0 ? '✅ TODO OK' : `❌ ${mal} fallo(s)`} — ${res.length} chequeos\n`);
process.exit(mal === 0 ? 0 : 1);
