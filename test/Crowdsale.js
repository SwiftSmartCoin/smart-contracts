/* eslint-disable no-undef */
const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");

const { expect } = require("chai");
const { BigNumber } = require("ethers");

describe("Crowdsale", function () {
  const toWei = (num, decimals = 18) =>
    BigNumber.from(num).mul(BigNumber.from(10).pow(decimals));

  const ICO_SUPPLY_PER_PHASE = toWei(40000000);
  const PHASE_DURATION = 48 * 60 * 60; // 48 hours

  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("SwiftCoin");
    const Crowdsale = await ethers.getContractFactory("Crowdsale");

    const busd = await Token.deploy(owner.address);
    const swft = await Token.deploy(owner.address);

    const crowdsale = await Crowdsale.deploy(
      swft.address,
      busd.address,
      owner.address,
      owner.address
    );

    await busd.transfer(user1.address, toWei(200000000));
    await busd.transfer(user2.address, toWei(200000000));

    await swft.approve(crowdsale.address, toWei(200000000));
    await crowdsale.startCrowdsale();

    return { busd, swft, crowdsale, owner, user1, user2 };
  }

  describe("Purchase", function () {
    it("Should give correct phase details for first phase", async function () {
      const { crowdsale } = await loadFixture(deployFixture);
      const details = await crowdsale.getPhaseDetails(1);

      expect(details[2]).to.equal(toWei(13, 14));
    });

    it("Should allow purchase", async function () {
      const { swft, busd, crowdsale, user1 } = await loadFixture(deployFixture);

      const purchase1 = BigNumber.from(100000);
      // if busd not approved
      await expect(crowdsale.connect(user1).purchase(toWei(purchase1))).to.be
        .reverted;

      const swftToBusd = BigNumber.from(purchase1).mul(toWei(13, 14));
      await busd.connect(user1).approve(crowdsale.address, toWei(swftToBusd));

      // if min cap not achieved
      await expect(
        crowdsale.connect(user1).purchase(toWei(100))
      ).to.be.rejectedWith("MinCap()");

      // successful purchase
      await crowdsale.connect(user1).purchase(toWei(purchase1));

      const phaseDetails = await crowdsale.getPhaseDetails(1);

      expect(phaseDetails[1]).to.equal(toWei(purchase1));
      expect(phaseDetails[0]).to.equal(swftToBusd);
      expect(phaseDetails[3]).to.equal(swftToBusd);

      let userBalance = await swft.balanceOf(user1.address);
      expect(userBalance).to.equal(toWei(purchase1));

      // token sold out before phase duration ends
      const swftToBuy = BigNumber.from(50000000).sub(purchase1);

      const phase1Swft = BigNumber.from(40000000).sub(purchase1);
      const phase2Swft = swftToBuy.sub(phase1Swft);
      let swftToBusd2 = phase1Swft.mul(toWei(13, 14));
      swftToBusd2 = swftToBusd2.add(phase2Swft.mul(toWei(26, 14)));

      await busd.connect(user1).approve(crowdsale.address, toWei(swftToBusd2));
      await crowdsale.connect(user1).purchase(toWei(swftToBuy));

      const phaseDetails1 = await crowdsale.getPhaseDetails(1);
      const phaseDetails2 = await crowdsale.getPhaseDetails(2);

      expect(phaseDetails1[0]).to.equal(
        BigNumber.from(40000000).mul(toWei(13, 14))
      );
      expect(phaseDetails1[1]).to.equal(ICO_SUPPLY_PER_PHASE);
      expect(phaseDetails1[2]).to.equal(toWei(13, 14));
      expect(phaseDetails1[3]).to.equal(toWei(78000));

      expect(phaseDetails2[0]).to.equal(
        BigNumber.from(10000000).mul(toWei(26, 14))
      );
      expect(phaseDetails2[1]).to.equal(toWei(10000000));
      expect(phaseDetails2[2]).to.equal(toWei(26, 14));
      expect(phaseDetails2[3]).to.equal(toWei(78000));

      userBalance = await swft.balanceOf(user1.address);
      expect(userBalance).to.equal(toWei(50000000));
    });

    it("Should update phase when duration completes", async function () {
      const { busd, crowdsale, user1 } = await loadFixture(deployFixture);

      await expect(crowdsale.purchase(toWei(210000000))).to.be.rejectedWith(
        "ExceedICOSupply()"
      );

      // phase change after duration gets over
      const purchase1 = BigNumber.from(100000);

      let swftToBusd = BigNumber.from(purchase1).mul(toWei(13, 14));
      await busd.connect(user1).approve(crowdsale.address, toWei(swftToBusd));

      // first phase purchase
      await crowdsale.connect(user1).purchase(toWei(purchase1));

      let phaseDetails = await crowdsale.getPhaseDetails(1);

      expect(phaseDetails[1]).to.equal(toWei(purchase1));
      expect(phaseDetails[0]).to.equal(swftToBusd);
      expect(phaseDetails[3]).to.equal(swftToBusd);

      // time increase
      const resultInSeconds =
        Math.floor(new Date().getTime() / 1000) + PHASE_DURATION + 100;
      await time.increaseTo(resultInSeconds);

      const purchase2 = BigNumber.from(100000);

      swftToBusd = BigNumber.from(purchase2).mul(toWei(26, 14));
      await busd.connect(user1).approve(crowdsale.address, toWei(swftToBusd));

      // second phase purchase
      await crowdsale.connect(user1).purchase(toWei(purchase2));

      phaseDetails = await crowdsale.getPhaseDetails(2);
      expect(phaseDetails[0]).to.equal(swftToBusd);
      expect(phaseDetails[1]).to.equal(toWei(purchase2));
      expect(phaseDetails[2]).to.equal(toWei(26, 14));
    });
  });
});
