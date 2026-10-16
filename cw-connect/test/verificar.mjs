// Verifica la implementación de referencia contra los vectores.   node cw-connect/test/verificar.mjs
import fs from 'node:fs';
import { armarUriVinculacion, leerUriVinculacion, leerMensaje, CwCodec, CW_TIPO } from '../cw-connect.mjs';

const V = JSON.parse(fs.readFileSync(new URL('../vectores.json', import.meta.url), 'utf8'));
let fallas = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const ok = (c, m) => { console.log(`${c ? '✅' : '❌'} ${m}`); if (!c) fallas++; };

for (const u of V.uris) ok(armarUriVinculacion(u.entrada) === u.uri, `armar ${u.uri}`);
for (const l of V.lecturas) ok(igual(leerUriVinculacion(l.texto), l.resultado), `leer ${l.texto.slice(0, 70)}`);
const codec = new CwCodec();
for (const x of V.mensajes) {
    const e = codec.encode(x.mensaje);
    ok(Buffer.from(e.content).toString('hex') === x.contentHex && e.fallback === x.fallback && igual(e.type, x.tipo),
        `codificar ${x.mensaje.type}`);
    const vuelta = codec.decode({ content: Buffer.from(x.contentHex, 'hex') });
    ok(igual(vuelta, x.mensaje), `decodificar ${x.mensaje.type}`);
    ok(igual(leerMensaje({ contentType: CW_TIPO, content: vuelta }), { m: x.mensaje, version: 2 }), `reconocer v2 ${x.mensaje.type}`);
    ok(igual(leerMensaje({ contentType: { authorityId: 'xmtp.org', typeId: 'text' }, content: JSON.stringify(x.mensaje) }), { m: x.mensaje, version: 1 }), `reconocer v1 ${x.mensaje.type}`);
}
// Lo que NO es protocolo no se reconoce: texto de una persona y el canal 3 (aviso stealth entre personas).
ok(leerMensaje({ content: 'hola, ¿cómo andás?' }) === null, 'texto común no es protocolo');
ok(leerMensaje({ content: JSON.stringify({ cw: 3, type: 'stealth_payment' }) }) === null, 'cw:3 no es de una app');
ok(leerMensaje({ contentType: CW_TIPO, content: { cw: 9 } }) === null, 'canal desconocido no es protocolo');

console.log(fallas ? `\n${fallas} fallas` : '\nTodo verde');
process.exit(fallas ? 1 : 0);
