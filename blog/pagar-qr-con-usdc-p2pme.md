# Pagá cualquier QR argentino con USDC desde ChatWallet

Escaneás el QR del comercio (Mercado Pago o cualquier billetera de Transferencias 3.0), confirmás, y el comercio cobra **en pesos** como siempre. Vos pagás **en USDC**, desde tu billetera, sin abrir cuenta en un exchange ni pasar por un banco.

Está en **etapa experimental** y por ahora funciona **solo en Argentina**.

## Cómo funciona

ChatWallet usa **P2P.me**, un protocolo abierto (código MIT en github.com/p2pdotme) que corre en la red **Base**. Una red de comerciantes cambia USDC por moneda local:

1. Escaneás el QR y ChatWallet abre una orden en Base. Todavía no se mueve plata.
2. Un comerciante de P2P.me toma la orden, normalmente en unos 10 segundos.
3. ChatWallet le manda el QR **cifrado solo para él**. Recién en este paso tus USDC pasan a la custodia del contrato.
4. El comerciante le paga al comercio en pesos y cierra la orden. Entonces los USDC quedan para él.

No hay empresa en el medio que guarde tu plata ni te pida datos: la custodia la hace un contrato en Base que cualquiera puede leer. La ficha del pago te muestra cada paso.

## Cuánto cuesta

| | |
|---|---|
| **Cotización** | Precio al que P2P.me te compra los USDC; hoy, 1 USDC ≈ $1.645 |
| **Spread del protocolo** | 2,25 %, ya incluido en la cotización |
| **Comisión fija de P2P.me** | 0,05 USDC en pagos de hasta 10 USDC; más arriba, nada |
| **Comisión de ChatWallet** | **0,5 %**, y solo si el pago se completa |
| **Gas** | Unos 0,00002 ETH en Base por pago (centavos de dólar) |

Ejemplos con la cotización de hoy:

| Pagás | Total |
|---|---|
| $500 | ≈ 0,35 USDC |
| $10.000 | ≈ 6,16 USDC |
| $50.000 | ≈ 30,54 USDC |

**Sobre la comisión de ChatWallet:** con ella se sostiene el proyecto, y el botón de confirmar la muestra con todas las letras. Por ejemplo: *"Confirmar $ 20.000: 12,30 USDC + 0,06 de ChatWallet"*. Así la aceptás con el mismo toque con que aceptás el pago.

- Se cobra únicamente si el pago se completa. Si falla, no pagás nada.
- Si cerrás la app antes de que termine, nunca se cobra sola: al volver, ChatWallet te pregunta si querés pagarla, y si decís "Ahora no", no insiste.
- Nada se firma ni se cobra sin que lo veas.

## Tiempos

- Un comerciante toma la orden en unos **10 segundos**.
- El comercio cobra en **alrededor de un minuto**.
- Nuestro primer pago real ($500, 10/10/2026) tardó 8 segundos en ser aceptado y 62 segundos en llegarle al comercio.
- En los datos públicos de P2P.me, Argentina hizo 1.000 pagos de QR en 19 días.

## Límites y requisitos

- **Sin KYC:** no te piden documento ni registro, solo tu billetera.
- Hasta **300 USDC por pago** (≈ $490.000).
- Necesitás **USDC en Base** y **un poco de ETH en Base** para el gas. Con 0,0001 ETH alcanza para varios pagos.

## La primera vez

La primera vez que tocás **"Pagar con USDC (experimental)"**, ChatWallet te muestra un aviso con la cotización en vivo, todas las comisiones, el límite, los tiempos y qué pasa si algo falla. Lo aceptás una vez y listo.

## ¿Y si algo sale mal?

Lo probamos contra el contrato real de P2P.me:

- **Nadie toma la orden, o tocás "Frenar" antes de que salga el QR:** la orden vence sola y tus USDC nunca se movieron.
- **El comerciante cancela después de recibir el QR:** tus USDC vuelven **enteros** a tu billetera, y ChatWallet no cobra nada.
- **El comerciante desaparece:**
  - La orden vence a los ~10 minutos y el sistema de P2P.me la cancela solo; los USDC vuelven.
  - ChatWallet revisa tus órdenes al abrirla y te avisa *"Tus USDC volvieron"*.
  - Si después de una hora siguieran retenidos, te aparece un botón **"Recuperar mis USDC"**.
- **El comerciante marca el pago como hecho pero el comercio no recibió nada:**
  - P2P.me tiene disputas en la cadena, que se pueden abrir desde los 30 minutos hasta los 7 días.
  - Por ahora se reclama en **t.me/p2pmeargentina** con el número de orden, que ChatWallet guarda. El botón para disputar desde la app viene en una próxima versión.
- **Cerrás la app en medio del pago:** no pasa nada. Al volver, ChatWallet mira en qué terminó la orden y te avisa.

Un límite a tener en cuenta: **una vez enviado el QR, quien paga ya no puede cancelar**; el protocolo no lo permite. Hasta ese momento podés frenar sin costo.

## Tus llaves, tus reglas

Hace poco se viralizó un caso: un estafador le mandó centavos a una billetera conocida, el filtro "de cumplimiento" de la app marcó la dirección como sospechosa, y la app le deshabilitó las transacciones al dueño. La blockchain no congeló nada; lo bloqueó la app.

En ChatWallet eso no puede pasar:

- **No hay filtro de cumplimiento ni listas negras.** ChatWallet no le pregunta a nadie si podés firmar: firma con tu llave, en tu teléfono. Que alguien te mande polvo no cambia nada.
- **Podés usar tu propio nodo.** Si un nodo público se negara a transmitir, agregás una red con tu propio RPC.
- **Modo frío:** firmás en un dispositivo sin conexión y la transacción firmada la puede transmitir **cualquier** nodo o app. Una vez firmada, nadie puede impedir que exista.
- Lo que sí puede pasar es que un servicio de terceros, como P2P.me, rechace una orden. Eso afecta a ese servicio, nunca tu acceso a tus fondos.

Un consejo: el polvo también se usa para el **envenenamiento de direcciones**. El estafador manda centavos desde una dirección parecida a la de un contacto tuyo, esperando que la copies del historial. Pagá siempre a contactos guardados o revisá la dirección completa.

## Por qué importa

- Gastás tus dólares digitales en cualquier comercio argentino que acepte QR.
- El comercio cobra pesos como siempre y no tiene que aceptar cripto.
- No hay intermediario que te pida datos: el contrato y el código están a la vista.
- Tu billetera sigue siendo tuya, sin permisos de nadie.

## Próximamente

- Botón **"Reportar problema"** para abrir la disputa desde la app.
- Lista de tus pagos de QR con su estado.
- **Bolivia y Perú:** P2P.me ya funciona ahí. Los vamos a habilitar después de un pago real de prueba en cada país.

*ChatWallet 3.104 · disponible en chatwallet.org y como app Android.*
