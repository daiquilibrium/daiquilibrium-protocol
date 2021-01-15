pragma solidity ^0.5;

import "./MultiSigWallet.sol";
import "./IImplementation.sol";

contract DAIVault is MultiSigWallet {

    IImplementation public dao;

    constructor() public MultiSigWallet() {
        dao = IImplementation(0x0aF9087FE3e8e834F3339FE4bEE87705e84Fd488);
    }

    modifier onlyDao() {
        require(msg.sender == address(dao), "Sender isn't DAO");
        _;
    }

    function submitTransaction(address destination, uint value, bytes memory data) public onlyDao returns (uint) {
        return super.submitTransaction(destination, value, data);
    }

    function executeTransaction(uint transactionId) public {
        super.executeTransaction(transactionId);

        Transaction storage txn = transactions[transactionId];
        if (txn.executed)
            dao.transactionExecuted(transactionId);
        else
            dao.transactionFailed(transactionId);
    }

}