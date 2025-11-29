// --------
  const identifiers = [
              // Reemplaza estas direcciones con las que quieras verificar
              { identifier: "0xe14f241b23ac40487faedf68fff2a6c693780f82", identifierKind: "Ethereum" }, // Dirección de prueba de Hardhat
              { identifier: "0x32307b3523559452221e42247f5b3312b6b23d1e", identifierKind: "Ethereum" }  // Una dirección al azar
            ];

                const response = await Client.canMessage(identifiers);
                console.log("Respuesta (Map):", response);


                
                const dmByInboxId = await client.conversations.getDmByInboxId(peerInboxId);




// --------------
import { Result } from "ethers"

let inbid= '5f314c54efb0ef21b6684917d248eeb9ad7c16ff95b6348302943b7f94fdcdce'
// the second argument is optional and refreshes the state from the network.
const states = await xmtpClient.preferences.inboxStateFromInboxIds(['5f314c54efb0ef21b6684917d248eeb9ad7c16ff95b6348302943b7f94fdcdce'], true)

states[0].identifiers[0].identifier
// ----------------------
// conseguir inboxId desde address




// ----------------------
// conseguir address desde inboxID

// get inboxId from address




    let inbxid= message.senderInboxId
    const stts = await xmtpClient.preferences.inboxStateFromInboxIds([inbxid], true)
    console.warn('SENDER ADDRESS:', stts[0].identifiers[0].identifier)

 
// the second argument is optional and refreshes the state from the network.
let inbid= '5f314c54efb0ef21b6684917d248eeb9ad7c16ff95b6348302943b7f94fdcdce'
const states = await xmtpClient.preferences.inboxStateFromInboxIds([inbid, inboxId], true)


let addr= "0xe14f241b23ac40487faedf68fff2a6c693780f82"



// ------------------
    const conversation = await xmtpClient.findOrCreateDm('0xe14f241b23ac40487faedf68fff2a6c693780f82');
// no funciona?



    // ---------------
            const identifiers = [
              // Reemplaza estas direcciones con las que quieras verificar
              { identifier: "0xe14f241b23ac40487faedf68fff2a6c693780f82", identifierKind: "Ethereum" }, // Dirección de prueba de Hardhat
              { identifier: "0x32307b3523559452221e42247f5b3312b6b23d1e", identifierKind: "Ethereum" }  // Una dirección al azar
            ];

            try {
                const response = await Client.canMessage(identifiers);
                console.log("Respuesta (Map):", response);

                // Procesamos el Map para mostrar los resultados
                let output = 'Resultados de la verificación:\n\n';
                response.forEach((isReachable, address) => {
                    output += `Dirección: ${address}\n`;
                    output += `¿Está en la red?: ${isReachable ? '✅ Sí' : '❌ No'}\n\n`;
                });
                
                resultsEl.textContent = output;

            } catch (error) {
                console.error("Error al verificar las direcciones:", error);
                resultsEl.textContent = `Error: ${error.message}`;
            }


            // Result
