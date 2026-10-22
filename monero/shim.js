export const process = globalThis.process || { env: {}, version: '', versions: {}, browser: true, nextTick: (f, ...a) => Promise.resolve().then(() => f(...a)) };
