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

- En el APK, los botones de **enviar** y **recibir** —los de la pantalla principal y los del chat—
  ahora **vibran** con un toque corto al apretarlos, para que se sienta que la app tomó el toque
  cuando se trata de plata.

## 3.50 — 2026-09-21

- El aviso de **“Tenés 1 mensaje nuevo de …”** que aparece al abrir la app ahora se puede tocar:
  abre ese chat. Si los mensajes son de varias personas, abre la lista de chats. Antes avisaba y
  no hacía nada al tocarlo.

## 3.49 — 2026-09-21

- **Tus contactos se ven aunque el chat no conecte.** La agenda está guardada en tu dispositivo,
  pero la app la leía recién cuando la red de mensajes terminaba de arrancar: si eso fallaba
  —el puntito rojo junto al botón de chats— la lista aparecía vacía y parecía que se habían
  borrado. No se habían borrado. Ahora se leen apenas abre la wallet.
- Si alguna vez la agenda no se puede descifrar, **ya no se borra**. Antes, en ese caso, la app la
  eliminaba y decía que “se resetearon”. Ahora guarda una copia intacta y te avisa que no se
  borró nada.

## 3.48 — 2026-09-21

- **Arreglo de seguridad importante.** La tarjeta de un pago o de un pedido de pago en el chat
  mostraba sin filtrar datos que escribe la otra persona —el monto, el nombre de la red, el
  explorador—. Alguien que te escribiera podía armar un mensaje que ejecutara código dentro de
  tu wallet. Ahora todo lo que viene del otro lado se muestra como texto, y un link de
  explorador sólo aparece si es una dirección web común. **Actualizá todos tus dispositivos.**
- **Solicitar pago** ahora te deja elegir **qué token** pedís, en vez de pedir siempre en la red
  que tengas activa. Y del otro lado se lee bien: antes, pedir 10 USDC podía llegar como
  *“Te solicitaron 10 ETH”*, y el botón Pagar abría el envío en la red que estuviera activa.
  Ahora el pedido dice qué token es, Pagar abre el envío ya en ese token, y si no lo tenés en tu
  lista te ofrece agregarlo primero. La dirección del nodo que viaja con el pedido nunca lleva tu
  clave de API.

## 3.47 — 2026-09-21

- Los dos botones de plata del chat **dicen qué hacen**: la flecha de siempre, ahora con una
  moneda. Violeta con la flecha hacia arriba, **pagarle** a quien estás chateando; gris con la
  flecha hacia abajo, **pedirle** plata. La moneda lleva un rombo y no un signo de ningún país.

## 3.46 — 2026-09-21

- Cambiar a una red cuyo **nodo no contesta** dejaba el saldo en *Cargando…* para siempre (pasó
  al pasar a Ethereum mainnet). Ahora la app espera 12 segundos y no más, **prueba sola los otros
  nodos** de esa red —y si la red no tenía de repuesto, se los busca en el diccionario de cadenas—,
  y se queda con el que anda. Si no anda ninguno, lo dice: el saldo muestra *Sin respuesta* y sale
  un aviso que, tocado, te lleva a cambiar el nodo en **Administrar redes**.

## 3.45 — 2026-09-21

- En el APK, el **botón atrás del celular** ahora cierra la ventana que está adelante, de a una
  por vez. Con varias encimadas —Configuración → Administrar redes → Añadir nueva red— cerraba
  una de atrás: en pantalla no cambiaba nada y parecía que el botón no funcionaba.

## 3.44 — 2026-09-21

- En la barra de contactos angosta, la etiqueta gris con la dirección **se le subía encima a la
  hora** y el renglón quedaba ilegible. Esa etiqueta nunca cedía espacio: ahora, cuando la barra
  es angosta, directamente no se dibuja —quedan el nombre y la hora, que es lo que se lee— y
  vuelve sola al ensanchar la ventana. La dirección completa sigue a un toque, en el avatar.

## 3.43 — 2026-09-20

- El renglón que ya había quedado con `{"cw":4,"t":"res"…}` guardado **se limpia solo** al
  abrir la app: la 3.42 evitó que volviera a pasar, pero el que estaba escrito seguía ahí
  hasta que llegara otro mensaje. Se reemplaza por el último mensaje de verdad que haya en tu
  historial local; si no hay ninguno, el renglón queda sin vista previa.

## 3.42 — 2026-09-20

- Si le pusiste un **apodo** a alguien y esa persona no declaró ningún nombre en su perfil, ahora
  se ve tu apodo —arriba del chat y en la barra lateral— en vez de su dirección `0x8990…1d80`.
  El nombre que declara el otro sigue mandando cuando existe (cualquiera puede llamarse como
  quiera, y por eso se marca); el tuyo, en cambio, no lo puede falsificar nadie.
- La lista de contactos mostraba de vez en cuando un renglón con `{"cw":4,"t":"res"…}` en crudo y
  encima le robaba el lugar a la última conversación de verdad. Era la app leyendo **su propio**
  mensaje de sincronía: se filtraba el de los demás, pero no el propio.

## 3.41 — 2026-09-20

- El **"En línea"** del chat dejó de mentir. Nadie puede avisar de forma confiable que cerró la
  app —cerrar la ventana no deja tiempo de mandar nada por la red—, así que el estado se
  quedaba pegado: una wallet cerrada hacía horas seguía figurando en línea del otro lado. Ahora
  "en línea" es un permiso que **vence a los 10 minutos** si no se renueva, y mientras estás
  mirando el chat tu app lo renueva sola. Al salir del chat, esconder la app o cerrarla, se avisa
  —y si el aviso no llega, el estado vence igual y pasa a decir cuándo fue la última vez.

## 3.40 — 2026-09-20

- El aviso de **"Reenviado a …"** ahora se puede tocar y abre el chat de quien lo recibió.
  Reenviar no te mueve del chat donde estás —eso sigue igual—, pero después casi siempre
  querés ver cómo quedó allá, y había que ir a buscarlo a mano en la lista.

## 3.39 — 2026-09-20

- **Reenviar un mensaje** —mantenés apretado y tocás la flecha— no hacía absolutamente nada
  desde que se agregó, en la 3.25. Eran dos fallas encimadas: la pantalla para elegir a quién
  reenviar se rompía antes de abrirse, y por debajo el pedido de conversación se colgaba sin
  devolver ni un error. Ahora abre la lista de contactos, manda el mensaje y te avisa a quién
  se lo mandaste, sin sacarte del chat donde estabas.
- Las **respuestas que te llegaban no se guardaban** en el historial local: un detalle del formato
  las hacía fallar al archivarlas, y de paso se llevaba puesto al resto de los mensajes del mismo
  lote. Como no quedaban guardadas, tampoco entraban en el respaldo ni en la sincronía entre las
  dos puntas: al cambiar de dispositivo, esas respuestas no aparecían.

## 3.38 — 2026-09-20

- El renglón de conexión del chat —**En línea**, **Desconectado** y el *Últ. vez*— nunca
  había pasado por las traducciones: se veía en castellano aunque tuvieras la app en inglés o
  en francés. Ahora está en los tres idiomas, con el lapso donde corresponde en cada lengua
  (*hace 11 días*, *Last seen 11 days ago*, *Vu il y a 11 jours*), y cambia al instante si
  cambiás de idioma con un chat abierto.

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
