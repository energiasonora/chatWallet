// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
// 1. Importamos la interfaz para interactuar con tokens ERC20
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ChatWalletIdentityv4 is Ownable {
    
    struct Profile {
        string username;      
        string metadataURI;   
        bool isRegistered;
    }

    // 2. Variable para almacenar la dirección de tu token (ChatWallet Token)
    IERC20 public chatWalletToken;

    mapping(address => Profile) public profiles;
    mapping(string => address) public usernameToAddress; 

    uint256 public registrationPrice = 100 * 10**18; // Costo por registrarse o cambiar nombre
    uint8 public constant MIN_LENGTH = 3;
    uint8 public constant MAX_LENGTH = 16;

    event ProfileUpdated(address indexed user, string newUsername, string newMetadataURI);
    event PriceChanged(uint256 newPrice);
    event TokenUpdated(address indexed newToken);

    // 3. El constructor ahora exige la dirección del token al desplegar
    constructor(address _tokenAddress) Ownable(msg.sender) {
        require(_tokenAddress != address(0), "Direccion de token invalida");
        chatWalletToken = IERC20(_tokenAddress);
    }

    // 4. Eliminamos 'payable' porque ya no recibimos ETH/MATIC nativo
    function setProfile(string memory _username, string memory _metadataURI) public {
        // Validaciones de seguridad (Input)
        require(bytes(_username).length >= MIN_LENGTH, "Nombre muy corto");
        require(bytes(_username).length <= MAX_LENGTH, "Nombre muy largo");
        require(_validateUsername(_username), "Caracteres invalidos (a-z, 0-9, _)");

        string memory currentUsername = profiles[msg.sender].username;
        bool isNameChange = keccak256(bytes(currentUsername)) != keccak256(bytes(_username));

        if (isNameChange) {
            // Verificamos disponibilidad ANTES de cobrar
            require(usernameToAddress[_username] == address(0), "Username ya tomado");

            // CAMBIO DE LOGICA: Cobramos SIEMPRE que se reserve un nombre nuevo
            // Sea registro inicial o cambio de nombre, cuesta tokens.
            // Esto previene spam de cambios de nombre.
            bool success = chatWalletToken.transferFrom(msg.sender, address(this), registrationPrice);
            require(success, "Fallo el cobro de tokens. Revisa el allowance");
            
            // Actualización de estado: Liberar nombre anterior si existía
            if (profiles[msg.sender].isRegistered) {
                delete usernameToAddress[currentUsername];
            }
            
            usernameToAddress[_username] = msg.sender;
        } 
        
        // Si NO hay cambio de nombre (solo actualiza foto/metadata), es GRATIS (solo gas).

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

    function setPrice(uint256 _newPrice) external onlyOwner {
        registrationPrice = _newPrice;
        emit PriceChanged(_newPrice);
    }

    // Permite cambiar el token de pago si migras el contrato del token en el futuro
    function setToken(address _newToken) external onlyOwner {
        require(_newToken != address(0), "Address invalida");
        chatWalletToken = IERC20(_newToken);
        emit TokenUpdated(_newToken);
    }

    // 5. Retiro de ganancias en TOKENS
    function withdrawTokens() external onlyOwner {
        uint256 balance = chatWalletToken.balanceOf(address(this));
        require(balance > 0, "No hay tokens para retirar");
        require(chatWalletToken.transfer(owner(), balance), "Transferencia fallida");
    }
}