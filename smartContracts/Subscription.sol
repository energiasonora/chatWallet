// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Subscription is Ownable {
    struct Plan {
        uint256 id;
        uint256 price;
        uint256 duration; // in seconds
    }

    struct UserSubscription {
        uint256 planId;
        uint256 startTime;
        uint256 endTime;
    }

    mapping(uint256 => Plan) public plans;
    mapping(address => UserSubscription) public subscriptions;

    IERC20 public paymentToken;
    address public serviceFeeWallet;

    event Subscribed(address indexed user, uint256 indexed planId, uint256 endTime);
    event PlanCreated(uint256 indexed planId, uint256 price, uint256 duration);
    event ServiceFeeWithdrawn(address indexed to, uint256 amount);

    constructor(address _paymentToken, address _serviceFeeWallet) Ownable(msg.sender) {
        paymentToken = IERC20(_paymentToken);
        serviceFeeWallet = _serviceFeeWallet;
    }

    function createPlan(uint256 _id, uint256 _price, uint256 _duration) external onlyOwner {
        plans[_id] = Plan(_id, _price, _duration);
        emit PlanCreated(_id, _price, _duration);
    }

    function subscribe(uint256 _planId) external {
        Plan memory plan = plans[_planId];
        require(plan.id != 0, "Plan does not exist");

        uint256 price = plan.price;
        require(paymentToken.transferFrom(msg.sender, address(this), price), "Payment failed");

        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + plan.duration;

        subscriptions[msg.sender] = UserSubscription(_planId, startTime, endTime);

        emit Subscribed(msg.sender, _planId, endTime);
    }

    function withdrawServiceFees() external {
        uint256 balance = paymentToken.balanceOf(address(this));
        require(balance > 0, "No fees to withdraw");
        require(paymentToken.transfer(serviceFeeWallet, balance), "Withdrawal failed");

        emit ServiceFeeWithdrawn(serviceFeeWallet, balance);
    }

    function checkSubscription(address _user) external view returns (bool) {
        return subscriptions[_user].endTime >= block.timestamp;
    }
}
