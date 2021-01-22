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

import "../dao/Setters.sol";

contract MockState is Setters {
    uint256 internal _blockTimestamp;

    constructor () public {
        _blockTimestamp = block.timestamp;
    }

    /**
     * Global
     */

    function incrementTotalBondedE(uint256 amount) external {
        super.incrementTotalBonded(amount);
    }

    function decrementTotalBondedE(uint256 amount, string calldata reason) external {
        super.decrementTotalBonded(amount, reason);
    }

    function incrementTotalDebtE(uint256 amount) external {
        super.incrementTotalDebt(amount);
    }

    function decrementTotalDebtE(uint256 amount, string calldata reason) external {
        super.decrementTotalDebt(amount, reason);
    }

    function incrementTotalRedeemableE(uint256 amount) external {
        super.incrementTotalRedeemable(amount);
    }

    function decrementTotalRedeemableE(uint256 amount, string calldata reason) external {
        super.decrementTotalRedeemable(amount, reason);
    }

    /**
     * Account
     */

    function incrementBalanceOfE(address account, uint256 amount) external {
        super.incrementBalanceOf(account, amount);
    }

    function decrementBalanceOfE(address account, uint256 amount, string calldata reason) external {
        super.decrementBalanceOf(account, amount, reason);
    }

    function incrementBalanceOfStagedE(address account, uint256 amount) external {
        super.incrementBalanceOfStaged(account, amount);
    }

    function decrementBalanceOfStagedE(address account, uint256 amount, string calldata reason) external {
        super.decrementBalanceOfStaged(account, amount, reason);
    }

    function incrementBalanceOfCouponsE(address account, uint256 epoch, uint256 amount, uint256 expiration) external {
        super.incrementBalanceOfCoupons(account, epoch, amount, expiration);
    }

    function incrementUserCoupons(address account, uint256 epoch, uint256 coupons) external {
        _state.accounts[account].coupons[epoch] = _state.accounts[account].coupons[epoch].add(coupons);
        _state.balance.coupons = _state.balance.coupons.add(coupons);
    }

    function decrementBalanceOfCouponsE(address account, uint256 epoch, uint256 amount, string calldata reason) external {
        super.decrementBalanceOfCoupons(account, epoch, amount, reason);
    }

    function unfreezeE(address account) external {
        super.unfreeze(account);
    }

    function updateAllowanceCouponsE(address owner, address spender, uint256 amount) external {
        super.updateAllowanceCoupons(owner, spender, amount);
    }

    function decrementAllowanceCouponsE(address owner, address spender, uint256 amount, string calldata reason) external {
        super.decrementAllowanceCoupons(owner, spender, amount, reason);
    }

    /**
     * Epoch
     */

    function setEpochParamsE(uint256 start, uint256 period) external {
        _state.epoch.currentStart = start;
        _state.epoch.currentPeriod = period;
    }

    function setBootstrappingPeriodE(uint256 period) external {
        _state.epoch.bootstrapping = period;
    }

    function incrementEpochE() external {
        super.incrementEpoch();
    }

    function setEpochTwapE(uint256 epoch, uint256 twap) external {
        _state6.twapPerEpoch[epoch] = Decimal.D256({ value: twap });
    }

    function snapshotTotalBondedE() external {
        super.snapshotTotalBonded();
    }

    /**
     * Governance
     */

    function createCandidateE(address candidate, uint256 period) external {
        super.createCandidate(candidate, period);
    }

    function recordVoteE(address account, address candidate, Candidate.Vote vote) external {
        super.recordVote(account, candidate, vote);
    }

    function incrementApproveForE(address candidate, uint256 amount) external {
        super.incrementApproveFor(candidate, amount);
    }

    function decrementApproveForE(address candidate, uint256 amount, string calldata reason) external {
        super.decrementApproveFor(candidate, amount, reason);
    }

    function incrementRejectForE(address candidate, uint256 amount) external {
        super.incrementRejectFor(candidate, amount);
    }

    function decrementRejectForE(address candidate, uint256 amount, string calldata reason) external {
        super.decrementRejectFor(candidate, amount, reason);
    }

    function placeLockE(address account, address candidate) external {
        super.placeLock(account, candidate);
    }

    function initializedE(address candidate) external {
        super.initialized(candidate);
    }

    /**
     * Mock
     */

    function setBlockTimestamp(uint256 timestamp) external {
        _blockTimestamp = timestamp;
    }
}
