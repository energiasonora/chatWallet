// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./chatWalletTokenF.sol"; 


/**
 * @title MilestonePresaleV21
 * @author Xunorus & Gemini
 * @notice A continuous presale contract with a renewing claim cliff model.
 * @dev This contract is designed to fund project development through a continuous token sale.
 * It features a two-phase funding mechanism and a personal, renewing vesting epoch for each user
 * to ensure market stability and fairness. This version incorporates gas optimizations and full NatSpec documentation.
 */
contract MilestonePresaleV21 is ReentrancyGuard, Ownable, Pausable {
    // --- Custom Errors ---
    error ZeroAddress();
    error PurchaseInvalid();
    error ExceedsAvailableTokens();
    error NoTokensToClaim();
    error NoFundsToWithdraw();
    error WithdrawalAmountExceedsBalance();
    error TimelockActive();
    error NoWithdrawalQueued();
    error WithdrawalAlreadyPending();
    error ETHTransferFailed();
    error ZeroEpochDuration();
    error EpochNotOver();

    // --- Events ---
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event FundsDistributed(uint256 amount, uint256 toDevelopment, uint256 toTreasury);
    event DevelopmentFundsWithdrawn(address indexed recipient, uint256 amount);
    event TreasuryWithdrawalQueued(address indexed recipient, uint256 amount, string purpose, uint256 unlockTime);
    event TreasuryWithdrawalCancelled(address indexed recipient, uint256 amount);
    event TreasuryWithdrawalExecuted(address indexed recipient, uint256 amount);
    event TokensClaimed(address indexed claimer, uint256 amount);
    event TokensClaimedToAccount(address indexed owner, address indexed recipient, uint256 amount);

    // --- Presale Configuration ---
    /// @notice The address of the ERC20 token being sold.
    ChatWalletTokenF public immutable TOKEN;

    // --- Dynamic Pricing & Supply ---
    /// @notice The starting price for one token in wei.
    uint256 public constant BASE_PRICE = 1e15; // 0.001 ETH
    /// @notice The factor by which the price increases as more tokens are sold.
    uint256 public constant PRICE_INCREMENT = 9e9;
    /// @notice The total number of tokens available for sale in the presale.
    uint256 public constant MAX_TOKENS_FOR_SALE = 100_000 * (10**18);
    /// @notice The decimals of the token being sold.
    uint256 private constant TOKEN_DECIMALS = 18;

    // --- Milestone & Treasury Configuration ---
    /// @notice The initial fundraising goal in wei to be allocated entirely to development.
    uint256 public immutable DEVELOPMENT_OBJECTIVE;
    /// @notice The duration in seconds for the treasury withdrawal timelock.
    uint256 public immutable TREASURY_TIMELOCK_DELAY;
    /// @notice The basis points (20%) of funds allocated to development after the objective is met.
    uint256 public constant DEV_FEE_BPS = 2000;
    /// @notice The basis points (80%) of funds allocated to the treasury after the objective is met.
    uint256 public constant TREASURY_FEE_BPS = 8000;

    // --- State Variables ---
    /// @notice The total number of tokens sold so far.
    uint256 public totalTokensSold;
    /// @notice The total amount of ETH raised so far.
    uint256 public totalFundsRaised;
    /// @notice The amount of ETH currently available for the development fund to withdraw.
    uint256 public developmentFundsAvailable;
    /// @notice The amount of ETH currently locked in the community treasury.
    uint256 public treasuryFundsAvailable;

    // --- Epoch Configuration ---
    /// @notice The duration of the personal vesting cliff for each user, in seconds.
    uint256 public immutable EPOCH_DURATION;

    // --- User Data ---
    /**
     * @dev Struct to hold user's vesting information.
     * Packed into a single 256-bit slot for gas optimization.
     * `amount` uses uint192, `startTimestamp` uses uint64.
     */
    struct VestingInfo {
        uint192 amount;         // Amount of tokens vesting in the current epoch.
        uint64 startTimestamp;  // Start time of the current vesting epoch.
    }
    /// @notice Maps a user's address to their current vesting information.
    mapping(address => VestingInfo) public userVestingInfo;

    // --- Treasury Timelock State ---
    /// @notice The recipient of a pending treasury withdrawal.
    address public treasuryWithdrawalRecipient;
    /// @notice The amount of a pending treasury withdrawal.
    uint256 public treasuryWithdrawalAmount;
    /// @notice The timestamp when a pending treasury withdrawal can be executed.
    uint256 public treasuryWithdrawalUnlockTime;
    /// @notice The stated purpose of a pending treasury withdrawal.
    string public treasuryWithdrawalPurpose;

    /**
     * @notice Contract constructor.
     * @param _tokenAddress The address of the ERC20 token contract.
     * @param _epochDuration The duration of the vesting cliff in seconds (e.g., 90 days).
     * @param _developmentObjective The initial fundraising goal in wei.
     * @param _timelockDelay The delay for treasury withdrawals in seconds.
     * @param _initialOwner The address that will own the contract and have admin rights.
     */
    constructor(
        address _tokenAddress,
        uint256 _epochDuration,
        uint256 _developmentObjective,
        uint256 _timelockDelay,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_tokenAddress == address(0) || _initialOwner == address(0)) revert ZeroAddress();
        if (_epochDuration == 0) revert ZeroEpochDuration();
        
        TOKEN = ChatWalletTokenF(_tokenAddress);
        EPOCH_DURATION = _epochDuration;
        DEVELOPMENT_OBJECTIVE = _developmentObjective;
        TREASURY_TIMELOCK_DELAY = _timelockDelay;

        require(DEV_FEE_BPS + TREASURY_FEE_BPS == 10000, "Fees must equal 100%");
    }

    // --- Core Purchase Logic ---

    /**
     * @notice Allows a user to buy tokens with ETH.
     * @dev The sale is permanently open unless paused by the owner. The price is calculated dynamically.
     */
    function buyTokens() external payable nonReentrant whenNotPaused {
        if (msg.value == 0) revert PurchaseInvalid();
        if (totalTokensSold >= MAX_TOKENS_FOR_SALE) revert ExceedsAvailableTokens();
        
        _purchaseTokens(msg.sender, msg.value);
    }

    /**
     * @dev Internal logic to process a token purchase, update user vesting info, and distribute funds.
     * @param buyer The address of the token purchaser.
     * @param amount The amount of ETH sent.
     */
    function _purchaseTokens(address buyer, uint256 amount) internal {
        uint256 tokensToReceive = calculateTokensForPayment(amount);
        if (totalTokensSold + tokensToReceive > MAX_TOKENS_FOR_SALE) revert ExceedsAvailableTokens();

        totalTokensSold += tokensToReceive;

        VestingInfo storage info = userVestingInfo[buyer];
        info.amount += uint192(tokensToReceive);

        // If this is the first purchase of a new vesting cycle, start the clock.
        if (info.startTimestamp == 0) {
            info.startTimestamp = uint64(block.timestamp);
        }

        _distributeFunds(amount);

        emit TokensPurchased(buyer, amount, tokensToReceive);
    }
    
    /**
     * @dev Internal logic to distribute incoming ETH based on the current funding phase.
     * @param amount The amount of ETH to distribute.
     */
    function _distributeFunds(uint256 amount) internal {
        uint256 previousTotalRaised = totalFundsRaised;
        totalFundsRaised += amount;

        uint256 toDevelopment;
        uint256 toTreasury;

        if (previousTotalRaised >= DEVELOPMENT_OBJECTIVE) {
            toDevelopment = (amount * DEV_FEE_BPS) / 10000;
            toTreasury = amount - toDevelopment;
        } else if (totalFundsRaised > DEVELOPMENT_OBJECTIVE) {
            uint256 amountInPhase1 = DEVELOPMENT_OBJECTIVE - previousTotalRaised;
            uint256 amountInPhase2 = totalFundsRaised - DEVELOPMENT_OBJECTIVE;
            
            toDevelopment = amountInPhase1;
            uint256 devSharePhase2 = (amountInPhase2 * DEV_FEE_BPS) / 10000;
            toDevelopment += devSharePhase2;
            toTreasury = amountInPhase2 - devSharePhase2;
        } else {
            toDevelopment = amount;
            toTreasury = 0;
        }

        developmentFundsAvailable += toDevelopment;
        treasuryFundsAvailable += toTreasury;

        emit FundsDistributed(amount, toDevelopment, toTreasury);
    }

    // --- Claim Logic ---

    /**
     * @notice Calculates the amount of tokens a user can claim.
     * @dev Tokens are claimable only after the user's personal epoch has ended.
     * @param user The address of the user to check.
     * @return The amount of tokens the user can currently claim.
     */
    function claimableTokens(address user) public view returns (uint256) {
        VestingInfo memory info = userVestingInfo[user];

        if (info.startTimestamp == 0 || info.amount == 0) {
            return 0;
        }

        if (block.timestamp >= uint256(info.startTimestamp) + EPOCH_DURATION) {
            return uint256(info.amount);
        }

        return 0;
    }

    /**
     * @notice Allows a user to claim their tokens to their own wallet after their vesting epoch ends.
     * @dev Claiming resets the epoch, starting a new one on the next purchase.
     */
    function claimTokens() external nonReentrant {
        _claim(msg.sender);
    }

    /**
     * @notice Allows a user to claim their tokens to a specified account (e.g., a smart contract account).
     * @dev This enables composability with other DeFi protocols.
     * @param recipient The address to receive the claimed tokens.
     */
    function claimToAccount(address recipient) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        _claim(recipient);
    }

    /**
     * @dev Internal claim logic shared by claimTokens and claimToAccount.
     * @param recipient The address that will receive the tokens.
     */
    function _claim(address recipient) private {
        VestingInfo storage info = userVestingInfo[msg.sender];
        
        if (info.amount == 0) revert NoTokensToClaim();
        if (block.timestamp < uint256(info.startTimestamp) + EPOCH_DURATION) revert EpochNotOver();

        uint256 amountToClaim = uint256(info.amount);

        // Reset the user's vesting state FOR THE NEXT CYCLE before the transfer.
        info.amount = 0;
        info.startTimestamp = 0;

        TOKEN.mint(recipient, amountToClaim);
        
        if (recipient == msg.sender) {
            emit TokensClaimed(msg.sender, amountToClaim);
        } else {
            emit TokensClaimedToAccount(msg.sender, recipient, amountToClaim);
        }
    }

    // --- Fund Withdrawal Logic ---

    /**
     * @notice Allows the owner to withdraw available development funds.
     * @param amount The amount of ETH to withdraw.
     * @param recipient The address to receive the funds.
     */
    function withdrawDevelopmentFunds(uint256 amount, address payable recipient) external onlyOwner nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0 || amount > developmentFundsAvailable) revert WithdrawalAmountExceedsBalance();

        developmentFundsAvailable -= amount;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert ETHTransferFailed();

        emit DevelopmentFundsWithdrawn(recipient, amount);
    }

    /**
     * @notice Queues a withdrawal from the community treasury, starting a timelock.
     * @param recipient The address that will receive the funds.
     * @param amount The amount of ETH to be withdrawn.
     * @param purpose A description of the reason for the withdrawal.
     */
    function queueTreasuryWithdrawal(address payable recipient, uint256 amount, string calldata purpose) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        if (treasuryWithdrawalUnlockTime != 0) revert WithdrawalAlreadyPending();
        if (amount == 0 || amount > treasuryFundsAvailable) revert WithdrawalAmountExceedsBalance();

        treasuryWithdrawalRecipient = recipient;
        treasuryWithdrawalAmount = amount;
        treasuryWithdrawalPurpose = purpose;
        treasuryWithdrawalUnlockTime = block.timestamp + TREASURY_TIMELOCK_DELAY;

        emit TreasuryWithdrawalQueued(recipient, amount, purpose, treasuryWithdrawalUnlockTime);
    }

    /**
     * @notice Executes a queued treasury withdrawal after the timelock has passed.
     */
    function executeTreasuryWithdrawal() external onlyOwner nonReentrant {
        if (treasuryWithdrawalUnlockTime == 0) revert NoWithdrawalQueued();
        if (block.timestamp < treasuryWithdrawalUnlockTime) revert TimelockActive();

        uint256 amount = treasuryWithdrawalAmount;
        address payable recipient = payable(treasuryWithdrawalRecipient);

        // Reset state before transfer
        treasuryWithdrawalRecipient = address(0);
        treasuryWithdrawalAmount = 0;
        treasuryWithdrawalUnlockTime = 0;
        treasuryWithdrawalPurpose = "";
        
        treasuryFundsAvailable -= amount;

        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert ETHTransferFailed();

        emit TreasuryWithdrawalExecuted(recipient, amount);
    }
    
    /**
     * @notice Allows the owner to cancel a pending treasury withdrawal.
     */
    function cancelTreasuryWithdrawal() external onlyOwner {
        if (treasuryWithdrawalUnlockTime == 0) revert NoWithdrawalQueued();
        
        address recipient = treasuryWithdrawalRecipient;
        uint256 amount = treasuryWithdrawalAmount;
        
        treasuryWithdrawalRecipient = address(0);
        treasuryWithdrawalAmount = 0;
        treasuryWithdrawalUnlockTime = 0;
        treasuryWithdrawalPurpose = "";
        
        emit TreasuryWithdrawalCancelled(recipient, amount);
    }

    // --- View Functions ---

    /**
     * @notice Gets a snapshot of the current state of the presale.
     * @return currentPrice The current price per token in wei.
     * @return tokensRemaining The number of tokens still available for sale.
     * @return saleProgressBP The sale's progress towards the max supply, in basis points.
     * @return isActive True if the sale is not paused and tokens are still available.
     * @return objectiveProgressBP The progress towards the development objective, in basis points.
     */
    function getPresaleStats()
        external
        view
        returns (
            uint256 currentPrice,
            uint256 tokensRemaining,
            uint256 saleProgressBP,
            bool isActive,
            uint256 objectiveProgressBP
        )
    {
        currentPrice = getCurrentPrice();
        
        if (totalTokensSold >= MAX_TOKENS_FOR_SALE) {
            tokensRemaining = 0;
            saleProgressBP = 10000;
        } else {
            tokensRemaining = MAX_TOKENS_FOR_SALE - totalTokensSold;
            saleProgressBP = (totalTokensSold * 10000) / MAX_TOKENS_FOR_SALE;
        }

        isActive = !paused() && totalTokensSold < MAX_TOKENS_FOR_SALE;

        if (DEVELOPMENT_OBJECTIVE > 0) {
            objectiveProgressBP = Math.min((totalFundsRaised * 10000) / DEVELOPMENT_OBJECTIVE, 10000);
        } else {
            objectiveProgressBP = 0;
        }
    }

    /**
     * @notice Calculates the current price per token based on total tokens sold.
     * @return The current price per token in wei.
     */
    function getCurrentPrice() public view returns (uint256) {
        uint256 soldSquared = Math.mulDiv(totalTokensSold, totalTokensSold, 1);
        uint256 increment = Math.mulDiv(PRICE_INCREMENT, soldSquared, 1e36);
        return BASE_PRICE + increment;
    }

    /**
     * @notice Calculates how many tokens a user will receive for a given payment amount.
     * @param paymentAmount The amount of ETH to be spent.
     * @return The amount of tokens the user will receive.
     */
    function calculateTokensForPayment(uint256 paymentAmount) public view returns (uint256) {
        if (paymentAmount == 0) return 0;
        uint256 currentPrice = getCurrentPrice();
        if (currentPrice == 0) return 0; // Should not happen with BASE_PRICE > 0
        return Math.mulDiv(paymentAmount, 10**TOKEN_DECIMALS, currentPrice);
    }
    
    /**
     * @notice Returns the details of any pending treasury withdrawal.
     * @return recipient The address of the recipient.
     * @return amount The amount of the withdrawal.
     * @return purpose The purpose of the withdrawal.
     * @return unlockTime The timestamp when the withdrawal can be executed.
     */
    function getTreasuryState() external view returns (address recipient, uint256 amount, string memory purpose, uint256 unlockTime) {
        return (treasuryWithdrawalRecipient, treasuryWithdrawalAmount, treasuryWithdrawalPurpose, treasuryWithdrawalUnlockTime);
    }

    // --- Pausable Admin Functions ---

    /**
     * @notice Pauses the contract, preventing purchases.
     */
    function pause() external onlyOwner { _pause(); }

    /**
     * @notice Unpauses the contract, re-enabling purchases.
     */
    function unpause() external onlyOwner { _unpause(); }
}
