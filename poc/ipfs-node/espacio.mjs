// Planes de espacio del nodo: qué wallets pueden subir más que el tope gratis.
// Edita espacio-planes.json (al lado de upload-server.mjs); el server lo relee solo, sin reiniciar.
//
//   node espacio.mjs lista
//   node espacio.mjs dar 0xABC… 10 30 "Huerta, pagó 4 USDC en Base"   → 10 GB por 30 días
//   node espacio.mjs dar 0xABC… 2 2026-12-31                           → 2 GB hasta esa fecha
//   node espacio.mjs renovar 0xABC… 30                                  → +30 días desde el vencimiento
//   node espacio.mjs quitar 0xABC…
//
// "quitar" sólo saca el plan: no despinea nada. Los archivos siguen en el nodo.
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = process.env.ESPACIO_PLANES || fileURLToPath(new URL('./espacio-planes.json', import.meta.url));
const GB = 1024 ** 3;
const planes = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {};
const guardar = () => { writeFileSync(FILE + '.tmp', JSON.stringify(planes, null, 2)); renameSync(FILE + '.tmp', FILE); };
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const sumarDias = (iso, d) => new Date(Date.parse(`${iso}T12:00:00Z`) + d * 86400e3).toISOString().slice(0, 10);
const fin = (msg) => { console.error(msg); process.exit(1); };
const addrOk = (a) => (/^0x[0-9a-fA-F]{40}$/.test(a || '') ? a.toLowerCase() : fin(`Dirección inválida: ${a}`));
const hasta = (x, desde = hoyAR()) =>
  /^\d{4}-\d{2}-\d{2}$/.test(x || '') ? x : /^\d+$/.test(x || '') ? sumarDias(desde, Number(x)) : fin(`Duración inválida: ${x} (días o AAAA-MM-DD)`);

const [cmd, a, b, c, ...resto] = process.argv.slice(2);
switch (cmd) {
  case 'dar': {
    const addr = addrOk(a);
    const gb = Number(b);
    if (!(gb > 0)) fin('Falta el espacio en GB (ej: 10)');
    const prev = planes[addr];
    planes[addr] = { bytes: Math.round(gb * GB), used: prev?.used || 0, until: hasta(c), nota: resto.join(' ') || prev?.nota || '' };
    guardar();
    console.log(`${addr}: ${gb} GB hasta ${planes[addr].until}`);
    break;
  }
  case 'renovar': {
    const addr = addrOk(a);
    const p = planes[addr] || fin(`${addr} no tiene plan`);
    const base = p.until && p.until > hoyAR() ? p.until : hoyAR();
    p.until = hasta(b || '30', base);
    guardar();
    console.log(`${addr}: vence ${p.until}`);
    break;
  }
  case 'quitar': {
    const addr = addrOk(a);
    if (!planes[addr]) fin(`${addr} no tiene plan`);
    delete planes[addr];
    guardar();
    console.log(`${addr}: plan quitado (los archivos siguen pineados)`);
    break;
  }
  case 'lista':
  case undefined: {
    const filas = Object.entries(planes);
    if (!filas.length) { console.log('Sin planes. Todas las wallets usan el tope gratis.'); break; }
    for (const [addr, p] of filas) {
      const estado = p.until && p.until < hoyAR() ? 'VENCIDO' : 'activo';
      console.log(`${addr}  ${(p.used / GB).toFixed(2)}/${(p.bytes / GB).toFixed(2)} GB  hasta ${p.until}  ${estado}  ${p.nota || ''}`);
    }
    break;
  }
  default:
    fin('Uso: node espacio.mjs lista | dar <0x…> <GB> <días|AAAA-MM-DD> [nota] | renovar <0x…> [días] | quitar <0x…>');
}
