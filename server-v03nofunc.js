import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Signer } from '@ucanto/principal/ed25519';
import * as Delegation from '@ucanto/core/delegation';
import * as DID from '@ipld/dag-ucan/did';

// Cargar variables de entorno desde el archivo .env
dotenv.config();

const app = express();

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
    console.log(`Generando delegación para: ${agentDid} (Expira en 1h)`);

    // 1. Cargar la llave privada y el DID del espacio desde el .env
    const serverPrincipal = Signer.parse(process.env.SERVER_PRIVATE_KEY);
    const spaceDid = process.env.SPACE_DID;

    // 2. Limpiar la variable del .env por si tiene espacios o saltos de línea invisibles
    const rawProof = process.env.SPACE_PROOF ? process.env.SPACE_PROOF.trim() : '';
    if (!rawProof) {
      throw new Error('La variable SPACE_PROOF está vacía o no existe en el .env');
    }

    // 3. Extraer el proof y mostrar el error real si falla
    const extractedProof = await Delegation.extract(Buffer.from(rawProof, 'base64'));
    if (!extractedProof.ok) {
      console.error('🚨 DETALLE TÉCNICO DEL ERROR UCAN:', extractedProof.error);
      throw new Error('Fallo al decodificar el SPACE_PROOF del .env');
    }
    const proof = extractedProof.ok;

    // 4. Preparar los datos de la nueva delegación
    const audience = DID.parse(agentDid);
    const expirationEpoch = Math.floor(Date.now() / 1000) + 3600; // 1 hora

    // 5. Crear y firmar la delegación usando el SDK
    const delegation = await Delegation.delegate({
      issuer: serverPrincipal,
      audience: audience,
      capabilities: [
        { can: 'space/blob/add', with: spaceDid },
        { can: 'space/index/add', with: spaceDid },
        { can: 'filecoin/offer', with: spaceDid },
        { can: 'upload/add', with: spaceDid },
        { can: 'store/add', with: spaceDid }
      ],
      proofs: [proof], // La prueba de que este servidor tiene permiso
      expiration: expirationEpoch
    });

    // 6. Empaquetar el UCAN a Base64 para enviarlo por HTTP
    const archive = await delegation.archive();
    if (!archive.ok) {
      throw new Error('Fallo al archivar la delegación internamente');
    }
    
    const ucanBase64 = Buffer.from(archive.ok).toString('base64');
    res.json({ success: true, ucan: ucanBase64 });

  } catch (error) {
    console.error('Error generando delegación:', error);
    res.status(500).json({ error: 'Fallo interno al generar el UCAN' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor intermediario corriendo en http://localhost:${PORT}`);
});