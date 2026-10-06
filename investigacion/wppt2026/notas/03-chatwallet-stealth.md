# StealthPay en ChatWallet: qué está hecho y dónde se filtra el vínculo

Revisado contra `src/dapp.html` el 5/10/2026, con ChatWallet en v3.61. El protocolo está publicado en <https://github.com/energiasonora/stealthpay>, con spec, referencia y vectores.

## Lo implementado
| Pieza | Dónde | Detalle |
|---|---|---|
| Llaves | `derivarLlavesStealth` | se derivan de la wallet firmando el mensaje fijo `ChatWallet StealthPay v1 — Key Derivation`. **La semilla recupera todo** |
| Envío | `anunciarStealth` | ERC-5564 esquema 1 (secp256k1 con *view tag*) contra el **Announcer canónico** `0x55649E01…5564`. Son **dos transacciones**, porque el Announcer rechaza ether: primero el valor, después el anuncio. Los anuncios pendientes se reintentan |
| Aviso por chat | `enviarAvisoStealth` (cw:3) | acelera la detección entre usuarios de ChatWallet. **No sustituye al anuncio on-chain**: se decidió que recuperar los fondos dependa de la semilla, no del historial de chat |
| Escáner | `escanearPagosStealth` (commit e21ca49, 3/9/2026) | lee los `Announcement`, descarta por *view tag* antes de la suma de puntos (que es lo caro), avanza hacia adelante desde un checkpoint y rellena hacia atrás entre sesiones. 40 tramos de 9000 bloques ≈ 8 días en Base |
| Saldo StealthWallet | `saldosStealth` | Multicall3 en una sola llamada |
| Pagar desde stealth | `seleccionarMonedas` + `ejecutarPagoDesdeStealth` (90f4aa8) | *coin selection*: siempre **la moneda más chica que alcance sola**, y sólo junta cuando no hay alternativa. Avisa cuántas direcciones va a unir antes de confirmar |
| USDC sin gas | `pagarTokenDesdeStealth` (7c7427c) | **ERC-3009** `transferWithAuthorization`: dos autorizaciones firmadas (pago y comisión) que el relayer transmite en una sola transacción |
| Relayer | `relay.chatwallet.org` (caja propia) | cobra en el mismo token. **Su libro no guarda direcciones ni hashes**: anotarlos lo volvería la base de vinculación que la stealth evita |
| Estado visible | `STEALTH_ENABLED = false` | **todo lo de arriba existe, pero la pestaña sigue oculta.** El comentario que lo justifica ("falta el escáner") quedó viejo |

## Dónde se filtra el vínculo
1. **Consolidar.** Ethereum no tiene transacciones con varias entradas: juntar N monedas son N transferencias al mismo destino en el mismo minuto, y eso las agrupa para siempre. El código lo atenúa con la selección de monedas, pero no lo resuelve. **Este es el agujero central.**
2. **El gas.** Una dirección stealth con USDC no tiene ETH. Si se lo manda la billetera principal, quedan vinculadas. **Resuelto** con ERC-3009 más el relayer. El costo: el relayer ve el par (dirección stealth, destino) en el momento, aunque no lo anota.
3. **El destino.** Pagar desde una stealth a alguien que te conoce, o a tu propia wallet principal, revela el vínculo. Esto lo resuelve el comportamiento del usuario o un pool.
4. **El emisor y el monto son públicos.** La stealth sólo oculta *quién recibe*.
5. **Los metadatos.** El RPC que consulta los saldos de todas tus direcciones stealth puede agruparlas, igual que el nodo Aztec en zk.money.

## Composición propuesta
```
pagador ─► dirección stealth (Base) ─► shield a Railgun (Base) ─► transferencias 0zk ─► unshield sólo para pagar afuera
            oculta al receptor          público: "una dirección     consolidar y gastar     público: monto y destino;
                                        anónima ingresó X"          sin vínculo             oculto: saldo e historial
```
- El *shield* no lleva prueba ZK, es un depósito público. Pero una stealth con USDC y sin ETH no puede pagar el gas del shield. Hay que ver si un broadcaster o el patrón 7702 de Railgun en Base lo permiten, o si hace falta una autorización ERC-3009 hacia el shield.
- Cada moneda stealth se convierte en una nota. Consolidar **3 notas** es un JoinSplit 3x2: **20,5 s en el S9**, más 22,5 s de la prueba de inocencia (POI) si la exige el broadcaster.
- **Bloqueante medido (6/10/2026):** Railgun en Base tiene **un solo depósito en su historia** (0,25 USDC). Componer ahí hoy no da anonimato: tu shield sería el segundo. Las alternativas son esperar a que se llene, usar Railgun en Ethereum (gas caro y un cruce público de Base a Ethereum) o un pool propio de la comunidad, que arrancaría con el mismo problema.

## Nombres (`@nombre`), en diseño, sin decidir
- `chatwallet.org/@nombre` ya abre el chat (v3.59) y resuelve `.eth`.
- Opción para que pagadores de afuera reciban **una dirección nueva por pago**: un resolvedor CCIP que la derive de una clave pública extendida del receptor (BIP32 no endurecida). No requiere anuncios on-chain y la semilla la recupera con un escaneo con límite de huecos. Rota sólo cuando la dirección actual recibe fondos, así el spam no rompe la recuperación.
- **El costo es el mismo que en zk.money:** el operador del resolvedor puede vincular todas esas direcciones. Entre usuarios de ChatWallet se sigue usando ERC-5564, que el resolvedor no ve.
