# StealthPay: barrido de direcciones stealth con EIP-7702 (diseño, 7/10/2026)

**Estado:** fase 1 hecha el 7/10/2026 (`contracts/stealth-sweeper/`): 30 tests de Foundry y E2E en un fork de Base con USDC real. Todavía no está desplegado. El resto de este documento es la propuesta original. Toma dos antecedentes:
- la *receive box* de Tacit (`../wppt2026/notas/05-tacit-anonwei.md`);
- el diseño SA_eph de `~/xunserver/stealthpay-app` (marzo de 2026), donde la clave stealth es dueña de una LightAccount contrafáctica y el gas lo paga el paymaster de Alchemy.

## El problema que resuelve
Una dirección stealth con tokens y sin nativo no puede gastar. Hoy se resuelve con **ERC-3009** (`pagarTokenDesdeStealth`): dos autorizaciones firmadas que transmite **nuestro** relayer. Eso tiene tres límites:
1. **Sólo sirve para tokens con ERC-3009:** USDC y EURC. USDT, DAI y el resto no lo tienen, así que una stealth que los recibe queda trabada.
2. **Sólo transmite nuestro relayer:** las autorizaciones nombran su dirección como destino de la comisión. Si `relay.chatwallet.org` se cae, nadie puede mover los fondos sin vincularlos.
3. **El ETH paga su propio gas:** deja polvo en la stealth y obliga a calcular el gas antes de enviar.

## Por qué 7702 y no CREATE2 (SA_eph o la *receive box*)
Las tres opciones usan una dirección determinista que existe antes de tener código. La diferencia está en **quién paga y a qué dirección**:

| | SA_eph (4337, mar 2026) | *Receive box* (Tacit) | **Delegado 7702 (esta propuesta)** |
|---|---|---|---|
| A qué dirección paga el pagador | la cuenta contrafáctica, no la stealth ERC-5564 | la caja, no la stealth ERC-5564 | **la stealth ERC-5564 de siempre** |
| Pagadores de otras wallets ERC-5564 | no la encuentran | no la encuentran | **funciona igual** |
| Infraestructura | bundler + paymaster (Alchemy) | keeper | **cualquier cuenta con gas** |
| Destino | lo que firme la clave | **fijo, sin firma** | lo que firme la clave |
| Redes | las de 4337 | cualquiera | las que tienen Pectra (Base, Ethereum: **verificado**) |

La clave del diseño: **el pagador no cambia nada.** La stealth sigue siendo una EOA ERC-5564 común. Sólo al gastar, su llave firma una delegación 7702 hacia un contrato chico, inmutable y público. Ese contrato corre *como* la stealth y sólo obedece a una orden de barrido firmada por esa misma llave.

**Verificado en vivo (`probar-7702.mjs`):** en Base y en Ethereum, una dirección nueva sin fondos delega con una autorización firmada, y un tercero sin fondos simula la llamada con `authorizationList` en `eth_estimateGas` y en `eth_call`. Costo: 47.609 de gas, incluida la autorización. El relayer puede validar antes de enviar.

## Mecanismo
```
pagador ──(transferencia común)──► stealth S (EOA ERC-5564, sin nativo)
                                         │
     ChatWallet deriva la llave de S (como hoy) y firma DOS cosas:
       1. autorización 7702: "el código de S es StealthSweeper" (chainId fijo, nonce de S)
       2. orden EIP-712 Barrido{token, destino, monto, relayer, comision, nonce, vence, llamada, datosHash}
                                         │
cualquier cuenta con gas ──tx tipo 4 (authorizationList=[1])──► S.barrer(orden, firma)
                                         │  corre COMO S: verifica que firmó S, paga la comisión, manda el monto
                                         ▼
                                destino (o `llamada`: shield a un pool)
```
- **La primera vez** va la autorización. Las siguientes, si S ya tiene el código `0xef0100‖StealthSweeper`, sólo la orden.
- **El receptor puede pagar el gas:** con `relayer = destino` y `comision = 0`, la orden viaja al receptor (en ChatWallet, por el chat) y él la transmite. No interviene ningún tercero: nadie más que el receptor, que igual sabe que le pagan, ve el par (stealth, destino) antes de la cadena. **Ojo:** esto resuelve el canal del gas, no la consolidación. N stealth que le pagan al mismo destino siguen agrupadas, sea quien sea el que pague el gas.
- **`relayer`:** si es una dirección, sólo ella puede transmitir y cobrar. Si es `0x0`, **transmite y cobra cualquiera**: es el modo sin permiso, como el keeper de Tacit. Si nuestro relayer se cae, la orden se le puede dar a cualquier otro.
- **`llamada` y `datosHash`:** si están vacíos, transferencia simple. Si no, el contrato aprueba `monto` a `llamada`, ejecuta `datos` y vuelve la aprobación a cero. Es la puerta para hacer shield a un pool cuando haya uno con multitud (fase 4), sin cambiar el contrato.

