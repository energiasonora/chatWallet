// "Últ. vez hace 15945 min" era ilegible: nadie divide por 1440 de cabeza.
// Acá se verifica que el rótulo suba de unidad (minutos → horas → días → meses → años),
// que el número que se muestra sea siempre chico, y que todo eso esté traducido en los
// tres idiomas — no sólo el lapso, también el marco, porque cada lengua lo rodea distinto
// ("hace 11 días" / "Last seen 11 days ago" / "Vu il y a 11 jours").
//
// Ni la función ni las traducciones se copian: se extraen de src/dapp.html y se evalúan,
// así se prueba el texto que realmente se envía y una copia no puede derivar en silencio.
//
// Correr:  node tests/ultima-vez.mjs        (Node 22, sin NODE_OPTIONS)

import fs from 'node:fs';

let ok = 0, fail = 0;
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
    else { fail++; console.log(`  ❌ ${nombre}${extra ? ' — ' + extra : ''}`); }
};

const DAPP = 'src/dapp.html';
const src = fs.readFileSync(DAPP, 'utf8');

// ── Los diccionarios reales ───────────────────────────────────────────────────
// OJO con el ancla: buscar 'es: {' a secas matchea cualquier clave que termine así
// ('values: {', 'res: {'…) y el diccionario saldría de otra parte del archivo. Va anclado
// a la indentación exacta del objeto translations.
const dondeEmpieza = (lang) => {
    const m = new RegExp('^ {16}' + lang + ': \\{$', 'm').exec(src);
    if (!m) throw new Error('no encontré el bloque de traducciones ' + lang);
    return m.index;
};
const finDeFr = src.indexOf('function t(', dondeEmpieza('fr'));
const trozo = { es: [dondeEmpieza('es'), dondeEmpieza('en')], en: [dondeEmpieza('en'), dondeEmpieza('fr')], fr: [dondeEmpieza('fr'), finDeFr] };
const dic = {};
for (const lang of ['es', 'en', 'fr']) {
    dic[lang] = Object.fromEntries([...src.slice(...trozo[lang]).matchAll(/"([a-z0-9_]+)":\s*"((?:[^"\\]|\\.)*)"/g)]
        .map(m => [m[1], JSON.parse('"' + m[2] + '"')]));
}

// ── La función real, con un t() que lee esos diccionarios ─────────────────────
const i = src.indexOf('function haceCuanto(');
const f = src.indexOf('function updateChatHeaderStatus(');
if (i < 0 || f < 0 || f < i) {
    console.error(`✗ No encontré haceCuanto() en ${DAPP}.`);
    process.exit(1);
}
let IDIOMA = 'es';
// Mismo comportamiento que el t() de la app: cae al castellano si falta la clave. Acá eso
// haría pasar un test con el idioma equivocado, así que el respaldo se cuenta como falta.
const faltantes = new Set();
const t = (key, vars) => {
    let s = dic[IDIOMA][key];
    if (s === undefined) { faltantes.add(IDIOMA + ':' + key); s = dic.es[key] ?? key; }
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
};
const haceCuanto = new Function('t', src.slice(i, f) + '\nreturn haceCuanto;')(t);

const MIN = 60000, HORA = 60 * MIN, DIA = 24 * HORA;
const hace = (ms) => haceCuanto(Date.now() - ms);
// Cómo se ve el renglón entero, igual que lo arma updateChatHeaderStatus.
const renglon = (ms) => t('presence_last_seen', { t: hace(ms) });

console.log('\n── Escalones de unidad (es) ──────────────────────────────────');
check('recién visto → "un momento"', hace(0) === 'un momento', hace(0));
check('30 s → "un momento"', hace(30000) === 'un momento', hace(30000));
check('1 min', hace(MIN) === '1 min', hace(MIN));
check('59 min (último minuto)', hace(59 * MIN) === '59 min', hace(59 * MIN));
check('60 min → "1 hora", no "60 min"', hace(HORA) === '1 hora', hace(HORA));
check('90 min → "1 hora" (no redondea para arriba)', hace(90 * MIN) === '1 hora', hace(90 * MIN));
check('2 h en plural', hace(2 * HORA) === '2 horas', hace(2 * HORA));
check('23 h (última hora)', hace(23 * HORA) === '23 horas', hace(23 * HORA));
check('24 h → "1 día", no "24 horas"', hace(DIA) === '1 día', hace(DIA));
check('2 días en plural', hace(2 * DIA) === '2 días', hace(2 * DIA));
check('29 días (último día)', hace(29 * DIA) === '29 días', hace(29 * DIA));
check('30 días → "1 mes"', hace(30 * DIA) === '1 mes', hace(30 * DIA));
check('3 meses en plural', hace(95 * DIA) === '3 meses', hace(95 * DIA));
check('11 meses (último mes)', hace(350 * DIA) === '11 meses', hace(350 * DIA));
check('364 días → "1 año" (no "0 años")', hace(364 * DIA) === '1 año', hace(364 * DIA));
check('2 años en plural', hace(800 * DIA) === '2 años', hace(800 * DIA));

