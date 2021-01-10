const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const expectEvent = require('@openzeppelin/test-helpers/src/expectEvent');
const { expect } = require('chai');

const MockBootstrapper = contract.fromArtifact('MockBootstrapper');
const Dollar = contract.fromArtifact('Dollar');
const DAI = contract.fromArtifact('MockToken')

describe("Bootstrapper", function () {

    const [ ownerAddress, userAddress, userAddress1 ] = accounts;

    beforeEach(async function () {
        this.bootstrapper = await MockBootstrapper.new({ from: ownerAddress });
        this.dollar = await Dollar.at(await this.bootstrapper.dollar());
        this.dai = await DAI.new("DAI", "DAI", 18);

        await this.bootstrapper.setDAI(this.dai.address);
    });

    describe("swap", function () {

        describe("epoch 0", function () {

            beforeEach(async function () {
                await this.dai.mint(userAddress, 1000);
                await this.dai.approve(this.bootstrapper.address, 1000, { from: userAddress });
                
                this.receipt = await this.bootstrapper.swap(1000, { from: userAddress });
            });

            it("mints tokens 1:1", async function () {
                expect(await this.dollar.totalSupply()).bignumber.equal(new BN(1000));
                expect(await this.dollar.balanceOf(userAddress)).bignumber.equal(new BN(1000));
                expect(await this.dai.balanceOf(this.bootstrapper.address)).bignumber.equal(new BN(1000));
            });

            it("increments total contributions", async function () {
                expect(await this.bootstrapper.totalContributions()).bignumber.equal(new BN(1000));
            });

            it("emits swap event", async function () {
                expectEvent(this.receipt, "Swap", {
                    sender: userAddress,
                    amount: new BN(1000),
                    contributions: new BN(1000)
                });
            });

        });

        describe("epoch >= 1", function() {

            beforeEach(async function () {
                await this.bootstrapper.incrementEpochE();
            });

            it("reverts", async function () {
                await expectRevert(this.bootstrapper.swap(1000, { from: userAddress }), "Bootstrapper: Fixed swap period ended");
            });

        });

    });

    describe("step", function () {

        describe("no contributions", function () {
            
            beforeEach(async function () {
                this.receipt = await this.bootstrapper.stepE({ from: userAddress });
            });

            it("skips bootstrapping", async function () {
                expect(await this.bootstrapper.bootstrappingPeriod()).bignumber.zero;
            });

            it("rewards with 150 DAIQ", async function () {
                expect(await this.dollar.totalSupply()).bignumber.equal(new BN(150).mul(new BN(10).pow(new BN(18))));
                expect(await this.dollar.balanceOf(userAddress)).bignumber.equal(new BN(150).mul(new BN(10).pow(new BN(18))));
            });

            it("sets shouldDistributeDAI to false", async function () {
                expect(await this.bootstrapper.shouldDistributeDAI()).equal(false);
            });

            it("emits MixedIncentivization event", function () {
                expectEvent(this.receipt, "MixedIncentivization", {
                    account: userAddress,
                    daiqAmount: new BN(150).mul(new BN(10).pow(new BN(18))),
                    daiAmount: new BN(0)
                });
            });
        });

        describe("with contributions", function () {

            describe("reward > soft cap", function () {

                beforeEach(async function () {
                    this.swapAmount = new BN(30100).mul(new BN(10).pow(new BN(18)));
                    await this.dai.mint(userAddress, this.swapAmount);
                    await this.dai.approve(this.bootstrapper.address, this.swapAmount, { from: userAddress });
                    await this.bootstrapper.swap(this.swapAmount, { from: userAddress });
    
                    this.receipt = await this.bootstrapper.stepE({ from: userAddress });

                    await this.bootstrapper.incrementEpochE();
                });
    
                describe("before DAI exhaustion", function () {
    
                    it("sets bootstrapping epochs", async function () {
                        expect(await this.bootstrapper.bootstrappingPeriod()).bignumber.equal(new BN(152));
                    });
        
                    it("rewards with 150 DAI", async function () {
                        expect(await this.dai.balanceOf(userAddress)).bignumber.equal(new BN(150).mul(new BN(10).pow(new BN(18))));
                    });
        
                    it("sets shouldDistributeDAI to true", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(true);
                    });
        
                    it("emits DAIIncentivization event", function () {
                        expectEvent(this.receipt, "DAIIncentivization", {
                            account: userAddress,
                            amount: new BN(150).mul(new BN(10).pow(new BN(18))),
                        });
                    });
    
                });

                describe("during DAI exhaustion", function () {
                    this.timeout(100000);
    
                    beforeEach(async function () {
    
                        await Promise.all([...new Array(199).keys()].map(() => this.bootstrapper.stepE()));
    
                        this.receipt = await this.bootstrapper.stepE({ from: userAddress1 });
                    });
        
                    it("rewards with 100 DAI and 50 DAIQ", async function () {
                        expect(await this.dai.balanceOf(userAddress1)).bignumber.equal(new BN(100).mul(new BN(10).pow(new BN(18))));
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.equal(new BN(50).mul(new BN(10).pow(new BN(18))));
                    });
        
                    it("sets shouldDistributeDAI to false", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(false);
                    });
        
                    it("emits MixedIncentivization event", function () {
                        expectEvent(this.receipt, "MixedIncentivization", {
                            account: userAddress1,
                            daiqAmount: new BN(50).mul(new BN(10).pow(new BN(18))),
                            daiAmount: new BN(100).mul(new BN(10).pow(new BN(18)))
                        });
                    });
    
                });

                describe("after DAI exhaustionb", function () {
                    this.timeout(100000);
    
                    beforeEach(async function () {
    
                        await Promise.all([...new Array(199).keys()].map(() => this.bootstrapper.stepE()));
    
                        const receipt = this.receipt = await this.bootstrapper.stepE();
                        this.receipt = await this.bootstrapper.stepE({ from: userAddress1 });
                    });
        
                    it("rewards with 100 DAIQ", async function () {
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.equal(new BN(100).mul(new BN(10).pow(new BN(18))));
                    });
        
                    it("sets shouldDistributeDAI to false", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(false);
                    });
        
                    it("emits Incentivization event", function () {
                        expectEvent(this.receipt, "Incentivization", {
                            account: userAddress1,
                            amount: new BN(100).mul(new BN(10).pow(new BN(18)))
                        });
                    });
                });

            });

            describe("reward < soft cap", function () {

                beforeEach(async function () {
                    this.swapAmount = new BN(10000).mul(new BN(10).pow(new BN(18)));
                    await this.dai.mint(userAddress, this.swapAmount);
                    await this.dai.approve(this.bootstrapper.address, this.swapAmount, { from: userAddress });
                    await this.bootstrapper.swap(this.swapAmount, { from: userAddress });
    
                    this.receipt = await this.bootstrapper.stepE({ from: userAddress });

                    await this.bootstrapper.incrementEpochE();
                });

                describe("before DAI exhaustion", function () {
    
                    it("sets bootstrapping epochs", async function () {
                        expect(await this.bootstrapper.bootstrappingPeriod()).bignumber.equal(new BN(177));
                    });
        
                    it("rewards with initialSupply / (bootstrappingEpochs + 1) DAI", async function () {
                        expect(await this.dai.balanceOf(userAddress)).bignumber.equal("56179775280898876404");
                    });
        
                    it("sets shouldDistributeDAI to true", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(true);
                    });
        
                    it("emits DAIIncentivization event", function () {
                        expectEvent(this.receipt, "DAIIncentivization", {
                            account: userAddress,
                            amount: "56179775280898876404",
                        });
                    });
    
                });

                describe("during bootstrapping end", function () {
                    this.timeout(100000);
    
                    beforeEach(async function () {
    
                        await Promise.all([...new Array(176).keys()].map(() => this.bootstrapper.stepE()));
    
                        this.receipt = await this.bootstrapper.stepE({ from: userAddress1 });
                    });

                    it("rewards with ~56 DAI", async function () {
                        expect(await this.dai.balanceOf(userAddress1)).bignumber.equal("56179775280898876404");
                    });
        
                    it("sets shouldDistributeDAI to true", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(true);
                    });
        
                    it("emits DAIIncentivization event", function () {
                        expectEvent(this.receipt, "DAIIncentivization", {
                            account: userAddress1,
                            amount: "56179775280898876404"
                        });
                    });

                });

                describe("during DAI exhaustion", function () {

                    this.timeout(100000);
    
                    beforeEach(async function () {
    
                        await Promise.all([...new Array(177).keys()].map(() => this.bootstrapper.stepE()));
    
                        this.receipt = await this.bootstrapper.stepE({ from: userAddress1 });
                    });

                    it("rewards with 88 units of DAI (distribution the last remaining dust) and ~56 DAIQ", async function () {
                        expect(await this.dai.balanceOf(userAddress1)).bignumber.equal(new BN(88));
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.equal("56179775280898876316");
                    });
        
                    it("sets shouldDistributeDAI to false", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(false);
                    });
        
                    it("emits MixedIncentivization event", function () {
                        expectEvent(this.receipt, "MixedIncentivization", {
                            account: userAddress1,
                            daiqAmount: "56179775280898876316",
                            daiAmount: new  BN(88)
                        });
                    });

                });

                describe("after DAI exhaustion", function () {
                    this.timeout(100000);
    
                    beforeEach(async function () {
    
                        await Promise.all([...new Array(178).keys()].map(() => this.bootstrapper.stepE()));
    
                        this.receipt = await this.bootstrapper.stepE({ from: userAddress1 });
                    });
        
                    it("rewards with 100 DAIQ", async function () {
                        expect(await this.dollar.balanceOf(userAddress1)).bignumber.equal(new BN(100).mul(new BN(10).pow(new BN(18))));
                    });
        
                    it("sets shouldDistributeDAI to false", async function () {
                        expect(await this.bootstrapper.shouldDistributeDAI()).equal(false);
                    });
        
                    it("emits Incentivization event", function () {
                        expectEvent(this.receipt, "Incentivization", {
                            account: userAddress1,
                            amount: new BN(100).mul(new BN(10).pow(new BN(18)))
                        });
                    });
                });

            });

        });

    });

});