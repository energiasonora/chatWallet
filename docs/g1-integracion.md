# Ğ1 (junas) en ChatWallet: cómo está armado

Apunte técnico al 17/11/2026 (v3.110). Explica qué librerías usamos, cómo se deriva la cuenta,
cómo se habla con la cadena y cómo se cruza Ğ1 con el chat y con Ius Naturalis.

## La idea en una línea

Ğ1 aporta la **identidad** (la red de confianza: quién es un ser vivo) y la **moneda** (las junas
y el dividendo universal). ChatWallet es **donde se habla y se paga**. Ius Naturalis es donde se
**atestigua y se ancla**. No reinventamos la red de confianza: el sello «ser vivo» se lee de Ğ1.

## Duniter v2 en datos

| Dato | Valor |
|---|---|
| Cadena | Duniter v2 (Substrate / Polkadot SDK, Rust), en producción desde el 7/3/2026 |
| Genesis | `0xfeb770bbb0344dabc8366b0d1f889a8e4e6ca09b914006655fe795920deb6d56` |
| Direcciones | SS58 con prefijo **4450**, empiezan con `g1…` |
| Llaves | **ed25519** (los clientes la usan por defecto; la cadena también acepta sr25519) |
| Unidad | 1 Ğ1 = 100 céntimos. Depósito existencial: 1 Ğ1 (una cuenta no puede quedar con menos) |
| Comisiones | 0 con uso normal (solo cobran si los bloques se llenan; antispam) |
| Bloque | ~6 s |
| Miembro | 5 certificaciones + evaluación de distancia (80 % de referentes a ≤ 5 pasos) |

## Librerías

| Librería | Para qué | Dónde |
|---|---|---|
| `@noble/curves` (ed25519) | Llave, firma de transacciones y del vínculo | `g1-llave.js`, `g1-cadena.js`, `g1-billetera.js` |
| `@noble/hashes` (pbkdf2, sha512, blake2b) | Mini-secreto Substrate, derivación dura, checksum SS58 | `g1-llave.js` |
| `@scure/bip39` | Frases en otros idiomas (es, fr…); ethers en el navegador solo trae la inglesa | `frase.js` |
| `@polkadot/api` 16.5.6 | Conexión WebSocket a la cadena, armar extrínsecos, leer el estado. Es la misma que usa Cesium² | `g1-cadena.js` |
| ethers v6 | Firma y verificación de la 0x en el vínculo | dapp + `ius/js/g1.js` |

Lo que **no** usamos: `@polkadot/keyring` ni el wasm de polkadot para firmar. La firma es ed25519
con @noble, y se comprobó byte a byte contra Keyring (ed25519 es determinista).

## Módulos y cómo se cargan

Nada de Ğ1 entra en el bundle principal. Son pedazos que se bajan a demanda:

| Módulo | Peso aprox. | Se carga con | Qué hace |
|---|---|---|---|
| `ius/js/g1.js` | 7 KB | `window.cwCargarG1()` | SS58, consultas al indexador, vínculo `ius1:`, sello «ser vivo» |
| `src/js/frase.js` | 107 KB (5 listas) | lo importa la billetera | Leer frases BIP39 en cualquier idioma, sin tildes |
| `src/js/g1-billetera.js` | 41 KB | `window.cwCargarBilleteraG1()` | Candidatas, cuenta elegida, historial, QR, vínculo privado |
| `src/js/g1-cadena.js` | 1,12 MB (345 KB br) | `window.cwCargarCadenaG1()` | Saldo real, DU pendiente, enviar, identidad y membresía |

Los cargadores están en `src/dapp.html` (~línea 5084). En las pruebas, `cwCargarCadenaG1` se
reemplaza con `defineProperty` por una cadena simulada.

## 1. La cuenta: misma frase que Ğecko y Cesium²

`src/js/g1-llave.js`. Copia lo que hacen Ğecko y Cesium² (leído en su código, 27/9/2026):

1. La frase se lleva a su **entropía**. La frase en español o francés que muestran es solo la
   cara: por dentro usan la inglesa de la misma entropía.
2. **Mini-secreto** Substrate: `PBKDF2-SHA512(entropía, "mnemonic", 2048)[0..32]`.
3. Par **ed25519** desde ese secreto. La cuenta principal es la **raíz**.
4. Al importar, se prueban además las derivaciones duras `//0` … `//29`, igual que hacen ellos
   (`candidatasG1`, 31 en total). Se elige la que tiene fondos o identidad (`elegirCuenta`).

