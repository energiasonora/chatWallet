// ¿Acepta la red EIP-7702 y deja simularlo? Una dirección nueva y sin fondos (como una stealth) delega en
// Multicall3 con una autorización firmada; un "relayer" sin fondos simula la llamada con authorizationList.
// Si devuelve código ejecutado como la propia dirección, el barrido 7702 es viable en esa red y el relayer
// puede validar antes de mandar. Medido el 7/10/2026: Base y Ethereum → OK (estimateGas 0xb9f9 = 47.609).

import { ethers } from '../../node_modules/ethers/lib.esm/index.js';
const MC3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
for (const [n, rpc, cid] of [['base', 'https://mainnet.base.org', 8453], ['ethereum', 'https://ethereum-rpc.publicnode.com', 1]]) {
  const p = new ethers.JsonRpcProvider(rpc, cid, { staticNetwork: true });
  const w = ethers.Wallet.createRandom().connect(p);   // "stealth" sin fondos
  const auth = await w.authorize({ address: MC3, nonce: 0, chainId: cid });
  const iface = new ethers.Interface(['function aggregate3((address,bool,bytes)[]) payable returns ((bool,bytes)[])']);
  const data = iface.encodeFunctionData('aggregate3', [[]]);
  const relayer = ethers.Wallet.createRandom().address;
  const params = [{ from: relayer, to: w.address, data, type: '0x4', authorizationList: [{
    chainId: ethers.toQuantity(cid), address: MC3, nonce: '0x0', yParity: ethers.toQuantity(auth.signature.yParity), r: auth.signature.r, s: auth.signature.s }] }];
  for (const m of ['eth_estimateGas', 'eth_call']) {
    try { const r = await p.send(m, m === 'eth_call' ? [params[0], 'latest'] : params); console.log(n, m, 'OK', r.slice(0, 80)); }
    catch (e) { console.log(n, m, 'ERR', (e.shortMessage || e.message).slice(0, 160)); }
  }
}
