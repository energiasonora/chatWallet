# Tacit / anon.wei en un teléfono de 2018 (7/10/2026)

El documento de Tacit sobre sus pruebas (`DEVICE-PROOFS.md`, en ERC8244/dapps) admite: *"No real phone was used, and no real iOS Safari or Chrome on Android"*. Sus cifras de teléfono salen de un modelo. **Esta es la medición en un teléfono real.**

## Qué se midió
El circuito **`transact`** del pool EVM de Tacit:
- Groth16 sobre BN254, 2 notas de entrada y 2 de salida;
- 44.414 restricciones, árbol Poseidon de profundidad 32.

Una sola prueba cubre el envío privado, el retiro o la combinación de notas. No hay prueba de inocencia aparte.

- **Artefactos:** los oficiales de `https://tacit.finance/evm-pool/` (`transact_final.zkey`, `transact.wasm` y `transact_vk.json`).
  - El zkey coincide con el SHA-256 de `contracts/deployments/evm-pool.json` (`40758061…4c4b`).
  - El wasm tiene SHA-256 `02dd5e84…a6c1`.
- **Entradas válidas, armadas a mano** (`gen-tacit.mjs`) según `circuito/transact.circom`:
  - dos notas reales en las hojas 0 y 1, cada una con su clave EdDSA y su firma sobre `M`;
  - nullifiers `Poseidon(nk, leaf, index)`;
  - pertenencia en un árbol de profundidad 32;
  - inserción de las dos salidas en `startIndex = 2`;
  - balance de 0,7 + 0,3 = 0,85 + 0,15 ETH.

  El `asset` es el `ASSET_FIELD()` real del pool en Base.
- **Doble verificación:**
  - contra la vkey oficial: **válida en todas las corridas**;
  - contra el **verificador desplegado** `0x000000b1c0e84CEc8AdF8278B90c4d6400DfB153`, por `eth_call` en Base (`verificar-en-cadena.mjs`): `true`. El control negativo, con `root + 1`, da `false`.
- **Prover:** snarkjs 0.7.6 en WASM, en Chrome; es el mismo banco que Railgun (`../railgun/bench.html`, variante `TACIT_2x2`). La página de anon.wei usa **su propio prover** (WASM propio más Pippenger en hasta 6 workers), que **no se midió**. Su tiempo en el teléfono puede ser distinto.
- **Equipos:**
  - S9 (SM-G960F, Exynos 9810, 2018, Android 10, Chrome 154), enchufado. La batería marcó 37,8–38,4 °C;
  - Mac (Apple Silicon), con Chrome 155 headless y con Node 22.

## Resultados
| | S9 | Mac Chrome | Mac Node |
|---|---|---|---|
| prueba `transact` 2x2 | **47,3 s** (mediana de 6: 45,8 · 46,0 · 46,6 · 48,0 · 60,2 · 61,6) | 3,6–3,9 s | 3,5–3,8 s |
| artefactos | 28,6 + 4,9 = **33,5 MB** sin comprimir | | |
| pico de heap | no reportable (Android cuantiza `performance.memory`) | 222 MB | |

- Las dos corridas de unos 61 s fueron la tercera de la primera tanda y la primera de la segunda. Encajan con calentamiento térmico y con la compilación en frío.
- **Relación S9/Mac: alrededor de 12–13×,** contra las 9–10× de Railgun. Encaja con un zkey más grande en un teléfono de 4 GB.

## En contexto (mismo S9, mismo prover)
| Envío privado | Pruebas | Tiempo en el S9 | Descarga la primera vez |
|---|---|---|---|
| Privacy Pools (retiro) | 1 | **6 s** | 19,5 MB |
| Railgun, pagar con 1 nota | 01x02 + POI 3x3 | ≈ 34 s | 13,3 MB |
| **Tacit / anon.wei, cualquier envío** | **transact 2x2** | **≈ 47 s** | **33,5 MB** (≈ 90 s en 4G rápido, ≈ 270 s en 4G flojo)* |
| Railgun, consolidar 8 | 08x02 + POI 13x13 | ≥ 41 s + POI | ≥ 15,9 MB |

\* Velocidades de la medición de Privacy Pools (unos 3 y 1 Mbit/s); es una extrapolación.

**Lectura:**
- El circuito de Tacit tiene casi el tamaño del 08x02 de Railgun (42,8k variables): eso cuesta su árbol de profundidad 32 y las dos firmas EdDSA. Cuesta parecido: 47 contra 41 s.
- Railgun, en cambio, escala con las entradas. Tacit paga siempre el máximo, aunque se gaste una sola nota.
- En un teléfono de gama media de 2018, **cada pago privado en anon.wei demora casi un minuto**, y el primero, además, baja 33 MB.

## Reproducir
```bash
cd investigacion/wppt2026/mediciones/railgun && npm i       # circomlibjs y snarkjs
mkdir -p art/TACIT_2x2 && cd art/TACIT_2x2
curl -o zkey https://tacit.finance/evm-pool/transact_final.zkey && shasum -a 256 zkey   # 40758061…
curl -o wasm https://tacit.finance/evm-pool/transact.wasm
curl -o vkey.json https://tacit.finance/evm-pool/transact_vk.json
cd ../../../tacit && node gen-tacit.mjs && node verificar-en-cadena.mjs
cd ../railgun && node prove.mjs TACIT_2x2
node medir-s9.mjs mac TACIT_2x2 3
adb connect 192.168.1.43:5555 && node medir-s9.mjs 192.168.1.43:5555 TACIT_2x2 3
```
Resultados crudos: `../railgun/resultados/s9-2026-10-07T0931.json`, `s9-2026-10-07T0934.json` y `mac-2026-10-07T0932.json`.
