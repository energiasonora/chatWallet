import express from 'express';
import { ethers } from 'ethers';
import { StorachaClient } from '@storacha/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// This is a placeholder for the provider, contract address, and Storacha credentials.
// In a real application, these should be securely configured.
const provider = new ethers.JsonRpcProvider('http://localhost:8545');
const contractAddress = 'YOUR_CONTRACT_ADDRESS';
const storachaCredentials = {
    accessKeyId: 'YOUR_ACCESS_KEY_ID',
    secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
};

const abi = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../smartContracts/Subscription.abi.json'), 'utf8'));

const contract = new ethers.Contract(contractAddress, abi, provider);
const storacha = new StorachaClient(storachaCredentials);

const userSpaces = new Map();

app.use(express.json());

// Endpoint for the frontend to get user's storage info
app.get('/storage-info/:userAddress', (req, res) => {
    const { userAddress } = req.params;
    const spaceInfo = userSpaces.get(userAddress);

    if (spaceInfo) {
        res.json(spaceInfo);
    } else {
        res.status(404).send('Storage space not found for this user.');
    }
});

contract.on('Subscribed', async (user, planId, endTime) => {
    console.log(`User ${user} subscribed to plan ${planId} until ${new Date(endTime * 1000)}`);

    try {
        // Create a new space for the user.
        // The space name could be the user's address or a unique ID.
        const space = await storacha.createSpace({ name: user });

        // Store the space information.
        userSpaces.set(user, {
            spaceId: space.id,
            planId: planId.toString(),
            endTime: endTime.toString(),
        });

        console.log(`Created Storacha space for user ${user}`);
    } catch (error) {
        console.error('Error creating Storacha space:', error);
    }
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
