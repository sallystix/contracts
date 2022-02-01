//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

contract AbsoluteAuction {
    event AddEvent(uint256, uint256);
    struct AuctionListing {
        address seller;
        uint256 tokenId;
        uint256 expiresAt;
        address highestBidder;
        uint256 bidAmount;
    }

    IERC721 private stixor_contract;
    uint256 private listingId = 0;
    mapping(uint256 => AuctionListing) public auctionListings;

    constructor(IERC721 contract_address) {
        stixor_contract = contract_address;
    }

    event addAuctionEvent(uint256, uint256);

    function addAuctionListing(uint256 tokenId, uint256 expiresAt) internal {
        // check if owner of token is the one adding the listing
        require(
            stixor_contract.ownerOf(tokenId) == msg.sender,
            "only owner of token can list it"
        );
        // emit addAuctionEvent(expiresAt, block.timestamp);
        require(
            expiresAt - block.timestamp >= 15 * 60,
            "expiry time has to be 15 minutes or more than start time"
        );
        auctionListings[listingId] = AuctionListing(
            msg.sender,
            tokenId,
            expiresAt,
            address(0),
            0
        );
        listingId++;

        stixor_contract.safeTransferFrom(msg.sender, address(this), tokenId);
        emit addAuctionEvent(block.timestamp, expiresAt);
    }

    function cancelAuctionListing(uint256 listing_Id) internal {
        AuctionListing memory listing = auctionListings[listing_Id];

        //listing cancelled
        delete auctionListings[listing_Id];

        //transfer token back to seller
        stixor_contract.safeTransferFrom(
            address(this),
            listing.seller,
            listing.tokenId,
            ""
        );

        //refund amount to highest bidder
        payable(listing.highestBidder).transfer(listing.bidAmount);
    }

    function bidOnAuctionListing(uint256 listing_Id) external payable {
        require(
            auctionListings[listing_Id].seller != address(0),
            "Auction does not exist"
        );
        require(
            auctionListings[listing_Id].seller != msg.sender,
            "bidder cannot be seller"
        );
        require(
            block.timestamp < auctionListings[listing_Id].expiresAt,
            "auction is over"
        );
        require(
            msg.value > auctionListings[listing_Id].bidAmount,
            "insufficient bid amount"
        );
        AuctionListing memory listing = auctionListings[listing_Id];

        //assign new highest bidder
        auctionListings[listing_Id].highestBidder = msg.sender;
        auctionListings[listing_Id].bidAmount = msg.value;

        //extend auction by 15 minutes if bid is made within last 8 minutes
        if (listing.expiresAt - block.timestamp < 8 * 60) {
            auctionListings[listing_Id].expiresAt += 15 * 60;
        }

        //refund amount to previous highest bidder
        payable(listing.highestBidder).transfer(listing.bidAmount);
    }

    function resolveAuction(uint256 listing_Id) internal {
        AuctionListing memory listing = auctionListings[listing_Id];
        require(
            block.timestamp >= listing.expiresAt,
            "auction is not over yet"
        );

        //remove listing
        delete auctionListings[listing_Id];

        //if there were no bidders, transfer token back to seller
        if (listing.highestBidder == address(0)) {
            stixor_contract.safeTransferFrom(
                address(this),
                listing.seller,
                listing.tokenId,
                ""
            );
            return;
        }

        stixor_contract.safeTransferFrom(
            address(this),
            listing.highestBidder,
            listing.tokenId,
            ""
        );
        payable(listing.seller).transfer(listing.bidAmount);
    }
}
