// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title WriterAllowlist
/// @notice Contrato mínimo que dicta quién puede ESCRIBIR en la DB OrbitDB.
///         El owner (la address admin) administra la allowlist on-chain.
///         El access controller de OrbitDB consulta `isWriter(address)` en cada append.
contract WriterAllowlist {
    address public owner;
    mapping(address => bool) private writers;

    event WriterSet(address indexed account, bool allowed);

    constructor() {
        owner = msg.sender;
    }

    function setWriter(address account, bool allowed) external {
        require(msg.sender == owner, "not owner");
        writers[account] = allowed;
        emit WriterSet(account, allowed);
    }

    function isWriter(address account) external view returns (bool) {
        return writers[account];
    }
}
