# Nodo Ğ1 propio

Para qué: hoy la billetera Ğ1 de ChatWallet y el explorador (`chatwallet.org/g1/`) dependen de
nodos de otros (gyroi, asycn, cgeek) y de un único indexador que funciona (brussels.ovh; el de
axiom da 502). Un nodo en casa saca a ChatWallet de esa dependencia para **comprobar** y
**mandar**, y es un nodo más para la red Ğ1.

## Dos piezas, dos pesos

| Pieza | Para qué | Peso | Estado |
|---|---|---|---|
| **Nodo espejo** (`duniter-g1-1100`, perfil `light`) | Comprobar el hash de cualquier bloque, ver lo finalizado, leer saldos al día y mandar transacciones | Liviano: guarda los bloques completos del último día (14.400) y los encabezados de todos | Script listo: `instalar-en-la-caja.sh` |
| **Indexador** (`squid-app-g1` + `squid-graphile-g1` + `squid-postgres-g1`) | El relato legible del explorador: pagos viejos, comentarios, nombres, historial de una cuenta | Pesado: necesita un nodo **archivo** (todo el historial) y Postgres | Pendiente: primero medir el espejo |

El explorador ya separa las dos cosas: lee el detalle del indexador y lo **comprueba contra un
nodo**. Con el espejo propio, la comprobación deja de depender de terceros aunque el detalle
siga viniendo de brussels.ovh.

## ¿Caja o Samsung?

**La caja.** Tiene podman, x86_64, 2 núcleos, ~2,4 GB de RAM libres y 29 GB en `/`.
En el Samsung (Android) no hay podman ni Docker; habría que compilar Duniter en Termux, y un
nodo que sincroniza todo el día come batería y datos. Para el teléfono, lo liviano de verdad es
un **cliente liviano** (smoldot) dentro de la app, que verifica sin guardar la cadena: queda
anotado como paso posterior.

## Instalar (lo corre el usuario)

```
./poc/g1-nodo/instalar-en-la-caja.sh
```

Qué hace en la caja:
- `~/start-g1-nodo.sh`: corre el contenedor `g1-nodo` con 1,5 GB de RAM como máximo, el RPC
  **sólo en 127.0.0.1:9944**, los datos en el volumen `g1-datos`, sin telemetría.
- `@reboot` en el crontab, como los demás servicios.
- No abre puertos: el nodo habla con la red hacia afuera (el router no deja abrir puertos igual).

La primera sincronización tarda (horas): mirar el avance con
```
ssh caja "curl -s -H 'content-type: application/json' -d '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"system_syncState\",\"params\":[]}' http://127.0.0.1:9944"
```
(`currentBlock` tiene que alcanzar a `highestBlock`).

## Exponerlo (después de que sincronice)

Por el túnel de Cloudflare que ya usa la caja, como `g1.chatwallet.org → http://localhost:9944`
(el túnel pasa WebSocket). Es un paso hacia afuera: lo decide y lo hace el usuario
(`cloudflared tunnel route dns …` + la entrada `ingress` en el config del túnel).
Eso lo hace `./poc/g1-nodo/exponer-en-el-tunel.sh` (y `--deshacer` lo vuelve atrás; el DNS se
borra a mano en Cloudflare). Reinicia el túnel `stealthpay` por PID: ~40 s de 530 en las otras páginas.

Después:
1. Probarlo en el explorador sin tocar nada: `chatwallet.org/g1/?bloque=3652720&nodo=wss://g1.chatwallet.org`
   (el sello dice contra qué nodo comprobó).
2. Ponerlo primero en `NODOS` de `src/static/g1/index.html` y de `src/js/g1-cadena.js`
   (la billetera), y publicar.
3. Sumarlo al monitor de la caja (que avise si se atrasa).

## Sincronización: warp, no completa

Medido el 24/11/2026: la sincronización completa (re-ejecutar cada bloque desde 2023) iba a
**2,6 bloques/s** (~2 semanas para 3,75 millones) y subía la carga de la caja a 4,8 con 2 núcleos,
con 700 MB de swap. Por eso el nodo arranca con `DUNITER_SYNC=warp` (baja el estado finalizado
con su prueba de GRANDPA y completa la historia después, sin ejecutarla) y `--cpus=1.5`.
El binario trae un punto de partida incorporado para el warp de Ğ1 que es viejo (bloque 84.128):
con él, warp saltaba sólo el 2 % y después volvía a bloque por bloque. Por eso también
`DUNITER_NO_CHECKPOINT=true` (warp con las pruebas de GRANDPA de la red). Si la red no las sirve,
queda `DUNITER_WARP_CHECKPOINT_HEADER` (un JSON con un encabezado reciente, comprobado contra
dos nodos). Pasar de completa a warp exige base vacía: `./poc/g1-nodo/instalar-en-la-caja.sh --de-cero`.

**Resultado (24/11/2026):** con warp sin checkpoint el nodo pasó de cero a la punta de la cadena
(#3.757.750) en **4 minutos**: ~25 s de pruebas GRANDPA, 33 MiB de estado, 262 MB en disco, carga
1,5. Después completa la historia en segundo plano («Block history»: encabezados viejos, sin
ejecutarlos); hasta que llega, `chain_getBlockHash` de un bloque viejo da `null` (el explorador
pasa al nodo siguiente). El saldo (`state_getStorage` de System.Account) ya da igual que gyroi.

## El monitor lo vigila

`uso/monitor/monitor.py` (chequeo `g1_nodo`, cada 10 min): avisa a los **7 GB**, y a los **10 GB**
lo frena y deja `~/g1-nodo-FRENADO`, que el arranque respeta (no vuelve solo al prender la caja).
También avisa si pasa una hora sin avanzar. El resumen de las 9 trae «🌐 Nodo Ğ1: bloque X de Y».
Para seguir después de un freno: `rm ~/g1-nodo-FRENADO && ~/start-g1-nodo.sh`.
Medido el 24/11/2026: 445 MB en el bloque 22 mil, ~1 GB de RAM; el disco bajó al pasar los
14.400 bloques (empieza la poda del perfil `light`).

## Medir antes de seguir

Cuando esté al día: disco del volumen (`podman volume inspect g1-datos`), RAM (`podman stats
--no-stream g1-nodo`) y temperatura. Con eso se decide si la caja aguanta el nodo archivo y el
indexador.
