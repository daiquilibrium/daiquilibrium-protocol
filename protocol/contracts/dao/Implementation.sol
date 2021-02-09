/*
    Copyright 2020 Daiquilibrium devs, based on the works of the Dynamic Dollar Devs and the Empty Set Squad

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Market.sol";
import "./Regulator.sol";
import "./Bonding.sol";
import "./Govern.sol";
import "./Bootstrapper.sol";
import "../Constants.sol";
import "../vault/IVault.sol";

contract Implementation is State, Bonding, Market, Regulator, Govern, Bootstrapper {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);

    function initialize() initializer public {
        dai().transfer(msg.sender, 150e18);  //150 DAI to committer
        //Mint 100k DAIQ to Boot Finance treasury
        dollar().mint(address(0x03Df4ADDfB568b338f6a0266f30458045bbEFbF2), 100000e18);
    }

    function advance() external {
        Bootstrapper.step();
        Bonding.step();
        Regulator.step();
        Market.step();

        emit Advance(epoch(), block.number, block.timestamp);
    }

    function requestDAI(address recipient, uint256 amount) external onlyLottery(msg.sender) {
        IVault(treasury()).submitTransaction(
            address(dai()),
            0,
            abi.encodeWithSignature(
                "transfer(address,uint256)",
                recipient,
                amount
            )
        );
    }

    function transactionExecuted(uint256 transactionId) external {

    }

    function transactionFailed(uint256 transactionId) external {

    }
}
