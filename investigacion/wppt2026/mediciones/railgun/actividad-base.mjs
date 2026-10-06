// Actividad de Railgun en Base, medida en la cadena vía la API de Blockscout.
// (Los RPC públicos de Base no sirven acá: publicnode pide token para rangos viejos,
//  mainnet.base.org limita getLogs a 500 bloques y drpc gratis rechaza el rango.)
// Proxy, registry y relayAdapt7702 tomados de @railgun-community/shared-models 8.2.1.
import { ethers } from '../../../../node_modules/ethers/lib.esm/index.js';
import fs from 'fs';
const API = 'https://base.blockscout.com/api';
const PROXY = '0x0047d1F97674614189E80566575FB615788AcF25', DESPLIEGUE = 50224711;
const OTROS = { registry: '0xFe276aD6a9Be967292D7fcb74E5510a1A6796bFb', relayAdapt7702: '0xAcBC3De27E7d9750a7F26b2eCCE9c89C24Cc8691' };
const abi = JSON.parse(fs.readFileSync(new URL('./abi-railgun-smart-wallet.json', import.meta.url)));
const iface = new ethers.Interface(abi.abi || abi);
const get = async (q) => (await (await fetch(`${API}?${q}`)).json()).result;

async function logs(addr) {          // pagina de a 1000 hasta agotar
  const todos = [];
  for (let page = 1; ; page++) {
    const r = await get(`module=logs&action=getLogs&fromBlock=${DESPLIEGUE}&toBlock=latest&address=${addr}&page=${page}&offset=1000`);
    if (!Array.isArray(r) || !r.length) break;
    todos.push(...r); if (r.length < 1000) break;
  }
  return todos;
}
const L = await logs(PROXY);
const eventos = {}, porDia = {};
for (const l of L) {
  let n; try { n = iface.parseLog({ topics: l.topics.filter(Boolean), data: l.data }).name; } catch { n = 'otro'; }
  eventos[n] = (eventos[n] || 0) + 1;
  const d = new Date(parseInt(l.timeStamp, 16) * 1000).toISOString().slice(0, 10);
  porDia[d] = (porDia[d] || 0) + 1;
}
const tokens = (await get(`module=account&action=tokentx&address=${PROXY}&page=1&offset=1000`)) || [];
const res = {
  medido: new Date().toISOString(), red: 'Base', proxy: PROXY, bloqueDespliegue: DESPLIEGUE,
  eventosProxy: eventos, logsPorDia: porDia,
  shield: eventos.Shield || 0, transact: eventos.Transact || 0, unshield: eventos.Unshield || 0,
  transferenciasDeTokens: tokens.map(t => ({ token: t.tokenSymbol, monto: Number(t.value) / 10 ** Number(t.tokenDecimal || 0),
                                             bloque: +t.blockNumber, fecha: new Date(+t.timeStamp * 1000).toISOString().slice(0, 10) })),
  otrosContratos: Object.fromEntries(await Promise.all(Object.entries(OTROS).map(async ([k, a]) => [k, (await logs(a)).length]))),
};
console.log(JSON.stringify(res, null, 1));
fs.mkdirSync(new URL('./resultados/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL(`./resultados/base-actividad-${res.medido.slice(0, 10)}.json`, import.meta.url), JSON.stringify(res, null, 1));
