# Railgun en un teléfono de 2018: costo de gastar en privado

**Medido el 5/10/2026.** Los JSON crudos están en `resultados/`.

## Qué se midió
El **JoinSplit** de Railgun, el circuito que gasta notas privadas: N notas de entrada → 2 salidas (pago + vuelto). Además, el circuito de **prueba de inocencia (POI)** que el SDK genera junto a cada transacción privada.

- **Artefactos:** los oficiales, del IPFS que usa `@railgun-community/wallet` 11.2.0 (`QmUsmnK4…` y, para POI, `QmZ2MyM6…`). Se verificaron contra el sha256 que trae el propio SDK (`hashes-sdk.json`): **todos coinciden.**
- **Entradas válidas, armadas a mano** (`gen.mjs`) siguiendo `circuito/joinsplit.circom` de `Railgun-Privacy/circuits-v2`:
  - firma EdDSA-Poseidon sobre el hash de las señales públicas;
  - nullifiers `Poseidon(nk, índice)`;
  - commitments `Poseidon(Poseidon(mpk, r), token, valor)`;
  - prueba de pertenencia en un árbol de profundidad 16;
  - balance entre entradas y salidas.

  El token es USDC de Base. **Cada prueba se verificó contra la vkey oficial: todas válidas.**
- **POI:** el circuito desplegado no coincide con el repo público (`chainwayxyz/railgun-proof-of-innocence-circuits`, que tiene otras señales), así que no se armaron entradas válidas. Se midió **sólo `groth16.prove` con un testigo sintético** del largo correcto (`testigo-sintetico.mjs`). Calibración en el mismo S9, sintético contra real: 01x02 da **11,3 s contra 11,5 s**, y 08x02 **40,1 s contra 41,0 s**. El error es menor al 3%, y el sintético no incluye el cálculo del testigo.
- **Equipos:**
  - S9 (SM-G960F, Exynos 9810, 2018, Android 10, Chrome 154, 7 núcleos visibles, `deviceMemory` 4), enchufado y con 100% de batería;
  - Mac (Apple Silicon), con Chrome 154 headless y con Node 22.
- **Prover:** snarkjs 0.7.6 en WASM, en el navegador. Es el camino que usaría la PWA o el WebView del APK. Railgun también ofrece un prover nativo (`.dat`, rapidsnark) que acá no se midió.

## Resultados (mediana de 3 corridas; la primera en frío)
| Circuito | Uso | Artefactos comprimidos (zkey + wasm) | S9 | Mac Chrome | Mac Node |
|---|---|---|---|---|---|
| JoinSplit 01x02 | pagar con 1 nota | 3,53 + 0,89 = **4,4 MB** | **11,5 s** (13,0 en frío) | 1,25–1,49 s | 1,59 s |
| JoinSplit 02x02 | juntar 2 | 4,75 + 0,90 = 5,7 MB | **14,7 s** | — | 1,84 s |
| JoinSplit 03x02 | juntar 3 monedas stealth | 6,98 + 0,91 = 7,9 MB | **20,6 s** | — | 1,98 s |
| JoinSplit 08x02 | consolidar 8 | 14,99 + 0,95 = **15,9 MB** | **41,1 s** | 4,1–4,6 s | 3,73 s |
| POI 3x3 (sintético) | inocencia, hasta 3 entradas | 7,95 + 0,92 = 8,9 MB | **22,5 s** | — | 2,50 s |
| POI 13x13 | inocencia, de 4 a 13 entradas | — | **no medido** | — | — |

Tamaño del circuito (cabecera del zkey):
- 01x02: 10.190 variables, dominio 2¹⁴;
- 08x02: 42.797 variables, dominio 2¹⁶;
- POI 3x3: 22.002 variables, dominio 2¹⁵.

## Lo que cuesta un envío privado en el S9
| Operación | Pruebas | Tiempo de prueba | Descarga la primera vez (4G rápido / flojo)* |
|---|---|---|---|
| Pagar con 1 nota | 01x02 + POI 3x3 | **≈ 34 s** | 13,3 MB → ≈ 35 s / 107 s |
| Juntar 3 monedas stealth y pagar | 03x02 + POI 3x3 | **≈ 43 s** | 16,8 MB → ≈ 44 s / 135 s |
| Consolidar 8 | 08x02 + POI 13x13 | **≥ 41 s + POI 13x13** | ≥ 15,9 MB |

\* Las velocidades salen de la medición de Privacy Pools (19,5 MB: 51 s en 4G rápido y 157 s en flojo, o sea unos 3 y 1 Mbit/s). Es una extrapolación, no una medición de esta corrida.

## Actividad de Railgun en Base (6/10/2026, `actividad-base.mjs`)
| Fecha | Qué pasó |
|---|---|
| 20/8/2026 | despliegue: Initialized, Ownership, Treasury, Fee y la mayoría de las vkeys |
| 31/8/2026 | resto de las vkeys (182 `VerifyingKeySet` en total) |
| 8/9/2026 | **el único Shield**: 0,25 USDC, de los que entran 0,249375 tras el 0,25% |
| hasta el 6/10 | **0 Transact, 0 Unshield**; el relayAdapt7702 no tiene ningún evento |

Verificado por dos vías en Blockscout: logs del proxy y transferencias de tokens hacia el proxy, donde aparece una sola. **El conjunto de anonimato en Base es de un depósito.**

## Comparación
- **Privacy Pools**, retiro en el mismo S9: 6 s (`../../notas/04-privacy-pools-s9.md`).
- **El JoinSplit 01x02 de Railgun tarda casi el doble, y con POI casi 6 veces más.**
- **La relación S9/Mac ronda 9–10×** en todos los circuitos.

## Limitaciones
- **Heap:** en Android, `performance.memory` sin `--enable-precise-memory-info` sale cuantizado (marcó 10 MB). **No se reporta.**
- **Temperatura:** las tres corridas por circuito son consecutivas. La primera, en frío, es más lenta (13,0 contra 11,5 s), lo que sugiere el costo de compilar el WASM o calentar la JIT, no limitación térmica.
- **Ni sync ni red:** no se midió la sincronización del árbol de notas ni el trabajo de los broadcasters. En Base, el árbol es trivial porque tiene un solo depósito.
- **Ni prover nativo ni WebView del APK:** no se midió el prover nativo de Railgun ni el WebView del APK.

## Reproducir
```bash
cd investigacion/wppt2026/mediciones/railgun
npm i && ./bajar-artefactos.sh            # baja y verifica hashes (POI: ver más abajo)
for v in 01x02 02x02 03x02 08x02; do node gen.mjs $v; done
node prove.mjs 01x02 02x02 03x02 08x02    # Node en la Mac
node medir-s9.mjs mac                     # Chrome headless en la Mac
adb connect 192.168.1.43:5555             # S9 por Wi-Fi
node medir-s9.mjs 192.168.1.43:5555 01x02,02x02,03x02,08x02 3
node testigo-sintetico.mjs 01x02 08x02 POI_3x3
node medir-s9.mjs 192.168.1.43:5555 none 3 01x02,08x02,POI_3x3
node actividad-base.mjs 30                # eventos de Railgun en Base
```
POI 3x3: `circuits/03x03/zkey.br`, `prover/snarkjs/03x03.wasm.br` y `circuits/03x03/vkey.json`, bajo `QmZ2MyM6TKxffkv6stuo2hFwmUfs3q4xgMYN164Sje8new`.
