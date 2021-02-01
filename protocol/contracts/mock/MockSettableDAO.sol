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

import "../oracle/IDAO.sol";

import "../lottery/ILottery.sol";
import "../token/IDollar.sol";

contract MockSettableDAO is IDAO {
    enum Status {
        EXPANSION,
        NEUTRAL,
        DEBT
    }

    struct Era {
        Status status;
        uint256 start;
    }

    struct DAIRequest {
        uint256 amount;
        address recipient;
    }

    DAIRequest public daiRequest;

    uint256 internal _epoch;

    Era public eraStruct;

    address public treasury;

    IDollar public dollar;

    address public lottery;

    mapping(address => uint256) public bonds;

    function set(uint256 epoch) external {
        _epoch = epoch;
    }

    function epoch() external view returns (uint256) {
        return _epoch;
    }

    function bondFromPool(address account, uint256 amount) external {
        bonds[account] = bonds[account] + amount;
    }

    function setEra(uint256 era, uint256 start) external {
        eraStruct.status = Status(era);
        eraStruct.start = start;
    }

    function era() external view returns (Status, uint256) {
        return (eraStruct.status, eraStruct.start);
    }

    function setTreasury(address addr) external {
        treasury = addr;
    }

    function setDollar(address addr) external {
        dollar = IDollar(addr);
    }

    function requestDAI(address recipient, uint256 amount) external {
        daiRequest.recipient = recipient;
        daiRequest.amount = amount;
    }

    function setLottery(address addr) external {
        lottery = addr;
    }

    function startLottery(uint256[] calldata prizes) external {
        ILottery(lottery).newGame(prizes);
    }

}
