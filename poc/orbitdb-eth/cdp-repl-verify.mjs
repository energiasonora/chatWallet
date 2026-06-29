// Verifica la replicación en el browser vía CDP: abre la página, espera a que
// conecte al hub, lee los mensajes replicados y luego ESCRIBE uno desde el browser
// (que debería propagarse al hub -> ver /tmp/hub.log).
const PORT = process.argv[2] || '9222'
const URL = process.argv[3] || 'http://localhost:1236/'

const t = await (await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(URL)}`, { method: 'PUT' })).json()
const ws = new WebSocket(t.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const cmd = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })

ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
})

const evalJS = async (expr) => (await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value

await new Promise((r) => ws.addEventListener('open', r))
await cmd('Runtime.enable')
await cmd('Page.enable')
await cmd('Page.navigate', { url: URL })

// esperar status OK
let status = ''
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  status = await evalJS(`document.getElementById('status')?.textContent || ''`)
  if (status.includes('Conectado')) break
}
console.log('status:', status)

const before = await evalJS(`[...document.querySelectorAll('.msg')].map(d=>d.textContent)`)
console.log('mensajes replicados desde el hub:', JSON.stringify(before))

// escribir desde el browser
const STAMP = 'desde-browser-' + Date.now()
await evalJS(`(()=>{const i=document.getElementById('input');i.value=${JSON.stringify(STAMP)};document.getElementById('form').dispatchEvent(new Event('submit',{cancelable:true}));return true})()`)
await new Promise((r) => setTimeout(r, 3000))
const after = await evalJS(`[...document.querySelectorAll('.msg')].map(d=>d.textContent)`)
console.log('mensajes tras escribir:', JSON.stringify(after))

const ok = status.includes('Conectado') && before.length > 0 && after.includes(STAMP)
console.log('\nSTAMP escrito:', STAMP)
console.log(ok ? '✅ BROWSER OK (conectó, replicó del hub y escribió)' : '❌ algo falló')
process.exit(ok ? 0 : 1)
