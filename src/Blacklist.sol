// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.12;

import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

import "./interfaces/IBlacklist.sol";

contract Blacklist is Ownable, IBlacklist {
    mapping(address => bool) _blacklisted;

    function addToBlacklist(address user) external onlyOwner {
        require(!_blacklisted[user], "Blacklist: user already blacklisted");
        _blacklisted[user] = true;
    }

    function removeFromBlacklist(address user) external onlyOwner {
        require(_blacklisted[user], "Blacklist: user not in blacklist");
        _blacklisted[user] = false;
    }

    function isInBlacklist(address user) external view returns (bool) {
        return _blacklisted[user];
    }
}
