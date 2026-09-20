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

## 3.37 — 2026-09-20

- En el chat, el **"Últ. vez"** dejó de contarse siempre en minutos. Decía cosas como
  *hace 15945 min*, que no las lee nadie: ahora sube de unidad a medida que pasa el tiempo
  —minutos, horas, días, meses, años— y el número siempre queda chico.

## 3.36 — 2026-09-20

- **Novedades ya no te interrumpe**: al estrenar una versión sale una notificación, y la pantalla
  se abre sólo si la tocás. Antes se abría sola apenas entrabas, tapando la app para algo que no
  pediste. Sigue estando en el modal de la marca y en Configuración.
- Cada dispositivo mantiene **una sola identidad de mensajería**: cuando el navegador borra la base,
  la identidad que murió con ella se da de baja sola en vez de quedar ocupando lugar. XMTP permite
  10 por wallet y al llegar a 10 el chat deja de arrancar; así el contador no sube nunca.
- El botón **Revocar instalaciones antiguas** de Configuración estaba mirando la red de desarrollo
  desde la mudanza de agosto: no revocaba nada. Ahora trabaja sobre la red real.

## 3.35 — 2026-09-20

- Los dos lados de un chat ahora **se ponen de acuerdo solos**. Al abrir una conversación, cada
  teléfono le manda al otro un resumen mínimo de lo que tiene —por día, cuántos mensajes y una
  huella, unos cientos de bytes— y el que tiene de más completa lo que falta. No pasa por ningún
  servidor: el que reenvía es el que escribió esos mensajes, y sólo puede reenviar los suyos.
  Vuelven con su fecha original, en su lugar del hilo, sin repetirse y sin figurar como nuevos.
  Si te borraron la base, la app pide el historial faltante a todos tus contactos apenas arranca.

- ChatWallet le pide al navegador que **no borre** sus datos. Sin ese pedido, cuando al disco le
  falta espacio el navegador tira el almacenamiento del sitio sin avisar: se va la base del chat,
  la app estrena identidad de mensajería y **todo lo que te escribieron mientras estaba cerrada
  queda ilegible para siempre**. Pasó de verdad en una Mac con el disco lleno: seis identidades
  nuevas en tres semanas y mensajes que nunca aparecieron, sin una sola advertencia.
- Y si ese borrado igual ocurre, ahora la app **lo detecta y lo dice**: restaura lo que haya en tu
  respaldo y te avisa que puede faltar lo que te mandaron con la app cerrada, para que pidas que
  te lo reenvíen. Antes parecía, simplemente, que nadie te había escrito.
- El chat avisa cuando vas por **8 de las 10 identidades** que permite la red de mensajes. Al
  llegar a 10 deja de arrancar, y cada borrado de base gasta una.

## 3.34 — 2026-09-18

- Los pedidos de firma de una dApp (como StealthPay) **ya no se pierden** cuando la conexión
  con la red de mensajes se corta un momento. El pedido llegaba y quedaba guardado, pero la
  app no lo mostraba nunca, y la dApp esperaba tres minutos hasta rendirse. Ahora ChatWallet
  revisa cada pocos segundos si quedó algún pedido sin atender y lo muestra.

## 3.33 — 2026-09-18

- En el APK, el celular **ahora sí vibra** cuando algo pide tu firma, y también al leer un QR,
  deslizar para responder o abrir las reacciones. La vibración que se había agregado en la 3.30
  no llegaba nunca al motor: Android la bloqueaba si no habías tocado la pantalla antes, y un
  pedido de firma llega justamente sin que toques nada. Ahora vibra por la vía nativa del
  teléfono. El pedido de firma son de verdad **dos pulsos**, como estaba pensado: antes salía
  uno solo.

## 3.32 — 2026-09-18

- La **lista de contactos** también dejó de mostrar los mensajes del puente en crudo: se le
  había arreglado al chat pero no a la vista previa, que se dibuja por otro lado.
- Cuando una dApp pide una transacción que llama a un contrato, ChatWallet **la simula antes
  de que la firmes** y te dice qué pasaría: cuánto sale y cuánto entra de cada saldo tuyo, qué
  **permisos** le estarías dando a otro contrato (incluidos los sin límite), o si la
  transacción **va a fallar** y solo perderías la comisión. Antes, lo que ChatWallet no sabía
  leer se firmaba a ciegas. Es una simulación y no una garantía, y la pantalla lo avisa. En
  las redes cuyo nodo no permite simular, también lo avisa.

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
