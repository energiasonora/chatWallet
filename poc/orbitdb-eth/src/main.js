// POC end-to-end:
//   wallet Ethereum -> identidad OrbitDB (id = address, DID did:pkh)
//   -> Helia (IPFS) -> OrbitDB log gateado por un access controller on-chain.
//
// Demuestra la tesis: datos soberanos, firmados por la address, con permisos
// dictados por un contrato. Por defecto corre OFFLINE (allowlist en memoria);
// poné rpcUrl + contractAddress para validar contra un contrato real.

import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'
import {
  createOrbitDB,
  Identities,
  KeyStore,
  useIdentityProvider,
  useAccessController
} from '@orbitdb/core'
import { Wallet } from 'ethers'

import EthereumIdentityProvider, { addressToDidPkh } from './eth-identity-provider.js'
import OnChainAccessController from './onchain-access-controller.js'
import { Libp2pBrowserOptions } from './libp2p-browser.js'

const log = (msg) => {
  console.log(msg)
  const el = document.getElementById('log')
  if (el) el.textContent += msg + '\n'
}

async function main() {
  log('▶ Arrancando POC OrbitDB + identidad Ethereum...')

  // 1) Wallet (en producción: la wallet del usuario que ya manejás en dapp.html)
  const wallet = Wallet.createRandom()
  const did = addressToDidPkh(wallet.address, 1)
  log('✓ Address: ' + wallet.address)
  log('✓ DID interoperable: ' + did)

  // 2) Helia (IPFS) con persistencia en IndexedDB -> sobrevive al "walkaway"
  const blockstore = new IDBBlockstore('poc-blocks')
  const datastore = new IDBDatastore('poc-data')
  await blockstore.open()
  await datastore.open()
  const libp2p = await createLibp2p(Libp2pBrowserOptions)
  const ipfs = await createHelia({ libp2p, blockstore, datastore })
  log('✓ Helia/IPFS iniciado (peerId ' + ipfs.libp2p.peerId.toString().slice(0, 12) + '…)')

  // 3) Identidad OrbitDB derivada de la wallet (id == address)
  useIdentityProvider(EthereumIdentityProvider)
  const keystore = await KeyStore()
  const identities = await Identities({ ipfs, keystore })
  const identity = await identities.createIdentity({
    provider: EthereumIdentityProvider({ wallet })
  })
  log('✓ Identidad OrbitDB creada. id = ' + identity.id)
  log('  ¿identidad válida (firmada por la address)? ' +
    (await identities.verifyIdentity(identity)))

  // 4) Access controller gateado por contrato.
  //    OFFLINE: allowlist en memoria con nuestra propia address.
  //    ON-CHAIN: pasá rpcUrl + contractAddress (function isWriter(address)).
  useAccessController(OnChainAccessController)
  const AccessController = OnChainAccessController({
    // rpcUrl: 'https://...',
    // contractAddress: '0x...',
    fallbackAllowlist: [wallet.address]
  })

  // 5) OrbitDB + abrir un log gateado
  const orbitdb = await createOrbitDB({ ipfs, identities, identity, directory: './orbitdb-poc' })
  const db = await orbitdb.open('poc-soberano', { type: 'events', AccessController })
  log('✓ DB abierta: ' + db.address)

  // 6) Escribir (debería PASAR: la address está permitida)
  const hash = await db.add('hola mundo soberano ' + Date.now())
  log('✓ Entry agregado (permitido por el AC): ' + hash.slice(0, 16) + '…')

  // 7) Leer de vuelta
  const all = await db.all()
  log('✓ Entries en el log: ' + all.length)
  all.forEach((e) => log('   • ' + e.value))

  log('✅ POC OK — identidad Ethereum + permisos por AC funcionando.')
}

main().catch((e) => {
  log('❌ ERROR: ' + (e?.stack || e?.message || e))
  console.error(e)
})
