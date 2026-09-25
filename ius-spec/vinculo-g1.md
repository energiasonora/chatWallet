# Vínculo Ğ1 — norma `ius-naturalis/vinculo-g1/1`

**Estado:** borrador · 25/9/2026
**Para qué:** que una dirección EVM (`0x…`, la que ya usa Ius y ChatWallet) y una cuenta Ğ1 (`g1…`) se declaren **de la misma persona**, de forma que cualquiera pueda comprobarlo sin preguntarle a ningún servidor. Con el vínculo hecho, Ius puede mostrar el badge **"ser vivo · miembro Ğ1"** leyendo la red de confianza de la Ğ1.

Ius no mantiene una red de confianza propia. La humanidad se la certifica la Ğ1; Ius solo la **lee**.

---

## 1. Principio: el vínculo vive en la cadena Ğ1

Un vínculo son dos firmas, una de cada llave:

| Lado | Qué firma | Cómo |
|---|---|---|
| EVM | "mi cuenta Ğ1 es `g1…`" | `personal_sign` (EIP-191) — como ya firma Ius hoy |
| Ğ1 | "mi dirección EVM es `0x…`" **+ la firma EVM** | un **comentario de transferencia** (`System.remark_with_event`) |

La firma EVM **viaja dentro** del comentario Ğ1, así que el vínculo entero queda en un solo *remark* on-chain. Pasa la prueba de "¿y si Ius desaparece?": con cualquier nodo o indexador de Ğ1 se puede reconstruir y verificar.

**Por qué un comentario y no una firma de mensaje:** no todas las billeteras Ğ1 firman mensajes arbitrarios, pero **todas** mandan transferencias con comentario. Verificado en la red: Ğecko y Cesium² envían `Utility.batch_all(claim_uds, transfer_keep_alive, remark_with_event)`. El autor del *remark* es la cuenta que firma el lote, así que el comentario prueba que se controla la llave Ğ1. Con uso normal no hay comisión (el modelo de comisiones de Duniter v2 cobra solo por encima de un umbral de carga).

## 2. Mensaje EVM canónico

Texto **fijo** (no se traduce: el comentario no lleva idioma y la firma tiene que poder reconstruirse). Saltos de línea `\n`, sin espacios al final:

```
Ius Naturalis · vinculo Ğ1 · v1
EVM: <0x… en minúsculas>
G1: <dirección g1… tal cual, SS58 prefijo 4450>
```

Se firma con `personal_sign`. Resultado: firma `r‖s‖v` de 65 bytes (`v` ∈ {27,28}).

*No lleva fecha:* el momento lo pone el bloque Ğ1 donde queda el comentario, que es un reloj mejor que el del dispositivo.

## 3. Comentario Ğ1

```
ius1:<base64url( dirección EVM 20 bytes ‖ firma 65 bytes )>
```

- 85 bytes → 114 caracteres base64url sin relleno → **119 caracteres** en total. En la red hay comentarios de más de 140 caracteres, así que la cadena lo acepta.
- Se ve como texto ASCII normal en cualquier explorador.
- **`v` tiene que ser 27 o 28.** ethers también acepta 0/1 y recupera la misma dirección, así que sin esta regla un mismo vínculo tendría varias codificaciones. Una sola forma canónica; lo demás se descarta.
- **La transferencia puede ser a cualquier cuenta y de cualquier monto** (0,01 Ğ1 alcanza; puede ser a un amigo, o a uno mismo si la billetera lo permite). Al verificador no le importa el destinatario: solo el **autor** y el **texto** del comentario.

**Revocación:** comentario `ius1:rev` desde la cuenta Ğ1. Invalida todos los vínculos anteriores de esa cuenta.

## 4. Verificación (cualquiera, en el cliente)

Entrada: una dirección `g1…` **o** una `0x…`.

1. Buscar en el indexador los comentarios que empiecen con `ius1:`, filtrando por autor (`txComments.authorId`) o por contenido.
2. Tomar el **último** comentario válido del autor. Si es `ius1:rev`, no hay vínculo.
3. Decodificar: `addr` (20 bytes) y `sig` (65 bytes).
4. Reconstruir el mensaje §2 con `EVM = addr` y `G1 = authorId`. `ethers.verifyMessage(msg, sig)` tiene que devolver `addr`.
5. **Mutuo y último:** para una `0x`, vale solo el vínculo más reciente que la nombra; para una `g1`, solo el más reciente que emitió. **Una identidad Ğ1 queda atada a una sola `0x` a la vez.** Si no fuera así, un mismo humano podría "prestarle" su condición de vivo a muchas direcciones EVM.

