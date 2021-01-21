const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockCurve = contract.fromArtifact('MockCurve');

describe('Curve', function () {
  const [ ownerAddress ] = accounts;

  beforeEach(async function () {
    this.curve = await MockCurve.new({from: ownerAddress});
  });

  describe('amount is zero below threshold', function () {
      it('is 0', async function () {
        expect(await this.curve.calculateCouponsE(100000, 10000, 0, 1, 1)).to.be.bignumber.equal(new BN(0));
      });
  });

  describe('amount is zero above threshold', function () {
    it('is 0', async function () {
      expect(await this.curve.calculateCouponsE(100000, 50000, 0, 1, 1)).to.be.bignumber.equal(new BN(0));
    });
  });

  describe('total supply is zero', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(0, 0, 0, 1, 1), "division by zero");
    });
  });

  describe('100-10-10-90c-1: high risk - 1 (10%)', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100, 10, 10, new BN(10).pow(new BN(17)).muln(9), 1)).to.be.bignumber.equal(new BN(1));
    });
  });

  describe('100000-10000-10000-50c-101: medium risk - 2500 (25%)', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 10000, new BN(10).pow(new BN(17)).muln(5), 101)).to.be.bignumber.equal(new BN(2500));
    });
  });

  describe('100000-10000-5000-10c-1001: low risk - 900 (18%) ', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 5000, new BN(10).pow(new BN(17)), 1001)).to.be.bignumber.equal(new BN(900));
    });
  });

  describe('100000-70000-10000-10c-100: high risk (above threshold) - 18090 (180.90%)', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 70000, 10000, new BN(10).pow(new BN(17)), 100)).to.be.bignumber.equal(new BN(18090));
    });
  });

  describe('100000-60000-50000-1c-100000: low risk (above threshold) - 3960 (7.92%)', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 60000, 50000, new BN(10).pow(new BN(16)), 100000)).to.be.bignumber.equal(new BN(3960));
    });
  });
});