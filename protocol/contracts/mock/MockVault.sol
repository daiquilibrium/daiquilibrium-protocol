pragma solidity ^0.5;

import "../vault/DAIVault.sol";

contract MockVault is DAIVault {

    function setOwnersE(address[] calldata _owners, uint256 _required) external {
        for (uint256 i = 0; i < owners.length; i ++) {
            isOwner[owners[i]] = false;
        }

        for (uint256 i = 0; i < _owners.length; i ++) {
            isOwner[_owners[i]] = true;
        }

        owners = _owners;
        required = _required;
    }

    function setImplementationE(IImplementation implementation) external {
        dao = implementation;
    }

}