// Driver CDP mínimo (sin playwright): conecta a un Chrome headless ya abierto
// con --remote-debugging-port, navega a la URL, captura console.* y al final
// lee el textContent de #log para confirmar que el POC corrió end-to-end.

const PORT = process.argv[2] || '9222'
const URL = process.argv[3] || 'http://localhost:8099/'

const http = await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })
  .catch(() => fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(URL)}`))
const target = await http.json()
const ws = new WebSocket(target.webSocketDebuggerUrl)

let id = 0
const send = (method, params = {}) => ws.send(JSON.stringify({ id: ++id, method, params }))

const logs = []
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')
    logs.push(text)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text))
  }
})

ws.addEventListener('open', async () => {
  send('Runtime.enable')
  send('Log.enable')
  send('Page.enable')
  send('Page.navigate', { url: URL })
})

// Esperar a que el POC termine (busca el marcador de éxito o error en consola)
const deadline = Date.now() + 45000
const poll = setInterval(() => {
  const joined = logs.join('\n')
  const done = joined.includes('✅ POC OK') || joined.includes('❌ ERROR')
  if (done || Date.now() > deadline) {
    clearInterval(poll)
    console.log('===== CONSOLE CAPTURADA =====')
    console.log(logs.join('\n'))
    console.log('===== FIN =====')
    process.exit(joined.includes('✅ POC OK') ? 0 : 1)
  }
}, 1000)
