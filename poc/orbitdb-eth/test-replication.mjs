// Test de replicación cross-node: prueba que la DB es DESCENTRALIZADA.
// Dos nodos OrbitDB independientes (libp2p propio, conectados por TCP). A escribe;
// B recibe la entrada peer-a-peer, SIN servidor central. Esa es la base del
// "walkaway test": el dato vive en la red de peers, no en un backend.
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { createOrbitDB, IPFSAccessController } from '@orbitdb/core'

async function makeNode(dir) {
  const libp2p = await createLibp2p({
    addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
    transports: [tcp()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
    }
  })
  const ipfs = await createHelia({ libp2p })
  const orbitdb = await createOrbitDB({ ipfs, directory: dir })
  return { ipfs, orbitdb }
}

const A = await makeNode('./repl-A')
const B = await makeNode('./repl-B')
console.log('Nodo A:', A.orbitdb.ipfs.libp2p.peerId.toString().slice(0, 16) + '…')
console.log('Nodo B:', B.orbitdb.ipfs.libp2p.peerId.toString().slice(0, 16) + '…')

// B se conecta a A por TCP
const addrA = A.ipfs.libp2p.getMultiaddrs()[0]
await B.ipfs.libp2p.dial(addrA)
console.log('✓ B conectado a A vía', addrA.toString())

// A crea la DB y escribe (write: ['*'] para que cualquiera replique/escriba en el POC)
const dbA = await A.orbitdb.open('repl-test', {
  type: 'events',
  AccessController: IPFSAccessController({ write: ['*'] })
})
await dbA.add('hola desde A — ' + Date.now())
console.log('✓ A escribió. Address:', dbA.address)

// B abre la MISMA address y espera replicar
const dbB = await B.orbitdb.open(dbA.address)
const got = await new Promise((resolve) => {
  let done = false
  const finish = async () => {
    if (done) return
    const all = await dbB.all()
    if (all.length > 0) { done = true; resolve(all) }
  }
  dbB.events.on('update', finish)
  dbB.events.on('join', finish)
  const iv = setInterval(finish, 500)
  setTimeout(() => { clearInterval(iv); if (!done) resolve([]) }, 20000)
})

if (got.length > 0) {
  console.log(`\n✅ REPLICACIÓN OK — B recibió ${got.length} entry(s) de A, peer-a-peer:`)
  got.forEach((e) => console.log('   • ' + e.value))
} else {
  console.log('\n❌ REPLICACIÓN FALLÓ — B no recibió la entrada de A en 20s')
}

await A.orbitdb.stop(); await B.orbitdb.stop()
await A.ipfs.stop(); await B.ipfs.stop()
process.exit(got.length > 0 ? 0 : 1)
