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
    const nonce = await api.rpc.system.accountNextIndex(cuenta.direccion);
    await tx.signAsync(parFirmante(cuenta), { era: 64, nonce });
    return { tx, conCobro: pendiente > 0 };
}

// Manda y espera a que entre en un bloque. alEstado('enviada'|'en-bloque') para la UI.
// → { hash, bloque } o tira con el motivo que da la cadena (p. ej. balances.FundsUnavailable).
export async function enviar(cuenta, destino, centimos, comentario, alEstado = () => { }) {
    const api = await conectar();
    const { tx } = await prepararEnvio(cuenta, destino, centimos, comentario);
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
