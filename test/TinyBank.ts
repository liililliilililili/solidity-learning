import hre from "hardhat";
import { expect } from "chai";
import { DECIMALS, MINTING_AMOUNT } from "./constant";
import { MyToken, TinyBank } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TinyBank", () => {
  let signers: HardhatEthersSigner[];
  let myTokenC: MyToken;
  let tinyBankC: TinyBank;
  let managers: string[];

  beforeEach(async () => {
    signers = await hre.ethers.getSigners();
    myTokenC = await hre.ethers.deployContract("MyToken", [
      "MyToken",
      "MT",
      DECIMALS,
      MINTING_AMOUNT,
    ]);

    managers = [
      signers[1].address,
      signers[2].address,
      signers[3].address,
      signers[4].address,
      signers[5].address,
    ];

    tinyBankC = await hre.ethers.deployContract("TinyBank", [
      await myTokenC.getAddress(),
      managers,
    ]);

    await myTokenC.setManager(await tinyBankC.getAddress());
  });

  describe("Initialized state check", () => {
    it("should return totalStaked 0", async () => {
      expect(await tinyBankC.totalStaked()).equal(0);
    });
    it("should return staked 0 amount of signer0", async () => {
      const signer0 = signers[0];
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
    it("should have 5 managers", async () => {
      for (let i = 0; i < 5; i++) {
        expect(await tinyBankC.managers(i)).equal(managers[i]);
      }
    });
  });

  describe("Staking", async () => {
    it("should return staked amount", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(stakingAmount);
      expect(await tinyBankC.totalStaked()).equal(stakingAmount);
      expect(await myTokenC.balanceOf(tinyBankC)).equal(
        await tinyBankC.totalStaked()
      );
    });
  });

  describe("Withdraw", () => {
    it("should return 0 staked after withdrawing total token", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);
      await tinyBankC.withdraw(stakingAmount);
      expect(await tinyBankC.staked(signer0.address)).equal(0);
    });
  });

  describe("Reward", () => {
    it("should reward 1MT every blocks", async () => {
      const signer0 = signers[0];
      const stakingAmount = hre.ethers.parseUnits("50", DECIMALS);
      await myTokenC.approve(await tinyBankC.getAddress(), stakingAmount);
      await tinyBankC.stake(stakingAmount);

      const BLOCKS = 5n;
      const transferAmount = hre.ethers.parseUnits("1", DECIMALS);
      for (let i = 0; i < BLOCKS; i++) {
        await myTokenC.transfer(transferAmount, signer0.address);
      }

      await tinyBankC.withdraw(stakingAmount);
      expect(await myTokenC.balanceOf(signer0.address)).equal(
        hre.ethers.parseUnits((BLOCKS + MINTING_AMOUNT + 1n).toString())
      );
    });
  });

  describe("setRewardPerBlock with MultiManagedAccess", () => {
    it("should revert when changing rewardPerBlock by non-manager without confirmation", async () => {
      const hacker = signers[3];
      const rewardToChange = hre.ethers.parseUnits("10000", DECIMALS);
      await expect(
        tinyBankC.connect(hacker).setRewardPerBlock(rewardToChange)
      ).to.be.revertedWith("Not all confirmed yet");
    });

    it("should revert when non-manager tries to confirm", async () => {
      const nonManager = signers[10];
      await expect(tinyBankC.connect(nonManager).confirm()).to.be.revertedWith(
        "You are not a manager"
      );
    });

    it("should revert when setting reward without all confirmations", async () => {
      const newReward = hre.ethers.parseUnits("2", DECIMALS);

      await tinyBankC.connect(signers[1]).confirm();
      await tinyBankC.connect(signers[2]).confirm();
      await tinyBankC.connect(signers[3]).confirm();
      await tinyBankC.connect(signers[4]).confirm();

      await expect(tinyBankC.setRewardPerBlock(newReward)).to.be.revertedWith(
        "Not all confirmed yet"
      );
    });

    it("should successfully set reward when all managers confirm", async () => {
      const newReward = hre.ethers.parseUnits("2", DECIMALS);

      await tinyBankC.connect(signers[1]).confirm();
      await tinyBankC.connect(signers[2]).confirm();
      await tinyBankC.connect(signers[3]).confirm();
      await tinyBankC.connect(signers[4]).confirm();
      await tinyBankC.connect(signers[5]).confirm();

      await tinyBankC.setRewardPerBlock(newReward);
      expect(await tinyBankC.rewardPerBlock()).equal(newReward);
    });

    it("should reset confirmations after successful execution", async () => {
      const newReward = hre.ethers.parseUnits("2", DECIMALS);

      await tinyBankC.connect(signers[1]).confirm();
      await tinyBankC.connect(signers[2]).confirm();
      await tinyBankC.connect(signers[3]).confirm();
      await tinyBankC.connect(signers[4]).confirm();
      await tinyBankC.connect(signers[5]).confirm();

      await tinyBankC.setRewardPerBlock(newReward);

      const anotherReward = hre.ethers.parseUnits("3", DECIMALS);
      await expect(
        tinyBankC.setRewardPerBlock(anotherReward)
      ).to.be.revertedWith("Not all confirmed yet");
    });

    it("should allow same manager to confirm multiple times for different actions", async () => {
      const newReward1 = hre.ethers.parseUnits("2", DECIMALS);

      for (let i = 1; i <= 5; i++) {
        await tinyBankC.connect(signers[i]).confirm();
      }
      await tinyBankC.setRewardPerBlock(newReward1);

      const newReward2 = hre.ethers.parseUnits("3", DECIMALS);
      for (let i = 1; i <= 5; i++) {
        await tinyBankC.connect(signers[i]).confirm();
      }
      await tinyBankC.setRewardPerBlock(newReward2);

      expect(await tinyBankC.rewardPerBlock()).equal(newReward2);
    });
  });
});
