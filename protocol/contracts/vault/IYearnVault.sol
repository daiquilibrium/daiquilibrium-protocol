pragma solidity ^0.5;

interface IYearnVault {    
    function deposit(uint _amount, address recipient) external;
    function balanceOf(address arg0) external view returns (uint256);
    function pricePerShare() external view returns (uint256);
}