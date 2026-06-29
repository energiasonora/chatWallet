// Config mínima de libp2p para browser (WebSockets + WebRTC + circuit relay).
// Necesaria para que OrbitDB pueda replicar peer-a-peer en el navegador.
// Para la prueba de bundling/local no hace falta networking vivo, pero incluirla
// aquí refleja el COSTO REAL de bundle (es el grueso del peso de libp2p).

import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { identify } from '@libp2p/identify'
import { webSockets } from '@libp2p/websockets'
import * as filters from '@libp2p/websockets/filters'
import { webRTC } from '@libp2p/webrtc'
import { circuitRelayTransport } from '@libp2p/circuit-relay-v2'

export const Libp2pBrowserOptions = {
  addresses: { listen: ['/webrtc'] },
  transports: [
    webSockets({ filter: filters.all }),
    webRTC(),
    circuitRelayTransport({ discoverRelays: 1 })
  ],
  connectionEncrypters: [noise()],
  streamMuxers: [yamux()],
  connectionGater: { denyDialMultiaddr: () => false },
  services: {
    identify: identify(),
    pubsub: gossipsub({ allowPublishToZeroTopicPeers: true })
  }
}
