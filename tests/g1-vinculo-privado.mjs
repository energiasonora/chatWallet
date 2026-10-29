// Vínculo privado 0x ↔ g1 en el perfil del chat (ius-spec/vinculo-g1.md §11.3):
// src/js/g1-billetera.js → vinculoPrivado / verificarVinculoPrivado.
// Correr:  node tests/g1-vinculo-privado.mjs        (Node 22, sin NODE_OPTIONS)
import { ethers } from 'ethers';
import { vinculoPrivado, verificarVinculoPrivado, cuentaDeRaizHex, raizHex } from '../src/js/g1-billetera.js';

let ok = 0, fail = 0;
const check = (n, c, x = '') => { if (c) { ok++; console.log(`  ✅ ${n}`); } else { fail++; console.log(`  ❌ ${n}${x ? ' — ' + x : ''}`); } };

const FRASE = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const w = ethers.Wallet.fromPhrase(FRASE);
const otra = ethers.Wallet.createRandom();
const raiz = raizHex(FRASE);
const cuenta = cuentaDeRaizHex(raiz, '');
const cuenta0 = cuentaDeRaizHex(raiz, '//0');

const v = await vinculoPrivado(cuenta, w.address, (m) => w.signMessage(m));
check('cuenta g1…', /^g1/.test(v.cuenta) && v.cuenta === cuenta.direccion, v.cuenta);
check('firma ed25519 en base64url de 64 bytes', /^[A-Za-z0-9_-]{86}$/.test(v.ed), v.ed);
check('verifica con su 0x', verificarVinculoPrivado(v, w.address, ethers) === cuenta.direccion);
check('verifica con la 0x en minúsculas', verificarVinculoPrivado(v, w.address.toLowerCase(), ethers) === cuenta.direccion);
check('otra 0x → null', verificarVinculoPrivado(v, otra.address, ethers) === null);
check('cambiar la cuenta → null', verificarVinculoPrivado({ ...v, cuenta: cuenta0.direccion }, w.address, ethers) === null);

// Alguien firma con SU 0x reclamando una g1 ajena: la firma ed25519 no le da.
const ajena = await vinculoPrivado(cuenta, otra.address, (m) => otra.signMessage(m));
check('ed25519 de otro mensaje → null', verificarVinculoPrivado({ ...ajena, ed: v.ed }, otra.address, ethers) === null);
// Y al revés: g1 propia firmando, pero la firma EVM es de otra 0x.
check('firma EVM ajena → null', verificarVinculoPrivado({ ...v, evm: ajena.evm }, w.address, ethers) === null);

const sigMal = v.ed.slice(0, -2) + (v.ed.endsWith('AA') ? 'BA' : 'AA');
check('ed25519 alterada → null', verificarVinculoPrivado({ ...v, ed: sigMal }, w.address, ethers) === null);
check('basura → null', verificarVinculoPrivado({ cuenta: 'x', evm: '0x', ed: '' }, w.address, ethers) === null);
check('null → null', verificarVinculoPrivado(null, w.address, ethers) === null);
check('dirección de otra red SS58 (prefijo 42) → null', verificarVinculoPrivado({ ...v, cuenta: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' }, w.address, ethers) === null);

console.log(`\n${ok} ✔  ${fail} ✘`);
process.exit(fail ? 1 : 0);
