// Barrido 7702 de punta a punta sobre un fork de Base (anvil, Prague), sin cheatcodes:
//  - despliegue determinista del sweeper (script/desplegar.mjs);
//  - una dirección stealth REAL de StealthPay (spend/view derivadas de una wallet, ERC-5564 esquema 1)
//    recibe USDC de Base y ETH;
//  - su llave firma la autorización 7702 y la orden EIP-712 CON ETHERS, como lo hará ChatWallet;
//  - un relayer manda una transacción tipo 4 real; después el propio receptor transmite otra orden sin
//    autorización (la delegación ya está) y paga su gas.
// Uso:  anvil --fork-url https://mainnet.base.org --hardfork prague --port 8547 &   node e2e/fork-base.mjs
import { ethers } from '../../../node_modules/ethers/lib.esm/index.js';
import { desplegar } from '../script/desplegar.mjs';
import fs from 'fs';

const RPC = process.env.RPC || 'http://127.0.0.1:8547';
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';   // USDC nativo de Base (FiatToken v2.2)
const p = new ethers.JsonRpcProvider(RPC, undefined, { staticNetwork: false });
const chainId = Number((await p.getNetwork()).chainId);
const sweeperAbi = JSON.parse(fs.readFileSync(new URL('../out/StealthSweeper.sol/StealthSweeper.json', import.meta.url))).abi;
const usdc = new ethers.Contract(USDC, ['function balanceOf(address) view returns (uint256)'], p);
let fallas = 0;
const ok = (c, m, x = '') => { console.log(`${c ? '✅' : '❌'} ${m}${x ? ' — ' + x : ''}`); if (!c) fallas++; };

// Cuentas de anvil (las 10 de siempre, con 10.000 ETH cada una).
const relayer = new ethers.Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', p);
const receptor = new ethers.Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', p);

// 1. Desplegar
const { dir: SWEEPER, nuevo, gas } = await desplegar(p, relayer);
ok((await p.getCode(SWEEPER)) !== '0x', `sweeper en ${SWEEPER}`, nuevo ? `desplegado, ${gas} gas` : 'ya estaba');

// 2. Una stealth de verdad, derivada como en StealthPay v1 (spend + s·G, s = keccak(view·R)).
const secp = ethers.SigningKey;
const spendPriv = ethers.hexlify(ethers.randomBytes(32)), viewPriv = ethers.hexlify(ethers.randomBytes(32));
const efimera = new ethers.Wallet(ethers.hexlify(ethers.randomBytes(32)));
// Igual que llaveDePagoStealth en dapp.html: s = keccak256(comprimido(view·R)), priv = spend + s (mod n).
const compartido = ethers.keccak256(secp.computePublicKey(new secp(viewPriv).computeSharedSecret(efimera.signingKey.publicKey), true));
const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
const stealthPriv = ethers.toBeHex((BigInt(spendPriv) + BigInt(compartido)) % n, 32);
const stealth = new ethers.Wallet(stealthPriv, p);
ok(true, `stealth ${stealth.address}`, 'sin nativo, como en la vida real');

// 3. Fondearla: USDC escribiendo su saldo (FiatToken v2.2: balanceAndBlacklistStates en el slot 9) y nada de ETH.
const slot = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'uint256'], [stealth.address, 9]));
await p.send('anvil_setStorageAt', [USDC, slot, ethers.toBeHex(50_000_000n, 32)]);
ok((await usdc.balanceOf(stealth.address)) === 50_000_000n, 'la stealth tiene 50 USDC');
ok((await p.getBalance(stealth.address)) === 0n, 'y 0 ETH');

