// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721Upgradeable.sol";

interface IAssets is IERC721Upgradeable {
    struct Asset {
        bytes content;
    }
    function lockToken(uint256 tokenId) external;
    function unlockToken(uint256 tokenId) external;
    function isLock(uint256 tokenId) external view returns(bool);
}
