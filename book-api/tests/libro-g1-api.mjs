import { Wallet, SigningKey } from 'ethers';
const B = 'http://127.0.0.1:8787', SQ = 'http://127.0.0.1:8799';
const ADM = { Authorization: 'Bearer admin-prueba', 'Content-Type': 'application/json' };
const CUENTA = 'g1XunorusCuentaDePrueba11111111111111111111111111';
let ok = 0, mal = 0;
const chk = (c, m) => { c ? ok++ : mal++; console.log(`${c ? '✔' : '✘'} ${m}`); };
const get = async (p, h) => { const r = await fetch(B + p, { headers: h }); return [r.status, await r.json().catch(() => null), r]; };
const post = async (p, b, h = { 'Content-Type': 'application/json' }) => { const r = await fetch(B + p, { method: 'POST', headers: h, body: JSON.stringify(b) }); return [r.status, await r.json().catch(() => null)]; };
const pagar = (b) => fetch(SQ + '/_agregar', { method: 'POST', body: JSON.stringify(b) });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

let [s, j] = await get('/g1/estado');
chk(s === 200 && j.abierto === false && j.cuenta === null, 'arranca cerrada y sin mostrar cuenta');
[s] = await post('/g1/pedido', { lang: 'es' });
chk(s === 403, 'cerrada: no se pueden crear pedidos (403)');
[s] = await post('/admin/g1/config', { activo: true });
chk(s === 401, 'config sin token → 401');
[s, j] = await post('/admin/g1/config', { activo: true }, ADM);
chk(s === 400 && /cuenta/i.test(j.error), 'no abre sin cuenta Ğ1');
[s, j] = await post('/admin/g1/config', { cuenta: 'g1corta' }, ADM);
chk(s === 400, 'rechaza una cuenta mal formada');
[s, j] = await post('/admin/g1/config', { cuenta: CUENTA, centimos: 15000, activo: true }, ADM);
chk(s === 200 && j.activo && j.cuentaNombre === 'Xunorus', 'abre con cuenta + precio; el panel muestra la identidad (Xunorus)');
[s, j] = await get('/g1/estado');
chk(j.abierto && j.cuenta === CUENTA && j.centimos === 15000 && j.du === 1217, 'estado: abierto, 150 Ğ1, DU 12,17');

// pedido FR
const [s1, p1] = await post('/g1/pedido', { lang: 'fr' });
chk(s1 === 200 && /^CPS-[A-Z2-9]{5}$/.test(p1.codigo) && p1.s?.length === 32, `pedido creado ${p1.codigo} con clave`);
chk(p1.pago === `june://${CUENTA}?amount=150&comment=${p1.codigo}`, 'enlace june:// con monto y comentario');
chk(p1.qrPago?.startsWith('<svg') && !p1.descarga, 'trae QR de pago y no descarga');
[s] = await get(`/g1/pedido?codigo=${p1.codigo}`);
chk(s === 404, 'sin clave el pedido "no existe"');
[s] = await get(`/g1/pedido?codigo=${p1.codigo}&s=${'0'.repeat(32)}`);
chk(s === 404, 'con clave equivocada tampoco');
const q1 = `/g1/pedido?codigo=${p1.codigo}&s=${p1.s}`;
[s, j] = await get(q1);
chk(s === 200 && j.pagado === false, 'pendiente');

// pagos que NO cuentan: otra cuenta, sin comentario, comentario de otro pedido
await pagar({ toId: 'g1OtraCuenta111111111111111111111111111111111111', amount: 15000, remark: p1.codigo });
await pagar({ toId: CUENTA, amount: 15000, remark: null });
await pagar({ toId: CUENTA, amount: 15000, remark: 'CPS-ZZZZZ' });
await pagar({ toId: CUENTA, amount: 15000, remark: p1.codigo, ts: new Date(Date.now() - 3600e3).toISOString() });
await dormir(4200);
[s, j] = await get(q1);
chk(j.pagado === false && !j.recibido, 'no cuentan: otra cuenta, sin comentario, otro código, ni pagos de antes del pedido');

