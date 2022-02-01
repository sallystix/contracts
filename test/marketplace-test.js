const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

let Stixor;
let stixor;
let Marketplace;
let marketplace;
let blockNum;
let block;
let timestamp;

const getBlockTimestamp = async () => {
  blockNum = await ethers.provider.getBlockNumber();
  block = await ethers.provider.getBlock(blockNum);
  timestamp = block.timestamp;

  return timestamp;
};
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
    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    timestamp = block.timestamp;
  });

  it("can't add a fixed price listing with 0 price", async function () {
    await expect(marketplace.addFixedPrice(0, 0)).to.be.revertedWith(
      "price has to be greater than 0"
    );
  });

  it("can't add auction with expiry time less than current block time + 15 minutes", async function () {
    await expect(
      marketplace.connect(user1).addAuction(0, timestamp + 1 + 15 * 60 - 1) //adding 1 because block time changes once function is called
    ).to.be.revertedWith(
      "expiry time has to be 15 minutes or more than start time"
    );
  });

  it("can add auction with expiry time equal to current block time + 15 minutes", async function () {
    await marketplace.connect(user1).addAuction(0, timestamp + 1 + 15 * 60);
  });

  it("can add auction with expiry time more than current block time + 15 minutes", async function () {
    await marketplace.connect(user1).addAuction(0, timestamp + 1 + 15 * 60 + 1);
  });

  it("should allow owner to add token to fixed price", async function () {
    //listing with owner
    marketplace.connect(user1).addFixedPrice(0, ethers.utils.parseEther("10"));
  });

  it("should not allow non-owner to add a token to fixed price", async function () {
    //listing with non owner
    await expect(
      marketplace.connect(user2).addFixedPrice(0, ethers.utils.parseEther("10"))
    ).to.be.revertedWith("only owner of token can list it");
  });

  it("should allow owner to add token to auction listing", async function () {
    //listing with owner
    marketplace.connect(user1).addAuction(1, timestamp + 1 + 15 * 60);
  });

  it("should not allow non-owner to add token to auction listing", async function () {
    await expect(
      marketplace.connect(user2).addAuction(0, timestamp + 1 + 15 * 60)
    ).to.be.revertedWith("only owner of token can list it");
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

  it("can cancel an auction listing that exists", async function () {
    //add auction
    await marketplace.connect(user1).addAuction(0, timestamp + 1 + 15 * 60);
    //cancel existing auction
    await marketplace.connect(user1).cancelAuction(0);
  });

  it("shouldn't allow non-seller to cancel fixed price listing", async function () {
    //add fixed price listing
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    //cancel as non-seller
    await expect(
      marketplace.connect(user2).cancelFixedPrice(0)
    ).to.be.revertedWith("only seller can make changes to this listing");
  });

  it("should allow seller to cancel fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));

    await marketplace.connect(user1).cancelFixedPrice(0);
  });

  it("should transfer token back to seller after cancelling fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));

    await marketplace.connect(user1).cancelFixedPrice(0);

    let owner = await stixor.ownerOf(0);
    expect(owner).equal(user1.address);
  });

  it("shouldn't allow non-seller to cancel auction listing", async function () {
    await marketplace.connect(user1).addAuction(1, timestamp + 1 + 15 * 60);
    //cancel as non-seller
    await expect(
      marketplace.connect(user2).cancelAuction(0)
    ).to.be.revertedWith("only seller can make changes to this listing");
  });

  it("should allow seller to cancel auction listing", async function () {
    await marketplace.connect(user1).addAuction(1, timestamp + 1 + 15 * 60);
    //cancel as seller
    await marketplace.connect(user1).cancelAuction(0);
  });

  it("should transfer token back to seller after cancelling auction listing", async function () {
    await marketplace.connect(user1).addAuction(1, timestamp + 1 + 15 * 60);
    //cancel as seller
    await marketplace.connect(user1).cancelAuction(0);

    let owner = await stixor.ownerOf(0);
    expect(owner).equal(user1.address);
  });

  it("shouldn't allow non-seller to edit fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    //edit as non-seller
    await expect(
      marketplace
        .connect(user2)
        .editFixedPrice(0, ethers.utils.parseEther("11"))
    ).to.be.revertedWith("only seller can make changes to this listing");
  });

  it("should allow seller to update fixed price listing cost", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    //edit as seller
    await marketplace
      .connect(user1)
      .editFixedPrice(0, ethers.utils.parseEther("11"));
    let listing = await marketplace.listings(0);
    //updated cost is equal to expected cost
    expect(listing.price.toString()).to.equal(ethers.utils.parseEther("11"));
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
    //attempting to bid on token auction
    await marketplace.connect(user1).addAuction(1, timestamp + 1 + 15 * 60);
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
    ).to.be.revertedWith("insufficient amount to buy token");
  });

  it("should allow a purchase if amount is more than or equal to price on fixed price listing", async function () {
    await marketplace
      .connect(user1)
      .addFixedPrice(0, ethers.utils.parseEther("10"));
    await marketplace.connect(user2).buyFixedPriceToken(0, {
      value: ethers.utils.parseEther("10"),
    });
  });

  it("shouldn't allow a bid if amount is less than or equal to highest bid on auction listing", async function () {
    await marketplace.connect(user1).addAuction(0, timestamp + 1 + 15 * 60);
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
    let initialBalanceSeller = await provider.getBalance(user1.address);
    let initialBalanceMarketPlace = await provider.getBalance(
      marketplace.address
    );

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
    let currentBalanceSeller = await provider.getBalance(user1.address);
    expect(
      Math.round(
        ethers.utils.formatEther(currentBalanceSeller) -
          ethers.utils.formatEther(initialBalanceSeller)
      )
    ).to.greaterThanOrEqual(10);

    //check if contract's balance is just as it started
    let currentBalanceMarketPlace = await provider.getBalance(
      marketplace.address
    );
    expect(
      Math.round(
        ethers.utils.formatEther(initialBalanceMarketPlace) -
          ethers.utils.formatEther(currentBalanceMarketPlace)
      )
    ).to.equal(0);
  });

  it("should not let anyone resolve auction before auction ends", async function () {
    const provider = waffle.provider;
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);
    let initialBalance = await provider.getBalance(user2.address);
    let blockTime = await getBlockTimestamp();
    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //set block timestamp to blocktime + 15 minutes - 1 second = 899 seconds
    await ethers.provider.send("evm_mine", [blockTime - 1 + 899]); //subtracted 1 because resolve transaction will take 1 second
    blockTime = await getBlockTimestamp();

    //user 2 resolves auction before auction expires
    await expect(
      marketplace.connect(user2).resolveAuctionListing(0)
    ).revertedWith("auction is not over yet");
  });

  it("can allow anyone to make a bid with sufficient amount", async function () {
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);

    //user 2 bids on auction with 10 ether
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });
  });

  it("transfers token back to seller if no bids have been made", async function () {
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);
    let blockTime = await getBlockTimestamp();
    await ethers.provider.send("evm_mine", [blockTime - 1 + 900]); //subtracted 1 because resolve transaction will take 1 second

    await marketplace.resolveAuctionListing(0);
    //owner is back to
    let owner = await stixor.ownerOf(0);
    await expect(owner).equal(user1.address);
  });

  it("should refund amount to previous highest bidder when new highest bidder is assigned", async function () {
    const provider = waffle.provider;
    let initialBalanceUser2 = await provider.getBalance(user2.address);
    let initialBalanceMarketPlace = await provider.getBalance(
      marketplace.address
    );
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);

    //user 2 bids on auction with 10 ether
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //contract receives 10 ether
    let currentBalanceMarketPlace = await provider.getBalance(
      marketplace.address
    );
    expect(
      Math.round(
        ethers.utils.formatEther(currentBalanceMarketPlace) -
          ethers.utils.formatEther(initialBalanceMarketPlace)
      )
    ).greaterThanOrEqual(10);

    //user 3 bids on auction with 11 ether
    await marketplace.connect(user3).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("11"),
    });

    //contract loses 10 ether and receives 11 ether
    currentBalanceMarketPlace = await provider.getBalance(marketplace.address);
    expect(
      Math.round(
        ethers.utils.formatEther(currentBalanceMarketPlace) -
          ethers.utils.formatEther(initialBalanceMarketPlace)
      )
    ).greaterThanOrEqual(11);

    //user 2 should have same balance as in the beginning
    let currentBalanceUser2 = await provider.getBalance(user2.address);
    expect(Math.round(ethers.utils.formatEther(currentBalanceUser2))).equal(
      Math.round(ethers.utils.formatEther(initialBalanceUser2))
    );
  });

  it("should let anyone resolve token after auction ends", async function () {
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);
    let blockTime = await getBlockTimestamp();
    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //set block timestamp to blocktime + 15 minutes = 900 seconds
    await ethers.provider.send("evm_mine", [blockTime - 1 + 900]); //subtracted 1 because resolve transaction will take 1 second

    //user resolves auction before auction expires
    await marketplace.connect(user2).resolveAuctionListing(0);
  });

  it("should not let anyone make bid after auction ends", async function () {
    const provider = waffle.provider;
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);
    let blockTime = await getBlockTimestamp();

    //set block timestamp to blocktime + 15 minutes = 900 seconds
    await ethers.provider.send("evm_mine", [blockTime - 1 + 900]); //subtracted 1 because resolve transaction will take 1 second

    //user 2 bids on auction
    await expect(
      marketplace.connect(user2).bidOnAuctionListing(0, {
        value: ethers.utils.parseEther("10"),
      })
    ).revertedWith("auction is over");
  });

  it("should not allow a bid amount of 0", async function () {
    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 15 * 60);

    //user 2 bids on auction
    await expect(
      marketplace.connect(user2).bidOnAuctionListing(0, {
        value: ethers.utils.parseEther("0"),
      })
    ).revertedWith("insufficient bid amount");
  });

  it("should deposit token to highest bidder and the price to seller after auction resolves", async function () {
    const provider = waffle.provider;

    const transactionResponse = await marketplace
      .connect(user1)
      .addAuction(0, timestamp + 1 + 30 * 60);
    let initialBalanceSeller = await provider.getBalance(user1.address);
    let blockTime = await getBlockTimestamp();
    //user 2 bids on auction
    await marketplace.connect(user2).bidOnAuctionListing(0, {
      value: ethers.utils.parseEther("10"),
    });

    //wait 30 minutes
    await ethers.provider.send("evm_mine", [blockTime - 1 + 30 * 60]); //subtracted 1 because resolve auction transaction will take 1 second

    //user 2 claims token after auction expires
    await marketplace.resolveAuctionListing(0);

    //check if buyer has received token
    let owner = await stixor.ownerOf(0);
    expect(owner).to.equal(user2.address);

    //check if seller received amount
    let currentBalanceSeller = await provider.getBalance(user1.address);
    let currentBalanceMarketPlace = await provider.getBalance(
      marketplace.address
    );
    expect(
      Math.round(
        ethers.utils.formatEther(currentBalanceSeller) -
          ethers.utils.formatEther(initialBalanceSeller)
      )
    ).to.greaterThanOrEqual(10);

    //contract should be empty
    expect(
      Math.round(ethers.utils.formatEther(currentBalanceMarketPlace))
    ).equal(0);
  });
});
