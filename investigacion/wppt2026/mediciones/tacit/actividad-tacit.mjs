// Actividad del pool EVM de Tacit (anon.wei) en Ethereum y Base: depósitos, retiros, transferencias privadas,
// depositantes distintos y montos. Ethereum vía la API de Routescan; Base vía mainnet.base.org en tramos de
// 500 bloques (Blockscout de Base pide challenge de Cloudflare y los RPC gratis rechazan rangos largos).
// ABIs de z0r0z/tacit docs/evm-pool/abi. Uso: node actividad-tacit.mjs
import { ethers } from '../../../../node_modules/ethers/lib.esm/index.js';
import fs from 'fs';
const POOL='0x000000c2A20657CE25f2Ba99737933D031AFBEE9', ROUTER='0x0000006C96Afa6f1cD4DF8FE19bc0d8B6A6Cd7B5';
const ab = f => { const j = JSON.parse(fs.readFileSync(new URL('./' + f, import.meta.url))); return new ethers.Interface(j.abi || j); };
const P = ab('TacitEvmPool.json'), R = ab('TacitEvmPoolRouter.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rpcCall = async (rpc, method, params) => {
  for (let i = 0; i < 6; i++) {
    try { const j = await (await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json();
      if (!j.error) return j.result; } catch {}
    await sleep(800 * (i + 1));
  }
  throw new Error(method + ' falló');
};
async function logsRoutescan(addr) {
  const all = [];
  for (let page = 1; ; page++) {
    const r = (await (await fetch(`https://api.routescan.io/v2/network/mainnet/evm/1/etherscan/api?module=logs&action=getLogs&address=${addr}&fromBlock=0&toBlock=latest&page=${page}&offset=1000`)).json()).result;
    if (!Array.isArray(r) || !r.length) break; all.push(...r); if (r.length < 1000) break;
  }
  return all.map(l => ({ ...l, blockNumber: parseInt(l.blockNumber, 16) }));
}
async function logsRpc(rpc, from, head, step) {
  const tramos = []; for (let a = from; a <= head; a += step) tramos.push([a, Math.min(head, a + step - 1)]);
  const all = []; let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < tramos.length) { const [a, b] = tramos[i++];
      const r = await rpcCall(rpc, 'eth_getLogs', [{ address: [POOL, ROUTER], fromBlock: ethers.toQuantity(a), toBlock: ethers.toQuantity(b) }]);
      all.push(...r.map(l => ({ ...l, blockNumber: parseInt(l.blockNumber, 16) }))); }
  }));
  return all.sort((x, y) => x.blockNumber - y.blockNumber || parseInt(x.logIndex, 16) - parseInt(y.logIndex, 16));
}
const chains = {
  ethereum: { rpc: 'https://ethereum-rpc.publicnode.com', from: 26069245, logs: async () => [...await logsRoutescan(POOL), ...await logsRoutescan(ROUTER)] },
  base: { rpc: 'https://mainnet.base.org', from: 51864014, logs: async (head) => logsRpc('https://mainnet.base.org', 51864014, head, 500) },
};
const out = { medido: new Date().toISOString() };
for (const [name, c] of Object.entries(chains)) {
  const head = parseInt(await rpcCall(c.rpc, 'eth_blockNumber', []), 16);
  const logs = await c.logs(head);
  const ev = {}, dep = [], wd = [], tr = [], relayers = {}, swept = [];
  for (const l of logs) {
    let x; try { x = (l.address.toLowerCase() === POOL.toLowerCase() ? P : R).parseLog({ topics: l.topics.filter(Boolean), data: l.data }); } catch { continue; }
    ev[x.name] = (ev[x.name] || 0) + 1;
    if (x.name === 'Received') swept.push(Number(ethers.formatEther(x.args.value)));
    if (x.name === 'Transact') {
      const amt = x.args.extAmount;
      const r = { tx: l.transactionHash, block: l.blockNumber, eth: Number(ethers.formatEther(amt < 0n ? -amt : amt)) };
      (amt > 0n ? dep : amt < 0n ? wd : tr).push(r);
      if (x.args.relayer !== ethers.ZeroAddress) relayers[x.args.relayer] = (relayers[x.args.relayer] || 0) + 1;
    }
  }
  const froms = {};
  for (const d of dep) { const t = await rpcCall(c.rpc, 'eth_getTransactionByHash', [d.tx]); d.from = t.from.toLowerCase(); froms[d.from] = (froms[d.from] || 0) + 1; }
  const ts = async b => new Date(parseInt((await rpcCall(c.rpc, 'eth_getBlockByNumber', [ethers.toQuantity(b), false])).timestamp, 16) * 1000).toISOString().slice(0, 10);
  out[name] = {
    bloques: [c.from, head], eventos: ev,
    depositos: dep.length, depositantesDistintos: Object.keys(froms).length,
    topDepositantes: Object.values(froms).sort((a, b) => b - a).slice(0, 5),
    ethDepositado: +dep.reduce((s, d) => s + d.eth, 0).toFixed(4),
    retiros: wd.length, ethRetirado: +wd.reduce((s, d) => s + d.eth, 0).toFixed(4),
    transferenciasPrivadas: tr.length, sweepsReceiveBox: swept.length,
    relayers,
    montosDeposito: dep.map(d => d.eth).sort((a, b) => b - a),
    montosRetiro: wd.map(d => d.eth).sort((a, b) => b - a),
    saldoPoolETH: Number(ethers.formatEther(BigInt(await rpcCall(c.rpc, 'eth_getBalance', [POOL, 'latest'])))),
    primerEvento: logs.length ? await ts(logs[0].blockNumber) : null,
  };
  console.log(name, JSON.stringify(out[name]));
}
fs.mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL(`./resultados/actividad-${out.medido.slice(0, 10)}.json`, import.meta.url), JSON.stringify(out, null, 1));
