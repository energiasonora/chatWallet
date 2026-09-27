// Billetera Ğ1 de solo lectura: qué cuenta es la tuya, cuánto tenés y cuánto dividendo
// universal te espera. Todo sale del indexador (squid), con la misma lista de respaldo
// que usa Ius (ius/js/g1.js); para LEER no hace falta la librería de la cadena, que es
// pesada y recién se va a cargar para enviar.
//
// Se carga a demanda al activar la red Ğ1 (window.cwCargarBilleteraG1 en dapp.html).
import { sha256 } from '@noble/hashes/sha256';
import IusG1 from '../../ius/js/g1.js';
import { candidatasG1 } from './g1-llave.js';
import { leerFrase, semillaBip39 } from './frase.js';

export { leerFrase, semillaBip39 };
export const G1 = IusG1;

// Las 31 direcciones que puede ser tu cuenta (raíz y //0…//29), sin secretos: solo lo
// público, que es lo único que se guarda.
export function candidatas(frase) {
    return candidatasG1(frase).map((c) => ({ ruta: c.ruta, g1: c.direccion }));
}

const Q_CANDIDATAS = `query($ids:[String!]!){
  accounts(filter:{ id:{ in:$ids } }){ nodes{ id balance identity{ isMember name } } } }`;

// Entre las candidatas, la que ya se usa en la red. Mismo orden de preferencia que un
// humano: la que tiene identidad de miembro, después cualquier identidad, después la de
// más saldo. Si ninguna existe todavía, la raíz (que es la que crea Cesium² al registrarse).
export async function elegirCuenta(cands, fetchFn) {
    const d = await IusG1.consultar(Q_CANDIDATAS, { ids: cands.map((c) => c.g1) }, fetchFn);
    const porId = new Map(d.accounts.nodes.map((n) => [n.id, n]));
    const puntaje = (n) => !n ? -1
        : (n.identity && n.identity.isMember ? 4e15 : 0) + (n.identity ? 2e15 : 0) + Number(n.balance || 0);
    let mejor = cands[0], p = puntaje(porId.get(cands[0].g1));
    for (const c of cands.slice(1)) {
        const q = puntaje(porId.get(c.g1));
        if (q > p) { mejor = c; p = q; }
    }
    return { ...mejor, existe: p >= 0 };
}

const Q_CUENTA = `query($id:String!){
  accounts(filter:{ id:{ equalTo:$id } }){ nodes{ balance identity{ isMember firstEligibleUd } } } }`;
const Q_DU = `query($desde:Int!){
  universalDividends(first:1000, orderBy:INDEX_ASC, filter:{ index:{ greaterThanOrEqualTo:$desde } }){ nodes{ amount } } }`;

// { g1, saldo, pendiente, identidad } — montos en céntimos de Ğ1 (la cadena usa 2 decimales).
// `pendiente`: los DU desde firstEligibleUd que todavía no se cobraron (mismo cálculo que
// Cesium²: solo para miembros). Se cobran solos en la primera transferencia (claim_uds).
export async function leerCuenta(g1, fetchFn) {
    const [d, identidad] = await Promise.all([
        IusG1.consultar(Q_CUENTA, { id: g1 }, fetchFn),
        IusG1.identidad(g1, fetchFn),
    ]);
    const n = d.accounts.nodes[0];
    let pendiente = 0;
    const idty = n && n.identity;
    if (idty && idty.isMember && idty.firstEligibleUd > 0) {
        const du = await IusG1.consultar(Q_DU, { desde: idty.firstEligibleUd }, fetchFn);
        pendiente = du.universalDividends.nodes.reduce((s, u) => s + Number(u.amount || 0), 0);
    }
    return { g1, existe: !!n, saldo: n ? Number(n.balance || 0) : 0, pendiente, identidad };
}

// ── QR de Ğ1 ────────────────────────────────────────────────────────────────────
// Lo mismo que leen Ğecko y Cesium² (cesium2s/src/app/scan/payment-request.ts):
//   - la dirección sola (g1…): un perfil, no un pedido de pago;
//   - june://g1…?amount=12.50&comment=… (el que emite Ğecko; Ğinkgo solo lee june://),
//     g1://… y duniter:key/…: pedidos de pago;
//   - la clave pública de Duniter v1 (base58 de 32 bytes, con o sin :suma de control).
// → { g1, monto (céntimos) | null, comentario | null, esPago } o null si no es de Ğ1.
const ESQUEMA_PAGO = /^(?:june:\/\/|g1:\/\/|duniter:key\/)/i;
const CLAVE_V1 = /^([1-9A-HJ-NP-Za-km-z]{43,44})(?::([1-9A-HJ-NP-Za-km-z]{3}))?$/;

// Suma de control v1: base58(sha256(sha256(clave)))[0..3]. Con 44 caracteres y un '1'
// adelante se calcula sin ese '1' (así lo fijó el foro de Duniter, hilo 7616).
function sumaV1(clave) {
    const bytes = IusG1.base58Decodificar(clave.length === 44 && clave[0] === '1' ? clave.slice(1) : clave);
    return IusG1.base58Codificar(sha256(sha256(bytes))).slice(0, 3);
}

function direccionDeClaveV1(texto) {
    const m = CLAVE_V1.exec(texto);
    if (!m) return null;
    const b = IusG1.base58Decodificar(m[1]);
    if (!b || b.length > 32) return null;
    if (m[2] && m[2] !== sumaV1(m[1])) return null;
    const clave = new Uint8Array(32);
    clave.set(b, 32 - b.length);
    return IusG1.ss58Codificar(clave);
}

export function leerQrG1(texto) {
    const v = String(texto || '').trim();
    if (v.length > 4096) return null;
    const esquema = ESQUEMA_PAGO.exec(v);
    const contenido = esquema ? v.slice(esquema[0].length) : v;
    const [cruda, consulta, sobra] = contenido.split('?');
    if (sobra !== undefined || (!esquema && consulta !== undefined) || contenido.includes('#')) return null;
    const g1 = IusG1.esDireccionG1(cruda) ? cruda : direccionDeClaveV1(cruda);
    if (!g1) return null;
    const p = new URLSearchParams(consulta || '');
    for (const k of ['amount', 'comment', 'currency', 'unit']) if (p.getAll(k).length > 1) return null;
    const moneda = p.get('currency');
    if (moneda && !['g1', 'ğ1'].includes(moneda.toLowerCase())) return null;          // ĞTest, etc.
    if (p.has('unit') && !['base', 'g1', 'Ğ1'].includes(p.get('unit'))) return null;   // DU: no se adivina
    let monto = null;
    if (p.has('amount')) {
        const t = p.get('amount').replace(',', '.');
        if (!/^\d+(?:\.\d{1,2}0*)?$/.test(t)) return null;
        monto = Math.round(Number(t) * 100);
        if (!(monto > 0) || !Number.isSafeInteger(monto)) return null;
    }
    return { g1, monto, comentario: p.get('comment') || null, esPago: !!esquema };
}
