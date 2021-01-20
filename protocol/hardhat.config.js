require("@nomiclabs/hardhat-ethers");

const {ALCHEMY_URL} = require("./secret")

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.5.17",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: {
        url: ALCHEMY_URL,
        blockNumber: 11688400
      }
    },
  },
  paths: {
    tests: "./hardhat/test"
  },
  mocha: {
    timeout: 60000
  }
};
