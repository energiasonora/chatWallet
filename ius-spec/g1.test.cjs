// Pruebas de ius/js/g1.js — correr con Node 22:
//   env -u NODE_OPTIONS node ius-spec/g1.test.cjs          (offline)
//   env -u NODE_OPTIONS node ius-spec/g1.test.cjs --vivo   (además consulta el indexador real)
const assert = require('assert');
const crypto = require('crypto');
const { ethers } = require('ethers');
// g1.js es un script de navegador: se ejecuta tal cual en un contexto con `module`.
const vm = require('vm'), fs = require('fs'), path = require('path');
const G = (() => {
  const mod = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../ius/js/g1.js'), 'utf8'),
    { module: mod, fetch, TextEncoder, AbortController, setTimeout, clearTimeout });
  return mod.exports;
})();

let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const hex = b => Buffer.from(b).toString('hex');

(async () => {
  /* blake2b-512 contra la implementación de OpenSSL, incluyendo bordes de bloque */
  for(const largo of [0, 3, 41, 127, 128, 129, 256, 300]){
    const d = crypto.randomBytes(largo);
    ok(hex(G.blake2b512(new Uint8Array(d))) === crypto.createHash('blake2b512').update(d).digest('hex'), 'blake2b ' + largo);
  }

  /* SS58: direcciones reales de miembros Ğ1 (indexador, 25/9/2026) */
  const reales = [
    'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH',
    'g1LqPgmosBjJC4qW7iniiAxopFXVugVHPzhDPNKCasdT6UFJo',
    'g1KhbX6L7CvdkLPyQT6SNS8AdHGwLM54BtVv2TXLqzTPkUD6J',
    'g1Lo1V2dY6xpjzMnYCrHGQaj1cLbKWMretAVhgkyoBS7PUTFA',
    'g1LFzHT2FZBAL2Qr9Xg8pTKqaR3b1sAy9z79Zsfcgoh431ZEU',
  ];
  for(const a of reales){
    const d = G.ss58Decodificar(a);
    ok(d && d.prefijo === 4450, 'prefijo 4450: ' + a);
    ok(G.ss58Codificar(d.clave) === a, 'ida y vuelta: ' + a);
    ok(G.esDireccionG1(a), 'es g1: ' + a);
    // un carácter cambiado rompe el checksum
    const i = 20, c = a[i] === 'x' ? 'y' : 'x';
    ok(!G.esDireccionG1(a.slice(0, i) + c + a.slice(i + 1)), 'checksum detecta error: ' + a);
  }
  // Polkadot (prefijo 0) es SS58 válido pero NO es g1
  const dot = G.ss58Codificar(new Uint8Array(32).fill(7), 0);
  ok(G.ss58Decodificar(dot).prefijo === 0 && !G.esDireccionG1(dot), 'otra red no pasa como g1');
  ok(!G.esDireccionG1('0x1234') && !G.esDireccionG1('') && !G.esDireccionG1(null), 'basura');

  /* base64url contra Buffer */
  for(const largo of [0, 1, 2, 3, 18, 85]){
    const d = crypto.randomBytes(largo);
    ok(G.b64urlCodificar(d) === d.toString('base64url'), 'b64url cod ' + largo);
    ok(hex(G.b64urlDecodificar(d.toString('base64url'))) === d.toString('hex'), 'b64url dec ' + largo);
  }

  /* El vínculo */
  const wallet = ethers.Wallet.createRandom();
  const evm = wallet.address, g1 = reales[0], otroG1 = reales[1];
  const firma = await wallet.signMessage(G.mensajeVinculo(evm, g1));
  const com = G.comentarioVinculo(evm, firma);
  ok(com.length === 119, 'comentario de 119 caracteres (fue ' + com.length + ')');
  ok(/^ius1:[A-Za-z0-9_-]+$/.test(com), 'solo caracteres seguros');
  ok(com.startsWith(G.prefijoComentarioDe(evm)), 'prefijo de búsqueda por 0x');
  ok(G.verificarComentario(com, g1, ethers) === evm, 'verifica con el autor correcto');
  ok(G.verificarComentario(com, otroG1, ethers) === null, 'otro autor g1 NO sirve (no se puede copiar)');
  ok(G.verificarComentario(com.slice(0, -2) + 'AA', g1, ethers) === null, 'v fuera de {27,28} se rechaza');
  const medio = 80, otro = com[medio] === 'Q' ? 'R' : 'Q';
  ok(G.verificarComentario(com.slice(0, medio) + otro + com.slice(medio + 1), g1, ethers) === null, 'firma alterada en el medio');
  const dirAlterada = com.slice(0, 10) + (com[10] === 'Q' ? 'R' : 'Q') + com.slice(11);
  ok(G.verificarComentario(dirAlterada, g1, ethers) === null, 'dirección EVM alterada');
  ok(G.leerComentario('ius1:rev').tipo === 'rev' && G.leerComentario('merci') === null, 'rev / ajeno');

  /* Indexador simulado: reglas de "último" y "mutuo" */
  const falso = comentarios => async (_url, opts) => {
    const { query, variables } = JSON.parse(opts.body);
    let nodes = [];
    if(query.includes('equalTo:$id')) nodes = comentarios.filter(c => c.authorId === variables.id);
    else if(query.includes('startsWith:$p')) nodes = comentarios.filter(c => c.remark.startsWith(variables.p));
    nodes.sort((a, b) => b.blockNumber - a.blockNumber);
    return { json: async () => ({ data: { txComments: { nodes } } }) };
  };
  const nodo = (remark, authorId, blockNumber, success = true) =>
    ({ remark, authorId, blockNumber, event: { extrinsic: { hash: '0x' + blockNumber, success } } });

  let f = falso([nodo('merci', g1, 5), nodo(com, g1, 10)]);
  let v = await G.vinculoDeG1(g1, ethers, f);
  ok(v && v.evm === evm && v.bloque === 10 && v.extrinsic === '0x10', 'vínculo desde g1');
  ok((await G.vinculoDeEvm(evm, ethers, f)).g1 === g1, 'vínculo desde 0x');

  f = falso([nodo(com, g1, 10), nodo('ius1:rev', g1, 20)]);
  ok(await G.vinculoDeG1(g1, ethers, f) === null, 'revocado desde g1');
  ok(await G.vinculoDeEvm(evm, ethers, f) === null, 'revocado desde 0x');

  const w2 = ethers.Wallet.createRandom();
  const com2 = G.comentarioVinculo(w2.address, await w2.signMessage(G.mensajeVinculo(w2.address, g1)));
  f = falso([nodo(com, g1, 10), nodo(com2, g1, 30)]);
  ok((await G.vinculoDeG1(g1, ethers, f)).evm === w2.address, 'la g1 pasó a otra 0x');
  ok(await G.vinculoDeEvm(evm, ethers, f) === null, 'la 0x vieja pierde el vínculo (una identidad, una 0x)');

  f = falso([nodo(com, g1, 10, false)]);
  ok(await G.vinculoDeG1(g1, ethers, f) === null, 'extrinsic fallido no cuenta');

  // alguien copia el comentario desde OTRA cuenta g1: no le sirve a nadie
  f = falso([nodo(com, otroG1, 50)]);
  ok(await G.vinculoDeG1(otroG1, ethers, f) === null && await G.vinculoDeEvm(evm, ethers, f) === null, 'comentario copiado no vincula');

  /* Contra la red real */
  if(process.argv.includes('--vivo')){
    const id = await G.identidad(g1);
    ok(id && id.miembro && id.certificaciones >= 5 && id.vence > new Date(), 'identidad real: ' + JSON.stringify(id));
    const r = await G.consultarSerVivo(g1, ethers);
    ok(r.g1 === g1 && r.vinculo === null, 'consulta real sin vínculo (todavía nadie usa ius1)');
    ok((await G.consultarSerVivo(evm, ethers)).g1 === null, 'consulta real por 0x');
    console.log('   identidad:', id.nombre, id.certificaciones, 'certs, vence', id.vence.toISOString().slice(0, 10));
  }

  console.log('✔', n, 'comprobaciones OK');
})().catch(e => { console.error('✘', e.message); process.exit(1); });
