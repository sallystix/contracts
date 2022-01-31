//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "./FixedPrice.sol";
import "./Auction.sol";

contract MarketPlace is IERC721Receiver, AbsoluteAuction, FixedPrice {
    constructor(IERC721 contract_address)
        AbsoluteAuction(contract_address)
        FixedPrice(contract_address)
    {}

    modifier onlySeller(address seller) {
        require(
            seller == msg.sender,
            "only seller can make changes to this listing"
        );
        _;
    }

    modifier auctionlistingExists(uint256 listing_Id) {
        require(
            auctionListings[listing_Id].seller != address(0),
            "Auction does not exist"
        );
        _;
    }

    modifier fixedPriceListingExists(uint256 listing_Id) {
        require(
            listings[listing_Id].seller != address(0),
            "listing does not exist"
        );
        _;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function addFixedPrice(uint256 tokenId, uint256 price) external {
        addFixedPriceListing(tokenId, price);
    }

    function addAuction(uint256 tokenId, uint256 expiresAt) external {
        addAuctionListing(tokenId, expiresAt);
    }

    function cancelFixedPrice(uint256 listing_Id)
        external
        fixedPriceListingExists(listing_Id)
        onlySeller(listings[listing_Id].seller)
    {
        cancelFixedPriceListing(listing_Id);
    }

    function cancelAuction(uint256 listing_Id)
        external
        auctionlistingExists(listing_Id)
        onlySeller(auctionListings[listing_Id].seller)
    {
        cancelAuctionListing(listing_Id);
    }

    function extendAuction(uint256 listing_Id, uint256 time_extension)
        external
        auctionlistingExists(listing_Id)
        onlySeller(auctionListings[listing_Id].seller)
    {
        extendAuctionTime(listing_Id, time_extension);
    }

    function editFixedPrice(uint256 listing_Id, uint256 price)
        external
        fixedPriceListingExists(listing_Id)
        onlySeller(listings[listing_Id].seller)
    {
        editFixedPriceListing(listing_Id, price);
    }

    function claimOnTimeout(uint256 listing_Id)
        external
        auctionlistingExists(listing_Id)
    {
        claimToken(listing_Id);
    }
}
