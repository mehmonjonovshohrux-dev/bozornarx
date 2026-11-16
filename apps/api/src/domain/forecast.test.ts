import test from 'node:test';
import assert from 'node:assert/strict';
import { linearFit, movingAverage, projectLinear } from './forecast.ts';

const s = (vals: number[]) => vals.map((v, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), value: v }));

test('moving average smooths with a growing window at the start', () => {
  assert.deepEqual(movingAverage(s([10, 20, 30]), 2).map((p) => p.value), [10, 15, 25]);
});
test('linear fit recovers a perfect line', () => {
  const f = linearFit(s([100, 110, 120, 130]))!;
  assert.ok(Math.abs(f.slopePerDay - 10) < 1e-9);
  assert.ok(Math.abs(f.r2 - 1) < 1e-9);
});
test('too few points gives no fit', () => { assert.equal(linearFit(s([1, 2])), null); });
test('projection continues the line and dates follow the last day', () => {
  const p = projectLinear(s([100, 110, 120, 130]), 2);
  assert.equal(p.reliable, true);
  assert.deepEqual(p.points.map((x) => x.value), [140, 150]);
  assert.equal(p.points[0].date, '2026-01-05');
});
test('noisy series is refused instead of guessed', () => {
  assert.equal(projectLinear(s([10, 90, 12, 88, 11, 89]), 3).reliable, false);
});
test('projection never goes below zero', () => {
  assert.equal(projectLinear(s([30, 20, 10, 5]), 5).points.at(-1)!.value, 0);
});
