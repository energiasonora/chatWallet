// Firmar con ChatWallet desde otro dispositivo, por el puente cw:1 ("WalletConnect sobre XMTP"),
// el mismo que usan Soberano Mail y StealthPay: la página abre una identidad XMTP efímera, muestra
// chatwallet://wc?inbox=… como QR, ChatWallet se conecta y contesta un personal_sign que el usuario
// aprueba en el teléfono. Se empaqueta a js/cw-firma.js (ver instalar-en-la-caja.sh).
import { Wallet, getAddress } from 'ethers';
import QRCode from 'qrcode';

const CW_PROTO = 1;
const ESPERA_PAREO_MS = 300000;
const ESPERA_FIRMA_MS = 180000;

function firmanteEfimero(wallet) {
    return {
        type: 'EOA',
        getIdentifier: async () => ({ identifier: wallet.address.toLowerCase(), identifierKind: 'Ethereum' }),
        signMessage: async (msg) => {
            const hex = (await wallet.signMessage(msg)).slice(2);
            return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)));
        },
    };
}

export const qrSvg = (texto) => QRCode.toString(texto, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });

// armarMensaje() se llama recién cuando ChatWallet se conecta (lo que se firma puede llevar la hora).
// onEstado(texto, uri?) dibuja los pasos; uri viene sólo en el paso de escanear.
export async function firmarConChatWallet(armarMensaje, onEstado) {
    onEstado('Cargando XMTP…');
    const { Client } = await import('/js/xmtp-bundle.js');
    const efimera = Wallet.createRandom();
    // Base local nueva cada vez: la identidad se descarta al terminar.
    const llave = crypto.getRandomValues(new Uint8Array(32));
    onEstado('Abriendo sesión…');
    const cliente = await Client.create(firmanteEfimero(efimera), {
        env: 'production', dbEncryptionKey: llave, appVersion: 'ChatWallet-Uso/1',
    });
    onEstado('Escaneá con ChatWallet', `chatwallet://wc?inbox=${efimera.address.toLowerCase()}&chain=1&v=${CW_PROTO}`);

    await cliente.conversations.sync();
    const stream = await cliente.conversations.streamAllMessages();
    const corte = (ms, motivo) => new Promise((_, no) => setTimeout(() => no(new Error(motivo)), ms));

    let dm = null, direccion = null, idPedido = null, mensaje = null;
    const escuchar = (async () => {
        for await (const m of stream) {
            if (!m || m.senderInboxId === cliente.inboxId || typeof m.content !== 'string') continue;
            let d; try { d = JSON.parse(m.content); } catch { continue; }
            if (!d || d.cw !== CW_PROTO) continue;
            if (d.type === 'connect' && !dm) {
                direccion = getAddress(d.address);
                onEstado('ChatWallet conectada. Aprobá la firma en el teléfono…');
                const id = { identifier: direccion.toLowerCase(), identifierKind: 'Ethereum' };
                await cliente.conversations.sync();
                try { dm = await cliente.conversations.newDmWithIdentifier(id); }
                catch { await cliente.conversations.sync(); dm = await cliente.conversations.newDmWithIdentifier(id); }
                idPedido = crypto.randomUUID();
                mensaje = armarMensaje();
                await dm.send(JSON.stringify({ cw: CW_PROTO, id: idPedido, type: 'rpc', method: 'personal_sign',
                    params: [mensaje, direccion.toLowerCase()], ttl: ESPERA_FIRMA_MS }));
            } else if (idPedido && d.id === idPedido) {
                if (d.type === 'result') return { address: direccion, signature: d.result, mensaje };
                if (d.type === 'error') throw new Error(d.error || 'firma rechazada en ChatWallet');
            }
        }
        throw new Error('se cortó la conexión con XMTP');
    })();
    try {
        return await Promise.race([escuchar, corte(ESPERA_PAREO_MS + ESPERA_FIRMA_MS, 'se acabó el tiempo: volvé a intentar')]);
    } finally {
        try { stream.return?.(); } catch {}
        try { cliente.close?.(); } catch {}
    }
}
