require("@nomiclabs/hardhat-ethers");

const {VFAT_MULTISIG_PK,PERCENT_ALCHEMY_URL} = require("./secret")

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.5.17",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: PERCENT_ALCHEMY_URL,
        blockNumber: 11688400
      }
    },
    mainnet: {
      url: PERCENT_ALCHEMY_URL,
      accounts: [VFAT_MULTISIG_PK]
    }
  },
  paths: {
    tests: "./hardhat/test"
  },
  mocha: {
    timeout: 60000
  }
};
