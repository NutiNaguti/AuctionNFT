// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.12;

import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

import "./interfaces/IAssets.sol";
import "./interfaces/ITreasury.sol";

contract Treasury is Ownable, ITreasury {
    IAssets private _assets;

    uint256 public constant FEE = 2;
    uint256 public constant DURATION = 1 hours;

    address private _auction;

    // token id => Trade details
    mapping(uint256 => PendingTrade) private _pendingTrades;
    // token id => index in _allTokensInPending
    mapping(uint256 => uint256) private _tokenIndexes;

    struct PendingTrade {
        address oldOwner;
        address newOwner;
        uint64 price;
        uint32 time;
        bool paid;
    }

    uint256[] private _allTokensInPending;

    event MoneyRecived(address from, uint256 amount, bytes msgData);

    constructor(address assetsAddress) {
        _assets = IAssets(assetsAddress);
    }

    function checkTrade(uint256 tokenId) external {
        PendingTrade memory tmp = _pendingTrades[tokenId];
        require(
            tmp.oldOwner != address(0) || tmp.newOwner != address(0),
            "Treasury: this trade doesn't exist"
        );

        if (block.timestamp >= tmp.time + DURATION) {
            if (msg.sender == tmp.oldOwner) {
                _assets.transferFrom(address(this), msg.sender, tokenId);
                return;
            }

            if (msg.sender == tmp.newOwner) {
                require(tmp.paid, "Treasury: trade time expired");
            }
        }

        require(tmp.paid, "Treasury: buyer has not paid yet");
        if (msg.sender == tmp.oldOwner) {
            (bool success, ) = msg.sender.call{
                value: tmp.price - ((tmp.time / 100) * FEE)
            }("Your token has been purchased");
            require(success, "Treasury: failed to send Ether");
        }

        if (msg.sender == tmp.newOwner) {
            _assets.transferFrom(address(this), msg.sender, tokenId);
        }
    }

    function pay(uint256 tokenId) external payable {
        PendingTrade memory tmp = _pendingTrades[tokenId];
        require(
            tmp.oldOwner != address(0) || tmp.newOwner != address(0),
            "Treasury: this trade doesn't exist"
        );
        require(
            block.timestamp < tmp.time + DURATION,
            "Trasury: trade time expired"
        );
        require(!tmp.paid, "Treasury: already paid");
        require(msg.sender == tmp.newOwner, "Treasury: you are not new owner");
        require(msg.value == tmp.price, "Treasury: not enougth ETH");
        _pendingTrades[tokenId].paid = true;
    }

    function addNewPendingTrade(
        address oldOwner,
        address newOwner,
        uint256 tokenId,
        uint256 time,
        uint256 price
    ) external {
        require(msg.sender == _auction, "Treasury: only auction can use this");
        if (_pendingTrades[tokenId].paid) {
            delete _pendingTrades[tokenId];
        }
        _pendingTrades[tokenId] = PendingTrade(
            oldOwner,
            newOwner,
            uint64(price),
            uint32(time),
            false
        );
        _allTokensInPending.push(tokenId);
        _tokenIndexes[tokenId] = _allTokensInPending.length - 1;
    }

    function setAuctionAddress(address newAuctionAddress) external onlyOwner {
        _auction = newAuctionAddress;
    }

    fallback() external payable {}

    receive() external payable {}
}
