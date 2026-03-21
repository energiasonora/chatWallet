import { create } from '@storacha/client';
import { parse } from '@storacha/client/proof';

let client;

self.onmessage = async (e) => {
  const { file } = e.data;
  let fakeProgressInterval; 

  try {
    self.postMessage({ type: 'progress', percent: 10, text: `Iniciando subida: ${file.name}` });

    if (!client) {
      client = await create();
    }
    
    // 1. Pedimos permiso al servidor (UCAN temporal) basándonos solo en el tamaño
    self.postMessage({ type: 'progress', percent: 20, text: 'Solicitando pase de almacenamiento...' });
    
    const agentDid = client.agent.did();

    const response = await fetch('/api/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
      body: JSON.stringify({
        agentDid,
        size: file.size,
        filename: file.name,
        walletAddress: e.data.walletAddress
      })
    });

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Respuesta no-JSON recibida:", text);
        throw new Error(`El servidor devolvió una respuesta inesperada (no-JSON). Status: ${response.status}`);
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'El servidor rechazó la solicitud de cuota');

    self.postMessage({ type: 'progress', percent: 35, text: 'Validando pase VIP en Storacha...' });
    
    // 2. Configuramos el cliente con el UCAN recibido
    const proof = await parse(data.ucan.trim());
    const space = await client.addSpace(proof);
    await client.setCurrentSpace(space.did());

    self.postMessage({ type: 'progress', percent: 50, text: 'Empaquetando y subiendo archivo...' });

    // ── MAGIA DEL AVANCE FALSO ──────────────────────────────────────
    let currentProgress = 50;
    fakeProgressInterval = setInterval(() => {
      if (currentProgress < 95) {
        const step = currentProgress < 80 ? 5 : 1; 
        currentProgress += step;
        self.postMessage({ 
          type: 'progress', 
          percent: currentProgress, 
          text: `Subiendo a la red descentralizada... ${currentProgress}%` 
        });
      }
    }, 600);
    // ────────────────────────────────────────────────────────────────

    // 3. Subimos directamente con Storacha
    const uploadedCid = await client.uploadFile(file);

    clearInterval(fakeProgressInterval);
    self.postMessage({ type: 'progress', percent: 100, text: '¡Archivo asegurado en IPFS!' });
    
    self.postMessage({ type: 'done', cid: uploadedCid.toString() });

  } catch (error) {
    if (fakeProgressInterval) clearInterval(fakeProgressInterval);
    self.postMessage({ type: 'error', error: error.message });
  }
};