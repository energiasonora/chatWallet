import { ethers } from 'ethers';

const connectButton = document.getElementById('connectButton');
const plansSection = document.getElementById('plans');
const dashboardSection = document.getElementById('dashboard');
const planList = document.getElementById('planList');
const subscribeButton = document.getElementById('subscribeButton');
const usageDiv = document.getElementById('usage');
const fileInput = document.getElementById('fileInput');
const uploadButton = document.getElementById('uploadButton');

const contractAddress = 'YOUR_CONTRACT_ADDRESS'; // To be replaced
const contractAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_paymentToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_serviceFeeWallet",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "planId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "duration",
        "type": "uint256"
      }
    ],
    "name": "PlanCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "to",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "ServiceFeeWithdrawn",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "user",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "planId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "name": "Subscribed",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_user",
        "type": "address"
      }
    ],
    "name": "checkSubscription",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_id",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_price",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "_duration",
        "type": "uint256"
      }
    ],
    "name": "createPlan",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paymentToken",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "plans",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "id",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "price",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "duration",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "serviceFeeWallet",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "_planId",
        "type": "uint256"
      }
    ],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "subscriptions",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "planId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "endTime",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawServiceFees",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

let provider;
let signer;
let contract;
let userAddress;

connectButton.addEventListener('click', async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();
            contract = new ethers.Contract(contractAddress, contractAbi, signer);

            document.getElementById('connection').style.display = 'none';
            plansSection.style.display = 'block';

            loadPlans();
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            alert('Failed to connect wallet.');
        }
    } else {
        alert('MetaMask is not installed.');
    }
});

async function loadPlans() {
    // In a real app, you would fetch these from a backend or smart contract
    const plans = [
        { id: 1, name: 'Basic', price: '10', duration: '30 days' },
        { id: 2, name: 'Pro', price: '25', duration: '90 days' },
    ];

    planList.innerHTML = plans.map(plan => `
        <label>
            <input type="radio" name="plan" value="${plan.id}">
            ${plan.name} - ${plan.price} Tokens for ${plan.duration}
        </label>
    `).join('<br>');
}

subscribeButton.addEventListener('click', async () => {
    const selectedPlan = document.querySelector('input[name="plan"]:checked');
    if (!selectedPlan) {
        alert('Please select a plan.');
        return;
    }

    const planId = selectedPlan.value;

    try {
        const tx = await contract.subscribe(planId);
        await tx.wait();

        alert('Subscription successful!');
        plansSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        loadDashboard();
    } catch (error) {
        console.error('Subscription failed:', error);
        alert('Subscription failed.');
    }
});

async function loadDashboard() {
    try {
        const response = await fetch(`/storage-info/${userAddress}`);
        if(response.ok) {
            const storageInfo = await response.json();
            usageDiv.innerHTML = `
                <p>Plan: ${storageInfo.planId}</p>
                <p>Expires: ${new Date(storageInfo.endTime * 1000)}</p>
            `;
        } else {
            usageDiv.innerHTML = `<p>Could not retrieve storage information.</p>`;
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        usageDiv.innerHTML = `<p>Error loading dashboard.</p>`;
    }
}

uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    // File upload logic will be implemented here
    alert(`Uploading ${file.name}...`);
});