// EIP-712 tal cual lo firmará ChatWallet.
const tipos = { Barrido: [
  { name: 'token', type: 'address' }, { name: 'destino', type: 'address' }, { name: 'monto', type: 'uint256' },
  { name: 'relayer', type: 'address' }, { name: 'comision', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
  { name: 'vence', type: 'uint256' }, { name: 'llamada', type: 'address' }, { name: 'datosHash', type: 'bytes32' }] };
const dominio = { name: 'StealthPay Barrido', version: '1', chainId, verifyingContract: stealth.address };
async function orden(o) {
  const b = { token: USDC, destino: receptor.address, monto: 0n, relayer: relayer.address, comision: 0n,
              nonce: BigInt(ethers.hexlify(ethers.randomBytes(16))), vence: BigInt(Math.floor(Date.now() / 1000) + 3600),
              llamada: ethers.ZeroAddress, datos: '0x', ...o };
  const firma = await stealth.signTypedData(dominio, tipos, { ...b, datosHash: ethers.keccak256(b.datos) });
  return { b, firma };
}
const iface = new ethers.Interface(sweeperAbi);

// 4. Primer barrido: relayer + autorización 7702 en la misma transacción tipo 4.
{
  const { b, firma } = await orden({ monto: 20_000_000n, comision: 50_000n });
  const auth = await stealth.authorize({ address: SWEEPER, nonce: 0, chainId });
  const data = iface.encodeFunctionData('barrer', [b, firma]);
  const est = await p.send('eth_estimateGas', [{ from: relayer.address, to: stealth.address, data, type: '0x4',
    authorizationList: [{ chainId: ethers.toQuantity(chainId), address: SWEEPER, nonce: '0x0',
      yParity: ethers.toQuantity(auth.signature.yParity), r: auth.signature.r, s: auth.signature.s }] }]);
  ok(BigInt(est) > 0n, 'el relayer simula con authorizationList antes de mandar', `${BigInt(est)} gas estimado`);
  const tx = await relayer.sendTransaction({ type: 4, to: stealth.address, data, authorizationList: [auth] });
  const rec = await tx.wait();
  ok(rec.status === 1, 'transacción tipo 4 minada', `${rec.gasUsed} gas usados (con autorización)`);
  ok((await p.getCode(stealth.address)) === ethers.concat(['0xef0100', SWEEPER]).toLowerCase(), 'la stealth quedó delegada en el sweeper');
  ok((await usdc.balanceOf(receptor.address)) >= 20_000_000n, 'el receptor recibió 20 USDC');
  ok((await usdc.balanceOf(stealth.address)) === 50_000_000n - 20_050_000n, 'la stealth pagó monto + comisión', `${await usdc.balanceOf(stealth.address)}`);
  const ev = rec.logs.map(l => { try { return iface.parseLog(l); } catch { return null; } }).find(Boolean);
  ok(ev && ev.name === 'Barrido_', 'evento Barrido_ emitido por la dirección stealth');
  // El digest que calcula el contrato coincide con el de ethers.
  const sw = new ethers.Contract(stealth.address, sweeperAbi, p);
  ok((await sw.digest(b)) === ethers.TypedDataEncoder.hash(dominio, tipos, { ...b, datosHash: ethers.keccak256(b.datos) }),
     'digest del contrato == EIP-712 de ethers');
  ok((await sw.usado(b.nonce)) === true, 'nonce marcado');
  // Replay: la misma orden otra vez revierte.
  let revirtio = false;
  try { await relayer.sendTransaction({ to: stealth.address, data }).then(t => t.wait()); } catch { revirtio = true; }
  ok(revirtio, 'el replay de la misma orden revierte');
}

// 5. Segundo barrido: SIN relayer. El receptor transmite y paga el gas; ya no hace falta autorización.
{
  const antes = await usdc.balanceOf(receptor.address);
  const { b, firma } = await orden({ monto: 10_000_000n, relayer: receptor.address, comision: 0n });
  const tx = await receptor.sendTransaction({ to: stealth.address, data: iface.encodeFunctionData('barrer', [b, firma]) });
  const rec = await tx.wait();
  ok(rec.status === 1, 'el receptor transmite la orden y paga su gas', `${rec.gasUsed} gas (sin autorización)`);
  ok((await usdc.balanceOf(receptor.address)) - antes === 10_000_000n, 'recibió 10 USDC, sin comisión para nadie');
}

// 6. ETH: la stealth recibe nativo estando delegada y lo barre entero, sin polvo.
{
  await receptor.sendTransaction({ to: stealth.address, value: ethers.parseEther('0.01') }).then(t => t.wait());
  const otro = ethers.Wallet.createRandom().address;
  const { b, firma } = await orden({ token: ethers.ZeroAddress, destino: otro, monto: ethers.parseEther('0.0099'), comision: ethers.parseEther('0.0001') });
  const rec = await (await relayer.sendTransaction({ to: stealth.address, data: iface.encodeFunctionData('barrer', [b, firma]) })).wait();
  ok(rec.status === 1 && (await p.getBalance(otro)) === ethers.parseEther('0.0099'), 'barre ETH al destino');
  ok((await p.getBalance(stealth.address)) === 0n, 'y la stealth queda en 0 exacto', `${rec.gasUsed} gas`);
}

console.log(fallas ? `\n✗ ${fallas} fallas` : '\n✓ todo bien');
process.exit(fallas ? 1 : 0);
