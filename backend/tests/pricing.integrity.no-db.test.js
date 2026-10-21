const { calculateDiscountAmounts } = require('../utils/pricing');

describe('Pricing integrity rules', () => {
  test('recalculates final price from server-side price and rounds discount', () => {
    expect(calculateDiscountAmounts({
      originalPrice: 100000,
      memberRate: 0.1,
      voucherRate: 0.2,
      maxTotalRate: 0.95
    })).toEqual({
      originalPrice: 100000,
      memberRate: 0.1,
      voucherRate: 0.2,
      maxTotalRate: 0.95,
      totalRate: 0.30000000000000004,
      discountAmount: 30000,
      finalPrice: 70000
    });
  });

  test('caps stacked discounts and never returns a negative price', () => {
    expect(calculateDiscountAmounts({
      originalPrice: 100,
      memberRate: 0.9,
      voucherRate: 0.9,
      maxTotalRate: 0.95
    })).toMatchObject({ discountAmount: 95, finalPrice: 5, totalRate: 0.95 });
  });

  test('rejects invalid or negative server-side prices', () => {
    expect(() => calculateDiscountAmounts({ originalPrice: -1, memberRate: 0, voucherRate: 0 })).toThrow('INVALID_SERVICE_PRICE');
    expect(() => calculateDiscountAmounts({ originalPrice: 'not-a-number', memberRate: 0, voucherRate: 0 })).toThrow('INVALID_SERVICE_PRICE');
  });

  test('clamps malicious discount policy values to safe bounds', () => {
    expect(calculateDiscountAmounts({
      originalPrice: 1000,
      memberRate: 4,
      voucherRate: -2,
      maxTotalRate: 2
    })).toMatchObject({ memberRate: 1, voucherRate: 0, maxTotalRate: 0.95, finalPrice: 50 });
  });

  test('rounds fractional discount amounts deterministically at the boundary', () => {
    expect(calculateDiscountAmounts({
      originalPrice: 101,
      memberRate: 0.05,
      voucherRate: 0,
      maxTotalRate: 0.95
    })).toMatchObject({ discountAmount: 5, finalPrice: 96 });
  });

  test('preserves a zero-price service without producing a negative total', () => {
    expect(calculateDiscountAmounts({
      originalPrice: 0,
      memberRate: 1,
      voucherRate: 1,
      maxTotalRate: 0.95
    })).toMatchObject({ discountAmount: 0, finalPrice: 0 });
  });
});
