# zk.money (Aztec Labs), relanzado el 29/9/2026

Fuentes:
- docs.zk.money completa, bajada el 4/10/2026 de `https://docs.zk.money/llms-full.txt`;
- L2BEAT Privacy: <https://l2beat.com/privacy/projects/zkmoney>;
- cobertura de prensa: CoinDesk y Unchained del 29/9/2026;
- capturas propias de launch.zk.money del 3/10/2026.

## Qué es
- **Billetera de pagos privados** sobre Aztec, una L2 de Ethereum con ejecución privada. Los fondos quedan en custodia en un "portal" (Oxide) sobre Ethereum.
- **Sólo DAI.** Acepta depósitos en USDC o USDT, pero los convierte a DAI vía Curve, sin precio mínimo.
- **Se entra sólo desde Ethereum mainnet.**
- **Cuenta = passkey + tag** (`bob.zk.money`). No hay frase semilla: perder la passkey es perder la billetera.

## Nombres (tags)
- Reclamar un tag cuesta **USD 4,90**, más 0,10 para el contrato que paga comisiones. Sale de un primer depósito de **al menos USD 15**.
- **Sale gratis** si fuiste usuario del zk.money anterior, o si **una persona** reclama su tag con tu link (referido).
- **Embudo observado** en launch.zk.money (captura del 3/10): reservás el nombre gratis y tenés **7 días** para concretarlo. Las opciones que muestra son "Share on X" (0 de 1 referido), "Verify" (usuario anterior) o "Buy your tag" (USD 15 = 5 por el tag + 10 de saldo).
- **Nombres reservados:** sólo se liberan si los pedís desde la cuenta de X con ese mismo handle.
- **On-chain**, el AccountRegistry guarda el hash del tag junto a la dirección Aztec, la dirección Ethereum y una clave pública. Quien conoce o adivina el tag puede leer esas direcciones.
- **Resolución ENS:** `zk.money` está importado en ENS (dueño `0x8c5EE3f9…`, resolvedor comodín `0x3e9BcF7c…`, verificado on-chain el 3/10). Para un pagador de afuera, el resolvedor (CCIP) **deriva una dirección de depósito nueva en cada consulta**. Según la doc, "Ethereum verifica la prueba de cada resolución". En la práctica, ninguno de los 15 nombres comunes que probamos con ethers v6 resolvió.

## Pagos
- **Entre usuarios:** monto, emisor, receptor y saldo quedan privados. La prueba se genera en el dispositivo y tarda **alrededor de 1 minuto**, según la doc.
- **Pedidos de pago por XMTP.** Al crear la cuenta se publica en Ethereum el vínculo con su dirección XMTP; no hay opción de apagarlo y es permanente.
- **Links de pago:** fondos en custodia en Aztec. El secreto va después del `#`, así que nunca llega a un servidor. Se reclaman en 1, 7 o 30 días y se pueden devolver. Hay una variante por email que usa una prueba ZK sobre el login de Google o Apple.
- **Direcciones de depósito de un solo uso**, derivadas de un secreto compartido.

## Costos y límites
- Depositar: **USD 0,35** (0,25 al relayer y 0,10 al contrato de comisiones). Retirar: **USD 0,20**.
- **100 transacciones gratis por día** adentro, mientras alcance el subsidio.
- **Menos de USD 2.500 por operación** (L2BEAT: 2.583 DAI). Los depósitos de todos los usuarios comparten un tope de **USD 50.000 por día**.
- Los topes están fijos en el portal. Subirlos exige un portal nuevo y que los usuarios migren.
- **Filtro de sanciones** (Predicate) sobre la dirección de depósito y la de retiro. Lo aplican la web y el relayer, no el contrato.

## Modelo de confianza
- **Cada envío y cada retiro necesita la co-firma de un enclave Oxide** (AWS Nitro). Cualquiera puede registrar un enclave si demuestra que corre la imagen aprobada, pero sigue siendo AWS. Según L2BEAT, **la imagen aprobada no fue reproducida**.
- **Sin un enclave registrado y funcionando, nadie sale**, ni siquiera por las vías de reembolso.
- Robar exige **dos fallas a la vez**: el sistema de pruebas y el enclave.
- Aztec Labs controla la administración de nombres: puede reemplazar el RegistrationController, lo que permite reasignar nombres.
- **El resolvedor ve** la IP del pagador, el tag, la dirección y el monto, y **puede re-derivar todas las direcciones de depósito**. L2BEAT lo resume como "privileged insider: link exposed".

## Escala (L2BEAT, 4/10/2026)
- TVL **USD 17,3 mil**, 762 depósitos, 743 de ellos en los últimos 7 días.
- 7 relayers activos.
- **El conjunto de anonimato es muy chico** durante el lanzamiento.

## Lectura para ChatWallet
- Valida el producto: nombre legible + link de pago + privacidad + XMTP.
- El precio del nombre (unos USD 5, gratis con un referido) es una referencia de mercado para `@nombre`.
- Su mayor costo es la dependencia de AWS y el ancla en mainnet + DAI. No encaja con una billetera centrada en Base.
