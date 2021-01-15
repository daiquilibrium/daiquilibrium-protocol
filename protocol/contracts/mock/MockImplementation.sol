pragma solidity ^0.5;

import "../vault/DAIVault.sol";

contract MockImplementation {

    bool public txReverted;
    bool public txCompleted;
    bool public mockFunctionCalled;

    DAIVault public vault;

    constructor(DAIVault _vault) public {
        vault = _vault;
    }

    function transactionExecuted(uint256 transactionId) external {
        txCompleted = true;
    }

    function transactionFailed(uint256 transactionId) external {
        txReverted = true;
    }

    function submitTransactionE(address destination, uint value, bytes calldata data) external {
        vault.submitTransaction(destination, value, data);
    }

    function mockFunction() external {
        mockFunctionCalled = true;
    }

}