console.log('\n── El caso que lo destapó ────────────────────────────────────');
check('15945 min se muestran como "11 días"', hace(15945 * MIN) === '11 días', hace(15945 * MIN));
check('el renglón completo dice "Últ. vez hace 11 días"',
    renglon(15945 * MIN) === 'Últ. vez hace 11 días', renglon(15945 * MIN));

console.log('\n── Traducido de verdad ───────────────────────────────────────');
IDIOMA = 'en';
check('en: 15945 min → "Last seen 11 days ago"',
    renglon(15945 * MIN) === 'Last seen 11 days ago', renglon(15945 * MIN));
check('en: singular sin número suelto → "1 hour"', hace(HORA) === '1 hour', hace(HORA));
check('en: recién visto → "Last seen a moment ago"',
    renglon(0) === 'Last seen a moment ago', renglon(0));
IDIOMA = 'fr';
check('fr: 15945 min → "Vu il y a 11 jours"',
    renglon(15945 * MIN) === 'Vu il y a 11 jours', renglon(15945 * MIN));
check('fr: "1 mois" no lleva s de más', hace(30 * DIA) === '1 mois', hace(30 * DIA));
check('fr: 3 meses también es "3 mois"', hace(95 * DIA) === '3 mois', hace(95 * DIA));
IDIOMA = 'es';

console.log('\n── Ninguna clave se cae al castellano ────────────────────────');
// Recorrer todas las unidades en los tres idiomas: si alguna clave falta, t() la rellena
// con el castellano y el usuario ve "hace 3 meses" en inglés sin que nada falle.
for (const lang of ['es', 'en', 'fr']) {
    IDIOMA = lang;
    [0, MIN, HORA, 2 * HORA, DIA, 2 * DIA, 30 * DIA, 95 * DIA, 364 * DIA, 800 * DIA].forEach(ms => renglon(ms));
    ['presence_online', 'presence_offline'].forEach(k => t(k));
}
IDIOMA = 'es';
check('están las 15 claves en es, en y fr', faltantes.size === 0, [...faltantes].join(', '));

console.log('\n── Nunca un número grande ni basura ──────────────────────────');
let grande = null, feo = null;
for (let m = 0; m <= 5000 * 1440; m += 7) {            // ~13,7 años, minuto a minuto (paso 7)
    const txt = hace(m * MIN);
    const n = parseInt(txt, 10);
    if (!isNaN(n) && n > 59) { grande = `${m} min → "${txt}"`; break; }
    if (/NaN|undefined|Infinity|-/.test(txt)) { feo = `${m} min → "${txt}"`; break; }
}
check('ningún rótulo pasa de 59 en 13 años', grande === null, grande || '');
check('ningún rótulo sale NaN/undefined/negativo', feo === null, feo || '');
check('reloj adelantado (futuro) → "un momento"', hace(-5 * MIN) === 'un momento', hace(-5 * MIN));
check('lastSeen basura → "un momento", no NaN', haceCuanto(NaN) === 'un momento', String(haceCuanto(NaN)));

console.log('\n── El texto fijo ya no está en el código ─────────────────────');
check('no quedó el "hace ${minutesAgo} min" original',
    !/Últ\. vez hace \$\{minutesAgo\}/.test(src));
check('el header arma el renglón con t()',
    /detail = t\('presence_last_seen', \{ t: haceCuanto\(contact\.lastSeen\)/.test(src));
check('"En línea" y "Desconectado" salen del diccionario, no del código',
    !/detail = 'En línea'/.test(src) && !/detail = 'Desconectado'/.test(src));
check('cambiar de idioma repinta el chat abierto',
    /if \(currentChatContact\) updateChatHeaderStatus\(currentChatContact\);/.test(src));

console.log(`\n${fail === 0 ? '✅' : '❌'} ${ok} bien, ${fail} mal.`);
process.exit(fail === 0 ? 0 : 1);
