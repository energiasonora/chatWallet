# Novedades de ChatWallet

Qué cambió en cada versión, contado para quien usa la app (no para quien lee el código).
Es la fuente de verdad: `deploy.sh` la exige en cada publicación, le pone el número de
versión y la fecha, y la incrusta en la app para que **Novedades** funcione sin conexión.

Cómo se escribe:

- Todo lo que todavía no salió va bajo `## Sin publicar`, como viñetas.
- `./deploy.sh` renombra esa sección a `## X.YY — AAAA-MM-DD` y abre una nueva vacía.
- Una viñeta se escribe en castellano llano y en pasado, contando qué cambia para el
  usuario, no qué archivo se tocó. Se admite `**negrita**` y `` `código` ``.
- Si una versión no tiene nada que contarle a nadie (un redeploy), no se lista.

Las versiones anteriores a la 3.00 están en los
[releases de GitHub](https://github.com/energiasonora/chatWallet/releases).

## Sin publicar

- La **lista de contactos** también dejó de mostrar los mensajes del puente en crudo: se le
  había arreglado al chat pero no a la vista previa, que se dibuja por otro lado.

## 3.31 — 2026-09-09

- Los pedidos que manda una dApp ahora se distinguen de un vistazo: **vincular** es azul,
  **firmar** violeta y **mover dinero** ámbar, cada uno con su ícono y su etiqueta. Antes los
  tres eran la misma tarjeta violeta y sólo se diferenciaban leyendo el texto.

## 3.30 — 2026-09-09

- El sitio dejó de pasar por un intermediario: ahora lo entrega Cloudflare directamente. En
  agosto una persona en Costa Rica se comió un error del intermediario y nunca llegó a abrir
  la app; ese eslabón ya no existe.
- El celular **vibra** cuando algo pide tu firma: una dApp, un pago del libro, una transacción
  fría o un envío. Son dos pulsos, distintos del toque del escáner. Antes el APK no vibraba
  nunca — le faltaba el permiso, así que tampoco vibraba al escanear un QR ni al deslizar
  para responder.
- Los mensajes que la app intercambia con las dApps ya no se ven como bloques de código en el
  chat: ahora dicen en una línea qué pasó («Una dApp pidió tu firma»), en tu idioma.

## 3.29 — 2026-09-09

- Vincular una dApp (como Ius Naturalis o StealthPay) ya no depende de la cámara: en **Escanear**
  hay un botón **Pegar código** que acepta lo mismo que un QR — el link de vinculación, un pago,
  una transacción fría o una agenda de contactos.
- Si la dApp está abierta en **este mismo dispositivo**, su botón «Abrir en chatWallet» ahora
  trae el pedido directo a la app, sin sacarle una foto a la pantalla de al lado.

## 3.28 — 2026-09-08

- Se corrigió un texto que decía que el proyecto no tiene token: **sí lo tiene** (CWLT) y hubo
  una preventa. Lo que es cierto, y se puede verificar en la cadena, es que no entró ningún
  fondo de inversión.
- El saldo de CWLT que mostraba la app era el de una red de prueba. Ahora muestra el real.

## 3.27 — 2026-09-07

- **Novedades**: la app ahora cuenta qué cambió en cada versión. Está en el modal de la
  marca y en Configuración, y se abre sola una vez cuando estrenás una versión nueva.
- Al buscar actualizaciones, además del número se puede ver qué trae la versión nueva.

## 3.26 — 2026-09-04

- Se puede gastar USDC desde direcciones privadas que no tienen gas: la transacción la
  transmite el relayer.

## 3.25 — 2026-09-04

- En el chat: copiar y reenviar mensajes, editar los emojis de las reacciones, y la cita
  de las respuestas se ve mejor.

## 3.24 — 2026-09-03

- Se puede pagar desde las direcciones privadas eligiendo qué moneda usar.
- El relayer transmite autorizaciones firmadas sin funcionar como surtidor: resuelve todo
  en una sola transacción atómica, tiene límite de tasa, y avisa si tiene gas **antes** de
  que alguien firme.

## 3.23 — 2026-09-03

- Escáner de anuncios stealth y saldo de la StealthWallet.

## 3.22 — 2026-09-02

- Los pagos stealth se envían siguiendo el spec, y el aviso viaja por el chat.

## 3.21 — 2026-09-02

- Stealth quedó alineado con el spec público, y se ocultó lo que todavía no puede cumplir.

## 3.20 — 2026-09-01

- El QR de "Recibir" salía en blanco, y stealth pedía "conectá tu wallet" con la wallet ya
  conectada.
- Los App Links de Android habían quedado con la huella vieja después de la mudanza.

## 3.19 — 2026-09-01

- El panel de modo frío hablaba sólo español; ahora sigue tu idioma.
- El aviso de la mudanza en el puente también se traduce.

## 3.18 — 2026-09-01

- El modo frío se mudó a Configuración, y las claves tienen su propia sección.

## 3.17 — 2026-09-01

- La pantalla de la billetera entra entera, sin tapar el saldo.

## 3.16 — 2026-09-01

- La etiqueta del apodo va sin posesivo: el alias lo elige el otro, no vos.

## 3.15 — 2026-09-01

- "Tu alias" se leía como si el alias fuera propio.

## 3.14 — 2026-09-01

- El selector de red entra sin scroll, y tu tarjeta se ve antes de editarla.

## 3.13 — 2026-09-01

- Elegir red pasó a ser una pantalla propia, y respeta el tema claro/oscuro.

## 3.12 — 2026-09-01

- Cambiar de tema ya no tira un cartel.

## 3.11 — 2026-09-01

- En tema claro había botones cortados y letra negra sobre fondo índigo.

## 3.10 — 2026-09-01

- Estrenar un contacto deja un solo renglón en el chat, y en tu idioma.

## 3.09 — 2026-09-01

- El aviso de "te escanearon el QR" no le salía justo a quien estrenaba la app.

## 3.08 — 2026-08-31

- A quien llega por un link de invitación ya no se lo recibe con advertencias.

## 3.07 — 2026-08-29

- En la lista de chats se marca el nombre que no confirmaste vos: el apodo lo elige el
  otro y se puede suplantar.

## 3.06 — 2026-08-29

- "Buy Token" no llevaba a ningún lado. No hay token: apoyar el proyecto es comprar el
  libro.

## 3.05 — 2026-08-29

- El buscador de actualizaciones decía "al día v3.1", una versión que no existe.
- Se puede copiar la dirección de un toque.

## 3.04 — 2026-08-28

- Después de tocar "descargar el APK", la app explica qué va a pasar.

## 3.03 — 2026-08-28

- El botón del APK se veía en escalera.

## 3.02 — 2026-08-28

- Instalar el APK también se puede desde Configuración, no sólo desde el banner.

## 3.01 — 2026-08-28

- En Android, la web ofrece el APK en lugar de la PWA: con el navegador cerrado la PWA no
  recibe avisos.

## 3.00 — 2026-08-27

- **Red XMTP de producción.** Los chats dejaron de vivir en la red de desarrollo.
- **Firma propia de EnergíaSonora.** La app dejó de estar firmada con una llave de debug.
  Android no deja cambiar la firma de una app instalada: hubo que desinstalar y reinstalar.
- El respaldo de chats subió sólo lo nuevo, no el historial entero.
- Los videos de la landing se sirven desde el nodo IPFS soberano.
