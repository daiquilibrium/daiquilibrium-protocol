pragma solidity ^0.5.0;

import "../lottery/Lottery.sol";

contract MockLottery is Lottery {

    uint256 public randomness;
    bool public shouldMockExtraction;
    uint256[] public winningTickets;

    constructor(address _dao) public {
        dao = ILotteryDao(_dao);
    }

    function setRandomnessE(uint256 _randomness) external {
        randomness = _randomness;
    }

    function mockExtractionE(bool should) external {
        shouldMockExtraction = should;
    }

    function setWinningTicketsE(uint256[] calldata winners) external {
        winningTickets = winners;
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal {
        Game storage game = games[gameIndex()];

        if (!shouldMockExtraction)
            super.fulfillRandomness(requestId, randomness);
        else {
            game.winningTickets = winningTickets;
            game.winnersExtracted = true;
        }
    }

    function requestRandomness(bytes32 _keyHash, uint256 _fee, uint256 _seed) internal returns (bytes32 requestId) {
        fulfillRandomness(0, randomness);
        return 0;
    }

    function setLinkE(address addr) external {
        LINK = LinkTokenInterface(addr);
    }
}