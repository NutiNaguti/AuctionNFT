// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";

import "./interfaces/IAssets.sol";

contract Assets is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    IAssets
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    string private _baseUri;
    uint256 private _basePrice;
    address private _auction;

    CountersUpgradeable.Counter private _counter;

    // user => token id => Asset
    mapping(address => mapping(uint256 => Asset)) private _ownedAssets;
    mapping(uint256 => bool) private _tokenLocked;

    function initialize(
        string memory name,
        string memory symbol,
        string calldata baseUri,
        uint256 basePrice
    ) public initializer {
        _baseUri = baseUri;
        _basePrice = basePrice;

        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
    }

    function mint(address to, bytes memory content)
        external
        payable
        whenNotPaused
    {
        require(msg.value == _basePrice, "Assets: not enougth ETH");

        _counter.increment();
        _mint(to, _counter.current());
        _ownedAssets[to][_counter.current()] = Asset(content);
    }

    function getContent(address user, uint256 tokenId) external view returns(string memory) {
        return string(_ownedAssets[user][tokenId].content);
    }

    function lockToken(uint256 tokenId) external {
        require(msg.sender == _auction, "Assets: msg.sender isn't auction");
        _tokenLocked[tokenId] = true;
    }  

    function unlockToken(uint256 tokenId) external {
        require(msg.sender == _auction, "Assets: msg.sender isn't auction");
        _tokenLocked[tokenId] = false;
    }

    function isLock(uint256 tokenId) external view returns(bool) {
        require(msg.sender == _auction, "Assets: msg.sender isn't auction");
        return _tokenLocked[tokenId];
    }

    function setAuctionAddress(address auctionAddress) external onlyOwner {
        _auction = auctionAddress;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseUri;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._beforeTokenTransfer(from, to, tokenId);
        require(!_tokenLocked[tokenId], "Assets: token is at auction");
        _ownedAssets[to][tokenId] = _ownedAssets[from][tokenId];
        delete _ownedAssets[from][tokenId];
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
