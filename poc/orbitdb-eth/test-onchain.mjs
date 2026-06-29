// Test del caso negativo: "los permisos los dicta el contrato".
// Reusa TAL CUAL el identity-provider y el access-controller del POC (agnósticos
// del entorno). Corre en Node con Helia (sin browser → sin CORS).
//
// Cada wallet tiene su PROPIO nodo (como en la vida real: máquinas distintas).
// Espera: wallet A (autorizada on-chain) escribe ✅ ; wallet B (no autorizada) es
// rechazada por el access controller ❌ — la decisión viene del contrato.
import { readFileSync } from 'node:fs'
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import {
  createOrbitDB, Identities,
  useIdentityProvider, useAccessController
} from '@orbitdb/core'
import { Wallet } from 'ethers'

import EthereumIdentityProvider from './src/eth-identity-provider.js'
import OnChainAccessController from './src/onchain-access-controller.js'
import { WALLET_A_PK, WALLET_B_PK } from './test-wallets.js'

const { rpcUrl, contractAddress } = JSON.parse(readFileSync(new URL('./deployed.json', import.meta.url)))
console.log('Contrato:', contractAddress, '@', rpcUrl, '\n')

useIdentityProvider(EthereumIdentityProvider)
useAccessController(OnChainAccessController)
const AccessController = OnChainAccessController({ rpcUrl, contractAddress })

// Un nodo OrbitDB independiente por wallet (libp2p propio → sin colisión de protocolos)
async function makeNode(wallet, dir) {
  const libp2p = await createLibp2p({
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
    }
  })
  const ipfs = await createHelia({ libp2p })
  const identities = await Identities({ ipfs, path: `${dir}/identities` })
  const identity = await identities.createIdentity({ provider: EthereumIdentityProvider({ wallet }) })
  const orbitdb = await createOrbitDB({ ipfs, identities, identity, directory: dir })
  return { ipfs, orbitdb }
}

let pass = 0, fail = 0

// --- Wallet A: autorizada → debe ESCRIBIR ---
const A = await makeNode(new Wallet(WALLET_A_PK), './odb-A')
const dbA = await A.orbitdb.open('neg-test', { type: 'events', AccessController })
try {
  await dbA.add('mensaje de A (autorizada)')
  const n = (await dbA.all()).length
  console.log(`✅ Wallet A (${A.orbitdb.identity.id.slice(0,12)}…) ESCRIBIÓ — entries: ${n}  [esperado: permitir]`)
  pass++
} catch (e) {
  console.log(`❌ Wallet A fue rechazada (NO esperado): ${e.message}`)
  fail++
}

// --- Wallet B: NO autorizada → el contrato/AC debe RECHAZAR ---
// (la decisión del AC es por identidad del firmante, no por la DB; B usa su propia
//  DB con el MISMO access controller para no requerir replicación de red entre nodos)
const B = await makeNode(new Wallet(WALLET_B_PK), './odb-B')
const dbB = await B.orbitdb.open('neg-test-b', { type: 'events', AccessController })
try {
  await dbB.add('mensaje de B (NO autorizada)')
  console.log(`❌ Wallet B (${B.orbitdb.identity.id.slice(0,12)}…) ESCRIBIÓ — NO esperado (el contrato debía rechazar)`)
  fail++
} catch (e) {
  console.log(`✅ Wallet B (${B.orbitdb.identity.id.slice(0,12)}…) RECHAZADA por el AC/contrato  [esperado]`)
  console.log(`   motivo: ${e.message}`)
  pass++
}

console.log(`\n${fail === 0 ? '✅ TEST OK' : '❌ TEST FALLÓ'} — ${pass} pasaron, ${fail} fallaron`)
await A.orbitdb.stop(); await B.orbitdb.stop()
await A.ipfs.stop(); await B.ipfs.stop()
process.exit(fail === 0 ? 0 : 1)
