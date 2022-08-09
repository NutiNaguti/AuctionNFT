// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.12;

interface ITreasury {
    function checkTrade(uint256 tokenId) external;
    function addNewPendingTrade(
        address oldOwner,
        address newOwner,
        uint256 tokenId,
        uint256 time,
        uint256 price
    ) external;
}
