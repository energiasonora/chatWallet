// Identity provider de OrbitDB que usa una wallet Ethereum (secp256k1).
//
// El `id` de la identidad ES la dirección Ethereum del usuario. Eso es justo
// lo que pide el proyecto: "la dirección de Ethereum actúa como la llave admin".
// A partir de esa address se deriva un DID interoperable con otras dapps EVM:
//   did:pkh:eip155:<chainId>:<address>
//
// Cómo encadena las firmas OrbitDB (igual que @orbitdb/identity-provider-ethereum):
//   - OrbitDB genera internamente un par de claves (keystore) para firmar los
//     ENTRIES del log. `publicKey` es esa clave pública del keystore.
//   - `signatures.id`        = firma del keystore sobre el id (la address).
//   - `signatures.publicKey` = firma de la WALLET ETHEREUM sobre (publicKey + signatures.id).
//   Verificar = recuperar el firmante de esa última firma y comprobar que == address.
//
// Resultado: cada entry queda ligado criptográficamente a una address Ethereum,
// verificable por cualquiera sin servidores (auto-certificante / walkaway-friendly).

import { verifyMessage } from 'ethers'

const type = 'ethereum'

const EthereumIdentityProvider = ({ wallet } = {}) => {
  if (!wallet) throw new Error('EthereumIdentityProvider requiere { wallet } (ethers.Wallet o Signer)')

  // id = address Ethereum del usuario
  const getId = async () => (await wallet.getAddress())

  // La wallet firma el bundle (publicKey del keystore + firma del id)
  const signIdentity = async (data) => wallet.signMessage(data)

  const provider = () => ({ type, getId, signIdentity })
  provider.type = type
  return provider
}

// Verificación estática: ¿esta identidad fue realmente firmada por su address?
EthereumIdentityProvider.verifyIdentity = async (identity) => {
  const { id, publicKey, signatures } = identity
  try {
    const recovered = verifyMessage(publicKey + signatures.id, signatures.publicKey)
    return recovered.toLowerCase() === id.toLowerCase()
  } catch {
    return false
  }
}

EthereumIdentityProvider.type = type

// Helper: DID interoperable derivado de la address (did:pkh, EIP-155).
export const addressToDidPkh = (address, chainId = 1) =>
  `did:pkh:eip155:${chainId}:${address}`

export default EthereumIdentityProvider
