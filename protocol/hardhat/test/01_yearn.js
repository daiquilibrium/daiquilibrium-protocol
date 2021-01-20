const { expect } = require("chai");
const { ethers } = require("hardhat");
const daoWhaleAddress = "0xb49ba65ce96ab19b49da09bfa124279daeb1d33b";
const daoAddress = "0x0aF9087FE3e8e834F3339FE4bEE87705e84Fd488";
const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const multisigAddress = "0x7c066d74dd5ff4E0f3CB881eD197d49C96cA1771";
const yearnVaultAddress = "0x19D3364A399d251E894aC732651be8B0E4e85001";

const impersonateAccount = async address => {
    const [account1] = await ethers.getSigners()
    await account1.sendTransaction({to: address, value: ethers.utils.parseEther("1.0")})
    await hre.network.provider.request({method: "hardhat_impersonateAccount", params: [address]})
    return ethers.provider.getSigner(address)
}

const daoCanVote = async () => {
    const dai = await ethers.getContractAt("IERC20", daiAddress);
    const Impl = await ethers.getContractFactory("Implementation");
    const impl = await Impl.deploy();
    const daoWhale = await impersonateAccount(daoWhaleAddress);
    const DAO = await ethers.getContractAt("Implementation", daoAddress, daoWhale);
    await DAO.vote(impl.address, 1);
    const votes = await DAO.votesFor(impl.address) / 1e18;
    const period = await DAO.periodFor(impl.address) / 1;
    expect(votes).to.be.greaterThan(0, "Candidate should have votes");
    const seconds = 24 * 60 * 60;
    await hre.network.provider.request({method: "evm_increaseTime", params: [seconds]});
    for (i = 0; i < period; i++)
        await DAO.advance();
    const balancePre = await dai.balanceOf(daoWhaleAddress) / 1e18;
    await DAO.commit(impl.address);
    const balancePost = await dai.balanceOf(daoWhaleAddress) / 1e18;
    expect(balancePost - balancePre).to.be.closeTo(150, 0.01, "150 DAI rewards for commiting");
}

const multisigCanApprove = async () => {
    const multisig = await ethers.getContractAt("DAIVault", multisigAddress);
    const tx = await multisig.transactionCount() - 1;
    const owners = await multisig.getOwners()
    for (const o of owners.slice(1,5)) {
        const a = await impersonateAccount(o);
        await multisig.connect(a).confirmTransaction(tx);
    }
    expect(await multisig.isConfirmed(tx)).to.equal(true, "Tx should be confirmed");
}

describe('Yearn Vault', function () {
  it('Can deposit 1.3M to vault for multi-sig', async function () {
      await daoCanVote();
      await multisigCanApprove();
      const vault = await ethers.getContractAt("IYearnVault", yearnVaultAddress);
      const balance = await vault.balanceOf(multisigAddress) / 1e18 * await vault.pricePerShare() / 1e18;
      expect(balance).to.be.closeTo(1300000, 0.01, "1.3M DAI deposited for multi-sig");
  });
});