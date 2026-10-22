// Medición: cuánto tarda una billetera completa de Monero (monero-ts, WASM) en ponerse al día
// contra un nodo remoto, según cuántos bloques estuvo sin abrirse. Billetera nueva al azar:
// no tiene fondos, pero escanear cuesta lo mismo (hay que mirar cada salida con la llave de lectura).
//
//   node medir-node.mjs [bloques...]      (720 ≈ 1 día, 5040 ≈ 1 semana)

import moneroTs from 'monero-ts';

const NODO = process.env.NODO || 'https://xmr-node.cakewallet.com:18081';
const tramos = process.argv.slice(2).map(Number).filter(Boolean);
if (!tramos.length) tramos.push(720, 5040);

const mb = () => (process.memoryUsage().rss / 1048576).toFixed(0) + ' MB';
const daemon = await moneroTs.connectToDaemonRpc(NODO);
const alto = await daemon.getHeight();
console.log(`nodo ${NODO} · altura ${alto}`);

for (const n of tramos) {
    // Llave al azar (una billetera nueva sin red) y después la billetera de verdad desde esa llave.
    const azar = await moneroTs.createWalletFull({ networkType: moneroTs.MoneroNetworkType.MAINNET, password: 'x' });
    const llave = await azar.getPrivateSpendKey(); await azar.close();
    const t0 = Date.now();
    const w = await moneroTs.createWalletFull({
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        password: 'medicion',
        server: { uri: NODO },
        privateSpendKey: llave,
        restoreHeight: alto - n,
    });
    const tCrear = Date.now() - t0;
    const t1 = Date.now();
    let ultimo = 0;
    await w.sync(new class extends moneroTs.MoneroWalletListener {
        async onSyncProgress(h, start, end, pct) {
            if (Date.now() - ultimo > 5000) { ultimo = Date.now(); console.log(`   ${(pct * 100).toFixed(0)}% · ${mb()}`); }
        }
    });
    const seg = (Date.now() - t1) / 1000;
    console.log(`${n} bloques (${(n / 720).toFixed(1)} días): crear ${tCrear} ms · sincronizar ${seg.toFixed(1)} s · ${(n / seg).toFixed(0)} bloques/s · memoria ${mb()}`);
    console.log(`   dirección ${(await w.getPrimaryAddress()).slice(0, 12)}… · saldo ${await w.getBalance()}`);
    await w.close();
}
process.exit(0);
