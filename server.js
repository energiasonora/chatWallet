import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';

// Storacha/UCAN se eliminó (ago 2026): la red está muerta — storacha.network redirige a
// fil.one y up.storacha.network ya no resuelve DNS. El almacenamiento IPFS lo hace el nodo
// soberano (Kubo en la caja: gateway.chatwallet.org + backup.chatwallet.org/api/ipfs/upload,
// autenticado por firma del DID), así que este server ya no delega nada. Con eso se fueron
// el endpoint /api/delegate y los imports de @ucanto/@storacha/@ipld/multiformats.

const QUOTA_FILE = path.join(process.cwd(), 'quotas.json');
const CONFIG_FILE = path.join(process.cwd(), 'server_config.json');

// ABIs para Smart Account
const SMART_ACCOUNT_ABI = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'smartContracts', 'ChatSmartAccount.abi.json'), 'utf8'));
const FACTORY_ABI = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'smartContracts', 'ChatSmartAccountFactory.abi.json'), 'utf8'));
const FACTORY_BYTECODE = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'smartContracts', 'ChatSmartAccountFactory.bytecode.json'), 'utf8'));

function readConfig() {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  return {};
}
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Función para leer cuotas
function readQuotas() {
  try {
    if (fs.existsSync(QUOTA_FILE)) {
      return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error leyendo cuotas:', e);
  }
  return {};
}

// Función para guardar cuotas
function saveQuotas(quotas) {
  try {
    fs.writeFileSync(QUOTA_FILE, JSON.stringify(quotas, null, 2));
  } catch (e) {
    console.error('Error guardando cuotas:', e);
  }
}

// Inicializar archivo si no existe
if (!fs.existsSync(QUOTA_FILE)) {
  saveQuotas({});
}

// Cargar variables de entorno desde el archivo .env (y forzar sobreescribir las cacheadas)
dotenv.config({ override: true });

const app = express();
app.use(cors({
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));
app.use(express.json());

// --- Inicializar Proveedor de Blockchain para AA ---
const rpcUrl = process.env.CHATWALLET_RPC || 'https://sepolia-rollup.arbitrum.io/rpc';
const provider = new ethers.JsonRpcProvider(rpcUrl);

// La wallet que paga el gas de los usuarios (Account Abstraction).
//
// ANTES esto era `new ethers.Wallet(process.env.SERVER_PRIVATE_KEY)` en el tope del archivo, y
// el server NO ARRANCABA: SERVER_PRIVATE_KEY guardaba la llave ed25519 de ucanto (`MgCa…`) que
// usaba la delegación de Storacha, no una llave eth — ethers tiraba `invalid BytesLike value`
// antes de llegar al app.listen(). Ahora:
//   1) va en su propia variable, SERVER_ETH_PRIVATE_KEY (0x + 64 hex), y
//   2) se construye PEREZOSAMENTE, así el server levanta igual sin ella y solo fallan —con un
//      mensaje claro y 503— los endpoints de Smart Account que de verdad la necesitan.
// Las cuotas y el resto de la API no dependen de ninguna llave.
let _serverSigner = null;
function getServerSigner() {
  if (_serverSigner) return _serverSigner;
  const pk = process.env.SERVER_ETH_PRIVATE_KEY;
  if (!pk) {
    throw Object.assign(
      new Error('Falta SERVER_ETH_PRIVATE_KEY en el .env (clave eth 0x+64hex que paga el gas). Los endpoints de Smart Account están deshabilitados.'),
      { statusCode: 503 }
    );
  }
  try {
    _serverSigner = new ethers.Wallet(pk, provider);
  } catch (e) {
    throw Object.assign(
      new Error(`SERVER_ETH_PRIVATE_KEY no es una clave eth válida (se espera 0x + 64 hex): ${e.message}`),
      { statusCode: 503 }
    );
  }
  return _serverSigner;
}

let factoryAddress = readConfig().factoryAddress;

async function ensureFactory() {
  if (factoryAddress) return;
  console.log('Desplegando ChatSmartAccountFactory desde el servidor...');
  const factory = new ethers.ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, getServerSigner());
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  factoryAddress = await contract.getAddress();
  saveConfig({ factoryAddress });
  console.log('Factory desplegada en:', factoryAddress);
}

// Endpoint para obtener la dirección de la Smart Account de un usuario
app.get('/api/smart/account/:owner', async (req, res) => {
  try {
    await ensureFactory();
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider);
    const owner = req.params.owner;
    const smartAddr = await factory.getAddress(owner, 0);
    res.json({ address: smartAddr });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Endpoint RELAYER: El servidor paga el gas para ejecutar una acción de la Smart Account
app.post('/api/smart/relay', async (req, res) => {
  const { owner, target, value, data, signature } = req.body;
  
  try {
    await ensureFactory();
    const signer = getServerSigner();
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);

    // 1. Asegurar que la Smart Account está desplegada
    console.log(`Asegurando despliegue para Smart Account de ${owner}...`);
    const deployTx = await factory.deploy(owner, 0);
    await deployTx.wait();

    const smartAddr = await factory.getAddress(owner, 0);
    const smartAccount = new ethers.Contract(smartAddr, SMART_ACCOUNT_ABI, signer);

    // 2. Ejecutar la operación (el servidor paga el gas)
    console.log(`Relaying tx de ${owner} hacia ${target}...`);
    const tx = await smartAccount.execute(target, value || 0, data, signature);
    const receipt = await tx.wait();
    
    res.json({ success: true, txHash: receipt.hash });
  } catch (err) {
    console.error('Relay error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Endpoint para obtener cuota actual
app.get('/api/quota/:address', (req, res) => {
  const quotas = readQuotas();
  const address = req.params.address.toLowerCase();
  res.json({ quota: quotas[address] || 0 });
});

// Endpoint para registrar compra de cuota
app.post('/api/buy-quota', async (req, res) => {
  const { address, signature, message, amountMb } = req.body;
  if (!address || !signature || !message || !amountMb) {
    return res.status(400).json({ error: 'Faltan datos' });
  }

  try {
    // 1. Verificar firma criptográfica del mensaje
    // Esto es GASLESS para el usuario: solo firma una intención.
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Firma inválida' });
    }

    console.log(`[GASLESS] Registro ${amountMb}MB para ${address} (Firma validada)`);
    
    // 2. Actualizar cuota
    const quotas = readQuotas();
    const addr = address.toLowerCase();
    const bytesToAdd = amountMb * 1024 * 1024;
    
    quotas[addr] = (quotas[addr] || 0) + bytesToAdd;
    saveQuotas(quotas);
    
    res.json({ success: true, newQuota: quotas[addr] });
  } catch (error) {
    console.error('Error en buy-quota:', error);
    res.status(500).json({ error: error.message });
  }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor intermediario corriendo en http://localhost:${PORT}`);
});