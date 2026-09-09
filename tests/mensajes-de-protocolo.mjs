// Los mensajes del puente con las dApps (cw:1/2/3) no tienen que verse como burbujas de
// JSON crudo en el chat. Se veían así: cuatro renglones de hexadecimal, dos veces, sin
// que nadie pudiera saber qué eran.
//
// El test NO copia la función: la extrae del propio src/dapp.html y la ejecuta, así que si
// alguien la cambia el test la sigue. Además chequea la rama del renderizador, porque
// clasificar bien no sirve de nada si el dibujo no la usa.
//
//   unset NODE_OPTIONS && node tests/mensajes-de-protocolo.mjs
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.dirname(new URL(import.meta.url).pathname).replace(/\/tests$/, '');
const dapp = fs.readFileSync(path.join(RAIZ, 'src/dapp.html'), 'utf8');
const res = [];
const check = (n, ok, extra = '') => { res.push(ok); console.log(`${ok ? '✅' : '❌'} ${n}${extra ? ' — ' + extra : ''}`); };

// ── Extraer la función real y ejecutarla con un t() que devuelve la clave ──
const desde = dapp.indexOf('function descripcionDeProtocolo(contenido) {');
const hasta = dapp.indexOf('\n            }', desde) + '\n            }'.length;
if (desde < 0) { console.log('❌ no encontré descripcionDeProtocolo en src/dapp.html'); process.exit(1); }
const fuente = dapp.slice(desde, hasta);
const descripcionDeProtocolo = new Function('t', fuente + '; return descripcionDeProtocolo;')(k => k);

// El mensaje EXACTO de la captura que reportó el problema.
const real = '{"cw":1,"id":"4edba6ed-069a-4221-9273-7337f4eddcc6","type":"result","result":"0xa0320155a3499ef780ffb562781ee5ab855c592fbad3490af878b8091503bf5259bf84fcabff946e470b13a8f39ba8a83030d49e5c0a9979d7f345c7084e4a971b"}';

const casos = [
    ['la respuesta firmada de la captura', real, 'proto_answered'],
    ['pedido de firma de una dApp', '{"cw":1,"type":"rpc","id":"x","method":"personal_sign","params":["hola"]}', 'proto_rpc'],
    ['vinculación', '{"cw":1,"type":"connect","address":"0xabc","chainId":42161}', 'proto_connect'],
    ['rechazo', '{"cw":1,"id":"x","error":"user rejected"}', 'proto_rejected'],
    ['pedido de pago (libro)', '{"cw":2,"type":"payment_request","ref":"CW-1"}', 'proto_pay_request'],
    ['respuesta de pago', '{"cw":2,"type":"payment_result","ref":"CW-1"}', 'proto_pay_result'],
    ['aviso stealth', '{"cw":3,"type":"stealth_payment"}', 'proto_stealth'],
];
for (const [nombre, entrada, clave] of casos) {
    const salida = descripcionDeProtocolo(entrada);
    check(`clasifica: ${nombre}`, typeof salida === 'string' && salida.includes(clave), String(salida));
}

// ── Y lo que NO debe tocar: un mensaje normal tiene que seguir siendo una burbuja ──
const noProtocolo = [
    ['texto común', 'hola, ¿cómo va?'],
    ['un JSON cualquiera', '{"hola":"mundo"}'],
    ['algo que arranca con llave pero no es JSON', '{no soy json'],
    ['una transacción', '[TRANSACTION]{"txHash":"0x1"}'],
    ['vacío', ''],
    ['null', null],
    ['un número', 42],
];
for (const [nombre, entrada] of noProtocolo) {
    check(`deja pasar: ${nombre}`, descripcionDeProtocolo(entrada) === null, String(descripcionDeProtocolo(entrada)));
}

// ── La vista previa de la lista de contactos usa el mismo clasificador ──
// Arreglar sólo las burbujas no alcanzaba: la lista es otro camino de dibujo y seguía
// mostrando el JSON crudo (visto en el teléfono con el arreglo del chat ya publicado).
check('la vista previa de la lista también lo traduce',
    /function xmtpMessagePreview\(message\)[\s\S]*?return descripcionDeProtocolo\(texto\) \|\| texto;/.test(dapp));

// ── La rama del renderizador ──
check('el renderizador tiene la rama de protocolo',
    /\} else if \(descripcionDeProtocolo\(messageContent\)\) \{/.test(dapp));
check('la dibuja como renglón de sistema, no como burbuja',
    /descripcionDeProtocolo\(messageContent\)\) \{[\s\S]{0,400}?messageRow\.className = 'handshake-message'/.test(dapp));
check('usa textContent y nunca innerHTML (el contenido lo escribe la otra punta)',
    /protoSpan\.textContent = protoTexto;/.test(dapp) &&
    !/protoSpan\.innerHTML/.test(dapp));
// El payload no puede llegar a la pantalla. Se aísla el cuerpo de la rama y se exige que
// la única mención de messageContent ahí adentro sea pasárselo al clasificador — nunca
// concatenarlo al texto que se dibuja. (La primera versión de este chequeo estaba mal: el
// regex marcaba como fuga la línea que se lo pasa a la función, que es lo correcto.)
const ini = dapp.indexOf("} else if (descripcionDeProtocolo(messageContent)) {");
const cuerpo = dapp.slice(ini, dapp.indexOf('messagesContainer.appendChild(messageRow)', ini));
const menciones = (cuerpo.match(/messageContent/g) || []).length;
const alClasificador = (cuerpo.match(/descripcionDeProtocolo\(messageContent\)/g) || []).length;
check('el contenido del mensaje no llega a la pantalla',
    menciones === alClasificador && menciones > 0,
    `${menciones} menciones, ${alClasificador} van al clasificador`);

// ── Las tres lenguas ──
for (const clave of ['proto_rpc', 'proto_answered', 'proto_rejected', 'proto_connect',
                     'proto_pay_request', 'proto_pay_result', 'proto_stealth', 'proto_generic']) {
    const n = (dapp.match(new RegExp('"' + clave + '":', 'g')) || []).length;
    check(`${clave} traducida en es/en/fr`, n === 3, `${n} apariciones`);
}

const mal = res.filter(x => !x).length;
console.log(`\n${mal === 0 ? '✅ TODO OK' : `❌ ${mal} fallo(s)`} — ${res.length} chequeos\n`);
process.exit(mal === 0 ? 0 : 1);
