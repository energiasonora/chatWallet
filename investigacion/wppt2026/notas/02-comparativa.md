# Pools blindados desplegados: zk.money, Privacy Pools y Railgun

Datos del panel de privacidad de L2BEAT, consultado el 4/10/2026:
- <https://l2beat.com/privacy>
- <https://l2beat.com/privacy/projects/zkmoney>
- <https://l2beat.com/privacy/projects/privacy-pools>
- <https://l2beat.com/privacy/projects/railgun>

Donde dice "medido", el dato es nuestro.

| | zk.money | Privacy Pools (0xbow) | Railgun |
|---|---|---|---|
| Diseño | ledger blindado (Aztec) | pool con conjuntos de asociación | ledger blindado UTXO |
| Redes | Ethereum (portal) | sólo Ethereum | Ethereum y Base. **En Base está desplegado pero vacío**: 1 solo shield de 0,25 USDC en 46 días (medido) |
| Activos | DAI | 14 (USDC, USDT, ETH, WBTC…) | WETH, USDT, USDC, DAI, WBTC… |
| TVL | USD 17,3 mil | USD 9,43 M | USD 112 M, **casi todo en Ethereum**; en Base ≈ USD 0,25 (medido 6/10/2026) |
| Conjunto de anonimato | sólo usuarios de zk.money, en lanzamiento | **6 a 83 depositantes** por activo en ventanas de 7–30 días | el más grande; volumen privado acumulado USD 5.160 M (6/2026) |
| ¿Se gasta adentro? | sí | **no**: entrar y salir | sí (transferencias `0zk`) |
| Comisiones | 0,35 al entrar y 0,20 al salir; tag 5 | 0–0,5% al entrar; relayer hasta 5–10% | **0,25% al entrar y 0,25% al salir**, más el broadcaster |
| Quién paga el gas | contrato subsidiado (100 tx/día) | relayer, u opcionalmente uno mismo | broadcaster, cobra en el token |
| Trusted setup | verde (176 participantes) | amarillo (80 en fase 1, 513–514 en fase 2) | amarillo (55 en fase 1, 304 en fase 2) |
| Actualizaciones | portal inmutable; Aztec Labs controla los nombres | multisig 2/4 | **DAO** del token RAIL, con 7 días de aviso |
| Ventana de salida | "infinita", pero **exige un enclave AWS vivo** | infinita: *ragequit* público | 7 días ante una actualización |
| Tercero que puede romper la privacidad | resolvedor y enclave | el ASP puede excluir un depósito y forzar una salida pública | los nodos de prueba de inocencia (PPoI) |
| Riesgo post-cuántico | vínculo expuesto | — | emisor, receptor y monto expuestos (*harvest now, decrypt later*) |
| Prueba en el teléfono | ~1 min (según su doc) | **6 s en el S9** (medido 4/9/2026) | **11,5–41 s** de JoinSplit **+ 22,5 s de POI en el S9** (medido 5/10/2026) |
| Artefactos (comprimidos) | — | 19,5 MB | 4,4–15,9 MB por circuito, más 8,9 MB del POI 3x3 |

## Lectura
- **Para el agujero de StealthPay (gastar y juntar), Privacy Pools no sirve:** sólo corta el vínculo entre la entrada y la salida. Sirve si el patrón es "recibo, salgo una vez".
- **Railgun en Base existe en el papel.** El proxy está desplegado desde el 20/8/2026 y las vkeys se cargaron el 31/8. Pero en 46 días hubo **un único Shield, de 0,25 USDC** (8/9/2026; 0,249375 netos tras el 0,25%), y **cero Transact y cero Unshield**. El SDK 11.2.0 todavía no puede cargar Base, porque `loadProvider` exige un relayAdapt que Base no tiene, y shared-models no trae configuración de POI para Base. **Hoy el conjunto de anonimato de Railgun en Base es de un depósito.**
- **Fragmentación entre redes:** la multitud está donde el gas es caro (Ethereum) y los usuarios con montos chicos están donde el gas es barato (Base). Un pool en la red barata no protege a nadie hasta que se llena. Este es un hallazgo publicable.
- **zk.money tiene la mejor experiencia** (nombres, links, XMTP), pero depende de AWS, de mainnet y de DAI, y hoy tiene un conjunto de anonimato casi nulo.
- **Ninguno resuelve la salida a un comercio.** El retiro sigue mostrando monto y destino. Lo que se gana es que no se ve el saldo ni el historial.

## Sin verificar todavía
- Si en Base hay broadcasters de Railgun en línea, y si la prueba de inocencia es obligatoria allí. shared-models 8.2.1 **no trae `poi.launchBlock` para Base**, y su comentario dice que `loadProvider` del SDK todavía exige un relayAdapt que Base no tiene: *"Base is 7702-only… Reaching Base also needs wallet's loadProvider to accept a network without one"*.
- Actividad en Base: **medida**, ver `mediciones/railgun/resultados/base-actividad-2026-10-06.json` (Blockscout, verificado por eventos y por transferencias de tokens).
