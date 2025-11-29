// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Importamos Ownable para gestionar funciones administrativas (como retirar fondos)
import "@openzeppelin/contracts/access/Ownable.sol";

contract ChatWalletIdentity is Ownable {
    
    struct Profile {
        string username;      
        string metadataURI;   
        bool isRegistered;
    }

    mapping(address => Profile) public profiles;
    mapping(string => address) public usernameToAddress; 

    // Configuración de seguridad
    uint256 public registrationPrice = 0.001 ether; // Costo anti-spam
    uint8 public constant MIN_LENGTH = 3;
    uint8 public constant MAX_LENGTH = 16;

    event ProfileUpdated(address indexed user, string newUsername, string newMetadataURI);
    event PriceChanged(uint256 newPrice);

    // Constructor que inicializa Ownable pasando el msg.sender
    constructor() Ownable(msg.sender) {}

    // Función principal
    function setProfile(string memory _username, string memory _metadataURI) public payable {
        // 1. Validación de Input (Evita caracteres invisibles y nombres absurdos)
        require(bytes(_username).length >= MIN_LENGTH, "Nombre muy corto");
        require(bytes(_username).length <= MAX_LENGTH, "Nombre muy largo");
        require(_validateUsername(_username), "Caracteres invalidos (a-z, 0-9, _)");

        string memory currentUsername = profiles[msg.sender].username;
        bool isNameChange = keccak256(bytes(currentUsername)) != keccak256(bytes(_username));

        // 2. Lógica de cambio de nombre
        if (isNameChange) {
            // Si es un registro nuevo (no actualización de solo metadata), cobrar fee
            if (!profiles[msg.sender].isRegistered) {
                require(msg.value >= registrationPrice, "Pago insuficiente para registro");
            }
            
            require(usernameToAddress[_username] == address(0), "Username ya tomado");

            // Liberar el nombre anterior
            if (profiles[msg.sender].isRegistered) {
                delete usernameToAddress[currentUsername];
            }
            
            usernameToAddress[_username] = msg.sender;
        } else {
            // Si solo actualiza metadata, devolvemos el pago si envió algo por error
            if (msg.value > 0) {
                payable(msg.sender).transfer(msg.value);
            }
        }

        // 3. Actualizar perfil
        profiles[msg.sender] = Profile(_username, _metadataURI, true);
        emit ProfileUpdated(msg.sender, _username, _metadataURI);
    }

    // Función auxiliar para validar caracteres (Gas intensive, pero seguro)
    // Solo permite a-z (minúsculas), 0-9 y guion bajo.
    function _validateUsername(string memory _str) internal pure returns (bool) {
        bytes memory b = bytes(_str);
        for(uint i; i < b.length; i++){
            bytes1 char = b[i];
            if(
                !(char >= 0x30 && char <= 0x39) && // 0-9
                !(char >= 0x61 && char <= 0x7A) && // a-z
                !(char == 0x5F) // _
            )
                return false;
        }
        return true;
    }

    // Funciones administrativas
    function setPrice(uint256 _newPrice) external onlyOwner {
        registrationPrice = _newPrice;
        emit PriceChanged(_newPrice);
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}