const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockLottery = contract.fromArtifact('MockLottery');
const MockToken = contract.fromArtifact('MockToken');
const MockDAO = contract.fromArtifact('MockSettableDAO');

describe("Lottery", function () {

    const [userAddress, userAddress1, userAddress2, userAddress3, treasury] = accounts;

    beforeEach(async function () {
        this.dao = await MockDAO.new();
        this.lottery = await MockLottery.new(this.dao.address);

        const link = await MockToken.new("LINK", "Chainlink", 18);
        await link.mint(this.lottery.address, new BN(2).pow(new BN(256)).subn(1));

        this.dollar = await MockToken.new("DAIQ", "Daiquilibrium", 18);

        await this.dao.setDollar(this.dollar.address);
        await this.dao.setLottery(this.lottery.address);
        await this.lottery.setLinkE(link.address);
        await this.dao.setTreasury(treasury);
    });

    describe("before start", function () {
        describe("purchaseTickets", function () {
            beforeEach(async function () {
                await this.dollar.mint(userAddress, new BN(10).pow(new BN(19)));
                await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress });
            });

            it("reverts", async function () {
                await expectRevert(this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress }), "SafeMath: subtraction overflow");
            });
        });
    });

    describe("newGame", function () {
        describe("not from dao", function () {
            it("reverts", async function () {
                await expectRevert(this.lottery.newGame([]), "Lottery: sender isn't the DAO");
            });
        });

        describe("from dao", function () {
            beforeEach(async function () {
                this.result = await this.dao.startLottery([100, 50, 30]);
            });

            it("updates the contract's state", async function () {
                expect(await this.lottery.isOngoing(0)).true;
                expect(await this.lottery.gameLength()).bignumber.equal(new BN(1));
                expect(await this.lottery.gameIndex()).bignumber.zero;

                const prizes = await this.lottery.getPrizes(0);
                expect(prizes.length).equal(3);
                expect(prizes[0]).bignumber.equal(new BN(100));
                expect(prizes[1]).bignumber.equal(new BN(50));
                expect(prizes[2]).bignumber.equal(new BN(30));
            });

            it("emits GameStarted event", async function () {
                await expectEvent.inTransaction(this.result.tx, this.lottery, "GameStarted", {
                    gameIndex: new BN(0),
                    prizes: ["100", "50", "30"]
                })
            });
        });
    });

    describe("after start", function () {

        beforeEach(async function () {
            await this.dao.startLottery([100, 50, 30]);
        });

        describe("purchaseTickets", function () {
            describe("single buy", function () {
                describe("less than 10 tokens", function () {
                    it("reverts", async function () {
                        await expectRevert(this.lottery.purchaseTickets(1), "Lottery: Insufficient purchase amount");
                    });
                });

                describe("1 ticket", function () {
                    beforeEach(async function () {
                        await this.dollar.mint(userAddress, new BN(10).pow(new BN(19)));
                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress });
                        this.result = await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.dollar.balanceOf(userAddress)).bignumber.zero;
                        expect(await this.dollar.balanceOf(treasury)).bignumber.equal(new BN(10).pow(new BN(19)));

                        expect(await this.lottery.getIssuedTickets(0)).bignumber.equal(new BN(1));
                        expect(await this.lottery.getTotalPurchases(0)).bignumber.equal(new BN(1));

                        const purchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress);
                        expect(purchases.length).equal(1);
                        expect(purchases[0]).bignumber.zero;

                        const purchase = await this.lottery.getPurchase(0, 0);
                        expect(purchase["0"]).bignumber.zero;
                        expect(purchase["1"]).bignumber.zero;
                    });

                    it("emits TicketsPurchase event", async function () {
                        await expectEvent.inTransaction(this.result.tx, this.lottery, "TicketsPurchase", {
                            sender: userAddress,
                            purchaseId: new BN(0),
                            lotteryId: new BN(0),
                            ticketStart: new BN(0),
                            ticketEnd: new BN(0)
                        })
                    });
                });

                describe("multiple tickets", function () {
                    beforeEach(async function () {
                        await this.dollar.mint(userAddress, new BN(10).pow(new BN(20)).addn(1));
                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(20)).addn(1), { from: userAddress });
                        this.result = await this.lottery.purchaseTickets(new BN(10).pow(new BN(20)).addn(1), { from: userAddress });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.dollar.balanceOf(userAddress)).bignumber.equal(new BN(1));
                        expect(await this.dollar.balanceOf(treasury)).bignumber.equal(new BN(10).pow(new BN(20)));

                        expect(await this.lottery.getIssuedTickets(0)).bignumber.equal(new BN(10));
                        expect(await this.lottery.getTotalPurchases(0)).bignumber.equal(new BN(1));

                        const purchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress);
                        expect(purchases.length).equal(1);
                        expect(purchases[0]).bignumber.zero;

                        const purchase = await this.lottery.getPurchase(0, 0);
                        expect(purchase["0"]).bignumber.zero;
                        expect(purchase["1"]).bignumber.equal(new BN(9));
                    });

                    it("emits TicketsPurchase event", async function () {
                        await expectEvent.inTransaction(this.result.tx, this.lottery, "TicketsPurchase", {
                            sender: userAddress,
                            purchaseId: new BN(0),
                            lotteryId: new BN(0),
                            ticketStart: new BN(0),
                            ticketEnd: new BN(9)
                        })
                    });
                });
            });

            describe("multiple buys", function () {
                describe("1 ticket", function () {
                    beforeEach(async function () {
                        await this.dollar.mint(userAddress, new BN(10).pow(new BN(19)).muln(2));
                        await this.dollar.mint(userAddress1, new BN(10).pow(new BN(19)));

                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress1 });
                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)).muln(2), { from: userAddress });

                        await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress });
                        await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress1 });
                        this.result = await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.dollar.balanceOf(userAddress)).bignumber.zero;
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.zero;
                        expect(await this.dollar.balanceOf(treasury)).bignumber.equal(new BN(10).pow(new BN(19)).muln(3));

                        expect(await this.lottery.getIssuedTickets(0)).bignumber.equal(new BN(3));
                        expect(await this.lottery.getTotalPurchases(0)).bignumber.equal(new BN(3));

                        const userPurchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress);
                        expect(userPurchases.length).equal(2);
                        expect(userPurchases[0]).bignumber.zero;
                        expect(userPurchases[1]).bignumber.equal(new BN(2));

                        const user1Purchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress1);
                        expect(user1Purchases.length).equal(1);
                        expect(user1Purchases[0]).bignumber.equal(new BN(1));

                        const purchase0 = await this.lottery.getPurchase(0, 0);
                        expect(purchase0["0"]).bignumber.zero;
                        expect(purchase0["1"]).bignumber.zero;

                        const purchase1 = await this.lottery.getPurchase(0, 1);
                        expect(purchase1["0"]).bignumber.equal(new BN(1));
                        expect(purchase1["1"]).bignumber.equal(new BN(1));

                        const purchase2 = await this.lottery.getPurchase(0, 2);
                        expect(purchase2["0"]).bignumber.equal(new BN(2));
                        expect(purchase2["1"]).bignumber.equal(new BN(2));
                    });

                    it("emits TicketsPurchase event", async function () {
                        await expectEvent.inTransaction(this.result.tx, this.lottery, "TicketsPurchase", {
                            sender: userAddress,
                            purchaseId: new BN(2),
                            lotteryId: new BN(0),
                            ticketStart: new BN(2),
                            ticketEnd: new BN(2)
                        })
                    });
                });

                describe("multiple tickets", function () {
                    beforeEach(async function () {
                        await this.dollar.mint(userAddress, new BN(10).pow(new BN(20)).muln(2));
                        await this.dollar.mint(userAddress1, new BN(10).pow(new BN(20)));

                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(20)).muln(2), { from: userAddress });
                        await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(20)), { from: userAddress1 });

                        await this.lottery.purchaseTickets(new BN(10).pow(new BN(20)), { from: userAddress });
                        await this.lottery.purchaseTickets(new BN(10).pow(new BN(20)), { from: userAddress1 });
                        this.result = await this.lottery.purchaseTickets(new BN(10).pow(new BN(20)), { from: userAddress });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.dollar.balanceOf(userAddress)).bignumber.zero;
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.zero;

                        expect(await this.dollar.balanceOf(treasury)).bignumber.equal(new BN(10).pow(new BN(20)).muln(3));

                        expect(await this.lottery.getIssuedTickets(0)).bignumber.equal(new BN(30));
                        expect(await this.lottery.getTotalPurchases(0)).bignumber.equal(new BN(3));

                        const userPurchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress);
                        expect(userPurchases.length).equal(2);
                        expect(userPurchases[0]).bignumber.zero;
                        expect(userPurchases[1]).bignumber.equal(new BN(2));

                        const user1Purchases = await this.lottery.getPlayerPurchaseIndexes(0, userAddress1);
                        expect(user1Purchases.length).equal(1);
                        expect(user1Purchases[0]).bignumber.equal(new BN(1));

                        const purchase0 = await this.lottery.getPurchase(0, 0);
                        expect(purchase0["0"]).bignumber.zero;
                        expect(purchase0["1"]).bignumber.equal(new BN(9));

                        const purchase1 = await this.lottery.getPurchase(0, 1);
                        expect(purchase1["0"]).bignumber.equal(new BN(10));
                        expect(purchase1["1"]).bignumber.equal(new BN(19));

                        const purchase2 = await this.lottery.getPurchase(0, 2);
                        expect(purchase2["0"]).bignumber.equal(new BN(20));
                        expect(purchase2["1"]).bignumber.equal(new BN(29));
                    });

                    it("emits TicketsPurchase event", async function () {
                        await expectEvent.inTransaction(this.result.tx, this.lottery, "TicketsPurchase", {
                            sender: userAddress,
                            purchaseId: new BN(2),
                            lotteryId: new BN(0),
                            ticketStart: new BN(20),
                            ticketEnd: new BN(29)
                        })
                    });
                });
            });
        });

        describe("extractWinner", function () {
            beforeEach(async function () {
                await this.dollar.mint(userAddress, new BN(10).pow(new BN(19)));
                await this.dollar.mint(userAddress1, new BN(10).pow(new BN(19)));
                await this.dollar.mint(userAddress2, new BN(10).pow(new BN(19)));
                await this.dollar.mint(userAddress3, new BN(10).pow(new BN(19)));

                await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress });
                await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress1 });
                await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress2 });
                await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress3 });

                await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress });
                await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress1 });
                await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress2 });
                await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress3 });
            });

            describe("in debt", function () {
                beforeEach(async function () {
                    await this.dao.set(10);
                    await this.dao.setEra(2, 10);
                });

                it("reverts", async function () {
                    await expectRevert(this.lottery.extractWinner(), "Lottery: Can only extract during expansion");
                });
            });

            describe("in expansion", function () {
                beforeEach(async function () {
                    await this.dao.setEra(0, 10);
                });

                describe("less than 3 epochs", function () {
                    beforeEach(async function () {
                        await this.dao.set(10);
                    });

                    it("reverts", async function () {
                        await expectRevert(this.lottery.extractWinner(), "Lottery: Can only extract during expansion");
                    });
                });

                describe("greater or equal to 3 epochs", function () {
                    beforeEach(async function () {
                        await this.dao.set(13);
                        await this.lottery.setRandomnessE(19474)
                        this.result = await this.lottery.extractWinner();
                    });

                    describe("extracting a second time", function () {
                        it("reverts", async function () {
                            await expectRevert(this.lottery.extractWinner(), "Lottery: winner already extracted");
                        });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.lottery.isOngoing(0)).false;
                        expect(await this.lottery.areWinnersExtracted(0)).true;

                        const winningTickets = await this.lottery.getWinningTickets(0);
                        expect(winningTickets.length).equal(3);
                        expect(winningTickets[0]).bignumber.lt(new BN(4));
                        expect(winningTickets[1]).bignumber.lt(new BN(4));
                        expect(winningTickets[2]).bignumber.lt(new BN(4));
                    });

                    it("emits LotteryEnded event", async function () {
                        await expectEvent.inTransaction(this.result.tx, this.lottery, "LotteryEnded", {
                            lotteryId: new BN(0)
                        });
                    });

                    it("emits WinningTicketsSorted event", async function () {
                        const { args } = await expectEvent.inTransaction(this.result.tx, this.lottery, "WinningTicketsSorted");
                        expect(args.lotteryId).equal("0");
                        expect(args.winningTickets.length).equal(3);
                        expect(parseInt(args.winningTickets[0])).lt(4);
                        expect(parseInt(args.winningTickets[1])).lt(4);
                        expect(parseInt(args.winningTickets[2])).lt(4);
                    });
                });
            });
        });

        describe("redeemReward", function () {
            describe("before extraction", function () {
                it("reverts", async function () {
                    await expectRevert(this.lottery.redeemReward(0, 0, 0), "Lottery: winner hasn't been extracted yet");
                });
            });

            describe("after extraction", function () {
                beforeEach(async function () {
                    await this.dollar.mint(userAddress, new BN(10).pow(new BN(19)));
                    await this.dollar.mint(userAddress1, new BN(10).pow(new BN(19)));
                    await this.dollar.mint(userAddress2, new BN(10).pow(new BN(19)));
                    await this.dollar.mint(userAddress3, new BN(10).pow(new BN(19)));
    
                    await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress });
                    await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress1 });
                    await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress2 });
                    await this.dollar.approve(this.lottery.address, new BN(10).pow(new BN(19)), { from: userAddress3 });
    
                    await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress });
                    await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress1 });
                    await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress2 });
                    await this.lottery.purchaseTickets(new BN(10).pow(new BN(19)), { from: userAddress3 });

                    await this.dao.setEra(0, 10);
                    await this.dao.set(13);

                    await this.lottery.mockExtractionE(true);
                    await this.lottery.setWinningTicketsE([0, 1, 2]);
                    await this.lottery.extractWinner();
                });

                describe("wrong ticket", function () {
                    it("reverts", async function () {
                        await expectRevert(this.lottery.redeemReward(0, 0, 3, { from: userAddress }), "Lottery: winning ticket not found");
                    });
                });

                describe("correct ticket but address isn't a winner", function () {
                    it("reverts", async function () {
                        await expectRevert(this.lottery.redeemReward(0, 0, 0, { from: userAddress3 }), "Lottery: purchase doesn't contain the winning ticket");
                    });
                });

                describe("address is a winner but doesn't own the ticket", function () {
                    it("reverts", async function () {
                        await expectRevert(this.lottery.redeemReward(0, 0, 1, { from: userAddress }), "Lottery: purchase doesn't contain the winning ticket");
                    });
                });

                describe("correct ticket", function () {
                    beforeEach(async function () {
                        this.first = await this.lottery.redeemReward(0, 0, 0, { from: userAddress });
                        this.second = await this.lottery.redeemReward(0, 0, 1, { from: userAddress1 });
                        this.third = await this.lottery.redeemReward(0, 0, 2, { from: userAddress2 });
                    });

                    it("updates the contract's state", async function () {
                        expect(await this.lottery.getWinners(0)).deep.equal([userAddress, userAddress1, userAddress2]);
                        expect(await this.lottery.getRedeemedPrizes(0)).deep.equal([true, true, true]);

                        const { recipient, amount } = await this.dao.daiRequest();
                        expect(recipient).equal(userAddress2);
                        expect(amount).bignumber.equal(new BN(30));
                    });

                    it("emits RewardRedeemed event", async function () {
                        await expectEvent.inTransaction(this.first.tx, this.lottery, "RewardRedeemed", {
                            recipient: userAddress,
                            lotteryId: new BN(0),
                            reward: new BN(100)
                        });
                        await expectEvent.inTransaction(this.second.tx, this.lottery, "RewardRedeemed", {
                            recipient: userAddress1,
                            lotteryId: new BN(0),
                            reward: new BN(50)
                        });
                        await expectEvent.inTransaction(this.third.tx, this.lottery, "RewardRedeemed", {
                            recipient: userAddress2,
                            lotteryId: new BN(0),
                            reward: new BN(30)
                        });
                    });
                });

                describe("multiple attempts", function () {
                    beforeEach(async function () {
                        await this.lottery.redeemReward(0, 0, 0, { from: userAddress });
                    });

                    it("reverts", async function () {
                        await expectRevert(this.lottery.redeemReward(0, 0, 0, { from: userAddress }), "Lottery: Reward already redeemed");
                    });
                });
            });
        });
    });

});