## Contrato (boceto)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

/// Delegado EIP-7702 para direcciones stealth de StealthPay. Corre COMO la dirección stealth.
/// Sin owner, sin upgrade, sin admin. Su único estado son los nonces, en un slot ERC-7201
/// para que una delegación posterior a otro código no pise nada.
contract StealthSweeper {
    bytes32 private constant BARRIDO_TYPEHASH = keccak256(
        "Barrido(address token,address destino,uint256 monto,address relayer,uint256 comision,"
        "uint256 nonce,uint256 vence,address llamada,bytes32 datosHash)");
    // keccak256(abi.encode(uint256(keccak256("stealthpay.barrido.v1")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant SLOT = /* calculado en el deploy, fijo */ 0x0;

    struct Barrido {
        address token;      // address(0) = nativo
        address destino;
        uint256 monto;
        address relayer;    // address(0) = cualquiera
        uint256 comision;   // en `token`, para quien transmite
        uint256 nonce;
        uint256 vence;      // timestamp
        address llamada;    // address(0) = transferencia simple
        bytes   datos;
    }

    error Vencido(); error NonceUsado(); error RelayerAjeno(); error FirmaInvalida(); error FalloPago(); error FalloLlamada();
    event Barrido_(address indexed token, address indexed destino, uint256 monto, address cobrador, uint256 comision);

    receive() external payable {}   // la stealth puede seguir recibiendo nativo estando delegada

    function barrer(Barrido calldata b, bytes calldata firma) external {
        if (block.timestamp > b.vence) revert Vencido();
        if (b.relayer != address(0) && msg.sender != b.relayer) revert RelayerAjeno();
        if (_usado(b.nonce)) revert NonceUsado();
        // Dominio EIP-712: name "StealthPay Barrido", version "1", chainId, verifyingContract = address(this) = la stealth.
        if (_recuperar(_digest(b), firma) != address(this)) revert FirmaInvalida();
        _marcar(b.nonce);

        address cobrador = b.relayer == address(0) ? msg.sender : b.relayer;
        if (b.comision > 0) _pagar(b.token, cobrador, b.comision);
        if (b.llamada == address(0)) {
            _pagar(b.token, b.destino, b.monto);
        } else {
            // Shield/depósito: aprobar exacto, llamar, volver a cero. `datos` está firmado vía datosHash.
            if (b.token != address(0)) _aprobar(b.token, b.llamada, b.monto);
            (bool ok,) = b.llamada.call{value: b.token == address(0) ? b.monto : 0}(b.datos);
            if (!ok) revert FalloLlamada();
            if (b.token != address(0)) _aprobar(b.token, b.llamada, 0);
        }
        emit Barrido_(b.token, b.destino, b.monto, cobrador, b.comision);
    }
    // _pagar: transferencia segura (tolera tokens sin retorno, como USDT); nativo con call.
    // _recuperar: ECDSA con s bajo (rechaza firmas maleables). _digest: EIP-712 con datosHash = keccak256(b.datos).
}
```
- **Mismo contrato en todas las redes:** se despliega con CREATE2 desde el *deterministic deployer*, así la autorización apunta siempre a la misma dirección.
- **La autorización 7702 lleva el `chainId` de la red, nunca `0`.** Con `0` vale en todas las cadenas y otro podría reproducirla donde S tenga fondos.

## Cambios en ChatWallet (`src/dapp.html`)
- **`pagarTokenDesdeStealth`** pasa a elegir camino:
  - si la red tiene `BARRIDO_7702` en su configuración (Base y Ethereum de entrada), usa el barrido;
  - si no, y el token es USDC o EURC, ERC-3009 como hoy;
  - si no, avisa que esa moneda no se puede mover sin gas en esa red.
- **Nuevas:**
  - `firmarBarrido(priv, red, orden)`: EIP-712 con `verifyingContract` igual a la stealth;
  - `autorizacion7702SiFalta(priv, dir, red)`: lee `getCode(dir)`; si ya delega en el sweeper, no firma nada;
  - `w.authorize({ address: SWEEPER, nonce, chainId })` de ethers 6.16, que ya está en el repo.
- **ETH desde stealth** también por barrido. No queda polvo y no hace falta reservar gas: la comisión sale del mismo ETH.
- **`seleccionarMonedas` no cambia.** Juntar sigue vinculando (ver "Lo que NO resuelve"), y la regla de usar la moneda más chica que alcance sola sigue valiendo.
- **Recuperación:** no cambia nada. El contrato no guarda nada necesario para recuperar; las llaves salen de la semilla como siempre.

## Cambios en el relayer (`relay/relay-server.mjs`)
- **`POST /api/relay/barrido`** recibe `{ chainId, autorizacion?, orden, firma }`:
  1. Verifica: el token es de la lista con precio, la `comision` cubre el gas estimado más el margen, y `vence` está en el futuro.
  2. Simula con `eth_estimateGas`, con `authorizationList` si viene autorización. Ya verificamos que funciona en los RPC públicos.
  3. Manda la transacción tipo 4.
- **`/api/relay/info`** suma `sweeper` y `soporta7702` por red.
- **Pendiente de siempre:** el precio nativo→USD está hardcodeado (`NATIVE_USD`). Con más tokens que USDC, hace falta un oráculo o una lista de estables a 1 US$ antes de aceptar otros.

## Qué se ve en la cadena
| | ERC-3009 (hoy) | Barrido 7702 |
|---|---|---|
| quién envía la transacción | nuestro relayer, siempre | nuestro relayer **o cualquiera** |
| vínculo stealth ↔ billetera principal | no | no |
| vínculo entre monedas al juntar | **sí** | **sí** (igual) |
| destino y monto | públicos | públicos |
| marca "esto es una stealth de StealthPay" | sí: la dirección del relayer | sí: el código `0xef0100‖StealthSweeper` queda en la dirección |

La marca no revela de quién es la dirección, pero sí que pertenece al conjunto de usuarios de StealthPay, igual que hoy. Se puede quitar la delegación después de barrer (otra autorización hacia `0x0`, unos 25k de gas más), pero la transacción de barrido ya quedó a la vista. **No vale la pena.**

## Lo que NO resuelve (dicho claro)
**Juntar sigue vinculando.** El barrido resuelve el gas, la dependencia de nuestro relayer y los tokens sin ERC-3009. No resuelve la consolidación: N stealth que pagan a un mismo destino siguen quedando agrupadas, sea en N transacciones o en una.

Eso sólo lo rompe un pool, y por eso existe `llamada`: el día que haya un pool con multitud en la red (fase 4), cada stealth hace shield ahí por separado. Hoy no lo hay:
- Railgun en Base tiene 1 depósito;
- Tacit tiene unos 1,5 ETH y casi todo es ida y vuelta por puntos;
- Privacy Pools está sólo en Ethereum.

## Costo
- **Medido en el fork de Base:**
  - primer barrido de USDC con autorización: **142.948** de gas;
  - los siguientes: **84.935**;
  - ETH: **111.421**;
  - despliegue: 931.972, una vez por red.
- **Medido antes:** 47.609 de gas para la autorización más una llamada vacía.
- **Estimado:** un barrido de ERC-20 con comisión (dos transferencias, verificación ECDSA y nonce) ronda los 110–130k de gas la primera vez y unos 85–105k las siguientes. ERC-3009 con dos autorizaciones ronda los 100k.
- En Base son fracciones de centavo en cualquier caso. Hay que medirlo en un fork antes de fijar la comisión.

## Cómo se verifica
1. **Foundry, contrato aislado:**
   - firma válida e inválida; firma maleable (s alto);
   - nonce repetido; orden vencida;
   - `relayer` fijo contra un tercero, y `relayer = 0` donde cobra quien llama;
   - nativo; token sin retorno (tipo USDT);
   - `llamada` que revierte, y aprobación que vuelve a 0.
2. **Fork de Base con anvil en hardfork Prague:** con USDC real, una stealth generada como en `llaveDePagoStealth`, autorización, barrido y saldos finales. Repetir con USDT y con ETH.
3. **E2E en Chrome (CDP)** contra el fork, con el relayer local: el camino completo desde la UI, siguiendo el patrón de `tests/`.
4. **Revisión del contrato antes de mainnet.** Es chico a propósito: si tiene un error, toda stealth delegada queda expuesta.

## Fases
| Fase | Qué | Tamaño |
|---|---|---|
| 1 | `StealthSweeper` + tests de Foundry + deploy en Base Sepolia | chico |
| 2 | endpoint del relayer + camino en `dapp.html` detrás de `BARRIDO_7702` + E2E en fork | mediano |
| 3 | deploy determinista en Base y Ethereum + agregarlo a la spec pública de StealthPay (`energiasonora/stealthpay`) como "§ Gastar sin gas" | chico |
| 4 | `llamada` → shield, cuando un pool tenga multitud en la red (revisar con `actividad-base.mjs` y `actividad-tacit.mjs`) | depende del pool |
| 5 | *receive box* sin firma (estilo Tacit) para pagadores **sin** ERC-5564: exchanges y el `@nombre` del resolvedor CCIP | va con la decisión de diseño de `@nombre` |

## Para decidir
1. **Modo sin permiso (`relayer = 0`) en la interfaz:** ¿se ofrece siempre, o sólo como salida de emergencia cuando el relayer no contesta?
2. **¿Quitar la delegación después de barrer?** La recomendación es que no (arriba).
3. **Tokens de la primera versión:** la recomendación es USDC, USDT y ETH en Base; el resto, cuando haya un precio confiable.
4. **¿Se activa `STEALTH_ENABLED` con esto, o antes, con ERC-3009 sólo para USDC?**
