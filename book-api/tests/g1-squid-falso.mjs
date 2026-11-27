// Indexador Ğ1 falso: responde las consultas que hace libro-g1.js.
// POST /_agregar {toId, amount, remark, fromId?, ts?} agrega una transferencia.
import http from 'node:http';
const transf = [];
let n = 0, caido = false;
const srv = http.createServer(async (req, res) => {
  let body = ''; for await (const c of req) body += c;
  const ok = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.url === '/_agregar') {
    const b = JSON.parse(body); n++;
    transf.push({ id: `000${n}-abc-00000${n}`, blockNumber: 3800000 + n, timestamp: b.ts || new Date().toISOString(),
      amount: String(b.amount), fromId: b.fromId || 'g1CompradorFalso1111111111111111111111111111111111', toId: b.toId,
      comment: b.remark == null ? null : { remark: b.remark } });
    return ok({ ok: true, n });
  }
  if (req.url === '/_caido') { caido = JSON.parse(body).caido; return ok({ caido }); }
  if (caido) { res.writeHead(502); return res.end('caido'); }
  const { query, variables } = JSON.parse(body || '{}');
  if (/universalDividends/.test(query)) return ok({ data: { universalDividends: { nodes: [{ amount: '1217' }] } } });
  if (/accounts\(/.test(query)) return ok({ data: { accounts: { nodes: variables.c.startsWith('g1Xunorus') ? [{ id: variables.c, identity: { name: 'Xunorus' } }] : [] } } });
  if (/transfers\(/.test(query)) {
    const nodes = transf.filter((t) => t.toId === variables.c && t.timestamp >= variables.d).reverse();
    return ok({ data: { transfers: { nodes } } });
  }
  ok({ errors: [{ message: 'consulta desconocida' }] });
});
srv.listen(8799, () => console.log('squid falso en :8799'));
