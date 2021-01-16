const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockMarket = contract.fromArtifact('MockMarket');
const Dollar = contract.fromArtifact('Dollar');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = new BN(2).pow(new BN(256)).subn(1);

describe('Market', function () {
    const [ownerAddress, userAddress, poolAddress] = accounts;

    beforeEach(async function () {
        this.market = await MockMarket.new(poolAddress, { from: ownerAddress, gas: 8000000 });
        this.dollar = await Dollar.at(await this.market.dollar());

        await this.market.incrementEpochE();
        await this.market.stepE();
        await this.market.mintToE(userAddress, 1000000);
        await this.dollar.approve(this.market.address, 1000000, { from: userAddress });
    });

    describe('DAIQIP-3 retrocompatibility', function () {

        beforeEach(async function () {
            await this.market.incrementUserCoupons(userAddress, 1, 100000);
        });

        describe('before update', function () {
            describe('same epoch', function () {
                it('shows correct coupon balance', async function () {
                    expect(await this.market.balanceOfCoupons(userAddress, 1)).bignumber.equal(new BN(100000));
                    expect(await this.market.totalCoupons()).bignumber.equal(new BN(100000));
                });

                describe('purchaseCoupons', function () {

                    beforeEach(async function () {
                        await this.market.incrementTotalDebtE(10000);
                    })

                    it('reverts', async function () {
                        await expectRevert(this.market.purchaseCoupons(10000, 10000, { from: userAddress }), "Market: Coupons not updated");
                    });
                });
            });

            describe('on redeem', function () {

                beforeEach(async function () {

                    for (let i = 0; i < 3; i ++)  {
                        await this.market.incrementEpochE();
                    }

                    await this.market.stepE();

                    await this.market.incrementTotalRedeemableE(100000);
                });

                it('reverts', async function () {
                    await expectRevert(this.market.redeemCoupons(1, 100000, 0, { from: userAddress }), "Market: Coupons not updated")
                });

            });

        });

        describe('afrer update', function () {
            beforeEach(async function () {
                await this.market.updateCoupons(1, 10, { from: userAddress });
            });

            describe('before expiration', function () {
                it('rewards with 1% more coupons', async function () {
                    expect(await this.market.balanceOfCoupons(userAddress, 1)).bignumber.equals(new BN(101000));
                    expect(await this.market.totalCoupons()).bignumber.equals(new BN(101000));
                });
    
                it('sets the correct expiration', async function () {
                    expect(await this.market.couponExpirationForAccount(userAddress, 1)).bignumber.equals(new BN(11));
                    expect(await this.market.expiringCoupons(11)).bignumber.equals(new BN(101000));
                });

                describe('redeem', function () {
                    beforeEach(async function () {
                        for (let i = 0; i < 3; i++) {
                            await this.market.incrementEpochE();
                        }

                        await this.market.stepE();
                        
                        await this.market.mintToE(this.market.address, 101000);
                        await this.market.incrementTotalRedeemableE(101000);

                        await this.market.redeemCoupons(1, 101000, 0, { from: userAddress });
                    });

                    it('updates balances', async function () {
                        expect(await this.market.totalRedeemable()).bignumber.zero;
                        expect(await this.market.totalCoupons()).bignumber.zero;
                        expect(await this.market.balanceOfCoupons(userAddress, 1)).bignumber.zero;
                        expect(await this.market.expiringCoupons(11)).bignumber.zero;
                        expect(await this.dollar.balanceOf(userAddress)).bignumber.equal(new BN(1101000));
                    });
                });
            });

            describe('after expiration', function () {
                beforeEach(async function () {
                    for (let i = 0; i < 10; i++) {
                        await this.market.incrementEpochE();
                    }
    
                    this.result = await this.market.stepE();
                });

                it('emits CouponExpiration event', async function () {
                    const event = await expectEvent.inTransaction(this.result.tx, MockMarket, 'CouponExpiration', {});
    
                    expect(event.args.epoch).to.be.bignumber.equal(new BN(11));
                    expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(101000));
                    expect(event.args.lessRedeemable).to.be.bignumber.zero;
                    expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
                    expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
                });

                it('updates balances', async function () {
                    expect(await this.market.totalRedeemable()).bignumber.zero;
                    expect(await this.market.totalCoupons()).bignumber.zero;
                    expect(await this.market.balanceOfCoupons(userAddress, 1)).bignumber.zero;
                    expect(await this.market.expiringCoupons(11)).bignumber.zero;
                });

                describe('redeem', async function () {
                    it('reverts', async function () {
                        await expectRevert(this.market.redeemCoupons(1, 101000, 0, { from: userAddress }), "Market: Insufficient coupon balance");
                    });
                });
            });

        });

    });

    describe('purchaseCoupons', function () {
        describe('before call', function () {
            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
            });

            it('shows correct potential coupon premium', async function () {
                expect(await this.market.couponPremium(100000, 100)).to.be.bignumber.equal(new BN(6980));
            });
        });

        describe('period is < 3', function () {

            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
            });

            it('reverts', async function () {
                await expectRevert(this.market.purchaseCoupons(100000, 2, { from: userAddress }), "Market: Invalid expiration period");
            });
        });

        describe('period is > 100000', function () {

            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
            });

            it('reverts', async function () {
                await expectRevert(this.market.purchaseCoupons(100000, 100001, { from: userAddress }), "Market: Invalid expiration period");
            });
        });

        describe('no amount', function () {
            it('reverts', async function () {
                await expectRevert(this.market.purchaseCoupons(0, 1, { from: userAddress }), "Market: Must purchase non-zero amount");
            });
        });

        describe('no debt', function () {
            it('total net is correct', async function () {
                expect(await this.market.totalNet()).to.be.bignumber.equal(new BN(1000000));
            });

            it('reverts', async function () {
                await expectRevert(this.market.purchaseCoupons(100000, 1), "Market: Not enough debt");
            });
        });

        describe('on single call', function () {
            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
                this.result = await this.market.purchaseCoupons(100000, 100000, { from: userAddress });
                this.txHash = this.result.tx;
            });

            it('updates user balances', async function () {
                expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
                expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(101857));
            });

            it('shows correct preimum', async function () {
                expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
                expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(101857));
            });

            it('updates dao balances', async function () {
                expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(0));
                expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(101857));
                expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
                expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
            });

            it('emits CouponPurchase event', async function () {
                const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponPurchase', {
                    account: userAddress,
                });

                expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
                expect(event.args.dollarAmount).to.be.bignumber.equal(new BN(100000));
                expect(event.args.couponAmount).to.be.bignumber.equal(new BN(101857));
            });
        });

        describe('multiple calls', function () {
            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
                await this.market.purchaseCoupons(50000, 100000, { from: userAddress });
                this.result = await this.market.purchaseCoupons(50000, 100000, { from: userAddress });
                this.txHash = this.result.tx;
            });

            it('updates user balances', async function () {
                expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
                expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(101908));
            });

            it('updates dao balances', async function () {
                expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(0));
                expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(101908));
                expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
                expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
            });

            it('emits CouponPurchase event', async function () {
                const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponPurchase', {
                    account: userAddress,
                });

                expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
                expect(event.args.dollarAmount).to.be.bignumber.equal(new BN(50000));
                expect(event.args.couponAmount).to.be.bignumber.equal(new BN(50465));
            });
        });
    });

    describe('redeemCoupons', function () {
        beforeEach(async function () {
            await this.market.incrementTotalDebtE(100000);
            await this.market.purchaseCoupons(100000, 10, { from: userAddress });
            await this.market.mintToE(this.market.address, 100000);
            await this.market.incrementTotalRedeemableE(100000);
        });

        describe('before redeemable', function () {
            describe('same epoch', function () {
                it('reverts', async function () {
                    await expectRevert(this.market.redeemCoupons(1, 100000, 0, { from: userAddress }), "Market: Too early to redeem");
                });
            });

            describe('next epoch', function () {
                it('reverts', async function () {
                    await this.market.incrementEpochE();
                    await expectRevert(this.market.redeemCoupons(1, 100000, 0, { from: userAddress }), "Market: Too early to redeem");
                });
            });
        });

        describe('after redeemable', function () {
            beforeEach(async function () {
                await this.market.incrementEpochE();
                await this.market.incrementEpochE();
            });

            describe('not enough coupon balance', function () {
                it('reverts', async function () {
                    await expectRevert(this.market.redeemCoupons(1, 200000, 0, { from: userAddress }), "Market: Insufficient coupon balance");
                });
            });

            describe('on single call', function () {
                beforeEach(async function () {
                    this.result = await this.market.redeemCoupons(1, 100000, 0, { from: userAddress });
                    this.txHash = this.result.tx;
                });

                it('updates user balances', async function () {
                    expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000000));
                    expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(24074));
                });

                it('updates dao balances', async function () {
                    expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(0));
                    expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(24074));
                    expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
                    expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
                });

                it('emits CouponRedemption event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
                        account: userAddress,
                    });

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
                    expect(event.args.couponAmount).to.be.bignumber.equal(new BN(100000));
                });
            });

            describe('multiple calls', function () {
                beforeEach(async function () {
                    this.result = await this.market.redeemCoupons(1, 30000, 0, { from: userAddress });
                    this.result = await this.market.redeemCoupons(1, 50000, 0, { from: userAddress });
                    this.txHash = this.result.tx;
                });

                it('updates user balances', async function () {
                    expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(980000));
                    expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(44074));
                });

                it('updates dao balances', async function () {
                    expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(20000));
                    expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(44074));
                    expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
                    expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(20000));
                });

                it('emits CouponRedemption event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
                        account: userAddress,
                    });

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
                    expect(event.args.couponAmount).to.be.bignumber.equal(new BN(50000));
                });
            });
        });

        describe('after expired', function () {
            this.timeout(100000);

            beforeEach(async function () {
                for (let i = 0; i < 10; i++) {
                    await this.market.incrementEpochE();
                }
                await this.market.stepE();
            });

            it('reverts', async function () {
                await expectRevert(this.market.redeemCoupons(1, 100000, 0, { from: userAddress }), "Market: Insufficient coupon balance");
            });
        });
    });

    describe('step', function () {
        beforeEach(async function () {
            await this.market.incrementEpochE();
            await this.market.stepE();
        });

        describe('on call with expiration', function () {

            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
                await this.market.purchaseCoupons(100000, 10, { from: userAddress });

                await this.market.incrementEpochE();
                await this.market.stepE();

                for (let i = 0; i < 9; i++) {
                    await this.market.incrementEpochE();
                }
                this.result = await this.market.stepE();
                this.txHash = this.result.tx;
            });

            it('emits CouponExpiration event', async function () {
                const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(124074));
                expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
                expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
            });
        });

        describe('on call with all reclaimed no bonded', function () {

            beforeEach(async function () {
                await this.market.incrementTotalDebtE(100000);
                await this.market.purchaseCoupons(100000, 10, { from: userAddress });

                await this.market.mintToE(this.market.address, 100000);
                await this.market.incrementTotalRedeemableE(100000);

                await this.market.incrementEpochE();
                this.result = await this.market.stepE();

                for (let i = 0; i < 9; i++) {
                    await this.market.incrementEpochE();
                }
                this.result = await this.market.stepE();
                this.txHash = this.result.tx;
            });

            it('emits CouponExpiration event', async function () {
                const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(124074));
                expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(100000));
                expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
                expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
            });
        });

        describe('with bonded', function () {
            beforeEach(async function () {
                await this.market.mintToE(this.market.address, 100000);
                await this.market.incrementTotalBondedE(100000);
            });

            describe('on call with all reclaimed', function () {

                beforeEach(async function () {
                    await this.market.incrementTotalDebtE(100000);
                    await this.market.purchaseCoupons(100000, 10, { from: userAddress });

                    await this.market.mintToE(this.market.address, 100000);
                    await this.market.incrementTotalRedeemableE(100000);

                    await this.market.incrementEpochE();
                    this.result = await this.market.stepE();

                    for (let i = 0; i < 9; i++) {
                        await this.market.incrementEpochE();
                    }
                    this.result = await this.market.stepE();
                    this.txHash = this.result.tx;
                });

                it('emits CouponExpiration event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                    expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(123888));
                    expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(100000));
                    expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
                    expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
                });
            });

            describe('on call with some reclaimed', function () {

                beforeEach(async function () {
                    await this.market.incrementTotalDebtE(100000);
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.incrementEpochE();
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.mintToE(this.market.address, 100000);
                    await this.market.incrementTotalRedeemableE(100000);

                    this.result = await this.market.stepE();

                    for (let i = 0; i < 9; i++) {
                        await this.market.incrementEpochE();
                    }
                    this.result = await this.market.stepE();
                    this.txHash = this.result.tx;
                });

                it('emits CouponExpiration event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                    expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(62402));
                    expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
                    expect(event.args.newBonded).to.be.bignumber.equal(new BN(38473));
                });
            });

            describe('reclaimed some debt', function () {

                beforeEach(async function () {
                    await this.market.incrementTotalDebtE(150000);
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.incrementEpochE();
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.mintToE(this.market.address, 100000);
                    await this.market.incrementTotalRedeemableE(100000);

                    this.result = await this.market.stepE();

                    for (let i = 0; i < 9; i++) {
                        await this.market.incrementEpochE();
                    }
                    this.result = await this.market.stepE();
                    this.txHash = this.result.tx;
                });

                it('emits CouponExpiration event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                    expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(63442));
                    expect(event.args.lessDebt).to.be.bignumber.equal(new BN(37527));
                    expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
                });
            });

            describe('reclaimed all debt and some bonded', function () {

                beforeEach(async function () {
                    await this.market.incrementTotalDebtE(120000);
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.incrementEpochE();
                    await this.market.purchaseCoupons(50000, 10, { from: userAddress });

                    await this.market.mintToE(this.market.address, 100000);
                    await this.market.incrementTotalRedeemableE(100000);

                    this.result = await this.market.stepE();

                    for (let i = 0; i < 9; i++) {
                        await this.market.incrementEpochE();
                    }
                    this.result = await this.market.stepE();
                    this.txHash = this.result.tx;
                });

                it('emits CouponExpiration event', async function () {
                    const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', {});

                    expect(event.args.epoch).to.be.bignumber.equal(new BN(12));
                    expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(62799));
                    expect(event.args.lessDebt).to.be.bignumber.equal(new BN(20000));
                    expect(event.args.newBonded).to.be.bignumber.equal(new BN(18112));
                });
            });
        });
    });
});