// Frases semilla BIP39 en cualquiera de los idiomas que usan las billeteras Ğ1.
//
// ethers en el navegador trae SOLO la lista inglesa (wordlists-browser.js), así que
// ChatWallet siempre creó frases en inglés. Pero Ğecko y Cesium² muestran la frase en el
// idioma del usuario (francés, español…), y un miembro Ğ1 que llega con la suya tiene que
// poder entrar. Esto se carga a demanda: solo cuando la frase no es inglesa, o al activar Ğ1.
//
// Se aceptan palabras sin tildes ("solucion", "negation"): se llevan a la forma oficial,
// porque la 0x sale del TEXTO de la frase y tiene que dar lo mismo que en la otra billetera.
import { validateMnemonic, mnemonicToEntropy, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist as en } from '@scure/bip39/wordlists/english';
import { wordlist as es } from '@scure/bip39/wordlists/spanish';
import { wordlist as fr } from '@scure/bip39/wordlists/french';
import { wordlist as it } from '@scure/bip39/wordlists/italian';
import { wordlist as pt } from '@scure/bip39/wordlists/portuguese';

const LISTAS = { en, es, fr, it, pt };
const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// palabra sin tildes → palabra oficial, por idioma. Si dos palabras chocaran al quitar
// las tildes, esa clave no se usa (se exige la tilde).
const indices = {};
function indice(idioma) {
    if (indices[idioma]) return indices[idioma];
    const m = new Map(), chocan = new Set();
    for (const w of LISTAS[idioma]) {
        const k = sinTildes(w.normalize('NFC'));
        if (m.has(k)) chocan.add(k); else m.set(k, w.normalize('NFC'));
    }
    for (const k of chocan) m.delete(k);
    return (indices[idioma] = m);
}

// Texto libre → { idioma, frase (forma oficial, NFC, un espacio), entropia (Uint8Array) } o null.
export function leerFrase(texto) {
    const palabras = String(texto || '').normalize('NFC').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (![12, 15, 18, 21, 24].includes(palabras.length)) return null;
    for (const idioma of Object.keys(LISTAS)) {
        const ix = indice(idioma);
        const oficiales = palabras.map((w) => ix.get(sinTildes(w)));
        if (oficiales.some((w) => !w)) continue;
        const frase = oficiales.join(' ');
        if (!validateMnemonic(frase, LISTAS[idioma])) continue;
        return { idioma, frase, entropia: mnemonicToEntropy(frase, LISTAS[idioma]) };
    }
    return null;
}

// Semilla BIP39 estándar (PBKDF2 sobre el texto NFKD): de acá sale la 0x.
export function semillaBip39(frase) {
    return mnemonicToSeedSync(frase);
}
