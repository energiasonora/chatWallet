// HUB: peer libp2p en Node que escucha por WebSockets y SOSTIENE la DB OrbitDB.
// Los browsers se conectan acá, abren la misma DB y replican en vivo a través suyo.
// (También ilustra el "pinning": este peer guarda los datos aunque los browsers cierren.)
//
// peerId determinístico (semilla fija) -> multiaddr estable entre reinicios.
import { writeFileSync } from 'node:fs'
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { generateKeyPairFromSeed } from '@libp2p/crypto/keys'
import { createOrbitDB, IPFSAccessController } from '@orbitdb/core'

const PORT = 9091
const privateKey = await generateKeyPairFromSeed('Ed25519', new Uint8Array(32).fill(7))

const libp2p = await createLibp2p({
  privateKey,
  addresses: { listen: [`/ip4/127.0.0.1/tcp/${PORT}/ws`] },
  transports: [webSockets()],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: { denyDialMultiaddr: () => false },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
  }
})
const ipfs = await createHelia({ libp2p })
const orbitdb = await createOrbitDB({ ipfs, directory: './hub-orbitdb' })
const db = await orbitdb.open('chatwallet-repl-demo', {
  type: 'events',
  AccessController: IPFSAccessController({ write: ['*'] })
})

// Semilla inicial para que el browser muestre algo apenas conecta
if ((await db.all()).length === 0) {
  await db.add('👋 mensaje inicial sembrado por el HUB')
}

const maddr = `/ip4/127.0.0.1/tcp/${PORT}/ws/p2p/${libp2p.peerId.toString()}`
writeFileSync(
  new URL('./src/hub-info.js', import.meta.url),
  `// AUTO-GENERADO por hub.mjs — no editar a mano\n` +
  `export const HUB_MADDR = ${JSON.stringify(maddr)}\n` +
  `export const DB_ADDRESS = ${JSON.stringify(db.address)}\n`
)

console.log('✅ HUB corriendo')
console.log('   multiaddr:', maddr)
console.log('   db:', db.address)
console.log('   (src/hub-info.js escrito para el browser)\n')

libp2p.addEventListener('peer:connect', (e) => console.log('[hub] peer conectado:', e.detail.toString().slice(0, 16) + '…'))
db.events.on('update', async (entry) => {
  console.log('[hub] ⟳ replicó entry:', JSON.stringify(entry?.payload?.value))
})

// mantener vivo
process.stdin.resume()
