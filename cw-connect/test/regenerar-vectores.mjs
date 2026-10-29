// Regenera vectores.json desde la implementación de referencia. Correrlo SÓLO si la spec cambió:
// los vectores son el contrato, no un espejo del código.   node cw-connect/test/regenerar-vectores.mjs
import fs from 'node:fs';
import { armarUriVinculacion, leerUriVinculacion, CwCodec } from '../cw-connect.mjs';

const inbox = '0x8ba1f109551bd432803012645ac136ddd64dba72';
const uris = [
    { inbox, chainId: 8453, app: 'mail.energiasonora.org', name: 'Soberano Mail', kind: 'once' },
    { inbox: '0x8BA1F109551BD432803012645AC136DDD64DBA72', chainId: 0, app: 'Panel.ChatWallet.org', name: '', kind: 'session' },
    { inbox, chainId: 1, app: 'evil.com/x', name: 'Nombre larguísimo que supera los cuarenta caracteres permitidos', kind: 'otra' },
    // §3.2 login en un paso; el segundo trae un tab (control) y se descarta entero.
    { inbox, chainId: 1, app: 'mail.energiasonora.org', name: 'Soberano Mail', kind: 'once', login: 'Soberano Mail Login\nNonce: 4f2a9c' },
    { inbox, chainId: 1, app: 'mail.energiasonora.org', name: 'Soberano Mail', kind: 'once', login: 'con\ttab' },
].map(entrada => ({ entrada, uri: armarUriVinculacion(entrada) }));

const lecturas = [
    uris[0].uri,
    `chatwallet://wc?inbox=${inbox}&chain=8453&v=1`,
    `https://chatwallet.org/dapp?wc=1&inbox=${inbox}&chain=8453&v=2&app=uso.chatwallet.org&name=Panel%20de%20uso&kind=once`,
    `CWW2|${inbox}|8453`,
    `CWW1|${inbox}`,
    'chatwallet://wc?inbox=0x123&chain=1',
    `chatwallet://wc?inbox=${inbox}&v=2&app=a%20b&name=%0Aoculto`,
    '0x' + '1'.repeat(40),
    `chatwallet://wc?v=2&inbox=${inbox}&chain=1&app=mail.energiasonora.org&kind=once&login=Soberano%20Mail%20Login%0ANonce%3A%204f2a9c`,
    `chatwallet://wc?v=2&inbox=${inbox}&chain=1&kind=once&login=${'x'.repeat(501)}`,
].map(texto => ({ texto, resultado: leerUriVinculacion(texto) }));

const codec = new CwCodec();
const mensajes = [
    { cw: 1, type: 'connect', v: 2, address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', chainId: 8453, app: 'mail.energiasonora.org', name: 'Soberano Mail', kind: 'once' },
    { cw: 1, type: 'connect', v: 2, address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', chainId: 1, app: 'mail.energiasonora.org', name: 'Soberano Mail', kind: 'once', login: '0x' + '22'.repeat(65) },
    { cw: 1, type: 'rpc', id: '7d3c1a8e-0000-4000-8000-000000000001', method: 'personal_sign', params: ['hola', inbox], ttl: 180000 },
    { cw: 1, type: 'rpc', id: '7d3c1a8e-0000-4000-8000-000000000002', method: 'eth_sendTransaction', params: [{ to: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', data: '0x', value: '0x0', chainId: 8453 }] },
    { cw: 1, type: 'result', id: '7d3c1a8e-0000-4000-8000-000000000001', result: '0x' + '11'.repeat(65) },
    { cw: 1, type: 'error', id: '7d3c1a8e-0000-4000-8000-000000000001', error: 'user rejected', code: 4001 },
    { cw: 1, type: 'bye' },
    { cw: 2, type: 'payment_result', ref: 'abc', txHash: '0x' + 'ab'.repeat(32), address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72' },
].map(mensaje => { const e = codec.encode(mensaje); return { mensaje, tipo: e.type, fallback: e.fallback, contentHex: Buffer.from(e.content).toString('hex') }; });

fs.writeFileSync(new URL('../vectores.json', import.meta.url), JSON.stringify({ spec: 'CW Connect v2.1', uris, lecturas, mensajes }, null, 2) + '\n');
console.log(`vectores: ${uris.length} URIs, ${lecturas.length} lecturas, ${mensajes.length} mensajes`);
