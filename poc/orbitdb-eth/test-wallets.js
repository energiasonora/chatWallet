// Claves de prueba PÚBLICAS y conocidas de anvil (mnemónico por defecto).
// SOLO PARA TESTS LOCALES. Nunca usar en redes reales.
export const RPC_URL = 'http://127.0.0.1:8545'

// account[0] — despliega el contrato y es el owner/admin de la allowlist
export const DEPLOYER_PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

// account[1] — wallet AUTORIZADA on-chain (debe poder escribir)
export const WALLET_A_PK =
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'

// account[2] — wallet NO autorizada (el contrato la rechaza)
export const WALLET_B_PK =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
