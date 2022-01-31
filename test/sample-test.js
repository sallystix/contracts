const { expect } = require("chai");
const { ethers } = require("hardhat");

let Stixor;
let stixor;
beforeEach(async function () {
  Stixor = await ethers.getContractFactory("Stixor");
  stixor = await Stixor.deploy();
  await stixor.deployed();

  [owner, user1, user2, user3] = await ethers.getSigners();
});

describe("Stixor", function () {
  it("can mint upto 10 tokens", async function () {
    //mints 5 tokens
    await stixor.mint(user1.address, 5, {
      value: ethers.utils.parseEther("3"),
    });
    //mints 10 more => expected to revert
    await stixor.mint(user1.address, 5, {
      value: ethers.utils.parseEther("5"),
    });
  });
  it("maximum supply should be capped at 10 tokens", async function () {
    //mints 5 tokens
    await stixor.mint(user1.address, 5, {
      value: ethers.utils.parseEther("3"),
    });
    //mints 10 more => expected to revert
    await expect(
      stixor.mint(user1.address, 10, {
        value: ethers.utils.parseEther("5"),
      })
    ).to.be.revertedWith("supply cap reached");
  });
  it("token should only be minted by a person with minter role", async function () {
    //owner is minter
    await stixor.connect(owner).mint(owner.address, 1, {
      value: ethers.utils.parseEther("5"),
    });
    //using address 1 to mint => expected to revert
    await expect(
      stixor.connect(user1).mint(user1.address, 7, {
        value: ethers.utils.parseEther("5"),
      })
    ).to.be.reverted;
  });
  it("minting cost can only be updated by default admin", async function () {
    //owner is minter
    await stixor.connect(owner).setCost(1);
    //attempting to update mint cost with non-admin account => expected to revert
    await expect(stixor.connect(user1).setCost(9)).to.be.reverted;
  });
  it("minting can only take place if minter has enough ether in wallet", async function () {
    //owner is minter
    //attempting to buy 9 tokens with insufficient amount of ether => expected to revert
    await expect(
      stixor.mint(owner.address, 9, {
        value: ethers.utils.parseEther("1"),
      })
    ).to.be.revertedWith("Not enough ether");
  });
});
