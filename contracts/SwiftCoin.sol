// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SwiftCoin is ERC20 {
    uint256 private constant INITIAL_SUPPLY = 500000000 ether;
    string private constant NAME = "Swift";
    string private constant SYMBOL = "SWFT";

    constructor(address _admin) ERC20(NAME, SYMBOL) {
        _mint(_admin, INITIAL_SUPPLY);
    }
}
