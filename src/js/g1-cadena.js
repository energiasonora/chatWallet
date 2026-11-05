// Conexión directa con la cadena Ğ1 (Duniter v2): saldo real y envío.
//
// Es la parte pesada (@polkadot/api, la misma librería que usa Cesium²), así que vive en
// su propio pedazo y se baja recién al elegir la red Ğ1. La firma NO usa el wasm de
// polkadot: es ed25519 con @noble, igual que en g1-llave.js.
//
// El saldo sale de acá y no del indexador: el 27/9/2026, en el mismo bloque, la cadena
// decía 4.334,12 Ğ1 y el squid 4.120,13 para la misma cuenta. La cadena manda.
//
// La transferencia es la de Ğecko (durt2, duniter_service.dart): un batch_all con
//   claim_uds (solo si hay dividendo por cobrar) + transfer_keep_alive + remark_with_event
// (el comentario, en UTF-8, solo si hay). Comisión: 0 con uso normal.
import { ApiPromise, WsProvider } from '@polkadot/api';
import { ed25519 } from '@noble/curves/ed25519';

const GENESIS = '0xfeb770bbb0344dabc8366b0d1f889a8e4e6ca09b914006655fe795920deb6d56';
// Los de Cesium² (endpoints.service.ts), en el orden en que respondieron el 27/9/2026.
// g1-bootstrap.p2p.legal y g1.coinduf.eu no aceptaban websockets ese día: van al final.
export const NODOS = [
    'wss://g1.gyroi.de:443',
    'wss://g1-v2s.cgeek.fr',
    'wss://g1.asycn.io:443/ws/',
    'wss://g1-bootstrap.p2p.legal',
    'wss://g1.coinduf.eu:443',
];
export const DEPOSITO_EXISTENCIAL = 100;   // 1 Ğ1: una cuenta no puede quedar con menos (keep_alive)

let conexion = null;
export function conectar() {
    if (!conexion) {
        conexion = (async () => {
            // WsProvider con una lista rota solo al siguiente nodo si uno no contesta.
            const api = await ApiPromise.create({ provider: new WsProvider(NODOS, 2500), noInitWarn: true });
            if (api.genesisHash.toHex() !== GENESIS) { await api.disconnect(); throw new Error('el nodo no es de la red Ğ1'); }
            return api;
        })().catch((e) => { conexion = null; throw e; });
    }
    return conexion;
}

// Dividendos por cobrar: el mismo cálculo que Cesium² (calculateUnclaimedUds), con los
// cambios de monto (pastReevals) de por medio. Solo para miembros.
function duPendiente(firstEligibleUd, currentUdIndex, reevals) {
    let total = 0, hasta = currentUdIndex;
    for (let i = reevals.length - 1; i >= 0; i--) {
        const [desde, monto] = reevals[i];
        if (desde <= firstEligibleUd) {
            if (hasta > firstEligibleUd) total += (hasta - firstEligibleUd) * monto;
            break;
        }
        if (hasta > desde) total += (hasta - desde) * monto;
        hasta = desde;
    }
    return total;
}
export const _duPendiente = duPendiente;   // para las pruebas

// { saldo, pendiente } en céntimos, leídos de la cadena.
export async function saldo(g1) {
    const api = await conectar();
    const [cuenta, idx] = await Promise.all([api.query.system.account(g1), api.query.identity.identityIndexOf(g1)]);
    let pendiente = 0;
    if (idx.isSome) {
        const [idty, ud, reevals] = await Promise.all([
            api.query.identity.identities(idx.unwrap()),
            api.query.universalDividend.currentUdIndex(),
            api.query.universalDividend.pastReevals(),
        ]);
        const j = idty.isSome ? idty.unwrap().toJSON() : null;
        const primero = j && j.data && j.data.firstEligibleUd;
        if (j && j.status === 'Member' && primero > 0) {
            pendiente = duPendiente(primero, ud.toNumber(), reevals.toJSON());
        }
    }
    return { saldo: Number(cuenta.data.free.toBigInt()), pendiente };
}

// Un "par" que @polkadot/api acepta para firmar, sin su Keyring ni su wasm. La carga que
// firma ya viene hasheada si pasa de 256 bytes (lo hace ExtrinsicPayload.sign); withType
// antepone el byte de tipo de MultiSignature: 0x00 = ed25519.
function parFirmante(cuenta) {
    return {
        address: cuenta.direccion,
        addressRaw: cuenta.publica,
        publicKey: cuenta.publica,
        type: 'ed25519',
        sign(datos, opciones) {
            const firma = ed25519.sign(datos, cuenta.semilla);
            if (!(opciones && opciones.withType)) return firma;
            const out = new Uint8Array(65);
            out.set(firma, 1);
            return out;
        },
    };
}

// Arma y firma la transferencia sin mandarla. → { tx, conCobro }
export async function prepararEnvio(cuenta, destino, centimos, comentario) {
    const api = await conectar();
    if (!Number.isSafeInteger(centimos) || centimos <= 0) throw new Error('monto');
    const { pendiente } = await saldo(cuenta.direccion);
    const llamadas = [];
    if (pendiente > 0) llamadas.push(api.tx.universalDividend.claimUds());
    llamadas.push(api.tx.balances.transferKeepAlive(destino, centimos));
    if (comentario) llamadas.push(api.tx.system.remarkWithEvent(comentario));
    const tx = llamadas.length > 1 ? api.tx.utility.batchAll(llamadas) : llamadas[0];
    await firmar(api, tx, cuenta);
    return { tx, conCobro: pendiente > 0 };
}

