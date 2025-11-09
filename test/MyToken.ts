import hre from "hardhat";
import { expect } from "chai";
import { MyToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { DECIMALS, MINTING_AMOUNT } from "./constant";

describe("My Token", () => {
  let myTokenC: MyToken;
  let signers: HardhatEthersSigner[];
  beforeEach("should deploy", async () => {
    signers = await hre.ethers.getSigners();
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);
  });
  describe("Basic state value check", () => {
    it("should return name", async () => {
      expect(await myTokenC.name()).equal("MyToken");
    });
    it("should return symbol", async () => {
      expect(await myTokenC.symbol()).equal("MT");
    });
    it("should return DECIMALS", async () => {
      expect(await myTokenC.decimals()).equal(DECIMALS);
    });
    it("should return total supply", async () => {
      expect(await myTokenC.totalSupply()).equal(
        MINTING_AMOUNT * 10n ** DECIMALS
      );
    });
  });

  describe("Mint", () => {
    it("should return balance for signer 0", async () => {
      const signer0 = signers[0];
      expect(await myTokenC.balanceOf(signer0)).equal(
        MINTING_AMOUNT * 10n ** DECIMALS
      );
    });

    it("should revert when minting by unauthorized user", async () => {
      const hacker = signers[2];
      const mintingAgainAmount = hre.ethers.parseUnits("10000", DECIMALS);
      await expect(
        myTokenC.connect(hacker).mint(mintingAgainAmount, hacker.address)
      ).to.be.revertedWith("You are not authorized to manage this contract");
    });
  });

  describe("Transfer", () => {
    it("should have 0.5MT after transfer", async () => {
      const signer0 = signers[0];
      const signer1 = signers[1];
      const transferAmount = hre.ethers.parseUnits("0.5", DECIMALS);

      await expect(myTokenC.transfer(transferAmount, signer1.address))
        .to.emit(myTokenC, "Transfer")
        .withArgs(signer0.address, signer1.address, transferAmount);

      expect(await myTokenC.balanceOf(signer1.address)).equal(transferAmount);
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        MINTING_AMOUNT * 10n ** DECIMALS - transferAmount
      );
    });

    it("should revert when transferring more than balance", async () => {
      const signer0 = signers[0];
      const signer1 = signers[1];
      const tooMuchAmount = hre.ethers.parseUnits("200", DECIMALS);

      await expect(
        myTokenC.transfer(tooMuchAmount, signer1.address)
      ).to.be.revertedWith("insufficient balance");
    });
  });
});
