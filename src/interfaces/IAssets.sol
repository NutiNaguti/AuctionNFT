// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.12;

import "lib/openzeppelin-contracts-upgradeable/contracts/token/ERC721/IERC721Upgradeable.sol";

interface IAssets is IERC721Upgradeable {
    struct Asset {
        string content;
    }

    function lockToken(uint256 tokenId) external;

    function unlockToken(uint256 tokenId) external;

    function isLocked(uint256 tokenId) external view returns (bool);
}
