// "Últ. vez hace 15945 min" era ilegible: nadie divide por 1440 de cabeza.
// Acá se verifica que el rótulo suba de unidad (minutos → horas → días → meses → años)
// y que en cualquier momento el número que se muestra sea chico.
//
// La función NO se copia: se extrae de src/dapp.html y se evalúa, así se prueba el código
// que realmente se envía.
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
const i = src.indexOf('function haceCuanto(');
const f = src.indexOf('function updateChatHeaderStatus(');
if (i < 0 || f < 0 || f < i) {
    console.error(`✗ No encontré haceCuanto() en ${DAPP}.`);
    process.exit(1);
}
const haceCuanto = new Function(src.slice(i, f) + '\nreturn haceCuanto;')();

const MIN = 60000, HORA = 60 * MIN, DIA = 24 * HORA;
const hace = (ms) => haceCuanto(Date.now() - ms);

console.log('\n── Escalones de unidad ───────────────────────────────────────');
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

console.log('\n── El rótulo viejo ya no está ────────────────────────────────');
check('no quedó el "hace ${minutesAgo} min" original',
    !/Últ\. vez hace \$\{minutesAgo\}/.test(src));
check('el header usa haceCuanto()',
    /detail = 'Últ\. vez hace ' \+ haceCuanto\(contact\.lastSeen\)/.test(src));

console.log(`\n${fail === 0 ? '✅' : '❌'} ${ok} bien, ${fail} mal.`);
process.exit(fail === 0 ? 0 : 1);