// parcial (comentario escrito a mano, en minúscula y sin guion)
await pagar({ toId: CUENTA, amount: 10000, remark: 'libro ' + p1.codigo.toLowerCase().replace('-', ' ') });
await dormir(4200);
[s, j] = await get(q1);
chk(j.pagado === false && j.recibido === 10000, 'pago parcial reconocido (100 de 150) con el código escrito a mano');
[s, j] = await get(q1);
chk(j.pagado === false && j.recibido === 10000 && j.qrPago, 'consulta frenada (<4 s) no rompe nada');

// completa
await pagar({ toId: CUENTA, amount: 5000, remark: p1.codigo, fromId: 'g1SegundoPago22222222222222222222222222222222222' });
await dormir(4200);
const [ra, rb] = await Promise.all([get(q1), get(q1)]);
[s, j] = ra;
chk(j.pagado === true && j.descarga?.includes('/download?token=') && j.qrDescarga?.startsWith('<svg'), 'pagado: descarga + QR de descarga');
chk(!rb[1].descarga || rb[1].descarga === j.descarga, 'dos consultas a la vez: mismo token');
const [s3, j3] = await get(q1);
chk(j3.descarga === j.descarga, 'idempotente: el token no cambia');
const tok = new URL(j.descarga).searchParams.get('token');
const r = await fetch(`${B}/download?token=${tok}`);
const txt = await r.text();
chk(r.status === 200 && /Crypto-pour-Souverains\.pdf/.test(r.headers.get('content-disposition')) && txt.includes('livre FR'), 'descarga la edición FR');
[s, j] = await get('/purchases?address=' + encodeURIComponent('g1:g1CompradorFalso1111111111111111111111111111111111'));
chk(j.purchases.length === 0, '/purchases no lista compras en Ğ1');

// ── entrega por ChatWallet ──
const comprador = Wallet.createRandom();
const pkComp = SigningKey.computePublicKey(comprador.signingKey.publicKey, true).slice(2);
const cw = (b) => post('/g1/chatwallet', b);
[s] = await cw({ codigo: p1.codigo, s: '0'.repeat(32), wallet: comprador.address });
chk(s === 404, 'ChatWallet: sin la clave del pedido no se puede cargar');
[s] = await cw({ codigo: p1.codigo, s: p1.s, wallet: 'cualquier cosa' });
chk(s === 400, 'ChatWallet: rechaza lo que no es dirección ni enlace');
[s, j] = await cw({ codigo: p1.codigo, s: p1.s, wallet: `https://chatwallet.org/dapp?pk=${pkComp}` });
chk(s === 200 && j.chatwallet === comprador.address.toLowerCase(), 'ChatWallet: acepta el enlace de invitación con ?pk= (saca la 0x)');
[s, j] = await get('/admin/events?since=0', ADM);
let ent = j.events.filter((e) => e.type === 'libro-g1-chat');
chk(ent.length === 1 && ent[0].codigo === p1.codigo && ent[0].lang === 'fr' && ent[0].wallet_address === comprador.address.toLowerCase()
  && ent[0].descarga === `https://libro.chatwallet.org/download?token=${tok}`, 'evento para el notificador: pagado + ChatWallet → enlace de descarga (FR)');
[s] = await get('/admin/events?since=0');
chk(s === 401, '/admin/events sigue pidiendo token');
// cargada ANTES de pagar: el evento sale recién al pagarse
const [, pw] = await post('/g1/pedido', { lang: 'es', wallet: comprador.address });
chk(pw.chatwallet === comprador.address.toLowerCase(), 'ChatWallet también se puede dar al crear el pedido');
const antes = Date.now();
[s, j] = await get(`/admin/events?since=${antes - 60000}`, ADM);
chk(!j.events.some((e) => e.codigo === pw.codigo), 'sin pago no hay envío');
await pagar({ toId: CUENTA, amount: 15000, remark: pw.codigo });
[s, j] = await get(`/g1/pedido?codigo=${pw.codigo}&s=${pw.s}`);
chk(j.pagado, 'pago del pedido con ChatWallet');
[s, j] = await get(`/admin/events?since=${antes}`, ADM);
ent = j.events.filter((e) => e.codigo === pw.codigo);
chk(ent.length === 1 && ent[0].type === 'libro-g1-chat', 'al pagarse sale el envío por ChatWallet');
// cambiar la dirección vuelve a mandar
await dormir(5);
const otro = Wallet.createRandom();
const marca = Date.now();
[s, j] = await cw({ codigo: pw.codigo, s: pw.s, wallet: otro.address });
[s, j] = await get(`/admin/events?since=${marca - 1}`, ADM);
ent = j.events.filter((e) => e.codigo === pw.codigo);
chk(ent.length === 1 && ent[0].wallet_address === otro.address.toLowerCase(), 'cambiar la dirección dispara un envío nuevo a la nueva');
[s, j] = await cw({ codigo: pw.codigo, s: pw.s, wallet: otro.address });
[s, j] = await get(`/admin/events?since=${Date.now() - 1}`, ADM);
chk(!j.events.some((e) => e.codigo === pw.codigo), 'repetir la misma dirección no reenvía');

