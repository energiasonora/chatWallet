import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const app = express();

// Middleware
// app.use(cors());

// app.use(cors({
//   origin: '*', // Temporalmente abierto para probar el túnel
//   methods: ['POST', 'GET', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Bypass-Tunnel-Reminder']
// }));
// En tu server.js de Linux:
app.use(cors({
  origin: 'https://chatwallet.org', // Permitimos solo a tu dApp conectarse
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning']
}));

app.use(express.json());

// Endpoint para generar el UCAN
app.post('/api/delegate', async (req, res) => {
  const { agentDid } = req.body;

  if (!agentDid || !agentDid.startsWith('did:key:')) {
    return res.status(400).json({ error: 'DID de agente inválido o faltante' });
  }

  try {
    console.log(`Generando delegación para: ${agentDid}`);

    // Ejecutamos el mismo comando que usaste en la terminal.
    // IMPORTANTE: El servidor donde corra esto debe tener la sesión de 'w3 login' iniciada
    // y el espacio correcto seleccionado con 'w3 space use'.
    // const command = `w3 delegation create ${agentDid} --can space/blob/add --can space/index/add --can filecoin/offer --can upload/add --can store/add --base64`;
    
// 1. Calculamos la expiración: Fecha actual + 1 hora (3600 segundos)
    const expirationEpoch = Math.floor(Date.now() / 1000) + 3600;

    console.log(`Generando delegación para: ${agentDid} (Expira en 1h)`);

    // 2. Le agregamos el flag --expiration al comando original
    const command = `w3 delegation create ${agentDid} --can space/blob/add --can space/index/add --can filecoin/offer --can upload/add --can store/add --expiration ${expirationEpoch} --base64`;
    

    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      console.error('Advertencia CLI:', stderr);
    }

    // Limpiamos el string base64 que devuelve la consola
    const ucanBase64 = stdout.trim();

    // Devolvemos el UCAN al frontend
    res.json({ success: true, ucan: ucanBase64 });

  } catch (error) {
    console.error('Error generando delegación:', error);
    res.status(500).json({ error: 'Fallo interno al generar el UCAN' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor intermediario corriendo en http://localhost:${PORT}`);
});
