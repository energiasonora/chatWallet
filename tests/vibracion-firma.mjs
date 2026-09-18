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
check('usa dos pulsos de verdad (45 · pausa 110 · 45), sin el 0 inicial que los hacía uno',
    /vibrar\(\[45,\s*110,\s*45\]\)/.test(dapp));
// En el APK navigator.vibrate() no llega al motor (bloqueo por gesto + ni con gesto): toda
// vibración tiene que pasar por vibrar(), que usa el plugin nativo.
check('nadie llama navigator.vibrate salvo vibrar()',
    (dapp.match(/navigator\.vibrate(\?\.)?\(/g) || []).length === 1 && /function vibrar\(patron\)[\s\S]{0,700}navigator\.vibrate\?\.\(patron\)/.test(dapp));
check('vibrar() prefiere KeepAlive.vibrate en el APK',
    /function vibrar\(patron\)[\s\S]{0,500}Plugins\.KeepAlive[\s\S]{0,200}nativo\.vibrate\(\{ pattern/.test(dapp));
const plugin = fs.readFileSync(path.join(RAIZ, 'android/app/src/main/java/org/energiasonora/chatwallet/KeepAlivePlugin.java'), 'utf8');
check('el plugin nativo expone vibrate()', /@PluginMethod\s+public void vibrate\(PluginCall call\)/.test(plugin));

// ── 3. Cada pedido de firma lo llama. Se ancla en la línea que ABRE cada modal, así que
//       si alguien mueve la apertura y se olvida la vibración, esto se pone rojo.
const sitios = [
    ['dApp por cw:1 (personal_sign / eth_sendTransaction)',
        /vibrarPedidoDeFirma\(\);\s*\n\s*ov\.querySelector\('#wc-title'\)/],
    // Se admiten un par de líneas antes (p. ej. tomar la paleta del tipo de pedido): lo que
    // importa es que vibre al ABRIR el modal, no que sea literalmente la primera sentencia.
    ['pago que llega de una dApp por cw:2',
        /function wcPaymentModal\([^)]*\)\s*\{(?:[^\n]*\n){0,3}?\s*vibrarPedidoDeFirma\(\);/],
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
        if (!/KeepAlive\.vibrate|nativo\.vibrate|\.vibrate\(\{pattern/.test(build)) { console.log(`⚠️  ${rel} es anterior a la vibración nativa, se saltea.`); continue; }
        check(`${rel}: el patrón de dos pulsos sobrevivió al build`, /\[45,110,45\]/.test(build));
        check(`${rel}: las 5 llamadas siguen ahí`,
            (build.match(/vibrarPedidoDeFirma/g) || []).length >= 6);   // 1 definición + 5 usos
    }
}

const mal = res.filter(x => !x).length;
console.log(`\n${mal === 0 ? '✅ TODO OK' : `❌ ${mal} fallo(s)`} — ${res.length} chequeos\n`);
process.exit(mal === 0 ? 0 : 1);
