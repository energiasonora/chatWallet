// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ChatSmartAccount.sol";

/**
 * @title ChatSmartAccountFactory
 * @dev Fábrica para desplegar ChatSmartAccounts de forma determinística usando CREATE2.
 */
contract ChatSmartAccountFactory {

    event AccountCreated(address indexed account, address indexed owner, uint256 salt);

    /**
     * @dev Calcula la dirección que tendrá la Smart Account para un dueño dado sin desplegarla.
     */
    function getAddress(address owner, uint256 salt) public view returns (address) {
        bytes memory bytecode = abi.encodePacked(type(ChatSmartAccount).creationCode, abi.encode(owner));
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    /**
     * @dev Despliega una Smart Account si no existe.
     */
    function deploy(address owner, uint256 salt) public returns (address) {
        address addr = getAddress(owner, salt);
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(addr)
        }

        if (codeSize > 0) return addr;

        ChatSmartAccount newAccount = new ChatSmartAccount{salt: bytes32(salt)}(owner);
        emit AccountCreated(address(newAccount), owner, salt);
        return address(newAccount);
    }
}