Consecuencias que conviene recordar:

- La 0x de ChatWallet sale del **texto** de la frase (BIP39 normal). La g1 sale de la
  **entropía**. Dos frases en idiomas distintos con la misma entropía dan la misma g1 y
  distinta 0x.
- Una clave privada EVM sola no alcanza para tener Ğ1: hace falta la frase.
- Las cuentas v1 (sal + contraseña, scrypt) no tienen frase. Pendiente, vía `change_owner_key`.
- Desde la v3.95 la frase se borra del dispositivo al comprobar el respaldo. Antes se guarda la
  **raíz Ğ1** (`cw-g1-raiz-<0x>`), que es lo que firma después.

Vectores de prueba: `tests/g1-llave.mjs` (sacados con `@polkadot/keyring`).

## 2. Leer: cadena primero, indexador de respaldo

**El saldo y el DU pendiente salen de la cadena** (`g1-cadena.js` → `saldo()`). El 27/9/2026, en
el mismo bloque, la cadena decía 4.334,12 Ğ1 y el indexador 4.120,13 para la misma cuenta. La
cadena manda.

El **indexador (squid)** sirve para lo que la cadena no da cómodo: historial con comentarios,
nombres de identidad, certificadores, vínculos `ius1:`.

- Nodos WebSocket (`NODOS` en `g1-cadena.js`): `g1.gyroi.de`, `g1-v2s.cgeek.fr`,
  `g1.asycn.io/ws/`, `g1-bootstrap.p2p.legal`, `g1.coinduf.eu`. `WsProvider` pasa al siguiente
  si uno no contesta en 2,5 s, y la conexión se descarta si el genesis no es el de Ğ1.
- Indexadores (`ius/js/g1.js`): `squid.g1.brussels.ovh/v1/graphql` y
  `g1-squid.axiom-team.fr/v1/graphql`.
- El squid es **PostGraphile**, no Hasura: `accounts(filter:{id:{in:…}})`, `nodes{…}`, sin
  `*Aggregate` y sin `accountById`.
- `state_call` está marcado como inseguro en los nodos públicos: no se puede simular una
  transacción sin mandarla.

## 3. Enviar junas

`g1-cadena.js` → `enviar(cuenta, destino, centimos, comentario)`. Arma lo mismo que Ğecko
(`durt2`, `duniter_service.dart`):

```
utility.batchAll([
  universalDividend.claimUds(),        // solo si hay DU por cobrar
  balances.transferKeepAlive(destino, centimos),
  system.remarkWithEvent(comentario),  // solo si hay comentario (UTF-8)
])
```

`transferKeepAlive` impide dejar la cuenta por debajo del depósito existencial. El comentario
de una transferencia **es** un remark: el indexador lo une a la transferencia (`txComments`,
`transfersByCommentId`). Las primeras transacciones reales salieron antes del 15/11/2026.

## 4. Identidad y membresía

`g1-cadena.js` → `identidad()`, `confirmarIdentidad()`, `pedirMembresia()`. El estado se lee de
la cadena porque el indexador tarda en ver una identidad recién confirmada.

1. Un miembro crea la identidad (`identity.createIdentity`) y suele certificarla.
2. El dueño la confirma con un nombre (`identity.confirmIdentity`) en ~61 días, o se borra.
3. Junta 5 certificaciones en otros ~61 días.
4. Pide la evaluación de distancia (`distance.requestDistanceEvaluation`, reserva 10 Ğ1).

## 5. Ğ1 en la interfaz

- **Red Ğ1 en el selector**, debajo de las redes EVM. Activa el modo `body.red-g1` (flag
  `cw-red-g1-<0x>`), que desvía saldo, nombre de red, QR, enviar y recibir.
- **Escáner** (`leerQrG1`, con las reglas de Cesium²): acepta `g1…`, `june://` (lo que emite
  Ğecko), `g1://`, `duniter:key/` y claves v1 base58 con `:suma` opcional. Se prueba **último**
  en `handleScannedData`, así ningún otro QR baja el módulo. Abre `#g1EscaneoModal`: identidad,
  monto, comentario y «Abrir chat» si hay vínculo, o «Invitar a ChatWallet» si no.