Resultado: `{ evm, g1, bloque, hashExtrinsic }`.

## 5. Badge "ser vivo"

Con el vínculo verificado, se consulta la identidad (`identityByAccountId(g1)`):

| Campo | Se muestra |
|---|---|
| `isMember` | ✦ **Ser vivo · miembro Ğ1** (si es `false`: "cuenta Ğ1 vinculada", sin badge) |
| `name` | el seudónimo Ğ1 |
| `certReceived` (vigentes) | "N certificaciones" |
| `expireOn` | vencimiento de la membresía |

El badge **no se guarda**: se recalcula siempre desde la Ğ1. Si la persona deja de ser miembro, el badge se apaga solo.

**Cambio de llave Ğ1** (`change_owner_key`, posible una vez cada 6 meses): el vínculo ata la **cuenta**, no la identidad. Si la identidad pasa a otra cuenta, el badge se apaga en la `0x` vieja y hay que rehacer el vínculo desde la cuenta nueva. Es lo correcto: quien controla hoy la identidad es quien tiene que declararlo.

## 6. Confianza en el indexador

El indexador (squid) puede mentir o estar caído.
- **v1:** consultar al menos dos indexadores cuando haya, y mostrar `bloque` + `hashExtrinsic` para que cualquiera lo confirme en otro nodo.
- **Después:** verificar el extrinsic directo contra un nodo RPC (`chain_getBlock`) sin pasar por el indexador.

Endpoints probados el 25/9/2026: `https://squid.g1.brussels.ovh/v1/graphql` ✔. `g1-squid.axiom-team.fr` responde vacío y `g1.p2p.legal` da 502. Ius tiene que traer una **lista con respaldo**, no una URL fija.

## 7. Flujo en Ius

1. **Identidad** (paso actual): se conecta la `0x`.
2. **Vincular Ğ1:** la persona pega su dirección `g1…`. Ius valida el formato (base58 + prefijo 4450 + checksum blake2b) y muestra el seudónimo si existe la identidad.
3. Ius pide la firma EVM (§2) y **genera el comentario** (§3) con botón "Copiar".
4. La persona hace en Ğecko o Cesium² una transferencia mínima con ese comentario.
5. Ius consulta el indexador cada pocos segundos hasta verlo, verifica (§4) y muestra el badge (§5).

**En ChatWallet, más adelante:** la llave Ğ1 sale de la misma semilla, así que los pasos 2 a 4 los hace la app sola, sin copiar y pegar.

## 8. Qué habilita

- **Testigos en Ius:** una atestación puede exigir N testigos cuyo badge esté vigente.
- **Perfil `/<did>`:** muestra el badge leyendo la Ğ1, sin contrato propio para esta parte.
- **Anclaje:** el mismo mecanismo (un comentario `ius1:…` con el hash) sirve para sellar en el tiempo cualquier atestación. Reemplaza al anclaje de Crust, que está muerto.

## 9. Pendiente antes de implementar

- [ ] **Probar el largo del comentario en la interfaz de Ğecko y Cesium²** (la cadena acepta 119 caracteres; falta ver si los campos de la app los dejan escribir).
- [ ] Comprobar que base64url no se altera al pegarlo en esas apps.
- [x] blake2b propio en `ius/js/g1.js` para el checksum SS58 (probado contra OpenSSL).
- [ ] Prueba punta a punta con una cuenta Ğ1 real (el E2E actual usa identidades reales y comentarios simulados).

## 10. Pruebas

- `env -u NODE_OPTIONS node ius-spec/g1.test.cjs [--vivo]`: blake2b, SS58 con direcciones reales, base64url, reglas del vínculo (último, mutuo, revocación, copia desde otra cuenta). `--vivo` consulta además el indexador real.
- `ius-spec/e2e-g1.mjs`: Chrome headless por CDP contra `ius/` servido en `:8830` (`python3 -m http.server 8830 --directory ius`), con wallet falsa y comentarios simulados; identidades contra la red real.
