// Nodo OrbitDB EN EL BROWSER. Se conecta al HUB por WebSockets, abre la misma DB
// y replica en vivo. Abrí esta página en DOS pestañas: lo que escribas en una
// aparece en la otra (a través del hub, sin servidor central de datos).
import { createHelia } from 'helia'
import { createLibp2p } from 'libp2p'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { identify } from '@libp2p/identify'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { multiaddr } from '@multiformats/multiaddr'
import { createOrbitDB } from '@orbitdb/core'
import { HUB_MADDR, DB_ADDRESS } from './hub-info.js'

const $ = (id) => document.getElementById(id)
const setStatus = (t, ok) => { const e = $('status'); e.textContent = t; e.className = ok ? 'ok' : 'wait' }
const log = (m) => console.log('[browser]', m)

function render(entries) {
  const box = $('messages')
  box.innerHTML = ''
  for (const e of entries) {
    const div = document.createElement('div')
    div.className = 'msg'
    div.textContent = e.value
    box.appendChild(div)
  }
  box.scrollTop = box.scrollHeight
}

async function main() {
  setStatus('Iniciando nodo en el browser…', false)

  const libp2p = await createLibp2p({
    transports: [webSockets({ filter: filters.all })],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    connectionGater: { denyDialMultiaddr: () => false },
    services: {
      identify: identify(),
      pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
    }
  })
  const ipfs = await createHelia({ libp2p })
  log('peerId ' + libp2p.peerId.toString().slice(0, 16))

  setStatus('Conectando al hub…', false)
  await libp2p.dial(multiaddr(HUB_MADDR))
  log('conectado al hub')

  // directorio único por pestaña -> identidades/stores independientes
  const dir = './odb-' + Math.random().toString(36).slice(2, 8)
  const orbitdb = await createOrbitDB({ ipfs, directory: dir })
  const db = await orbitdb.open(DB_ADDRESS)
  log('db abierta: ' + db.address)

  $('addr').textContent = db.address
  $('peer').textContent = libp2p.peerId.toString().slice(0, 24) + '…'
  setStatus('● Conectado y replicando', true)

  render(await db.all())
  db.events.on('update', async () => { render(await db.all()) })
  db.events.on('join', async () => { render(await db.all()) })

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const val = $('input').value.trim()
    if (!val) return
    $('input').value = ''
    await db.add(val)
    render(await db.all())
  })
}

main().catch((e) => {
  console.error(e)
  setStatus('❌ Error: ' + (e?.message || e), false)
})
