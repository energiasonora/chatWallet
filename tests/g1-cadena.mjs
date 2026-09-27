// Módulo de la cadena Ğ1 (src/js/g1-cadena.js) contra la red REAL, sin mandar nada.
//
// - saldo(): lo que dice la cadena de una cuenta miembro real.
// - La firma: ed25519 es determinista, así que la transferencia firmada con nuestro par
//   liviano (@noble, sin el wasm de polkadot) tiene que dar EXACTAMENTE los mismos bytes
//   que firmada con @polkadot/keyring, que es lo que usa Cesium². Si coincide, la cadena
//   la acepta igual que la de Cesium².
// - duPendiente: el cálculo de Cesium² con cambios de monto de por medio.
// Correr:  node tests/g1-cadena.mjs        (Node 22, sin NODE_OPTIONS; necesita red)
import { conectar, saldo, prepararEnvio, _duPendiente } from '../src/js/g1-cadena.js';
import { cuentaG1 } from '../src/js/g1-llave.js';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); } };
const SOPHIE = 'g1K378tVb3YMtuLRCB7T63zQ22orBRdkmtrhzMsu81LRRaLxH';

console.log('Dividendo pendiente (pastReevals reales: [[1,1148],[15,1178],[197,1217]])');
const R = [[1, 1148], [15, 1178], [197, 1217]];
check('202→204: 2 × 12,17', _duPendiente(202, 204, R) === 2434);
check('al día: 0', _duPendiente(204, 204, R) === 0);
check('cruzando un cambio de monto: 195→199', _duPendiente(195, 199, R) === 2 * 1178 + 2 * 1217);

console.log('Cadena real');
const api = await conectar();
check('conecta a la red Ğ1 (génesis correcto)', api.genesisHash.toHex().startsWith('0xfeb770bb'));
const s = await saldo(SOPHIE);
check('saldo de una cuenta miembro', s.saldo > 0 && Number.isInteger(s.pendiente), JSON.stringify(s));
console.log('     ', JSON.stringify(s));

console.log('Firma: idéntica a la de @polkadot/keyring');
await cryptoWaitReady();
const FRASE = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
const cuenta = cuentaG1(FRASE, '');
const par = new Keyring({ type: 'ed25519', ss58Format: 4450 }).addFromUri(FRASE);
check('misma cuenta que el Keyring', par.address === cuenta.direccion);
const { tx } = await prepararEnvio(cuenta, SOPHIE, 150, 'hola desde ChatWallet');
const nuestra = tx.toHex();
const sig = tx.signature;
// Re-firmar el MISMO payload con el Keyring: mismos nonce, era y bloque de referencia
// (el de nacimiento de la era, que se recupera del número de bloque actual).
const decoded = api.createType('Extrinsic', nuestra);
const alto = (await api.rpc.chain.getHeader()).number.toNumber();
const blockHash = await api.rpc.chain.getBlockHash(decoded.era.asMortalEra.birth(alto));
check('la transacción lleva batch_all (0x3602), sin claim_uds (cuenta sin identidad)', decoded.method.toHex().startsWith('0x3602') && decoded.method.args[0].length === 2, decoded.method.toHex().slice(0, 10));
const payload = api.createType('ExtrinsicPayload', {
    method: decoded.method.toHex(), era: decoded.era, nonce: decoded.nonce, tip: decoded.tip,
    specVersion: api.runtimeVersion.specVersion, transactionVersion: api.runtimeVersion.transactionVersion,
    genesisHash: api.genesisHash, blockHash, mode: 0,
}, { version: 4 });
// Keyring devuelve la MultiSignature entera: 0x00 (ed25519) + los 64 bytes.
const firmaKeyring = payload.sign(par).signature;
check('la firma de Keyring sobre el mismo payload es byte a byte la nuestra', firmaKeyring === '0x00' + sig.toHex().slice(2), `${firmaKeyring.slice(0, 20)} vs ${sig.toHex().slice(0, 20)}`);
check('y la firma verifica con la pública', (await import('@polkadot/util-crypto')).signatureVerify(payload.toU8a({ method: true }), sig.toU8a(), cuenta.direccion).isValid);

await api.disconnect();
console.log(`\n${ok} ok, ${fail} fallas`);
process.exit(fail ? 1 : 0);
