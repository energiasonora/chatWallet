// Medición en el navegador: la misma billetera WASM, contra un nodo remoto con CORS.
import moneroTs from 'monero-ts';
const q = new URLSearchParams(location.search);
const NODO = q.get('nodo') || 'https://xmr-node.cakewallet.com:18081';
const N = Number(q.get('n') || 720);
const log = (m) => { console.log(m); document.getElementById('log').textContent += m + '\n'; };
const heap = () => performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB heap' : '';
window.resultado = null;
(async () => {
  try {
    log(`aislado: ${self.crossOriginIsolated} · SharedArrayBuffer: ${typeof SharedArrayBuffer !== 'undefined'}`);
    moneroTs.LibraryUtils.setWorkerDistPath(new URL('monero.worker.js', location.href).href);
    const tL = performance.now();
    const daemon = await moneroTs.connectToDaemonRpc({ uri: NODO, proxyToWorker: false });
    const alto = await daemon.getHeight();
    log(`nodo ${NODO} · altura ${alto}`);
    const azar = await moneroTs.createWalletFull({ networkType: 'mainnet', password: 'x' });
    const llave = await azar.getPrivateSpendKey(); await azar.close();
    const cargar = performance.now() - tL;
    log(`librería + llave: ${cargar.toFixed(0)} ms`);
    const t0 = performance.now();
    const w = await moneroTs.createWalletFull({ networkType: 'mainnet', password: 'x', server: { uri: NODO }, privateSpendKey: llave, restoreHeight: alto - N });
    const crear = performance.now() - t0;
    const t1 = performance.now(); let ult = 0;
    await w.sync(new class extends moneroTs.MoneroWalletListener {
      async onSyncProgress(h, s, e, pct) { if (performance.now() - ult > 5000) { ult = performance.now(); log(`  ${(pct * 100).toFixed(0)}% ${heap()}`); } }
    });
    const seg = (performance.now() - t1) / 1000;
    window.resultado = { n: N, cargarMs: Math.round(cargar), crearMs: Math.round(crear), seg: +seg.toFixed(1), bps: Math.round(N / seg), heap: heap(), ua: navigator.userAgent };
    log(JSON.stringify(window.resultado));
    await w.close();
  } catch (e) { window.resultado = { error: String(e?.message || e) }; log('ERROR ' + (e?.stack || e)); }
})();
