# CW Connect v2.1 — Especificación

**Estado:** v2.1 (29/10/2026; borrador 1 del 16/10/2026 + login en un paso, §3.2). **Idioma normativo: español.**
Implementación de referencia: [`cw-connect.mjs`](cw-connect.mjs). Vectores: [`vectores.json`](vectores.json),
verificables con `node cw-connect/test/verificar.mjs`.

---

## 1. Intención

Una página web (la **app**) necesita que alguien firme un texto o mande una transacción, y esa
persona tiene la llave en otra parte: en ChatWallet, en su teléfono (la **billetera**). CW Connect
une a las dos sin servidor propio y sin que la llave salga nunca de la billetera: la app abre una
identidad de [XMTP](https://xmtp.org) descartable, la muestra como QR o link, la billetera la
escanea y desde ese momento las dos hablan por un chat cifrado de punta a punta. Cada pedido se
aprueba a mano en la billetera.

Es lo que WalletConnect hace con un relay propio, hecho sobre una red de mensajería abierta.

La versión 1 (`cw:1`) funcionó desde 2026 con JSON dentro de mensajes de texto comunes. Tenía un
problema que esta versión resuelve: **la billetera no podía distinguir a una app de una persona.**
Cada inicio de sesión en una app dejaba un "contacto" más en la lista de chats, con un nombre
hexadecimal y mensajes de protocolo adentro. La v2 hace que la app se presente, que el
transporte se distinga por su tipo de contenido y que la sesión tenga un final.

## 2. Roles e identidades

- **App:** crea una wallet de Ethereum al azar y la registra en XMTP. Esa dirección es su
  **inbox**. Nunca tiene fondos ni firma nada fuera de XMTP.
- **Billetera:** habla con la identidad XMTP de la wallet de la persona (la misma dirección que
  firma). Por eso la app puede abrirle un DM por dirección.

Una app de **un solo uso** (`kind=once`) descarta su identidad al terminar: un inicio de sesión,
un pago. Una app de **sesión** (`kind=session`) la guarda para reconectar después de recargar.

## 3. El pedido de vinculación

La app muestra este URI como QR:

    chatwallet://wc?v=2&inbox=<0x…>&chain=<chainId>&app=<host>&name=<nombre>&kind=<once|session>

| parámetro | obligatorio | qué es |
|---|---|---|
| `inbox` | sí | dirección del inbox de la app, `0x` + 40 hex, en minúsculas |
| `chain` | no | chainId que la app espera; `0` o ausente = cualquiera |
| `v` | no | versión del protocolo que habla la app; ausente = `1` |
| `app` | no (v2: debería) | dominio desde el que corre la app, p. ej. `mail.energiasonora.org`. Se pasa a minúsculas; después, sólo `[a-z0-9.-]`, hasta 253 caracteres |
| `name` | no | nombre a mostrar, hasta 40 caracteres (puntos de código), sin caracteres de control; se le quitan los espacios de los extremos; codificado con `encodeURIComponent` |
| `kind` | no | `once` (por defecto) o `session` |
| `login` | no (v2.1) | texto a firmar en el mismo paso de vincular (§3.2), hasta 500 caracteres (puntos de código), sin caracteres de control salvo el salto de línea; codificado con `encodeURIComponent` |

Dos formas equivalentes:

- **Link:** `https://chatwallet.org/dapp?wc=1&<los mismos parámetros>`. Abre la billetera si está
  instalada y, si no, la versión web. Sirve para pegar en un chat.
- **Código corto,** para tipear cuando no hay cámara ni link: `CWW2|<inbox>|<chain>` (v2, sin
  nombre ni dominio) o `CWW1|<inbox>|<chain>` (v1).

Una billetera que recibe un URI DEBE rechazar un `inbox` que no sea una dirección válida, y DEBE
ignorar `app`, `name` o `login` que no cumplan las reglas de arriba (se tratan como ausentes, no se
recortan).

### 3.1 El nombre lo declara la app

`app` y `name` los escribe la propia app: cualquiera puede poner "Soberano Mail". La billetera
los muestra como **declarados** ("dice ser Soberano Mail · mail.energiasonora.org"), nunca como
verificados, y el dominio va antes que el nombre. Sirven para ordenar y reconocer, no para
confiar. Lo que protege a la persona es lo mismo que en la v1: cada firma y cada transacción se
muestra entera y se aprueba a mano (§7).

### 3.2 Login en un paso (v2.1)

Sin `login`, entrar a una app son dos aprobaciones: vincular y después firmar el `personal_sign`
del inicio de sesión. Con `login`, la app pone en el URI el texto que su servidor espera firmado
(con su nonce de un solo uso) y la billetera muestra **una sola** pantalla: quién dice ser la
app, el texto completo a firmar y el aviso de la §7.6. Si la persona aprueba, la billetera firma
el texto con EIP-191 y manda la firma dentro del `connect` (§5.1). Si rechaza, no manda nada.

Una billetera que no conoce `login` lo ignora y hace el flujo de dos pasos; por eso la app, si el
`connect` llega sin firma, DEBE pedirla con un `personal_sign` normal. El texto lo arma la app y
la billetera no lo interpreta: la protección es la misma que en un `personal_sign` (§7.3) — se
muestra entero y se aprueba a mano.

## 4. Transporte

### 4.1 Tipo de contenido

En v2 cada mensaje viaja con el tipo de contenido de XMTP

    chatwallet.org/cw:2.0        (authorityId "chatwallet.org", typeId "cw", versionMajor 2, versionMinor 0)

cuyo `content` es el JSON del mensaje en UTF-8, sin espacios extra (`JSON.stringify`), y cuyo
`fallback` es un texto en español que explica qué es (§4.3). `parameters` va vacío.

Un cliente de XMTP que no conoce el tipo muestra el `fallback` en lugar de un JSON crudo, y la
billetera reconoce un mensaje de protocolo por su tipo, sin tener que leer el texto de nadie.

### 4.2 Versión de la sesión

La billetera elige la versión: `min(v del URI, la mayor que entiende)`. La comunica en el primer
mensaje (`connect`, §5.1):

- si la sesión es **v2**, el `connect` va con el tipo `chatwallet.org/cw:2.0` y lleva `"v": 2`;
- si es **v1**, el `connect` va como texto plano (el JSON de la §5 sin el campo `v`).

La app DEBE contestar con el mismo transporte en que llegó el `connect`, y DEBE aceptar los dos.
Así una app v2 sigue funcionando con una billetera vieja, y una billetera v2 con una app vieja.

### 4.3 Fallback

| mensaje | fallback |
|---|---|
| `connect` | `ChatWallet: vinculación con una app` |
| `rpc` `personal_sign` | `ChatWallet: pedido de firma de una app` |
| `rpc` `eth_sendTransaction` | `ChatWallet: pedido de transacción de una app` |
| `result` / `error` | `ChatWallet: respuesta a una app` |
| `bye` | `ChatWallet: fin de la sesión con una app` |
| `payment_result` | `ChatWallet: resultado de un pago` |

## 5. Mensajes

Todos llevan `cw`: `1` para el canal de firma, `2` para el de pago (§6). El número de canal no
es la versión del protocolo: un mensaje de una sesión v2 sigue diciendo `"cw": 1`.

### 5.1 `connect` — billetera → app

    { "cw": 1, "type": "connect", "v": 2, "address": "0x…", "chainId": 8453,
      "app": "mail.energiasonora.org", "name": "Soberano Mail", "kind": "once" }

`address` es la cuenta que va a firmar (checksum o minúsculas). Si el URI traía `login` y la
persona lo aprobó, el `connect` lleva además `"login": "0x…"`, la firma EIP-191 de ese texto
(65 bytes) hecha por `address`. `app`, `name` y `kind` repiten lo
que la billetera entendió del URI: le confirman a la app qué mostró y le avisan a los otros
dispositivos de la misma persona que ese DM es de una app (ven el mensaje enviado y así no lo
convierten en contacto).

La app responde abriendo un DM a `address` (o reusando la conversación por la que llegó el
`connect`) y desde ahí manda pedidos.

### 5.2 `rpc` — app → billetera

    { "cw": 1, "type": "rpc", "id": "<único>", "method": "<método>", "params": [ … ], "ttl": 180000 }

`id` es único por pedido (un UUID). `ttl`, opcional, es cuántos milisegundos espera la app; es
relativo y no una hora absoluta porque los relojes de los dos aparatos no coinciden.

Métodos:

| método | params | resultado |
|---|---|---|
| `personal_sign` | `[mensaje, address]` — mensaje en texto o `0x…` hex | firma `0x…` de 65 bytes (EIP-191) |
| `eth_sendTransaction` | `[{ to, data?, value?, chainId? }]` — `value` en hex | hash `0x…` de la transacción enviada |

Si `chainId` no coincide con la red elegida en la billetera, la billetera contesta con error
`4901` sin molestar a la persona.

### 5.3 `result` y `error` — billetera → app

    { "cw": 1, "type": "result", "id": "<el del pedido>", "result": "0x…" }
    { "cw": 1, "type": "error",  "id": "<el del pedido>", "error": "user rejected", "code": 4001 }

`code` sigue a [EIP-1193](https://eips.ethereum.org/EIPS/eip-1193): `4001` rechazado por la
persona, `4100` sesión no autorizada, `4200` método no soportado, `4901` otra red. Sin `code`, es
un error de ejecución (por ejemplo, fondos insuficientes) y `error` lo describe.

### 5.4 `bye` — cualquiera de las dos

    { "cw": 1, "type": "bye" }

Termina la sesión. La app lo manda al cerrar si es `once`, o cuando la persona se desconecta. La
billetera lo manda cuando la persona toca «Desconectar». Después de un `bye` la billetera NO
atiende más pedidos de ese inbox.

## 6. Canal de pago (`cw: 2`)

Para cobrar sin vincular: la app muestra

    https://chatwallet.org/dapp?pay=1&to=<0x>&chainId=<id>&value=<wei>&reply=<inbox>&ref=<ref>&memo=<texto>&v=2&app=<host>&name=<nombre>

La billetera muestra el pago, y si la persona lo aprueba manda un envío nativo de `value` a `to`
(nunca ejecuta calldata en este canal). El resultado va a `reply` por DM:

    { "cw": 2, "type": "payment_result", "ref": "<ref>", "txHash": "0x…", "address": "0x…" }
    { "cw": 2, "type": "payment_result", "ref": "<ref>", "error": "user rejected" }

Con `v=2`, el resultado viaja con el tipo de la §4.1; sin `v`, como texto. Un pedido de pago es
siempre `kind=once`.

## 7. Reglas de seguridad para la billetera

1. Sólo atiende `rpc` de un inbox con el que la persona se vinculó a propósito, y nunca después
   de un `bye`.
2. Sólo por DM: un pedido que llega por un grupo se descarta, aunque venga de un inbox vinculado.
3. Cada `personal_sign` muestra el texto completo; cada `eth_sendTransaction` muestra destino,
   monto, lo que el calldata hace si se puede leer, y lo que no se puede leer se dice que no se
   puede leer. Un permiso sin límite se nombra como tal.
4. `app` y `name` se muestran como declarados (§3.1).
5. Nunca exporta la llave ni firma algo que la persona no vio.
6. La pantalla de vincular (con o sin `login`) avisa arriba de todo que hay que comprobar que el
   dominio mostrado sea el de la página en la que la persona está entrando: `app` lo declara la
   propia app (§3.1), y una página falsa puede mostrar el QR de la verdadera.

## 8. Qué hace la billetera con el chat de una app

Un inbox vinculado es una **app**, no un contacto:

- no aparece entre los chats; la billetera lo lista aparte ("Apps conectadas"), con el nombre y
  el dominio declarados, la fecha y la actividad;
- sus mensajes no suenan, no cuentan como no leídos y no disparan avisos, salvo el propio pedido
  de aprobación;
- una sesión `once` se archiva al recibir `bye` o tras 24 horas sin actividad; una `session`, al
  desconectarla o tras 30 días sin actividad;
- un DM cuyos mensajes son todos de protocolo (canales 1 y 2) se trata igual aunque no haya
  sesión registrada: así se ordenan las sesiones v1 previas a esta especificación.

## 9. Compatibilidad con v1

- Una app v1 muestra un URI sin `v` y habla texto. La billetera v2 la atiende en v1, sin nombre
  ni dominio (la lista la muestra como "App sin nombre"). Como la v1 no declara `kind` y hay apps
  v1 que reusan su identidad entre recargas, la billetera trata una sesión v1 como `session`.
- Una billetera v1 recibe un URI con `v=2`: ignora los parámetros que no conoce y manda un
  `connect` de texto. La app v2 detecta que llegó como texto y sigue en v1 (§4.2).
- `bye` no existe en v1: una app v2 en una sesión v1 no lo manda.

## 10. Implementación de referencia

[`cw-connect.mjs`](cw-connect.mjs), sin dependencias propias: recibe el `Client` de
`@xmtp/browser-sdk` (v5 o v6) y `ethers` v6.

```js
import { conectarConChatWallet } from './cw-connect.mjs';

const sesion = await conectarConChatWallet({
    Client, ethers,
    app: location.host, name: 'Mi app', kind: 'once', chainId: 8453,
    onUri: (uri) => mostrarQR(uri),          // pintar el QR / el link
    onEstado: (texto) => console.log(texto),
});
const firma = await sesion.firmar('Iniciar sesión en Mi app · ' + new Date().toISOString());
await sesion.cerrar();                        // manda `bye`
```
