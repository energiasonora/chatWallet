// Tailwind compilado para dapp.html (antes venía en vivo de cdn.tailwindcss.com).
// Sin config propia: la CDN corría con la config por defecto, y esto la replica.
// Lo regenera scripts/tailwind.sh (lo llaman deploy.sh y build-apk.sh).
module.exports = {
  content: [
    './src/dapp.html',
    './src/js/frase.js',
    './src/js/g1-*.js',
    './src/js/storage.js',
    './cw-connect/cw-connect.mjs',
    './ius/js/g1.js',
  ],
};
