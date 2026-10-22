// En el hilo principal no se carga el WASM de Monero: todo pasa por el worker (proxyToWorker),
// que trae su propia copia. Así la página no baja 2 MB repetidos.
module.exports = function () { throw new Error('cw-monero: el WASM sólo corre en el worker'); };
