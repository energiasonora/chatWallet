// Billetera Ğ1 de solo lectura: qué cuenta es la tuya, cuánto tenés y cuánto dividendo
// universal te espera. Todo sale del indexador (squid), con la misma lista de respaldo
// que usa Ius (ius/js/g1.js); para LEER no hace falta la librería de la cadena, que es
// pesada y recién se va a cargar para enviar.
//
// Se carga a demanda al activar la red Ğ1 (window.cwCargarBilleteraG1 en dapp.html).
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
