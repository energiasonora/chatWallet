// Access controller de OrbitDB cuyo permiso de escritura lo dicta un CONTRATO
// inteligente en una red EVM. Es la pieza central del requisito:
//   "El control de acceso está dictado por contratos inteligentes...
//    la dirección de Ethereum actúa como la llave de administrador."
//
// Por cada entry que alguien intenta agregar al log, `canAppend`:
//   1) resuelve la identidad del firmante (su address Ethereum),
//   2) verifica criptográficamente la cadena de firmas de la identidad,
//   3) pregunta AL CONTRATO si esa address puede escribir.
//
// Contrato esperado (mínimo): `function isWriter(address) view returns (bool)`.
// Podés apuntarlo a tu ChatSmartAccountFactory/allowlist o a un contrato de roles.
//
// Sin RPC/contrato configurado, cae a una allowlist en memoria (solo para correr
// el POC offline). El camino on-chain es real: solo necesita { rpcUrl, contractAddress }.

import { Contract, JsonRpcProvider } from 'ethers'

const type = 'onchain'

const ALLOWLIST_ABI = ['function isWriter(address account) view returns (bool)']

const OnChainAccessController =
  ({ rpcUrl, contractAddress, fallbackAllowlist = [] } = {}) =>
  async ({ orbitdb, identities, address } = {}) => {
    identities = identities || orbitdb?.identities

    // Resolver on-chain (cacheado por address para no martillar el RPC).
    const cache = new Map()
    let contract = null
    if (rpcUrl && contractAddress) {
      contract = new Contract(contractAddress, ALLOWLIST_ABI, new JsonRpcProvider(rpcUrl))
    }
    const allow = new Set(fallbackAllowlist.map((a) => a.toLowerCase()))

    const isWriterOnChain = async (addr) => {
      const key = addr.toLowerCase()
      if (cache.has(key)) return cache.get(key)
      let ok
      if (contract) {
        try {
          ok = await contract.isWriter(addr)
        } catch (e) {
          console.warn('[AC] fallo al consultar el contrato, denegando:', e.message)
          ok = false
        }
      } else {
        ok = allow.has(key) // modo offline del POC
      }
      cache.set(key, ok)
      return ok
    }

    const canAppend = async (entry) => {
      const writer = await identities.getIdentity(entry.identity)
      if (!writer) return false
      // 1) la identidad debe ser válida (firmada por su propia address)
      if (!(await identities.verifyIdentity(writer))) return false
      // 2) el contrato decide
      return isWriterOnChain(writer.id)
    }

    return {
      type,
      address: address || 'onchain',
      write: ['*'], // la decisión real la toma canAppend, no esta lista
      canAppend
    }
  }

OnChainAccessController.type = type

export default OnChainAccessController
