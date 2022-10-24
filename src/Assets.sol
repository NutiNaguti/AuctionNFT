// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC721/ERC721Upgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/security/PausableUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/utils/CountersUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/utils/cryptography/MerkleProofUpgradeable.sol";
import "lib/openzeppelin-contracts-upgradeable/contracts/utils/StringsUpgradeable.sol";

import "./interfaces/IAssets.sol";
import "./interfaces/IBlacklist.sol";

contract Assets is
    Initializable,
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    PausableUpgradeable,
    OwnableUpgradeable,
    IAssets
{
    using StringsUpgradeable for uint256;
    using CountersUpgradeable for CountersUpgradeable.Counter;

    IBlacklist private _blacklist;

    uint256 public constant MAX_SUPPLY = 1111;

    string private _baseUri;
    string private _uriSuffix;
    uint256 private _basePrice;
    uint256 private _additionalPrice;
    bytes32 private _merkleRoot;
    address private _auction;

    CountersUpgradeable.Counter private _counter;

    // user => token id => Asset
    mapping(address => mapping(uint256 => Asset)) private _ownedAssets;
    mapping(uint256 => bool) private _tokenLocked;
    mapping(address => bool) private _tokenClaimed;

    function initialize(
        string memory name,
        string memory symbol,
        string memory baseUri,
        uint256 basePrice,
        uint256 additionalPrice,
        address blacklistAddress
    ) public initializer {
        _baseUri = baseUri;
        _uriSuffix = ".json";
        _basePrice = basePrice;
        _additionalPrice = additionalPrice;

        _blacklist = IBlacklist(blacklistAddress);

        __ERC721_init(name, symbol);
        __ERC721Enumerable_init();
        __Ownable_init();
        __Pausable_init();
    }

    function mint(address to, string memory content)
        external
        payable
        whenNotPaused
    {
        require(_counter.current() < MAX_SUPPLY, "Assets: limit reached");
        require(
            !_blacklist.isInBlacklist(to),
            "Assets: cannot mint for user in blacklist"
        );
        require(!_tokenClaimed[to], "Assets: this user already claimed token");
        require(
            msg.value == _basePrice + _additionalPrice,
            "Assets: not enougth ETH"
        );

        _counter.increment();
        _mint(to, _counter.current());
        _ownedAssets[to][_counter.current()] = Asset(content);
        _tokenClaimed[to] = true;
    }

    function whitelistMint(
        address to,
        bytes32[] memory merkleProof,
        string memory content
    ) external payable {
        require(_counter.current() < MAX_SUPPLY, "Assets: limit reached");
        require(
            !_blacklist.isInBlacklist(to),
            "Assets: cannot mint for user in blacklist"
        );
        require(!_tokenClaimed[to], "Assets: this user already claimed token");
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProofUpgradeable.verify(merkleProof, _merkleRoot, leaf),
            "Assets: Incorrect proof"
        );
        require(msg.value == _basePrice, "Assets: not enougth ETH");
        _counter.increment();
        _mint(to, _counter.current());
        _ownedAssets[to][_counter.current()] = Asset(content);
        _tokenClaimed[to] = true;
    }

    function getContent(address user, uint256 tokenId)
        external
        view
        returns (string memory)
    {
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

    function isLocked(uint256 tokenId) external view returns (bool) {
        // require(msg.sender == _auction, "Assets: msg.sender isn't auction");
        return _tokenLocked[tokenId];
    }

    function setAuctionAddress(address auctionAddress) external onlyOwner {
        _auction = auctionAddress;
    }

    function setMerkeleRoot(bytes32 newRoot) external onlyOwner {
        _merkleRoot = newRoot;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(
            _exists(tokenId),
            "ERC721Metadata: URI query for nonexistent token"
        );
        string memory baseUri = _baseURI();
        return
            bytes(baseUri).length > 0
                ? string.concat(baseUri, tokenId.toString(), _uriSuffix)
                : "";
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
        require(
            !_blacklist.isInBlacklist(from),
            "Assets: cannot transfer token from blacklisted user"
        );
        require(
            !_blacklist.isInBlacklist(to),
            "Assets: cannot transfer token to blacklisted user"
        );
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
        override(
            ERC721Upgradeable,
            ERC721EnumerableUpgradeable,
            IERC165Upgradeable
        )
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
