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

## Una transacción, no dos

Las dos autorizaciones viajan en **una sola transacción** por Multicall3 (`allowFailure: false`),
que está desplegado con la misma dirección en toda red EVM.

Con dos transacciones sueltas **ningún orden es justo**: la comisión primero cobra aunque el
pago falle, y el pago primero deja al relayer pagando gas de arriba. Atómico no hay estado
intermedio. Medido en un fork de Base:

```
dos transacciones          205.704 gas
una atómica                138.670 gas      33% menos
```

El ahorro supera una tarifa base porque la segunda llamada encuentra el storage del token ya
caliente. La cotización refleja el camino barato, así que el usuario paga menos comisión.

El riesgo se mueve del usuario al relayer: si el lote revierte, el relayer gasta gas y no cobra.
Es donde corresponde — el relayer es el que simula antes y el que cobra por el servicio.

En una red sin Multicall3 se cae a dos transacciones y **la respuesta lo dice** (`atomico:false`)
en vez de fingir que es lo mismo.

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

## Desplegado

Corre en la caja, en el puerto **3200** (el 3100 lo ocupa `backup.chatwallet.org`), expuesto
por el túnel de Cloudflare como **https://relay.chatwallet.org**. Arranca solo por
`@reboot ... /home/xunorus/start-relay.sh` en el crontab.

La llave se generó **en la caja** con `ethers.Wallet.createRandom()` y vive en
`~/chatwallet-node/relay/.env` con permisos `600`. Nunca viajó por la red.

Tiene límite de tasa (20 pedidos por minuto y por IP) en `/info` y `/erc3009`. El dinero ya lo
protege la comisión, pero cada pedido dispara simulaciones contra el RPC: sin límite, quemar
la cuota del proveedor cuesta un bucle de cinco líneas.

### Al operar en la caja: no matar por patrón

Tres veces en este despliegue un `pgrep`/`pkill` por patrón matcheó **su propia línea de
comando** (la del ssh que lo invoca, o la del supervisor que contiene el texto buscado).
La tercera tiró el túnel abajo. Operar por PID, o mirar el puerto, nunca por nombre.
El guard de `start-relay.sh` mira el puerto 3200 justamente por esto.
