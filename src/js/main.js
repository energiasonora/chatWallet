document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const initView = document.getElementById('initView');
    const chatView = document.getElementById('chatView');
    const scannerView = document.getElementById('scannerView');
    const createWalletButton = document.getElementById('createWalletButton');
    const scanQrButton = document.getElementById('scanQrButton');
    const backButton = document.getElementById('backButton');
    const closeScannerBtn = document.getElementById('closeScannerBtn');
    const statusEl = document.getElementById('status');

    // App State
    let currentWallet = null;

    // --- VIEW MANAGEMENT ---
    function showView(view) {
        initView.classList.add('hidden');
        chatView.classList.add('hidden');
        scannerView.classList.add('hidden');
        view.classList.remove('hidden');
        view.classList.add('flex');
    }

    // --- EVENT LISTENERS ---
    createWalletButton.addEventListener('click', () => {
        statusEl.textContent = "Creando billetera...";
        try {
            const randomWallet = ethers.Wallet.createRandom();
            currentWallet = randomWallet;
            statusEl.textContent = `Billetera creada: ${currentWallet.address}`;
            alert(`Billetera creada y guardada (simulado).\n\nDirección: ${currentWallet.address}\n\nIMPORTANTE: Anota esta clave privada y guárdala en un lugar seguro:\n\n${currentWallet.privateKey}`);
        } catch (error) {
            console.error("Error creating wallet:", error);
            statusEl.textContent = "Error al crear la billetera.";
        }
    });

    scanQrButton.addEventListener('click', () => {
        showView(scannerView);
        // QR Scanner initialization will go here
    });

    backButton.addEventListener('click', () => {
        showView(initView);
    });

    closeScannerBtn.addEventListener('click', () => {
        showView(initView);
        // Logic to stop the scanner will go here
    });

    // --- INITIALIZATION ---
    showView(initView);
});