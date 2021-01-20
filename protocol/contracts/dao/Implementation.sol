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
import "../vault/IImplementation.sol";
import "../vault/IVault.sol";
import "../vault/IYearnVault.sol";

contract Implementation is IImplementation, State, Bonding, Market, Regulator, Govern, Bootstrapper {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);

    function initialize() initializer public {
        dai().transfer(0xC6c42995F7A033CE1Be6b9888422628f2AD67F63, 1000e18); //1000 DAI to D:\ev (reimbursing deployment - see https://etherscan.io/tx/0xa7e9bb426a1ec79d786c2d03abf049838f0dcc0eba3a79fb0f38a1cdd3bf1c6f)
        dai().transfer(msg.sender, 150e18);  //150 DAI to committer

        //Approve the DAO to spend 1.3M DAI from the multisig
        IVault(Constants.getMultisigAddress()).submitTransaction(
            address(dai()),
            0,
            abi.encodeWithSignature(
                "approve(address,uint256)",
                address(this),
                1300000e18
            )
        );
    }

    function advance() external {
        Bootstrapper.step();
        Bonding.step();
        Regulator.step();
        Market.step();

        emit Advance(epoch(), block.number, block.timestamp);
    }


    //The executed transaction is approving the DAO for 1.3M from the multi-sig
    function transactionExecuted(uint256 transactionId) external {
        address daiVault = 0x19D3364A399d251E894aC732651be8B0E4e85001;
        uint depositAmount = 1300000e18;
        uint multisigAllowance = dai().allowance(Constants.getMultisigAddress(), address(this));
        require(multisigAllowance == depositAmount, "Allowance should be 1.3M DAI");
        dai().transferFrom(Constants.getMultisigAddress(), address(this), depositAmount);
        dai().approve(daiVault, depositAmount);
        IYearnVault(daiVault).deposit(depositAmount, Constants.getMultisigAddress());
    }

    function transactionFailed(uint256 transactionId) external {
    }
}
