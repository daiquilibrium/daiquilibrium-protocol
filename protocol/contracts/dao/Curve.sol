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
import "../external/Decimal.sol";
import "../Constants.sol";

contract Curve {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    function calculateCouponPremium(
        uint256 totalSupply,
        uint256 totalDebt,
        uint256 amount,
        Decimal.D256 memory price,
        uint256 expirationPeriod
    ) internal pure returns (uint256) {
        return couponPremium(totalSupply, totalDebt, price, expirationPeriod).mul(amount).asUint256();
    }

    function couponPremium(
        uint256 totalSupply,
        uint256 totalDebt,
        Decimal.D256 memory price,
        uint256 expirationPeriod
    ) private pure returns (Decimal.D256 memory) {
        Decimal.D256 memory debtRatioUpperBound = Constants.getDebtRatioCap();

        Decimal.D256 memory debtRatio = Decimal.ratio(totalDebt, totalSupply);

        debtRatio = debtRatio.greaterThan(debtRatioUpperBound)
            ? debtRatioUpperBound
            : debtRatio;

        if (expirationPeriod > 1000)
            return lowRiskPremium(debtRatio, price, expirationPeriod);
        
        if (expirationPeriod > 100)
            return mediumRiskPremium(debtRatio, price, expirationPeriod);

        return highRiskPremium(debtRatio, price, expirationPeriod);
    }

    //R * (1 - P) *  2.2 / (1 + (T - 1) * 0.0001)
    function lowRiskPremium(Decimal.D256 memory debtRatio, Decimal.D256 memory price, uint256 expirationPeriod) private pure returns (Decimal.D256 memory) {
        return multiplier(debtRatio, price).mul(
            Decimal.D256({ value: 2.2e18 }).div(
                Decimal.one().add(Decimal.D256({ value: 1e14 }).mul(expirationPeriod - 1))
            )
        );
    }

    //R * (1 - P) * 6 /(1 + (T - 1) * 0.002)
    function mediumRiskPremium(Decimal.D256 memory debtRatio, Decimal.D256 memory price, uint256 expirationPeriod) private pure returns (Decimal.D256 memory) {
        return multiplier(debtRatio, price).mul(
            Decimal.D256({ value: 6e18 }).div(
                Decimal.one().add(Decimal.D256({ value: 2e15 }).mul(expirationPeriod - 1))
            )
        );
    }

    //R * (1 - P) * 10 /(1 + (T - 1) * 0.01)
    function highRiskPremium(Decimal.D256 memory debtRatio, Decimal.D256 memory price, uint256 expirationPeriod) private pure returns (Decimal.D256 memory) {
        return multiplier(debtRatio, price).mul(
            Decimal.D256({ value: 10e18 }).div(
                Decimal.one().add(Decimal.D256({ value: 1e16 }).mul(expirationPeriod - 1))
            )
        );
    }

    //R * (1 - P)
    function multiplier(Decimal.D256 memory debtRatio, Decimal.D256 memory price) private pure returns (Decimal.D256 memory) {
        return debtRatio.mul(Decimal.one().sub(price));
    }
}
