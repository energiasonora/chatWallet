# Relayer de ChatWallet

Transmite una autorización firmada y paga el gas. Existe porque **una dirección stealth con
USDC y sin nativo no puede gastar nada**: no tiene con qué pagar gas, y mandárselo desde la
billetera principal la vincularía, que es justo lo que el esquema evita.

ERC-3009 (`transferWithAuthorization`) deja firmar la transferencia **sin mandar transacción**.
Alguien más la transmite. Ese alguien es esto.

## El problema central no es transmitir, es no ser un surtidor

Un endpoint abierto que paga gas se vacía en horas. Se resuelve así:

1. quien pide firma **dos** autorizaciones: el pago, y una comisión para el relayer;
2. la comisión tiene que cubrir el gas estimado con margen, o se rechaza;
3. antes de gastar nada se **simulan las dos con `eth_call`** — si alguna revierte, se rechaza
   sin haber tocado la cadena;
4. sólo se aceptan tokens de una **lista blanca**: esto no transmite llamadas arbitrarias.

El reintento no es riesgo: el nonce de ERC-3009 lo consume el propio token.

## Correr

    RELAYER_PRIVATE_KEY=0x…  RELAY_PORT=3100  node relay-server.mjs

    GET  /api/relay/salud
    GET  /api/relay/info?chainId=8453&simbolo=USDC   → comisión y dirección del relayer
    POST /api/relay/erc3009                          → {chainId, simbolo, pago, comision}

## Probar

Contra un fork de Base con USDC real:

    anvil --fork-url https://mainnet.base.org --port 8545
    RPC_8453=http://127.0.0.1:8545 node test-relay.mjs

## Trampa medida

Las cuentas conocidas de anvil **tienen 23 bytes de código en Base** — el designador de
delegación de EIP-7702. Con código presente, USDC verifica por ERC-1271 en vez de ECDSA y
rechaza cualquier firma de llave normal con `invalid signature`. El banco usa llaves frescas.
Una dirección stealth recién derivada nunca tiene código, así que el caso real está bien.

## Lo que el relayer ve

Ve la dirección que paga y la que cobra, y puede vincularlas. Es inherente a relayear, no un
defecto de esta implementación: lo mismo vale para el retiro de Privacy Pools. Por eso conviene
que el relayer sea propio.
