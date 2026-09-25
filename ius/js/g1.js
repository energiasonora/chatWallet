/* Ius Naturalis · Vínculo Ğ1 — norma ius-naturalis/vinculo-g1/1
 *
 * Une una dirección EVM (0x…) con una cuenta Ğ1 (g1…) mediante UN comentario
 * de transferencia en la cadena Ğ1 (System.remark_with_event), que lleva adentro
 * la firma EVM. Cualquier billetera Ğ1 (Ğecko, Cesium²) sabe mandarlo, y cualquiera
 * lo verifica con un nodo o indexador de Ğ1: no depende de Ius.
 *
 * Spec: ius-spec/vinculo-g1.md. Sin dependencias salvo ethers (verifyMessage),
 * que se recibe por parámetro para poder probar esto en Node.
 */
(function(raiz){
  'use strict';

  /* ================= blake2b-512 (RFC 7693) — solo para el checksum SS58 ================= */
  // Con BigInt: lento para megas, sobrado para los 41 bytes de una dirección.
  const M64 = (1n << 64n) - 1n;
  const IV = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];
  const SIGMA = [
    [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],[14,10,4,8,9,15,13,6,1,12,0,2,11,7,5,3],
    [11,8,12,0,5,2,15,13,10,14,3,6,7,1,9,4],[7,9,3,1,13,12,11,14,2,6,5,10,4,0,15,8],
    [9,0,5,7,2,4,10,15,14,1,11,12,6,8,3,13],[2,12,6,10,0,11,8,3,4,13,7,5,15,14,1,9],
    [12,5,1,15,14,13,4,10,0,7,6,3,9,2,8,11],[13,11,7,14,12,1,3,9,5,0,15,4,8,6,2,10],
    [6,15,14,9,11,3,0,8,12,2,13,7,1,4,10,5],[10,2,8,4,7,6,1,5,15,11,9,14,3,12,13,0],
  ];
  const rotr = (x, n) => ((x >> n) | (x << (64n - n))) & M64;

  function blake2b512(datos){
    const h = IV.slice();
    h[0] ^= 0x01010000n ^ 64n;              // sin clave, salida de 64 bytes
    const n = datos.length;
    const bloques = Math.max(1, Math.ceil(n / 128));
    for(let b = 0; b < bloques; b++){
      const ultimo = b === bloques - 1;
      const bloque = new Uint8Array(128);
      bloque.set(datos.subarray(b * 128, Math.min(n, (b + 1) * 128)));
      const m = [];
      for(let i = 0; i < 16; i++){
        let w = 0n;
        for(let j = 7; j >= 0; j--) w = (w << 8n) | BigInt(bloque[i * 8 + j]);
        m.push(w);
      }
      const t = BigInt(ultimo ? n : (b + 1) * 128);
      const v = h.concat(IV);
      v[12] ^= t & M64;
      v[13] ^= t >> 64n;
      if(ultimo) v[14] ^= M64;
      const G = (a, bb, c, d, x, y) => {
        v[a] = (v[a] + v[bb] + x) & M64; v[d] = rotr(v[d] ^ v[a], 32n);
        v[c] = (v[c] + v[d]) & M64;      v[bb] = rotr(v[bb] ^ v[c], 24n);
        v[a] = (v[a] + v[bb] + y) & M64; v[d] = rotr(v[d] ^ v[a], 16n);
        v[c] = (v[c] + v[d]) & M64;      v[bb] = rotr(v[bb] ^ v[c], 63n);
      };
      for(let r = 0; r < 12; r++){
        const s = SIGMA[r % 10];
        G(0,4,8,12, m[s[0]], m[s[1]]);  G(1,5,9,13, m[s[2]], m[s[3]]);
        G(2,6,10,14,m[s[4]], m[s[5]]);  G(3,7,11,15,m[s[6]], m[s[7]]);
        G(0,5,10,15,m[s[8]], m[s[9]]);  G(1,6,11,12,m[s[10]],m[s[11]]);
        G(2,7,8,13, m[s[12]],m[s[13]]); G(3,4,9,14, m[s[14]],m[s[15]]);
      }
      for(let i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
    }
    const out = new Uint8Array(64);
    for(let i = 0; i < 8; i++) for(let j = 0; j < 8; j++) out[i * 8 + j] = Number((h[i] >> BigInt(8 * j)) & 0xffn);
    return out;
  }

  /* ================= base58 (alfabeto de Bitcoin, el que usa SS58) ================= */
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Decodificar(s){
    let n = 0n;
    for(const c of s){
      const i = B58.indexOf(c);
      if(i < 0) return null;
      n = n * 58n + BigInt(i);
    }
    const bytes = [];
    while(n > 0n){ bytes.unshift(Number(n & 0xffn)); n >>= 8n; }
    for(const c of s){ if(c === '1') bytes.unshift(0); else break; }
    return new Uint8Array(bytes);
  }
  function base58Codificar(bytes){
    let n = 0n;
    for(const b of bytes) n = (n << 8n) | BigInt(b);
    let s = '';
    while(n > 0n){ s = B58[Number(n % 58n)] + s; n /= 58n; }
    for(const b of bytes){ if(b === 0) s = '1' + s; else break; }
    return s;
  }

  /* ================= SS58 (direcciones g1…) ================= */
  const PREFIJO_G1 = 4450;   // runtime/g1/src/parameters.rs → SS58Prefix
  const SS58PRE = new TextEncoder().encode('SS58PRE');

  function prefijoBytes(id){
    if(id < 64) return new Uint8Array([id]);
    return new Uint8Array([((id & 0xfc) >> 2) | 0x40, (id >> 8) | ((id & 0x03) << 6)]);
  }
  function concatenar(...partes){
    const out = new Uint8Array(partes.reduce((a, p) => a + p.length, 0));
    let o = 0; for(const p of partes){ out.set(p, o); o += p.length; }
    return out;
  }

  // Devuelve { prefijo, clave (32 bytes) } o null si la dirección no es SS58 válida.
  function ss58Decodificar(dir){
    if(typeof dir !== 'string') return null;
    const b = base58Decodificar(dir.trim());
    if(!b || b.length < 3) return null;
    let id, largoPrefijo;
    if(b[0] < 64){ id = b[0]; largoPrefijo = 1; }
    else if(b[0] < 128){
      id = ((b[0] & 0x3f) << 2) | (b[1] >> 6) | ((b[1] & 0x3f) << 8);
      largoPrefijo = 2;
    }else return null;
    if(b.length !== largoPrefijo + 32 + 2) return null;       // solo cuentas de 32 bytes
    const cuerpo = b.subarray(0, largoPrefijo + 32);
    const suma = blake2b512(concatenar(SS58PRE, cuerpo));
    if(suma[0] !== b[largoPrefijo + 32] || suma[1] !== b[largoPrefijo + 33]) return null;
    return { prefijo: id, clave: b.slice(largoPrefijo, largoPrefijo + 32) };
  }
  function ss58Codificar(clave, prefijo = PREFIJO_G1){
    const cuerpo = concatenar(prefijoBytes(prefijo), clave);
    const suma = blake2b512(concatenar(SS58PRE, cuerpo));
    return base58Codificar(concatenar(cuerpo, suma.subarray(0, 2)));
  }
  function esDireccionG1(dir){
    const d = ss58Decodificar(dir);
    return !!d && d.prefijo === PREFIJO_G1;
  }

  /* ================= base64url sin relleno ================= */
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64urlCodificar(bytes){
    let s = '';
    for(let i = 0; i < bytes.length; i += 3){
      const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      const quedan = bytes.length - i;
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
      if(quedan > 1) s += B64[(n >> 6) & 63];
      if(quedan > 2) s += B64[n & 63];
    }
    return s;
  }
  function b64urlDecodificar(s){
    if(!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
    const out = [];
    for(let i = 0; i < s.length; i += 4){
      const trozo = s.slice(i, i + 4);
      let n = 0;
      for(let j = 0; j < 4; j++) n = (n << 6) | (j < trozo.length ? B64.indexOf(trozo[j]) : 0);
      out.push((n >> 16) & 255);
      if(trozo.length > 2) out.push((n >> 8) & 255);
      if(trozo.length > 3) out.push(n & 255);
    }
    return new Uint8Array(out);
  }

  const hexABytes = h => new Uint8Array((h.replace(/^0x/, '').match(/../g) || []).map(x => parseInt(x, 16)));
  const bytesAHex = b => '0x' + [...b].map(x => x.toString(16).padStart(2, '0')).join('');

  /* ================= el vínculo ================= */
  const PREFIJO_COMENTARIO = 'ius1:';
  const COMENTARIO_REVOCAR = 'ius1:rev';

  // Texto FIJO: no se traduce, porque el comentario no lleva idioma y la firma tiene que
  // poder reconstruirse igual en cualquier lado.
  function mensajeVinculo(evm, g1){
    return 'Ius Naturalis · vinculo Ğ1 · v1\nEVM: ' + evm.toLowerCase() + '\nG1: ' + g1.trim();
  }
  function comentarioVinculo(evm, firma){
    const addr = hexABytes(evm), sig = hexABytes(firma);
    if(addr.length !== 20 || sig.length !== 65) throw new Error('dirección o firma de largo inválido');
    return PREFIJO_COMENTARIO + b64urlCodificar(concatenar(addr, sig));
  }
  // Prefijo que tienen todos los comentarios que nombran a una 0x: los primeros 18 bytes
  // (múltiplo de 3) codifican a 24 caracteres fijos, así el indexador filtra con startsWith.
  function prefijoComentarioDe(evm){
    return PREFIJO_COMENTARIO + b64urlCodificar(hexABytes(evm).subarray(0, 18));
  }
  function leerComentario(texto){
    if(typeof texto !== 'string') return null;
    const s = texto.trim();
    if(s === COMENTARIO_REVOCAR) return { tipo: 'rev' };
    if(!s.startsWith(PREFIJO_COMENTARIO)) return null;
    const b = b64urlDecodificar(s.slice(PREFIJO_COMENTARIO.length));
    if(!b || b.length !== 85) return null;
    // v estricto en {27,28}: ethers acepta también 0/1 y recupera lo mismo, y eso daría
    // varios comentarios distintos para un mismo vínculo. Una sola forma canónica.
    if(b[84] !== 27 && b[84] !== 28) return null;
    return { tipo: 'vinculo', evm: bytesAHex(b.subarray(0, 20)), firma: bytesAHex(b.subarray(20)) };
  }
  // La 0x que queda vinculada si el comentario lo mandó la cuenta `autorG1`, o null.
  function verificarComentario(texto, autorG1, ethers){
    const c = leerComentario(texto);
    if(!c || c.tipo !== 'vinculo') return null;
    try{
      const rec = ethers.verifyMessage(mensajeVinculo(c.evm, autorG1), c.firma);
      return rec.toLowerCase() === c.evm.toLowerCase() ? ethers.getAddress(c.evm) : null;
    }catch(_){ return null; }
  }

  /* ================= indexador (squid) con respaldo ================= */
  // Probados el 25/9/2026: Bruselas responde; axiom-team devolvía vacío. Se prueban en orden
  // y se recuerda el último que contestó. Todos son PostGraphile (no Hasura).
  const INDEXADORES = [
    'https://squid.g1.brussels.ovh/v1/graphql',
    'https://g1-squid.axiom-team.fr/v1/graphql',
  ];
  const SEG_POR_BLOQUE = 6;
  let preferido = 0;

  async function consultar(query, variables, fetchFn){
    const f = fetchFn || raiz.fetch.bind(raiz);
    let ultimoError = null;
    for(let k = 0; k < INDEXADORES.length; k++){
      const i = (preferido + k) % INDEXADORES.length;
      try{
        const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const reloj = ctl && setTimeout(() => ctl.abort(), 12000);
        const r = await f(INDEXADORES[i], {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query, variables }), signal: ctl && ctl.signal,
        });
        if(reloj) clearTimeout(reloj);
        const j = await r.json();
        if(j.errors && j.errors.length) throw new Error(j.errors[0].message);
        if(!j.data) throw new Error('respuesta vacía');
        preferido = i;
        return j.data;
      }catch(e){ ultimoError = e; }
    }
    throw new Error('Ningún indexador de Ğ1 respondió (' + (ultimoError && ultimoError.message) + ')');
  }

  const Q_IDENTIDAD = `query($id:String!){
    identityByAccountId(accountId:$id){ index name status isMember expireOn
      certReceived(filter:{isActive:{equalTo:true}}){ totalCount } }
    blocks(first:1, orderBy:HEIGHT_DESC){ nodes{ height timestamp } } }`;
  const CAMPOS_COMENTARIO = `nodes{ remark blockNumber authorId event{ extrinsic{ hash success } } }`;
  const Q_COMENTARIOS_DE = `query($id:String!){
    txComments(first:20, orderBy:BLOCK_NUMBER_DESC,
      filter:{ authorId:{equalTo:$id}, remark:{startsWith:"${PREFIJO_COMENTARIO}"} }){ ${CAMPOS_COMENTARIO} } }`;
  const Q_COMENTARIOS_QUE_NOMBRAN = `query($p:String!){
    txComments(first:20, orderBy:BLOCK_NUMBER_DESC,
      filter:{ remark:{startsWith:$p} }){ ${CAMPOS_COMENTARIO} } }`;

  const exitoso = n => !n.event || !n.event.extrinsic || n.event.extrinsic.success !== false;

  // El vínculo vigente que emitió una cuenta g1: su último comentario ius1 válido,
  // salvo que sea una revocación. → { evm, g1, bloque, extrinsic } o null.
  async function vinculoDeG1(g1, ethers, fetchFn){
    const d = await consultar(Q_COMENTARIOS_DE, { id: g1 }, fetchFn);
    for(const n of d.txComments.nodes){
      if(!exitoso(n)) continue;
      const c = leerComentario(n.remark);
      if(!c) continue;                      // ius1: mal formado: se ignora, no corta la búsqueda
      if(c.tipo === 'rev') return null;
      const evm = verificarComentario(n.remark, g1, ethers);
      if(!evm) continue;                    // firma que no cierra: ignorada
      return { evm, g1, bloque: n.blockNumber, extrinsic: n.event && n.event.extrinsic && n.event.extrinsic.hash };
    }
    return null;
  }

  // El vínculo vigente de una 0x: el comentario más reciente que la nombra, y SOLO si sigue
  // siendo el último vínculo de su cuenta g1 (mutuo y último: una identidad, una 0x a la vez).
  async function vinculoDeEvm(evm, ethers, fetchFn){
    const d = await consultar(Q_COMENTARIOS_QUE_NOMBRAN, { p: prefijoComentarioDe(evm) }, fetchFn);
    for(const n of d.txComments.nodes){
      if(!exitoso(n)) continue;
      const ok = verificarComentario(n.remark, n.authorId, ethers);
      if(!ok || ok.toLowerCase() !== evm.toLowerCase()) continue;
      const vigente = await vinculoDeG1(n.authorId, ethers, fetchFn);
      return vigente && vigente.evm.toLowerCase() === evm.toLowerCase() ? vigente : null;
    }
    return null;
  }

  // Identidad Ğ1 de una cuenta, con la fecha de vencimiento estimada desde el bloque actual.
  async function identidad(g1, fetchFn){
    const d = await consultar(Q_IDENTIDAD, { id: g1 }, fetchFn);
    const idty = d.identityByAccountId;
    if(!idty) return null;
    const cab = d.blocks.nodes[0];
    let vence = null;
    if(cab && idty.expireOn){
      vence = new Date(new Date(cab.timestamp).getTime() + (idty.expireOn - cab.height) * SEG_POR_BLOQUE * 1000);
    }
    return {
      indice: idty.index, nombre: idty.name, estado: idty.status, miembro: !!idty.isMember,
      certificaciones: idty.certReceived ? idty.certReceived.totalCount : 0, vence,
    };
  }

  // Entrada libre (0x… o g1…) → { vinculo, identidad } para pintar el badge.
  async function consultarSerVivo(entrada, ethers, fetchFn){
    const s = String(entrada || '').trim();
    let vinculo = null, g1 = null;
    if(/^0x[0-9a-fA-F]{40}$/.test(s)){
      vinculo = await vinculoDeEvm(s, ethers, fetchFn);
      g1 = vinculo && vinculo.g1;
    }else if(esDireccionG1(s)){
      g1 = s;
      vinculo = await vinculoDeG1(s, ethers, fetchFn);
    }else{
      throw new Error('formato');
    }
    return { entrada: s, g1, vinculo, identidad: g1 ? await identidad(g1, fetchFn) : null };
  }

  const api = {
    PREFIJO_G1, INDEXADORES, COMENTARIO_REVOCAR,
    blake2b512, base58Decodificar, base58Codificar, ss58Decodificar, ss58Codificar, esDireccionG1,
    b64urlCodificar, b64urlDecodificar,
    mensajeVinculo, comentarioVinculo, prefijoComentarioDe, leerComentario, verificarComentario,
    consultar, vinculoDeG1, vinculoDeEvm, identidad, consultarSerVivo,
  };
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.IusG1 = api;
})(typeof window !== 'undefined' ? window : globalThis);
