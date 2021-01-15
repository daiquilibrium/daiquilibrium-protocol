const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockVault = contract.fromArtifact('MockVault');
const MockImplementation = contract.fromArtifact('MockImplementation');

const Web3 = require("web3");

describe("DAIVault", function () {
    const owners = accounts.slice(0, 6);

    beforeEach(async function () {
        this.vault = await MockVault.new();
        this.implementation = await MockImplementation.new(this.vault.address);

        owners[6] = this.implementation.address;

        await this.vault.setOwnersE(owners, 5);
        await this.vault.setImplementationE(this.implementation.address);
    });

    describe("submitTransaction", function () {
        describe("not from dao", function () {

            it("reverts", async function () {
                await expectRevert(this.vault.submitTransaction(owners[0], 0, "0x", { from: owners[0] }), "Sender isn't DAO");
            });

        });

        describe("from dao", function () {

            it("completes", async function () {
                await this.implementation.submitTransactionE(this.implementation.address, 0, "0x");
            });

        });
    });

    describe("executeTransaction", function () {
        
        describe("not enough approves", function () {

            beforeEach(async function () {
                await this.implementation.submitTransactionE(this.implementation.address, 0, new Web3().eth.abi.encodeFunctionSignature("mockFunction()"));
                await this.vault.confirmTransaction(0, { from: owners[1] });
                this.result = await this.vault.executeTransaction(0, { from: owners[1] });
            });

            it("doesn't execute", async function () {
                expect(this.result.logs).empty;
                expect(await this.implementation.mockFunctionCalled()).false;
            });

        });

        describe("invalid call", function () {

            beforeEach(async function () {
                await this.implementation.submitTransactionE(this.implementation.address, 0, new Web3().eth.abi.encodeFunctionSignature("invalidCall()"));
                await this.vault.confirmTransaction(0, { from: owners[1] });
                await this.vault.confirmTransaction(0, { from: owners[2] });
                await this.vault.confirmTransaction(0, { from: owners[3] });
                this.result = await this.vault.confirmTransaction(0, { from: owners[4] });
            });

            it("emits ExecutionFailure event", function () {
                expectEvent(this.result, "ExecutionFailure", {
                    transactionId: new BN(0)
                });
            });

            it("calls transactionFailed", async function () {
                expect(await this.implementation.txReverted()).true;
            });

        });

        describe("valid call", function () {

            beforeEach(async function () {
                await this.implementation.submitTransactionE(this.implementation.address, 0, new Web3().eth.abi.encodeFunctionSignature("mockFunction()"));
                await this.vault.confirmTransaction(0, { from: owners[1] });
                await this.vault.confirmTransaction(0, { from: owners[2] });
                await this.vault.confirmTransaction(0, { from: owners[3] });
                this.result = await this.vault.confirmTransaction(0, { from: owners[4] });
            });

            it("emits Execution event", function () {
                expectEvent(this.result, "Execution", {
                    transactionId: new BN(0)
                });
            });

            it("calls transactionExecuted", async function () {
                expect(await this.implementation.txCompleted()).true;
            });

            it("calls the function", async function () {
                expect(await this.implementation.mockFunctionCalled()).true;
            });

        });

    });
});