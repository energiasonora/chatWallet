// Despliega StealthSweeper con CREATE2 desde el deterministic deployer (0x4e59…956C): la MISMA dirección
// en toda red que lo tenga, porque la autorización 7702 apunta a una dirección fija. Si ya hay código ahí,
// no hace nada.
// Uso:  RPC=<url> CLAVE=<0x…> node script/desplegar.mjs          (despliega)
//       RPC=<url> node script/desplegar.mjs                       (sólo dice la dirección y si existe)
import { ethers } from '../../../node_modules/ethers/lib.esm/index.js';
import fs from 'fs';

export const DEPLOYER = '0x4e59b44847b379578588920cA78FbF26c0B4956C';
export const SAL = ethers.id('stealthpay.barrido.v1');

export function initcode() {
  const art = JSON.parse(fs.readFileSync(new URL('../out/StealthSweeper.sol/StealthSweeper.json', import.meta.url)));
  return art.bytecode.object;
}
export const direccionSweeper = () => ethers.getCreate2Address(DEPLOYER, SAL, ethers.keccak256(initcode()));

export async function desplegar(provider, firmante) {
  const dir = direccionSweeper();
  if ((await provider.getCode(dir)) !== '0x') return { dir, nuevo: false };
  if ((await provider.getCode(DEPLOYER)) === '0x') throw new Error('esta red no tiene el deterministic deployer');
  if (!firmante) return { dir, nuevo: false, falta: true };
  const tx = await firmante.sendTransaction({ to: DEPLOYER, data: ethers.concat([SAL, initcode()]) });
  const rec = await tx.wait();
  if ((await provider.getCode(dir)) === '0x') throw new Error('el deploy no dejó código en ' + dir);
  return { dir, nuevo: true, tx: tx.hash, gas: rec.gasUsed };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC);
  const firmante = process.env.CLAVE ? new ethers.Wallet(process.env.CLAVE, provider) : null;
  const r = await desplegar(provider, firmante);
  const red = await provider.getNetwork();
  console.log(JSON.stringify({ red: Number(red.chainId), ...r, gas: r.gas?.toString() }, null, 1));
}
