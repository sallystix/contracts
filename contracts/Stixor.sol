//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Stixor is ERC721, AccessControl {
    uint256 public constant supply_cap = 10;
    uint256 public total_tokens_minted = 0;
    uint256 public mint_cost = 0.5 ether;
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC721("Stixor", "STX") {
        //assign the deployer admin role
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setCost(uint256 newCost) public onlyRole(DEFAULT_ADMIN_ROLE) {
        mint_cost = newCost;
    }

    function mint(address to, uint256 num)
        public
        payable
        onlyRole(MINTER_ROLE)
    {
        require(total_tokens_minted + num <= supply_cap, "supply cap reached");
        require(msg.value >= mint_cost * num, "Not enough ether");
        for (uint256 i = 0; i < num; i++) {
            _safeMint(to, total_tokens_minted);
            total_tokens_minted++;
        }
    }
}
