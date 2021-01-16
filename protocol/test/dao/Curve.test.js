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
      it('reverts', async function () {
        expect(await this.curve.calculateCouponsE(100000, 10000, 0, 1)).to.be.bignumber.equal(new BN(0));
      });
  });

  describe('amount is zero above threshold', function () {
    it('reverts', async function () {
      expect(await this.curve.calculateCouponsE(100000, 50000, 0, 1)).to.be.bignumber.equal(new BN(0));
    });
  });

  describe('total supply is zero', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(0, 0, 0, 1), "division by zero");
    });
  });

  describe('amount larger than total supply', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(100, 50, 110, 1), "subtraction overflow");
    });
  });

  describe('amount larger than total debt', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(100, 50, 60, 1), "subtraction overflow");
    });
  });

  describe('10-100-10-3: 3.0037037', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100, 10, 10, 1)).to.be.bignumber.equal(new BN(3));
    });
  });

  describe('100000-10000-10000-10: 2254', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 10000, 10)).to.be.bignumber.equal(new BN(2254));
    });
  });

  describe('100000-10000-5000-50 ', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 5000, 50)).to.be.bignumber.equal(new BN(578));
    });
  });

  describe('100000-70000-10000-100: 0.3467 (above threshold) - should add 3467', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 70000, 10000, 100)).to.be.bignumber.equal(new BN(3467));
    });
  });

  describe('100000-60000-50000-100000', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 60000, 50000, 100000)).to.be.bignumber.equal(new BN(11924));
    });
  });
});