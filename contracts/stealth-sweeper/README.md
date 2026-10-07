# StealthSweeper

Gastar desde una dirección stealth ERC-5564 **sin gas propio**, con EIP-7702.

La llave de la dirección stealth hace dos cosas:
1. delega su código en este contrato, con una autorización 7702 que lleva el chainId de la red, nunca 0;
2. firma una orden EIP-712 `Barrido`.

Después **cualquier cuenta con gas** ejecuta `barrer(orden, firma)` sobre la propia dirección stealth: nuestro relayer, cualquier otro, o el mismo receptor del pago.

Diseño y motivos: [`../../investigacion/stealthpay/diseno-barrido-7702.md`](../../investigacion/stealthpay/diseno-barrido-7702.md).

## Dirección
`0x5fe1eCd65845E4172852547Cb4FA790d2084a92C`, la misma en toda red con el *deterministic deployer* (`0x4e59…956C`), salt `keccak256("stealthpay.barrido.v1")`.
- Para que sea la misma en todas partes, `foundry.toml` fija solc 0.8.30, `bytecode_hash = "none"` y sin metadata CBOR. **Cambiar el compilador o el optimizador cambia la dirección.**
- Estado: **todavía no está desplegado en ninguna red.**

## Orden EIP-712
Dominio: `{ name: "StealthPay Barrido", version: "1", chainId, verifyingContract: <la dirección stealth> }`.

```
Barrido(address token,address destino,uint256 monto,address relayer,uint256 comision,uint256 nonce,uint256 vence,address llamada,bytes32 datosHash)
```
- **`token`:** `0x0` es el nativo.
- **`relayer`:** `0x0` significa que transmite y cobra cualquiera. Si es una dirección, sólo ella. Para que el gas lo pague el receptor, se pone `relayer = destino` y `comision = 0`.
- **`llamada` y `datos`:** con `llamada ≠ 0`, se aprueba `monto` exacto, se ejecuta `datos` y la aprobación vuelve a 0. Sirve para hacer shield o depositar en otro contrato. `datosHash` es `keccak256(datos)`.
- **Firma:** 65 bytes, `s` bajo y `v` en {27, 28}.

## Reglas para quien transmite
- **Verificar la delegación antes de mandar.** Una dirección sin delegar es una EOA común: llamarla "funciona" sin mover nada (`test_sin_delegar_la_llamada_no_hace_nada`).
  - Hay que mirar que el código sea `0xef0100‖sweeper`, o mandar la autorización en la misma transacción tipo 4.
  - Después, confirmar el evento `Barrido_`.
- **Simular antes de mandar:** `eth_estimateGas` con `authorizationList` funciona en los RPC públicos de Base y Ethereum.

## Gas medido (fork de Base, USDC real, 7/10/2026)
| | gas |
|---|---|
| primer barrido de USDC con comisión, autorización incluida | 142.948 |
| barrido de USDC siguiente, sin comisión, lo transmite el receptor | 84.935 |
| barrido de ETH con comisión, ya delegada | 111.421 |
| despliegue (una vez por red) | 931.972 |

## Probar
```bash
forge test                                   # 30 tests (Prague, cheatcodes 7702), con fuzz
anvil --fork-url https://mainnet.base.org --hardfork prague --port 8547 &
node e2e/fork-base.mjs                       # 17 chequeos: tx tipo 4 real, USDC real, firma con ethers
RPC=<url> node script/desplegar.mjs          # dice la dirección y si ya existe
RPC=<url> CLAVE=<0x…> node script/desplegar.mjs   # despliega
```
Hace falta Foundry ≥ 1.0 (`~/.foundry/bin`). La de `~/.cargo/bin` es de 2024 y no conoce 7702.
