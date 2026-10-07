// Prueba la entrada de art/TACIT_2x2 y la verifica contra el verificador Groth16 DESPLEGADO del pool
// (0x000000b1c0e84CEc8AdF8278B90c4d6400DfB153, el mismo en todas las cadenas) por eth_call, en Base.
// Así la prueba es válida para el contrato real, no sólo para la vkey publicada.
import * as snarkjs from '../railgun/node_modules/snarkjs/main.js';
import { ethers } from '../../../../node_modules/ethers/lib.esm/index.js';
import fs from 'fs';
const d = new URL('../railgun/art/TACIT_2x2/', import.meta.url).pathname;
const { proof, publicSignals } = await snarkjs.groth16.fullProve(JSON.parse(fs.readFileSync(d + 'input.json')), d + 'wasm', d + 'zkey');
const cd = JSON.parse('[' + await snarkjs.groth16.exportSolidityCallData(proof, publicSignals) + ']');
const iface = new ethers.Interface(['function verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[11]) view returns (bool)']);
const p = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
const VERIF = '0x000000b1c0e84CEc8AdF8278B90c4d6400DfB153';
const llamar = async (args) => { try { return iface.decodeFunctionResult('verifyProof', await p.call({ to: VERIF, data: iface.encodeFunctionData('verifyProof', args) }))[0]; } catch (e) { return 'revert: ' + (e.shortMessage || e.message); } };
console.log('verificador desplegado (Base), prueba real:', await llamar(cd));
const mal = structuredClone(cd); mal[3][0] = (BigInt(mal[3][0]) + 1n).toString();
console.log('control negativo (root + 1):', await llamar(mal));
process.exit(0);
