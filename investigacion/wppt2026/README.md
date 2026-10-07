# WPPT 2026: privacidad de pagos en ChatWallet

Esta carpeta junta la investigación y las mediciones para presentar en el **1st Workshop on Privacy-Preserving Technologies** (WPPT 2026), afiliado a Asiacrypt 2026.

## La convocatoria
Verificada el 5/10/2026 en <https://privacypreserving.tech/call>.

| | |
|---|---|
| Resumen (abstract) | **domingo 11/10/2026, 23:59:59 AoE** (UTC−12) |
| Aviso de aceptación | 25/10/2026 |
| Workshop | 7–11/12/2026, Hong Kong Polytechnic University. **Si aceptan, al menos un autor tiene que presentar en persona.** |
| Formato | PDF de **hasta 3 páginas** sin contar referencias, más material opcional (slides, paper, borrador) |
| Envío | HotCRP: <https://hotcrp.ethereum.foundation/> |
| Datos que pide | título; nombre, afiliación y email de cada autor; quién presenta y una bio corta; estado de publicación |
| Revisión | simple ciego: los revisores ven los nombres de los autores |
| Actas | no hay; presentar ahí no impide publicar en otro lado |
| Organizan | Shyam Sridhar y Chengru Zhang, de la Ethereum Foundation |

Temas que encajan, tal como figuran en la convocatoria:
- *Private transfers, stealth addresses*
- *Secure key management and wallet-level privacy*
- *On-chain privacy with accountability, auditability, and compliance*
- *Implementation, optimization, and deployment of privacy-preserving systems*
- *Empirical measurement of deployed privacy protocols*
- *Trusted execution environments*

**Política de IA de Asiacrypt** (<https://asiacrypt.iacr.org/2026/aipolicy.php>):
- Corregir estilo con IA no hace falta declararlo.
- Si la IA generó contenido sustancial, hay que declararlo en los agradecimientos.
- Si generó secciones enteras, va un apéndice con herramientas, versiones y prompts.
- La IA no puede figurar como autora, y los autores responden por todo.

Como este borrador y las mediciones se armaron con Claude, **hay que declararlo** en los agradecimientos o en un apéndice.

## Tesis candidata
> **Recibir en privado es fácil; gastar en privado es lo caro.** En una billetera desplegada con direcciones stealth (ERC-5564), cada pago llega a una dirección nueva, pero al juntar monedas para pagar se reconstruye el vínculo que la stealth había ocultado. Cerrar ese agujero exige un pool blindado. Medimos en un teléfono de 2018 cuánto cuesta cada opción desplegada hoy en Ethereum y Base, y en qué tercero confía cada una.

Los aportes posibles:
1. **Caracterizar el problema en un sistema real.** ChatWallet ya implementa StealthPay v1 completo: escáner, pago desde direcciones stealth, selección de monedas y relayer ERC-3009. Ahí se ve dónde se filtra el vínculo: al consolidar, al pagar el gas y en el destino.
2. **Una composición concreta, y su bloqueo real:** stealth en Base, después un pool blindado, después la salida. **Medido:** Railgun está desplegado en Base desde el 20/8/2026, pero tiene **un único depósito de 0,25 USDC** y ninguna transacción privada. La multitud está en Ethereum, donde el gas es caro, y la gente con montos chicos en Base. Es **fragmentación del conjunto de anonimato entre redes**.
3. **Mediciones en el S9** (Exynos 9810, 2018, Android 10, Chrome 154): ver [mediciones/railgun/RESULTADOS.md](mediciones/railgun/RESULTADOS.md). Railgun cuesta entre 34 y 63 s por envío privado si se suma la prueba de inocencia. Privacy Pools tarda 6 s.
4. **Comparar los modelos de confianza** con los datos de L2BEAT:
   - zk.money depende de un TEE (AWS Nitro);
   - Privacy Pools, de un ASP y un multisig 2 de 4;
   - Railgun, de una DAO con 7 días de aviso.
5. **Nombres legibles y privacidad.** `bob.zk.money` da una dirección nueva por resolución, pero el resolvedor puede re-derivarlas todas (L2BEAT: "privileged insider: link exposed"). Es el mismo dilema que tendría `@nombre` en ChatWallet.

## Contenido
- `notas/01-zkmoney.md`: zk.money relanzado (29/9/2026), leído de su documentación completa.
- `notas/02-comparativa.md`: zk.money, Privacy Pools y Railgun con los números de L2BEAT.
- `notas/03-chatwallet-stealth.md`: estado real de StealthPay en ChatWallet y dónde se filtra el vínculo.
- `notas/04-privacy-pools-s9.md`: la medición del 4/9/2026.
- `notas/05-tacit-anonwei.md`: anon.wei / pool EVM de Tacit (3/10/2026). *Receive boxes* (lo que le falta a StealthPay) y actividad medida: el volumen es ida y vuelta por puntos, con 1,5 ETH de saldo y 14 pagos privados en Base.
- `mediciones/tacit/`: actividad del pool de Tacit en Ethereum y Base (`actividad-tacit.mjs`), y su circuito `transact` medido en el S9 (`RESULTADOS.md`: 47,3 s; 3,6 s en la Mac).
- `mediciones/railgun/`: el banco reproducible (pruebas Groth16 reales en Mac y en el S9, más la actividad en Base).
- `abstract/`: el borrador del resumen de 3 páginas (pendiente).
