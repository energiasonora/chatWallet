// Banco de pruebas de la llave Ğ1 (src/js/g1-llave.js).
//
// La garantía que importa: que la cuenta que deriva ChatWallet de la frase sea LA MISMA que
// ve el usuario en Ğecko o Cesium². Los vectores salen de @polkadot/keyring
// (createFromUri, ed25519, prefijo 4450), que es lo que usa Cesium². No viaja en el bundle
// ni está en package.json: se calcularon aparte y quedan fijos acá (27/9/2026).
//
// Correr:  node tests/g1-llave.mjs        (Node 22, sin NODE_OPTIONS)

import { cuentaG1, candidatasG1, entropiaDeFrase, semillaG1, firmarG1, direccionG1 } from '../src/js/g1-llave.js';
import { leerFrase, semillaBip39 } from '../src/js/frase.js';
import { ed25519 } from '@noble/curves/ed25519';
import { HDNodeWallet, Mnemonic, wordlists, defaultPath } from 'ethers';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
    else { fail++; console.log(`  ❌ ${nombre}${extra ? ' — ' + extra : ''}`); }
};

const EN = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
const ES = 'opción batir títere duda crema samba miembro iris opción batir títere duda';
const FR = 'négation bijou taxer discuter crayon roseau ligoter gourmand négation bijou taxer discuter';
const VECTORES = [
    [EN, '', 'g1LAN1C5rktuWS2giuZ7z1CydYKV2HQeH2rj8A6qY3CemwTVz'],
    [EN, '//0', 'g1QmGamxAFGmM8wFVTEb8SDVL1LoHqHv2t8hm4uDHY8JAduSP'],
    [EN, '//1', 'g1PJW8UwRrJq1ikcKxZyNkNDk3mXjr5qmr9sGUGnKZz9MSaQU'],
    [EN, '//2', 'g1KsTTBYJ74ao86rVfDLRbUGrEHGiHE5qsUUnvWYiDk6Qw9xu'],
    [EN, '//29', 'g1NMVVCsq2CVqonZxB72AUPsdFZrXA1twha41rZSy6QcTD4Ly'],
    [EN, '//Alice', 'g1N5DYUQpNKB1pezUMxWWR9yv92ckWqsqqtRAyAwRr25GZkxb'],
    [EN, '//una juntura de texto larga que pasa de 32 bytes', 'g1KKpFmbtzc4mB8HKrs9tgQY3u59AWehJZa3ajgc9F7BNqVT8'],
    // Misma entropía en español y en francés: los clientes Ğ1 derivan de la entropía,
    // así que las dos caras dan la misma cuenta.
    [ES, '', 'g1PCHTZ2qUfzKKdpsuwye1fJedAumM7YG7nkxGCCLGd1sJWVu'],
    [ES, '//0', 'g1Q4M7PaNECWF9JYSCYXR9yCMttHAE8K8ncDZ5nMpEhsXE7zi'],
    [FR, '', 'g1PCHTZ2qUfzKKdpsuwye1fJedAumM7YG7nkxGCCLGd1sJWVu'],
];

console.log('Vectores contra @polkadot/keyring');
for (const [frase, ruta, esperada] of VECTORES) {
    const d = cuentaG1(frase, ruta).direccion;
    check(`${frase.split(' ')[0]}… ${ruta || '(raíz)'}`, d === esperada, d);
}

console.log('Entrada tolerante');
check('mayúsculas y espacios de más', cuentaG1('  ' + EN.toUpperCase().replace(/ /g, '   ') + '\n').direccion === VECTORES[0][2]);
check('frase inválida → null', entropiaDeFrase('hola mundo') === null);
let tiro = false; try { semillaG1('hola mundo'); } catch (e) { tiro = e.message === 'frase'; }
check('semilla de frase inválida tira "frase"', tiro);
for (const mala of ['/0', '//', '//0/1', '0']) {
    tiro = false; try { semillaG1(EN, mala); } catch (e) { tiro = e.message === 'ruta'; }
    check(`ruta inválida ${JSON.stringify(mala)} tira "ruta"`, tiro);
}

console.log('Candidatas y firma');
const c = candidatasG1(EN, 30);
check('raíz + 30 derivaciones', c.length === 31 && c[0].ruta === '' && c[30].ruta === '//29');
check('la //29 coincide con el vector', c[30].direccion === VECTORES[4][2]);
const msj = new TextEncoder().encode('hola Ğ1');
const firma = firmarG1(c[0], msj);
check('firma ed25519 verifica con la pública', ed25519.verify(firma, msj, c[0].publica));
check('SS58 de la pública = dirección', direccionG1(c[0].publica) === c[0].direccion);

console.log('Frases en otros idiomas → la 0x (src/js/frase.js)');
// En Node ethers trae todas las listas; en el navegador solo la inglesa. La 0x que arma la
// app (semilla BIP39 + ruta estándar) tiene que ser la misma que da ethers con la lista.
const evmApp = (texto) => { const r = leerFrase(texto); return r && HDNodeWallet.fromSeed(semillaBip39(r.frase)).derivePath(defaultPath).address; };
for (const idioma of ['en', 'es', 'fr', 'it', 'pt']) {
    const m = Mnemonic.fromEntropy('0x' + '5c'.repeat(16), undefined, wordlists[idioma]);
    const esperada = HDNodeWallet.fromMnemonic(m).address;
    const r = leerFrase(m.phrase);
    check(`${idioma}: detecta el idioma y da la 0x de ethers`, r && r.idioma === idioma && evmApp(m.phrase) === esperada, `${r && r.idioma} ${evmApp(m.phrase)}`);
}
check('español sin tildes → misma 0x', evmApp(ES.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) === evmApp(ES));
check('francés sin tildes → misma 0x', evmApp(FR.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) === evmApp(FR));
check('español sin tildes → misma cuenta Ğ1', cuentaG1(ES.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).direccion === VECTORES[7][2]);
check('frase con la suma de control mal → null', leerFrase(EN.replace(/walk$/, 'wall')) === null);
check('11 palabras → null', leerFrase(EN.split(' ').slice(1).join(' ')) === null);
check('mezcla de idiomas → null', leerFrase(ES.split(' ').slice(0, 6).concat(FR.split(' ').slice(6)).join(' ')) === null);
check('misma entropía en es y fr → 0x distintas (por eso el aviso)', evmApp(ES) !== evmApp(FR));

console.log(`\n${ok} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
