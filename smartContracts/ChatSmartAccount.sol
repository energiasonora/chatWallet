// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ChatSmartAccount
 * @dev Una implementación minimalista de Smart Account controlada por una EOA.
 * Permite la ejecución de transacciones mediante firmas (Meta-transactions).
 */
contract ChatSmartAccount {
    using ECDSA for bytes32;

    address public immutable owner;
    uint256 public nonce;

    event Executed(address indexed target, uint256 value, bytes data);

    constructor(address _owner) {
        owner = _owner;
    }

    /**
     * @dev Ejecuta una llamada a otro contrato si la firma es válida.
     * @param target El contrato destino (ej. el token CWLT).
     * @param value El valor en ETH (usualmente 0).
     * @param data Los datos de la función a llamar (ej. transfer).
     * @param signature La firma de la EOA dueña.
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        bytes calldata signature
    ) external {
        // 1. Reconstruir el hash del mensaje que el usuario firmó
        bytes32 hash = keccak256(
            abi.encodePacked(target, value, data, nonce, address(this), block.chainid)
        );
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(hash);

        // 2. Verificar que el firmante sea el dueño
        address signer = ethHash.recover(signature);
        require(signer == owner, "ChatSmartAccount: Firma invalida");

        // 3. Incrementar nonce para prevenir replay attacks
        nonce++;

        // 4. Ejecutar la llamada
        (bool success, ) = target.call{value: value}(data);
        require(success, "ChatSmartAccount: Ejecucion fallida");

        emit Executed(target, value, data);
    }

    // Permitir recibir ETH
    receive() external payable {}
}
