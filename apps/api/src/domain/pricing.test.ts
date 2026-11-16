import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alertTriggered, bucketByDay, median, orderTotals, priceStats, priceTrend, slugify, unitPriceFor, validOfferPrice } from './pricing.ts';

test('median odd/even/empty', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test('priceStats', () => {
  assert.deepEqual(priceStats([]), { count: 0, min: null, max: null, avg: null, median: null });
  assert.deepEqual(priceStats([10, 20, 60]), { count: 3, min: 10, max: 60, avg: 30, median: 20 });
});

test('wholesale tiers pick the largest reached tier', () => {
  const tiers = [{ minQuantity: 10, unitPrice: 9000 }, { minQuantity: 100, unitPrice: 8000 }];
  assert.equal(unitPriceFor(10000, 5, tiers), 10000);
  assert.equal(unitPriceFor(10000, 10, tiers), 9000);
  assert.equal(unitPriceFor(10000, 150, tiers), 8000);
});

test('order totals with discount and delivery', () => {
  const t = orderTotals([{ quantity: 2, unitPrice: 10000 }, { quantity: 1.5, unitPrice: 4000 }], { discountPercent: 10, deliveryFee: 5000 });
  assert.deepEqual(t, { subtotal: 26000, discountAmount: 2600, deliveryFee: 5000, total: 28400 });
});

test('discount ignored below minimum amount', () => {
  const t = orderTotals([{ quantity: 1, unitPrice: 1000 }], { discountPercent: 10, discountMinAmount: 5000 });
  assert.equal(t.discountAmount, 0);
  assert.equal(t.total, 1000);
});

test('bucketByDay groups per UTC day', () => {
  const b = bucketByDay([
    { price: 100, at: new Date('2026-01-01T08:00:00Z') },
    { price: 120, at: new Date('2026-01-01T18:00:00Z') },
    { price: 90, at: new Date('2026-01-02T01:00:00Z') },
  ]);
  assert.equal(b.length, 2);
  assert.deepEqual(b[0], { date: '2026-01-01', min: 100, max: 120, avg: 110, last: 120, count: 2 });
});

test('trend needs 5 days, then detects direction', () => {
  const mk = (prices: number[]) => bucketByDay(prices.map((p, i) => ({ price: p, at: new Date(Date.UTC(2026, 0, i + 1)) })));
  assert.equal(priceTrend(mk([1, 2, 3])).status, 'INSUFFICIENT_DATA');
  assert.equal(priceTrend(mk([100, 110, 120, 130, 140])).direction, 'UP');
  assert.equal(priceTrend(mk([140, 130, 120, 110, 100])).direction, 'DOWN');
  assert.equal(priceTrend(mk([100, 100, 100, 100, 100])).direction, 'FLAT');
});

test('alerts', () => {
  assert.equal(alertTriggered('BELOW', 5000, 4999), true);
  assert.equal(alertTriggered('BELOW', 5000, 5001), false);
  assert.equal(alertTriggered('ABOVE', 5000, 5000), true);
});

test('offer price bounds', () => {
  assert.equal(validOfferPrice(8000, 10000), true);
  assert.equal(validOfferPrice(2000, 10000), false);
  assert.equal(validOfferPrice(12000, 10000), false);
});

test('slugify', () => {
  assert.equal(slugify('Qizil Pomidor (1-nav)!'), 'qizil-pomidor-1-nav');
  assert.equal(slugify('!!!'), 'item');
});
