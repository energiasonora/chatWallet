import * as snarkjs from 'snarkjs'; import fs from 'fs';
for (const v of process.argv.slice(2)) {
  const d = `art/${v}`; const input = JSON.parse(fs.readFileSync(`${d}/input.json`));
  const t0 = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, `${d}/wasm`, `${d}/zkey`);
  const t1 = performance.now();
  const ok = await snarkjs.groth16.verify(JSON.parse(fs.readFileSync(`${d}/vkey.json`)), publicSignals, proof);
  console.log(v, 'prueba', ((t1 - t0) / 1000).toFixed(2), 's', 'válida:', ok);
}
process.exit(0);
