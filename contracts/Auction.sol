// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./interfaces/IAssets.sol";
import "./interfaces/ITreasury.sol";
import "./interfaces/IBlacklist.sol";

contract Auction is Initializable, PausableUpgradeable, OwnableUpgradeable {
    IAssets private _assets;
    ITreasury private _treasury;
    IBlacklist private _blacklist;

    uint256 public constant FEE = 3;
    uint256 public constant DISTINCTION = 3;
    uint256 public tokensAmount;

    // token id => Bid)
    mapping(uint256 => Bid) private _lastBids;
    // token id => initial price)
    mapping(uint256 => uint256) private _initPrices;
    // token id => owner
    mapping(uint256 => address) private _assetOwners;
    // token id => index in _allTokens
    mapping(uint256 => uint256) private _assetIndexes;

    struct Bid {
        uint32 time;
        uint128 price;
        address user;
    }

    uint256[] private _allTokens;

    event PlaceAsset(
        address seller,
        uint256 tokenId,
        uint256 price,
        uint256 time
    );
    event CancelAsset(
        address seller,
        uint256 tokenId,
        uint256 price,
        uint256 time
    );
    event AcceptOffer(
        address seller,
        address buyer,
        uint256 tokenId,
        uint256 price,
        uint256 time
    );
    event BuyAsset(
        address bidder,
        uint256 tokenId,
        uint256 price,
        uint256 time
    );
    event PlaceBid(
        address bidder,
        uint256 tokenId,
        uint256 price,
        uint256 time
    );

    function initialize(
        address assetsAddress,
        address treasuryAddress,
        address blacklistAddress
    ) public initializer {
        _assets = IAssets(assetsAddress);
        _treasury = ITreasury(treasuryAddress);
        _blacklist = IBlacklist(blacklistAddress);

        __Pausable_init();
        __Ownable_init();
    }

    // ---------------------
    // Seller functions
    function sellAsset(uint256 tokenId, uint256 price) external whenNotPaused {
        require(!_isContract(msg.sender), "Auction: only EOA");
        require(
            msg.sender == _assets.ownerOf(tokenId),
            "Auction: you are not the owner of token"
        );
        require(
            !_blacklist.isInBlacklist(msg.sender),
            "Auction: blacklisted user cannot sell"
        );
        require(
            _lastBids[tokenId].time == 0,
            "Auction: this token already placed"
        );
        _assets.lockToken(tokenId);
        _lastBids[tokenId] = Bid(
            uint32(block.timestamp),
            uint128(price),
            msg.sender
        );
        _initPrices[tokenId] = price;
        _assetOwners[tokenId] = msg.sender;
        _allTokens.push(tokenId);
        _assetIndexes[tokenId] = _allTokens.length - 1;
        tokensAmount++;
        emit PlaceAsset(msg.sender, tokenId, price, block.timestamp);
    }

    function cancelAsset(uint256 tokenId) external whenNotPaused {
        require(!_isContract(msg.sender), "Auction: only EOA");
        require(
            msg.sender == _assets.ownerOf(tokenId),
            "Auction: you are not the owner of token"
        );
        require(
            _lastBids[tokenId].time != 0,
            "Auction: this token is not for sale on the auction"
        );
        if (_allTokens.length < 2) {
            _allTokens.pop();
        } else {
            uint256 index = _assetIndexes[tokenId];
            _allTokens[index] = _allTokens[tokensAmount - 1];
            _allTokens.pop();
        }
        emit CancelAsset(
            msg.sender,
            tokenId,
            _lastBids[tokenId].price,
            block.timestamp
        );

        _assets.unlockToken(tokenId);
        _deleteAssetData(tokenId);
        tokensAmount--;
    }

    function acceptOffer(uint256 tokenId) external whenNotPaused {
        require(!_isContract(msg.sender), "Auction: only EOA");
        require(
            msg.sender == _assets.ownerOf(tokenId),
            "Auction: you are not the owner of token"
        );
        require(
            msg.sender != _lastBids[tokenId].user,
            "Auction: you tried to buy your token"
        );
        require(
            !_blacklist.isInBlacklist(msg.sender),
            "Auction: blacklisted user cannot sell"
        );

        if (_allTokens.length < 2) {
            _allTokens.pop();
        } else {
            uint256 index = _assetIndexes[tokenId];
            _allTokens[index] = _allTokens[tokensAmount - 1];
            _allTokens.pop();
        }

        emit AcceptOffer(
            msg.sender,
            _lastBids[tokenId].user,
            tokenId,
            _lastBids[tokenId].price,
            _lastBids[tokenId].time
        );

        tokensAmount--;
        _assets.unlockToken(tokenId);
        _assets.transferFrom(msg.sender, address(_treasury), tokenId);
        _treasury.addNewPendingTrade(
            msg.sender,
            _lastBids[tokenId].user,
            tokenId,
            _lastBids[tokenId].time,
            _lastBids[tokenId].price
        );
        _deleteAssetData(tokenId);
    }

    // ---------------------
    // Buyer functions
    function buyAsset(uint256 tokenId) external payable whenNotPaused {
        require(!_isContract(msg.sender), "Auction: only EOA");
        require(
            msg.value == _lastBids[tokenId].price,
            "Assets: not enougth ETH"
        );
        require(
            _lastBids[tokenId].price == _initPrices[tokenId],
            "Auction: can only be purchased if no bids have been placed"
        );
        require(
            _lastBids[tokenId].user != msg.sender,
            "Auction: you tried to buy your token"
        );
        (bool sent, ) = _assetOwners[tokenId].call{
            value: msg.value - (msg.value / 100) * FEE
        }("Your token has been purchased");
        require(sent, "Auction: failed to send Ether");
        require(
            !_blacklist.isInBlacklist(msg.sender),
            "Auction: blacklisted user cannot buy"
        );
        _assets.unlockToken(tokenId);
        _assets.transferFrom(_assetOwners[tokenId], msg.sender, tokenId);
        if (_allTokens.length < 2) {
            _allTokens.pop();
        } else {
            uint256 index = _assetIndexes[tokenId];
            _allTokens[index] = _allTokens[tokensAmount - 1];
            _allTokens.pop();
        }
        _deleteAssetData(tokenId);
        tokensAmount--;
    }

    function placeBid(uint256 tokenId, uint256 price) external whenNotPaused {
        require(!_isContract(msg.sender), "Auction: only EOA");
        require(
            !_blacklist.isInBlacklist(msg.sender),
            "Auction: blacklisted user cannot buy"
        );
        require(
            price >=
                _lastBids[tokenId].price +
                    (_lastBids[tokenId].price / 100) *
                    DISTINCTION,
            "Auction: the next bet must be greater than than the previous one + 3%"
        );
        Bid memory newBid = Bid(
            uint32(block.timestamp),
            uint128(price),
            msg.sender
        );
        _lastBids[tokenId] = newBid;
    }

    function getLastBid(uint256 tokenId)
        external
        view
        returns (
            uint256,
            uint256,
            address
        )
    {
        Bid memory tmp = _lastBids[tokenId];
        return (tmp.time, tmp.price, tmp.user);
    }

    function getAllAssetIds() external view returns (uint256[] memory) {
        return _allTokens;
    }

    function getOwnerOfAsset(uint256 tokenId) external view returns (address) {
        return _assetOwners[tokenId];
    }

    // ---------------------
    // Internal functions
    function _isContract(address _addr) private view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }

    function _deleteAssetData(uint256 tokenId) internal {
        delete _lastBids[tokenId];
        delete _initPrices[tokenId];
        delete _assetOwners[tokenId];
        delete _assetIndexes[tokenId];
    }

    // ---------------------
    // Admin functions
    function getAllEth() external onlyOwner {
        (bool sent, ) = msg.sender.call{value: address(this).balance}(
            "ETH withdrowal"
        );
        require(sent, "Auction: failed to send Ether");
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    receive() external payable {}
}
