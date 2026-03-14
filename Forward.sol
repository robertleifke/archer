// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Forward {
    address public buyer;
    address public seller;
    uint256 public forwardPrice; // Agreed-upon price
    uint256 public settlementDate; // UNIX timestamp for settlement
    bool public isSettled;

    event Created(address buyer, address seller, uint256 forwardPrice, uint256 settlementDate);
    event Settled(address buyer, address seller, uint256 settlementPrice);

    modifier onlyParties() {
        require(msg.sender == buyer || msg.sender == seller, "Not authorized");
        _;
    }

    modifier notSettled() {
        require(!isSettled, "Contract already settled");
        _;
    }

    modifier afterSettlementDate() {
        require(block.timestamp >= settlementDate, "Settlement date not reached");
        _;
    }

    constructor(
        address _buyer,
        address _seller,
        uint256 _forwardPrice,
        uint256 _settlementDate
    ) {
        require(_buyer != address(0) && _seller != address(0), "Invalid addresses");
        require(_settlementDate > block.timestamp, "Settlement date must be in the future");

        buyer = _buyer;
        seller = _seller;
        forwardPrice = _forwardPrice;
        settlementDate = _settlementDate;

        emit Created(buyer, seller, forwardPrice, settlementDate);
    }

    function settle() external payable onlyParties notSettled afterSettlementDate {
        if (msg.sender == buyer) {
            // Buyer pays forward price to the seller
            require(msg.value == forwardPrice, "Incorrect payment amount");
            payable(seller).transfer(msg.value);
        } else if (msg.sender == seller) {
            // Seller confirms the delivery of asset
            require(msg.value == 0, "Seller does not send Ether");
        }

        isSettled = true;

        emit Settled(buyer, seller, forwardPrice);
    }
}
