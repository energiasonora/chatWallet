# anon.wei / Tacit EVM pool: qué es, cómo se compara y qué tomar (7/10/2026)

Lanzado el 3/10/2026 por z0r0z ([tweet](https://x.com/z0r0zzz/status/2106332725292732550)). anon.wei es la página de pagos privados del **pool EVM de Tacit**, servida desde un contrato (ERC-8244). Fuentes:
- `ERC8244/dapps` PR #3: `TACIT-PAY-8244.md` y `DEVICE-PROOFS.md`;
- `z0r0z/tacit`: `README.md`, `SPEC.md`, `docs/EVM-POOL.md` y `contracts/deployments/evm-pool.json`.

La actividad la medimos nosotros: `../mediciones/tacit/`.

## Qué es
- **Pool de ETH nativo** en Ethereum, Base, Robinhood Chain y MegaETH, con las mismas direcciones en todas. Es el pool `0x000000c2A20657CE25f2Ba99737933D031AFBEE9`.
- **Contratos inmutables:** sin owner, sin pausa, sin upgrade.
- **Sin ASP ni filtro de sanciones.** No hay lista de asociación como en Privacy Pools, ni *screening* como el Predicate de zk.money.
- **Circuito único `transact`:**
  - Groth16 sobre BN254, 2 notas de entrada y 2 de salida;
  - 44.414 restricciones, árbol Poseidon de profundidad 32;
  - artefactos de 33 MB (zkey 28,5 + wasm 4,9);
  - ceremonia pública de 176 contribuciones, sellada con el bloque 968840 de Bitcoin.
- **Prover propio en la página**, sin snarkjs porque es GPL: WASM generado en el tab y Pippenger repartido en hasta 6 workers.
  - Cada prueba se verifica con `eth_call` contra el verificador antes de enviarla.
  - Memoria de 260 a 320 MB en el pico.
- **Claves:** salen de firmar con la wallet un mensaje fijo de identidad, el mismo para todas las apps Tacit. Una dirección `tacit1…` o `bp1…` recibe en el pool de Bitcoin y en el de EVM.
- **Relayer (keeper)** opcional:
  - comisión ligada a la prueba, con tope por cadena verificado antes de firmar;
  - siempre existe la alternativa de mandar la transacción desde la propia wallet.
- **Nombres `.wei`:** los resuelve el registro WNS (`0x0000000000696760e15f265e828db644a0c242eb`), además de `.eth`.
  - La dirección de pago va en el *text record* `finance.tacit`.
  - Antes de pagar, el nombre se vuelve a leer, y se exige que dos nodos coincidan.
- **Links de pago:** todo va después del `#`, así que el gateway no se entera de a quién se paga.

## La pieza que nos falta: *receive boxes*
`receiveBoxOf(npk, feeBps)` es una **dirección contrafáctica (CREATE2)** ligada a una clave de nota del dueño.
- Cualquiera le manda ETH con una transferencia plana: wallet, exchange, lo que sea. Funciona porque la dirección no tiene código entre barridos.
- Cualquiera la barre al pool con `sweepReceive`, y el router calcula él mismo la nota del dueño. **El que barre sólo puede acreditarle al dueño** y se queda con a lo sumo `feeBps` (0,25%).
- Se deriva de la semilla, una por contraparte (`receiveKeys(i)`), y se recupera escaneando con un *gap limit*.
- **La caja no necesita gas:** el keeper barre cuando la comisión cubre el gas. El mínimo en Base ronda los 0,0017 ETH (unos US$4,6).

Es la composición que proponíamos en `03-chatwallet-stealth.md` (`stealth → shield → 0zk`), pero resuelta mejor:
- **Nuestro bloqueante era el gas del shield:** una stealth con USDC no tiene ETH para pagarlo. Acá ni hace falta, porque el contrato garantiza que el que barre no puede desviar los fondos.
- **El costo:** el `sweep` publica el `npk` de la caja, y los pagos a una misma caja quedan vinculados entre sí, como cualquier dirección reusada. Lo que sale del pool después ya no se vincula.

## Medición en la cadena (7/10/2026)
Pool más router, desde el bloque de despliegue. El primer evento es del 27/9/2026 en las dos cadenas.

| | Ethereum | Base |
|---|---|---|
| depósitos | 87 | 727 |
| depositantes distintos | 26 | 130 |
| los 2 que más depositan | 30 + 24 (62%) | 201 + 169 (51%) |
| ETH depositado / retirado | 52,7 / 51,6 | 123,6 / 122,1 |
| **saldo actual del pool** | **1,07 ETH** | **1,45 ETH** |
| **transferencias privadas** | **5** | **14** |
| barridos de *receive box* | 2 | 6 |
| retiros con un depósito de monto casi igual* | 53 de 75 (71%) | 711 de 715 (99%) |

\* Emparejamiento voraz por monto: depósito mayor o igual al retiro y diferencia ≤ máx(0,0002 ETH, 0,03%). No prueba que cada par sea el mismo usuario. Sí muestra que el monto no oculta nada.

**Lectura:**
- El volumen es casi todo **ida y vuelta**: depositar y retirar el mismo monto, en serie. En Base hay rachas de depósitos de 0,483… que bajan de a 0,00001, y bloques de 0,18 y de 0,48 exactos.
- Encaja con el **programa de puntos TAC**, que paga 1.000 puntos por ETH depositado en el pool EVM (README de Tacit, del 23/9 al 21/12/2026).
- **El conjunto de anonimato efectivo es el saldo:** alrededor de 1,5 ETH por cadena, con 14 y 5 pagos privados de verdad. Los "727 depósitos" no son 727 personas escondiéndose: es *wash volume* incentivado.
- Es el **mismo patrón que Railgun en Base** (un shield en total) y que zk.money (US$17k de TVL). **Tercer caso para la tesis del paper:** el conjunto de anonimato se fragmenta por cadena y por pool, y la métrica que se publicita (depósitos, "volumen") no lo mide.

## Comparación con StealthPay de ChatWallet
| | StealthPay (hoy) | Tacit / anon.wei |
|---|---|---|
| Qué oculta | quién recibe | quién paga a quién, y el monto dentro del pool |
| Consolidar / gastar | **se vincula** (N transferencias al mismo destino) | sin vínculo dentro del pool; la salida muestra monto y destino |
| Activos | ETH y USDC (ERC-3009 sin gas) | **sólo ETH** |
| Gas del receptor | relayer ERC-3009 propio | keeper que barre con comisión y relayer que paga en la prueba |
| Costo en el teléfono | ninguno, no hay ZK | Groth16 de 44k restricciones y 33 MB por bajar |
| Estándar | ERC-5564/6538, interoperable | formato propio (`tacit1…`, `bp1…`) |
| Confianza | ninguna adicional | ceremonia; auditorías mayormente hechas con IA (`audit/`) |
| Riesgo regulatorio | bajo (sólo direcciones nuevas) | **pool sin ASP ni filtro**: el perfil de Tornado |

## Qué tomar
1. **El patrón de *receive box* para StealthPay.** Una dirección contrafáctica por pago, que **cualquiera puede barrer pero sólo hacia el dueño**, resuelve el gas sin depender de nuestro relayer para custodiar nada.
   - Se puede hacer sin pool: una caja CREATE2 que sólo puede reenviar a una dirección fija (la stealth de destino o la nota). Para USDC, la caja haría `transfer` al barrer.
   - Con el pool de Tacit es directamente su `receiveBoxOf`, pero sólo para ETH.
2. **Links de pago con fragmento (`#`) en vez de query.** Hoy `?pay=1&…` y `?wc=1&…` viajan al servidor (Cloudflare ve a quién se paga). Pasarlos al fragmento cuesta poco y deja de filtrar metadatos.
3. **Endurecimiento de nombres:** volver a resolver el nombre justo antes de pagar, con dos RPC que coincidan, y no pagar si cambió. Nuestro `.eth` (v3.59) resuelve una sola vez y acepta el primer RPC que contesta.
4. **Resolver `.wei`:** el registro WNS es uno solo, y leer `addr` y *text records* es barato. Podemos publicar el meta-address stealth en un *text record* además del registro ERC-6538.
5. **Verificar la prueba con `eth_call` antes de enviarla** y fijar los artefactos por SHA-256 con varios espejos: aplica a cualquier pool que integremos.

## Dónde sinergizar
- **Ellos no midieron en un teléfono real** (`DEVICE-PROOFS.md`: "No real phone was used, and no real iOS Safari or Chrome on Android"; las cifras de teléfono son un modelo).
  - Nosotros tenemos el banco del S9 armado.
  - Medir su `transact` (44k restricciones, dominio 2¹⁶, como el 08x02 de Railgun, que en el S9 tarda **41 s**) les da el dato que les falta y le suma una fila al paper.
  - Las entradas válidas salen de su `evm-pool-wallet.js` (MIT). Es la vía natural para contactar a z0r0z.
- **Interop:** como cliente, ChatWallet podría derivar la clave Tacit con el mismo mensaje de identidad y pagar a `tacit1…` o a `.wei` desde el chat. Lo que nos frena:
  - es **sólo ETH**;
  - el conjunto de anonimato es chico (arriba);
  - es un pool **sin ASP**;
  - **ojo, phishing:** un mensaje de identidad fijo y compartido por todas las apps implica que cualquier sitio que logre que lo firmes obtiene tu clave Tacit completa. Nuestras llaves StealthPay se derivan dentro de la app y nunca se piden a una página externa. Hay que mantenerlo así.