// pedido ES pagado a mano
const [, p2] = await post('/g1/pedido', { lang: 'es' });
[s] = await post('/admin/g1/pagado', { codigo: p2.codigo });
chk(s === 401, 'marcar pagado sin token → 401');
[s, j] = await post('/admin/g1/pagado', { codigo: p2.codigo }, ADM);
chk(s === 200 && j.pagado && j.qrDescarga?.startsWith('<svg'), 'marcado a mano → QR de descarga');
const r2 = await fetch(B + new URL(j.descarga).pathname + new URL(j.descarga).search);
chk(r2.status === 200 && /Cripto-para-Soberanos\.pdf/.test(r2.headers.get('content-disposition')), 'descarga la edición ES');
[s, j] = await get(`/g1/pedido?codigo=${p2.codigo}&s=${p2.s}`);
chk(j.pagado === true, 'el comprador también lo ve pagado en su pantalla');

// cambiar precio: no afecta pedidos abiertos
const [, p3] = await post('/g1/pedido', { lang: 'es' });
[s, j] = await post('/admin/g1/config', { centimos: 20000 }, ADM);
chk(j.centimos === 20000, 'precio cambiado a 200 Ğ1');
// cerrar con un pedido abierto
[s, j] = await post('/admin/g1/config', { activo: false }, ADM);
chk(j.activo === false, 'venta cerrada desde el panel');
[s] = await post('/g1/pedido', { lang: 'es' });
chk(s === 403, 'cerrada: no hay pedidos nuevos');
await pagar({ toId: CUENTA, amount: 15000, remark: p3.codigo });
[s, j] = await get(`/g1/pedido?codigo=${p3.codigo}&s=${p3.s}`);
chk(j.pagado === true && j.centimos === 15000, 'cerrada: un pedido abierto antes se sigue acreditando, al precio que tenía (150)');

// indexador caído
await post('/admin/g1/config', { activo: true }, ADM);
const [, p4] = await post('/g1/pedido', { lang: 'es' });
await fetch(SQ + '/_caido', { method: 'POST', body: JSON.stringify({ caido: true }) });
[s, j] = await get(`/g1/pedido?codigo=${p4.codigo}&s=${p4.s}`);
chk(s === 200 && j.pagado === false && j.indexador, 'indexador caído: avisa y no rompe');
await fetch(SQ + '/_caido', { method: 'POST', body: JSON.stringify({ caido: false }) });
await post('/admin/g1/config', { activo: false }, ADM);

// panel y notificador
[s, j] = await get('/admin/g1', ADM);
const pag = j.pedidos.filter((p) => p.pagado);
chk(pag.length === 4 && pag.some((p) => p.via === 'manual') && pag.find((p) => p.codigo === p1.codigo)?.recibido === 15000, 'panel: 4 pagados (uno a mano), lo recibido suma bien');
chk(pag.find((p) => p.codigo === p1.codigo)?.descargas === 1, 'panel: cuenta las descargas');
[s, j] = await get('/admin/events?since=0', ADM);
chk(j.events.filter((e) => e.network === 'g1').length === 4, 'el notificador de la caja ve las 4 ventas en Ğ1');
chk(pag.some((p) => p.chatwallet === otro.address.toLowerCase()), 'panel: muestra la ChatWallet del comprador');
[s, j] = await get('/funding');
chk(s === 200, '/funding sigue andando con compras en Ğ1 (sin monto ETH)');

console.log(`\n${ok} ✔  ${mal} ✘`);
process.exit(mal ? 1 : 0);
