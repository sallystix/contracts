//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract FixedPrice {
    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
    }

    IERC721 private stixor_contract;
    uint256 private listingId = 0;
    mapping(uint256 => Listing) public listings;

    constructor(IERC721 contract_address) {
        stixor_contract = contract_address;
    }

    function addFixedPriceListing(uint256 tokenId, uint256 price) internal {
        require(price > 0, "price has to be greater than 0");
        // check if owner of token is the one adding the listing
        require(
            stixor_contract.ownerOf(tokenId) == msg.sender,
            "only owner of token can list it"
        );
        stixor_contract.safeTransferFrom(msg.sender, address(this), tokenId);
        listings[listingId] = Listing(msg.sender, tokenId, price);
        listingId++;
    }

    function cancelFixedPriceListing(uint256 listing_Id) internal {
        Listing memory listing = listings[listing_Id];

        //listing cancelled
        delete listings[listing_Id];

        //trasnfer token back to seller
        stixor_contract.safeTransferFrom(
            address(this),
            listing.seller,
            listing.tokenId,
            ""
        );
    }

    function editFixedPriceListing(uint256 listing_Id, uint256 price) internal {
        Listing storage listing = listings[listing_Id];
        listing.price = price;
    }

    function buyFixedPriceToken(uint256 listing_Id) external payable {
        require(
            listings[listing_Id].seller != address(0),
            "listing does not exist"
        );
        require(
            listings[listing_Id].seller != msg.sender,
            "buyer cannot be seller"
        );
        require(
            listings[listing_Id].price <= msg.value,
            "insufficient amount to buy token"
        );

        Listing memory listing = listings[listing_Id];

        //remove listing
        delete listings[listing_Id];

        //first transfer token
        stixor_contract.safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            ""
        );
        //then send ether to seller
        payable(listing.seller).transfer(listing.price);
        payable(msg.sender).transfer(msg.value - listing.price);
    }
}
