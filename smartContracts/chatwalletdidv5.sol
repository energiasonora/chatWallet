// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract chatwalletdidv5 is Ownable {
    
    struct Profile {
        string username;      
        string metadataURI;   
        bool isRegistered;
    }

    IERC20 public chatWalletToken;

    mapping(address => Profile) public profiles;
    mapping(string => address) public usernameToAddress; 

    // PRECIOS (Configurables)
    // Estrategia: Token barato, Nativo caro.
    uint256 public tokenPrice = 100 * 10**18;     // Ej: 100 Tokens (Opción Económica)
    uint256 public nativePrice = 0.02 ether;      // Ej: ~0.02 ETH/MATIC (Opción Premium/Rápida)

    uint8 public constant MIN_LENGTH = 3;
    uint8 public constant MAX_LENGTH = 16;

    event ProfileUpdated(address indexed user, string newUsername, string newMetadataURI);
    event PricesUpdated(uint256 newTokenPrice, uint256 newNativePrice);
    event TokenUpdated(address indexed newToken);

    constructor(address _tokenAddress) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Direccion de token invalida");
        chatWalletToken = IERC20(_tokenAddress);
    }

    // Agregamos 'payable' para permitir la entrada de ETH/MATIC
    function setProfile(string memory _username, string memory _metadataURI) public payable {
        // 1. Validaciones de seguridad
        require(bytes(_username).length >= MIN_LENGTH, "Nombre muy corto");
        require(bytes(_username).length <= MAX_LENGTH, "Nombre muy largo");
        require(_validateUsername(_username), "Caracteres invalidos");

        string memory currentUsername = profiles[msg.sender].username;
        bool isNameChange = keccak256(bytes(currentUsername)) != keccak256(bytes(_username));

        if (isNameChange) {
            require(usernameToAddress[_username] == address(0), "Username ya tomado");

            // 2. Lógica de Cobro Híbrida
            if (msg.value > 0) {
                // --- CAMINO A: PAGO CON NATIVO (PREMIUM) ---
                require(msg.value >= nativePrice, "Pago nativo insuficiente para el premium");
                
                // Devolvemos el cambio si el usuario envió de más (User Friendly)
                if (msg.value > nativePrice) {
                    payable(msg.sender).transfer(msg.value - nativePrice);
                }
            } else {
                // --- CAMINO B: PAGO CON CHATWALLET TOKEN (STANDARD) ---
                // Si msg.value es 0, asumimos que quiere usar sus tokens
                bool success = chatWalletToken.transferFrom(msg.sender, address(this), tokenPrice);
                require(success, "Fallo el cobro de tokens. Revisa allowance o saldo");
            }
            
            // 3. Gestión de Nombres
            if (profiles[msg.sender].isRegistered) {
                delete usernameToAddress[currentUsername];
            }
            usernameToAddress[_username] = msg.sender;
        } else {
            // Si solo actualiza foto (metadata) y envió dinero por error, se lo devolvemos
            if (msg.value > 0) {
                payable(msg.sender).transfer(msg.value);
            }
        }

        profiles[msg.sender] = Profile(_username, _metadataURI, true);
        emit ProfileUpdated(msg.sender, _username, _metadataURI);
    }

    function _validateUsername(string memory _str) internal pure returns (bool) {
        bytes memory b = bytes(_str);
        for(uint i; i < b.length; i++){
            bytes1 char = b[i];
            if(
                !(char >= 0x30 && char <= 0x39) && 
                !(char >= 0x61 && char <= 0x7A) && 
                !(char == 0x5F) 
            )
                return false;
        }
        return true;
    }

    // --- GESTIÓN ADMINISTRATIVA ---

    // Permite ajustar ambos precios si el mercado fluctúa
    function setPrices(uint256 _tokenPrice, uint256 _nativePrice) external onlyOwner {
        tokenPrice = _tokenPrice;
        nativePrice = _nativePrice;
        emit PricesUpdated(_tokenPrice, _nativePrice);
    }

    function setToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Address invalida");
        chatWalletToken = IERC20(_newToken);
        emit TokenUpdated(_newToken);
    }

    // Retirar Tokens acumulados
    function withdrawTokens() external onlyOwner {
        uint256 balance = chatWalletToken.balanceOf(address(this));
        require(balance > 0, "No hay tokens");
        require(chatWalletToken.transfer(owner(), balance), "Transferencia token fallida");
    }

    // Retirar ETH/MATIC acumulado
    function withdrawNative() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay fondos nativos");
        payable(owner()).transfer(balance);
    }
}