// Manda y espera a que entre en un bloque. alEstado('enviada'|'en-bloque') para la UI.
// → { hash, bloque } o tira con el motivo que da la cadena (p. ej. balances.FundsUnavailable).
export async function enviar(cuenta, destino, centimos, comentario, alEstado = () => { }) {
    const { tx } = await prepararEnvio(cuenta, destino, centimos, comentario);
    return mandar(tx, alEstado);
}

// ── Identidad: de "sin confirmar" a miembro ──────────────────────────────────────
// Leído del runtime en vivo (4/11/2026):
//   1. un miembro crea la identidad (identity.createIdentity) y suele certificarla;
//   2. el dueño la CONFIRMA con un nombre (identity.confirmIdentity), antes de confirmPeriod
//      (876.600 bloques ≈ 61 días) o la identidad se borra;
//   3. junta 5 certificaciones (wot.minCertForMembership) antes de validationPeriod (otros ≈ 61 días);
//   4. pide la evaluación de distancia (distance.requestDistanceEvaluation): reserva
//      distance.evaluationPrice (10 Ğ1); si da bien se le da la membresía, si da mal la pierde.
// El estado sale de la cadena y no del indexador: recién confirmada, el squid tarda en verlo.
export const SEG_POR_BLOQUE = 6;
export const CERTS_PARA_MIEMBRO = 5;

// Regla del runtime (IdtyNameValidatorImpl): 3 a 42 caracteres ASCII alfanuméricos, '-' o '_'.
export function nombreValido(nombre) {
    return typeof nombre === 'string' && /^[A-Za-z0-9_-]{3,42}$/.test(nombre);
}

export async function nombreLibre(nombre) {
    const api = await conectar();
    return (await api.query.identity.identitiesNames(nombre)).isNone;
}

// → null (la cuenta no tiene identidad) o
//   { indice, estado, certificaciones, vencePlazo (bloque), bloque (actual), diasPlazo, enEvaluacion, precioEvaluacion }
// vencePlazo es nextScheduled: para Unconfirmed, hasta cuándo se puede confirmar; para
// Unvalidated, hasta cuándo hay para llegar a miembro.
export async function identidad(g1) {
    const api = await conectar();
    const idx = await api.query.identity.identityIndexOf(g1);
    if (idx.isNone) return null;
    const indice = idx.unwrap().toNumber();
    const [idty, meta, cab, evaluando] = await Promise.all([
        api.query.identity.identities(indice),
        api.query.certification.storageIdtyCertMeta(indice),
        api.rpc.chain.getHeader(),
        api.query.distance.pendingEvaluationRequest(indice),
    ]);
    if (idty.isNone) return null;
    const j = idty.unwrap().toJSON();
    const bloque = cab.number.toNumber();
    const vencePlazo = Number(j.nextScheduled) || 0;
    return {
        indice, estado: j.status, bloque, vencePlazo,
        diasPlazo: vencePlazo > bloque ? Math.floor((vencePlazo - bloque) * SEG_POR_BLOQUE / 86400) : null,
        certificaciones: Number(meta.toJSON().receivedCount) || 0,
        enEvaluacion: evaluando.isSome,
        precioEvaluacion: Number(api.consts.distance.evaluationPrice.toString()),
    };
}

export async function confirmarIdentidad(cuenta, nombre, alEstado = () => { }) {
    if (!nombreValido(nombre)) throw new Error('identity.IdtyNameInvalid');
    const api = await conectar();
    const tx = api.tx.identity.confirmIdentity(nombre);
    await firmar(api, tx, cuenta);
    return mandar(tx, alEstado);
}

export async function pedirMembresia(cuenta, alEstado = () => { }) {
    const api = await conectar();
    const tx = api.tx.distance.requestDistanceEvaluation();
    await firmar(api, tx, cuenta);
    return mandar(tx, alEstado);
}

async function firmar(api, tx, cuenta) {
    const nonce = await api.rpc.system.accountNextIndex(cuenta.direccion);
    await tx.signAsync(parFirmante(cuenta), { era: 64, nonce });
}

// Manda una transacción ya firmada y espera el bloque. Tira con "pallet.Error" si la cadena la rechaza.
async function mandar(tx, alEstado = () => { }) {
    const api = await conectar();
    const hash = tx.hash.toHex();
    return new Promise((resolver, rechazar) => {
        let cortar = null;
        const reloj = setTimeout(() => { if (cortar) cortar(); rechazar(new Error('la red no confirmó en 2 minutos')); }, 120000);
        tx.send((r) => {
            if (r.status.isReady || r.status.isBroadcast) alEstado('enviada');
            if (r.status.isInBlock || r.status.isFinalized) {
                clearTimeout(reloj);
                if (cortar) cortar();
                const fallo = r.dispatchError || (r.events || []).map((e) => e.event)
                    .find((e) => api.events.utility.BatchInterrupted.is(e))?.data?.[1];
                if (fallo) {
                    let motivo = fallo.toString();
                    if (fallo.isModule) { const m = api.registry.findMetaError(fallo.asModule); motivo = `${m.section}.${m.name}`; }
                    rechazar(new Error(motivo));
                    return;
                }
                alEstado('en-bloque');
                api.rpc.chain.getHeader(r.status.isInBlock ? r.status.asInBlock : r.status.asFinalized)
                    .then((h) => resolver({ hash, bloque: h.number.toNumber() }))
                    .catch(() => resolver({ hash, bloque: null }));
            }
            if (r.isError || r.status.isInvalid || r.status.isDropped || r.status.isUsurped) {
                clearTimeout(reloj);
                if (cortar) cortar();
                rechazar(new Error('la red rechazó la transacción (' + r.status.type + ')'));
            }
        }).then((u) => { cortar = u; }).catch((e) => { clearTimeout(reloj); rechazar(e); });
    });
}
