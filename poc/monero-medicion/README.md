# Medición: Monero (monero-ts, WASM) para ChatWallet

Paso 1 del plan de Monero: medir antes de tocar la app. Billetera completa en el
dispositivo (la llave de lectura nunca sale), contra un nodo remoto.

- `node medir-node.mjs 720 5040` — sincronizar 1 día / 1 semana en Node.
- `./build.sh` y servir `web/` → página que mide lo mismo en el navegador
  (`?n=720&nodo=https://…`). `node correr-chrome.mjs <url> [puertoCDP]` la corre
  en Chrome headless o en el Chrome del teléfono (adb forward).

## Resultados (22/10/2026, monero-ts 0.11.20 = monero v0.18.5.3)

| Dónde | 1 día (720 bloques) | 1 semana | Datos |
|---|---|---|---|
| Mac, Node, nodo Cake Wallet | 28 s (25 bloques/s) | 180 s | ~28 MB/día |
| Mac, Node, nodo sethforprivacy | 63 s (11 bloques/s) | — | |
| Mac, Chrome headless | 30 s (24 bloques/s) | — | |

- El cuello es la red (CPU 1–3 %), no el procesador.
- En el navegador NO hace falta crossOriginIsolated / SharedArrayBuffer.
- Nodos públicos con CORS (aceptan https://localhost de la APK): xmr-node.cakewallet.com:18081, node.sethforprivacy.com.
- Peso: pagina.js 4,3 MB (2,0 MB gz) + monero.worker.js 3,7 MB (2,1 MB gz). La página trae el WASM duplicado: se puede achicar.
- Bundle con esbuild: hace falta `assert` y shims de http/https con una clase `Agent` vacía (HttpClient siempre arma un agente).
- La caja (Celeron N2830, 3,7 GB, disco mecánico, 24 GB libres) no da para un nodo propio (~100 GB podado).
