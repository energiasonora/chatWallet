// Firmar con ChatWallet desde otro dispositivo, por CW Connect (cw-connect/SPEC.md): la página abre
// una identidad XMTP descartable, muestra el URI como QR, ChatWallet se conecta y contesta un
// personal_sign que el usuario aprueba en el teléfono. El protocolo es el del módulo común; acá sólo
// queda lo propio del panel. Se empaqueta a js/cw-firma.js (ver instalar-en-la-caja.sh).
import { Wallet, getAddress } from 'ethers';
import QRCode from 'qrcode';
import { conectarConChatWallet } from '../cw-connect/cw-connect.mjs';

export const qrSvg = (texto) => QRCode.toString(texto, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });

// armarMensaje() se llama recién cuando ChatWallet se conecta (lo que se firma puede llevar la hora).
// onEstado(texto, uri?) dibuja los pasos; uri viene sólo en el paso de escanear.
export async function firmarConChatWallet(armarMensaje, onEstado) {
    onEstado('Cargando XMTP…');
    const { Client } = await import('/js/xmtp-bundle.js');
    const sesion = await conectarConChatWallet({
        // Del módulo sólo se usan Wallet y getAddress: así no entra ethers entero al bundle.
        Client, ethers: { Wallet, getAddress },
        app: location.host, name: 'Panel de uso', kind: 'once', chainId: 1,
        appVersion: 'ChatWallet-Uso/2',
        onUri: (uri) => onEstado('Escaneá con ChatWallet', uri),
        onEstado: (texto) => { if (texto !== 'Escaneá con ChatWallet') onEstado(texto); },
    });
    try {
        onEstado('ChatWallet conectada. Aprobá la firma en el teléfono…');
        const mensaje = armarMensaje();
        const signature = await sesion.firmar(mensaje);
        return { address: sesion.address, signature, mensaje };
    } finally {
        // Un solo uso: cerrar avisa a ChatWallet (bye) y la sesión deja de aparecer como activa.
        await sesion.cerrar();
    }
}