- **Sello ✦ Ğ1** en la tarjeta del contacto: solo si el vínculo llegó comprobado. El alias sigue
  siendo el nombre que se muestra; el seudónimo Ğ1 lo respalda, nunca lo reemplaza.

## 6. El cruce con el chat: vínculo 0x ↔ g1

El chat (XMTP) necesita una 0x, y Ğ1 tiene una g1. El vínculo las une. Hay dos formas:

**Vínculo público `ius1:`** (spec `ius-spec/vinculo-g1.md`, Ius v0.10). Es un comentario de
transferencia Ğ1 con la firma EVM adentro: `ius1:<base64url(addr20‖sig65)>`, 119 caracteres.
Cualquier billetera Ğ1 puede mandarlo y cualquiera lo verifica con el indexador. Ojo: la `v` de
la firma tiene que ser 27/28 (ethers acepta 0/1 y eso da codificaciones distintas).

**Vínculo privado** (spec §11.3, v3.93). Viaja solo a los contactos, dentro del perfil firmado
del chat: `payload.g1 = { cuenta, evm, ed }`. Son dos firmas sobre el mismo mensaje: la de la 0x
y la ed25519 de la g1, esta envuelta en `<Bytes>…</Bytes>` como hacen las billeteras Polkadot,
para que no se confunda con la firma de una operación. No publica nada en la cadena. Se difunde
una vez por cuenta (`cw-g1-vinculo-difundido-<0x>`).

Con el vínculo, el menú «Activo» del envío desde el chat ofrece Ğ1, y aparecen las tarjetas
`[G1]` de pedido y pago, verificadas contra el historial del indexador. Las dos puntas necesitan
la v3.93 o posterior.

## 7. Ius Naturalis

Ius usa el mismo `ius/js/g1.js`. Muestra «Ser vivo · Ğ1» y «Consultar un ser vivo», y el
anclaje de documentos pasa a ser un remark en Ğ1 (reemplaza a Crust, que está muerto). El
vínculo público todavía está oculto tras `?vincular` hasta probarlo con una cuenta Ğ1 real.

## Datos guardados en el dispositivo

Solo direcciones y un secreto mínimo. La frase nunca se guarda para Ğ1.

| Clave de localStorage | Contenido |
|---|---|
| `cw-red-g1-<0x>` | Si la red elegida es Ğ1 |
| `cw-g1-candidatas-<0x>` | Las 31 direcciones candidatas |
| `cw-g1-cuenta-<0x>` | La g1 elegida |
| `cw-g1-raiz-<0x>` | Mini-secreto de la raíz: lo que firma |
| `cw-g1-vinculo-<0x>` | Vínculo privado ya firmado (caché) |
| `cw-g1-vinculo-difundido-<0x>` | Marca de que ya se mandó a los contactos |
| `cw-g1-verif-<de>-<a>-<bloque>-<monto>` | Caché de la verificación de una tarjeta `[G1]` |

## Pruebas

| Prueba | Qué cubre |
|---|---|
| `tests/g1-llave.mjs` | Derivación contra vectores de @polkadot/keyring |
| `tests/g1-cadena.mjs` | Firma @noble igual a Keyring byte a byte |
| `tests/g1-cadena-cdp.mjs` | Cadena real dentro de la página |
| `tests/g1-qr.mjs` | Formatos de QR Ğ1 |
| `tests/g1-vinculo-privado.mjs` | Las dos firmas del vínculo privado |
| `./tests/run-g1-red.sh` | Red Ğ1 en la interfaz (cadena simulada) |
| `./tests/run-g1-tarjeta.sh` | Sello en la tarjeta del DID |
| `./tests/run-g1-chat.sh` | Pagos Ğ1 por chat con dos XMTP reales |
| `ius-spec/g1.test.cjs`, `ius-spec/e2e-g1.mjs` | Vínculo `ius1:` y la página de Ius |

## Pendiente

- Confirmar que Ğecko muestra bien nuestros comentarios y la envoltura `<Bytes>`.
- Quitar la bandera `?vincular` de Ius cuando se pruebe con una cuenta real.
- Cuentas v1 sin frase: migrar con `change_owner_key`.
- Página `chatwallet.org/junas` con un instructivo, y presentar ChatWallet en el foro de Duniter
  y en las listas de billeteras Ğ1.
- Idea aparcada: papelitos de las juntas con QR firmado (`CWJ1`) y activación por sesión.
