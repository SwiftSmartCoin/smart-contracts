// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SwiftCoin is ERC20 {
    uint256 private constant INITIAL_SUPPLY = 500000000 ether;

    constructor() ERC20("Swift", "SWFT") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }
}