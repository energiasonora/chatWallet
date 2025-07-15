// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol"; // CHANGE 1: Import AccessControl
import "@openzeppelin/contracts/utils/Pausable.sol";

// deployed on arb sepolia 0x2aC45C33602E1a8450302100F1897BFF6C91a5d6
/**
 * @title ChatWallet Token (CWLT)
 * @dev Secure, pausable, and burnable ERC20 token with role-based access control.
 */
contract ChatWalletTokenF is ERC20, ERC20Burnable, AccessControl, Pausable {
    // --- Roles ---
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); // CHANGE 2: Define a role
    
    // --- Constants ---
    uint8 public constant TOKEN_DECIMALS = 18;
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * (10**TOKEN_DECIMALS); // 1 billion tokens

    // --- Constructor ---
    constructor()
        ERC20("ChatWalletToken", "CWLT")
    {
        // CHANGE 3: Grant roles to the deployer
        // The deployer gets admin rights to manage roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // The deployer can also mint tokens immediately
        _grantRole(MINTER_ROLE, msg.sender);
    }

    // --- Overrides ---
    function decimals() public view virtual override returns (uint8) {
        return TOKEN_DECIMALS;
    }

    function _update(address from, address to, uint256 amount)
        internal virtual override(ERC20) whenNotPaused // ✅ CORRECTED: Only ERC20 is needed here
    {
        super._update(from, to, amount);
    }


    // --- Core Functions ---
    // CHANGE 4: Use 'onlyRole' modifier
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(totalSupply() + amount <= MAX_SUPPLY, "CWLT: Exceeds max supply");
        _mint(to, amount);
    }

    // --- Pause Controls ---
    // Note: It's good practice to let only an admin pause/unpause.
    // The DEFAULT_ADMIN_ROLE is used here implicitly by AccessControl's setup for grantRole/revokeRole.
    // For pause/unpause, you could create a PAUSER_ROLE or leave it to the admin.
    // Let's use the admin role for simplicity.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
  
