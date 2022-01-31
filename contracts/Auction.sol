//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract AbsoluteAuction {
    event AddEvent(uint256, uint256);
    struct AuctionListing {
        address seller;
        uint256 tokenId;
        uint256 startTime;
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

    function addAuctionListing(uint256 tokenId, uint256 expiresAt) internal {
        // check if owner of token is the one adding the listing
        require(
            stixor_contract.ownerOf(tokenId) == msg.sender,
            "only owner of token can list it"
        );
        require(
            expiresAt > block.timestamp,
            "expiry time has to be greater than start time"
        );
        stixor_contract.safeTransferFrom(msg.sender, address(this), tokenId);
        auctionListings[listingId] = AuctionListing(
            msg.sender,
            tokenId,
            block.timestamp,
            expiresAt,
            address(0),
            0
        );
        listingId++;
    }

    function cancelAuctionListing(uint256 listing_Id) internal {
        AuctionListing memory listing = auctionListings[listing_Id];

        //listing cancelled
        delete auctionListings[listing_Id];

        //trasnfer token back to seller
        stixor_contract.safeTransferFrom(
            address(this),
            listing.seller,
            listing.tokenId,
            ""
        );
    }

    function extendAuctionTime(uint256 listing_Id, uint256 time_extension)
        internal
    {
        require(time_extension > 0, "time extension must be greater than 0");
        auctionListings[listing_Id].expiresAt += time_extension;
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
        AuctionListing storage listing = auctionListings[listing_Id];

        require(msg.value > listing.bidAmount, "insufficient bid amount");
        listing.highestBidder = msg.sender;
        listing.bidAmount = msg.value;
    }

    function claimToken(uint256 listing_Id) internal {
        AuctionListing memory listing = auctionListings[listing_Id];

        require(block.timestamp > listing.expiresAt, "auction is not over yet");
        require(
            listing.highestBidder == msg.sender,
            "only highest bidder can claim token"
        );

        //remove listing
        delete auctionListings[listing_Id];

        //first transfer token
        stixor_contract.safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            ""
        );
        //then send ether to seller
        payable(listing.seller).transfer(listing.bidAmount);
    }
}
