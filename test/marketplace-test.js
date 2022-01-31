const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

let Stixor;
let stixor;
let Marketplace;
let marketplace;

describe("Market place", function () {
  beforeEach(async function () {
    Stixor = await ethers.getContractFactory("Stixor");
    stixor = await Stixor.deploy();
    Marketplace = await ethers.getContractFactory("MarketPlace");
    marketplace = await Marketplace.deploy(stixor.address);
    await stixor.deployed();
    await marketplace.deployed();

    [owner, user1, user2, user3] = await ethers.getSigners();
    //mints 5 tokens to user1
    await stixor.mint(user1.address, 5, {
      value: ethers.utils.parseEther("3"),
    });
    //approve marketplace as operator
    await stixor.connect(user1).setApprovalForAll(marketplace.address, true);
  });

  it("can't add a fixed price listing with 0 price", async function () {
    await expect(marketplace.addFixedPrice(0, 0)).to.be.revertedWith(
      "price has to be greater than 0"
    );
  });

  it("can't add auction with expiry time less than current time", async function () {
    const auctionTimeInMilSeconds = 30 * 1000;
    const expiryTimeInSeconds = new Date().getTime() / 1000 - 600;
    await expect(
      marketplace.connect(user1).addAuction(0, Math.floor(expiryTimeInSeconds))
    ).to.be.revertedWith("expiry time has to be greater than start time");
  });

  it("should only allow owner to add token to fixed price", async function () {
    //listing with non owner
    await expect(
      marketplace.connect(user2).addFixedPrice(0, ethers.utils.parseEther("10"))
    ).to.be.revertedWith("only owner of token can list it");

    //listing with owner
    marketplace.connect(user1).addFixedPrice(0, ethers.utils.parseEther("10"));
  });

  it("should only allow owner to add token to auction listing", async function () {
    const auctionTimeInMilSeconds = 30 * 1000;
    const expiryTimeInSeconds = new Date().getTime() / 1000 + 600;
    await expect(
      marketplace.connect(user2).addAuction(0, Math.floor(expiryTimeInSeconds))
    ).to.be.revertedWith("only owner of token can list it");

    //listing with owner
    marketplace.connect(user1).addAuction(1, Math.floor(expiryTimeInSeconds));
  });

  it("can't cancel a fixed price listing that doesn't exist", async function () {
    await expect(
      marketplace.connect(user1).cancelFixedPrice(0)
    ).to.be.revertedWith("listing does not exist");
  });

  it("can't cancel a auction listing that doesn't exist", async function () {
    await expect(
      marketplace.connect(user1).cancelAuction(0)
    ).to.be.revertedWith("Auction does not exist");
  });

  it("can cancel a auction listing that exists", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    await marketplace.connect(user1).addAuction(0, timestamp + 10);
    await marketplace.connect(user1).cancelAuction(0);
  });

  it("shouldn't allow anyone other than seller to cancel fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    await expect(
      marketplace.connect(user2).cancelFixedPrice(0)
    ).to.be.revertedWith("only seller can make changes to this listing");
    await marketplace.connect(user1).cancelFixedPrice(0);
  });

  it("shouldn't allow anyone other than seller to cancel auction listing", async function () {
    const auctionTimeInMilSeconds = 30 * 1000;
    const expiryTimeInSeconds = new Date().getTime() / 1000 + 600;
    await marketplace
      .connect(user1)
      .addAuction(1, Math.floor(expiryTimeInSeconds));
    await expect(
      marketplace.connect(user2).cancelAuction(0)
    ).to.be.revertedWith("only seller can make changes to this listing");
    await marketplace.connect(user1).cancelAuction(0);
  });

  it("should only allow seller to edit fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    await expect(
      marketplace
        .connect(user2)
        .editFixedPrice(0, ethers.utils.parseEther("11"))
    ).to.be.revertedWith("only seller can make changes to this listing");
    //user 1 can edit listing
    await marketplace
      .connect(user1)
      .editFixedPrice(0, ethers.utils.parseEther("11"));
    let listing = await marketplace.listings(0);
    expect(listing.price.toString()).to.equal(ethers.utils.parseEther("11"));
  });

  it("shouldn't allow seller to extend auction by 0 seconds", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const expiryTime = block.timestamp + 1 + 10;

    await marketplace.connect(user1).addAuction(0, expiryTime);

    //user 1 extends auction by 0
    await expect(
      marketplace.connect(user1).extendAuction(0, 0)
    ).to.revertedWith("time extension must be greater than 0");
    const Auction = await marketplace.auctionListings(0);
  });

  it("should only allow seller to extend auction listing", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const expiryTime = block.timestamp + 1 + 10;

    await marketplace.connect(user1).addAuction(0, expiryTime);

    // user2 cannot extend auction
    await expect(marketplace.connect(user2).extendAuction(0, 10)).revertedWith(
      "only seller can make changes to this listing"
    );

    //user 1 can extend auction by 10 seconds
    await marketplace.connect(user1).extendAuction(0, 10);
    const Auction = await marketplace.auctionListings(0);

    expect(Auction.expiresAt.toNumber() - expiryTime).to.equal(10);
  });

  it("shouldn't allow seller to purchase his own token", async function () {
    // attempting to buy fixed price listing token
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    await expect(
      marketplace.connect(user1).buyFixedPriceToken(0)
    ).to.be.revertedWith("buyer cannot be seller");
  });

  it("shouldn't allow seller to bid on his own token", async function () {
    const expiryTimeInSeconds = new Date().getTime() / 1000 + 600;
    //attempting to bid on token auction
    await marketplace
      .connect(user1)
      .addAuction(1, Math.floor(expiryTimeInSeconds));
    await expect(
      marketplace.connect(user1).bidOnAuctionListing(0)
    ).to.be.revertedWith("bidder cannot be seller");
  });

  it("shouldn't allow a purchase if amount is less than price on fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    await expect(
      marketplace.connect(user2).buyFixedPriceToken(0, {
        value: ethers.utils.parseEther("5"),
      })
      //attempting to buy with sufficient amount
    ).to.be.revertedWith("insufficient amount to buy token");
    await marketplace.connect(user2).buyFixedPriceToken(0, {
      value: ethers.utils.parseEther("10"),
    });
  });

  it("shouldn't allow a bid if amount is less than or equal to highest bid on auction listing", async function () {
    const expiryTimeInSeconds = new Date().getTime() / 1000 + 600;
    await marketplace
      .connect(user1)
      .addAuction(0, Math.floor(expiryTimeInSeconds));
    //user2 makes bid of 10 ether
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //user3 makes bid of 8 ether
    await expect(
      marketplace.connect(user3).bidOnAuctionListing(0, {
        value: ethers.utils.parseEther("8"),
      })
    ).revertedWith("insufficient bid amount");
    //user3 makes bid of 10 ether
    await expect(
      marketplace.connect(user3).bidOnAuctionListing(0, {
        value: ethers.utils.parseEther("10"),
      })
    ).revertedWith("insufficient bid amount");
  });

  it("should deposit token to buyer and the price to seller after fixed price purchase", async function () {
    const provider = waffle.provider;
    let initialBalance = await provider.getBalance(user2.address);
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));

    //user 2 buys fixed price token
    await marketplace.connect(user2).buyFixedPriceToken(0, {
      value: ethers.utils.parseEther("10"),
    });

    //check if buyer has received token
    let owner = await stixor.ownerOf(0);
    expect(owner).to.equal(user2.address);

    //check if seller received amount
    let currentBalance = await provider.getBalance(user2.address);
    expect(
      ethers.utils.formatEther(initialBalance) -
        ethers.utils.formatEther(currentBalance)
    ).to.greaterThan(10);
  });

  it("should not let anyone claim token before auction ends", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15);
    let initialBalance = await provider.getBalance(user2.address);

    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //wait 14 seconds
    await new Promise((r) => setTimeout(r, 13000));

    //user 2 claims token before auction expires
    await expect(marketplace.connect(user2).claimOnTimeout(0)).revertedWith(
      "auction is not over yet"
    );
  });

  it("should not allow a bid amount of 0", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15);

    //user 2 bids on auction
    await expect(
      marketplace.connect(user2).bidOnAuctionListing(0, {
        value: ethers.utils.parseEther("0"),
      })
    ).revertedWith("insufficient bid amount");
  });

  it("should not let anyone other than highest bidder claim token", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15);

    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //wait 14 seconds
    await new Promise((r) => setTimeout(r, 15000));

    //user 1 claims token after auction expires
    await expect(marketplace.connect(user1).claimOnTimeout(0)).revertedWith(
      "only highest bidder can claim token"
    );

    //user 2 claims token after auction expires
    await marketplace.connect(user2).claimOnTimeout(0);
  });

  it("should deposit token to highest bidder and the price to seller after highest bidder claims token", async function () {
    const provider = waffle.provider;
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const timestamp = block.timestamp;

    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15);
    let initialBalance = await provider.getBalance(user2.address);

    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //wait 15 seconds
    await new Promise((r) => setTimeout(r, 15000));

    //user 2 claims token after auction expires
    await marketplace.connect(user2).claimOnTimeout(0);

    //check if buyer has received token
    let owner = await stixor.ownerOf(0);
    expect(owner).to.equal(user2.address);

    //check if seller received amount
    let currentBalance = await provider.getBalance(user2.address);
    expect(
      ethers.utils.formatEther(initialBalance) -
        ethers.utils.formatEther(currentBalance)
    ).to.greaterThan(10);
  });
});
