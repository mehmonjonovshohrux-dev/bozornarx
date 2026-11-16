import { test } from 'node:test';
import assert from 'node:assert/strict';
import { can, canAny, ROLES, PERMISSIONS, ROLE_PERMISSIONS } from './permissions.ts';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  CONTRACT_STATUSES,
  CONTRACT_TRANSITIONS,
  assertOrderTransition,
  assertContractTransition,
  canTransitionOrder,
  InvalidTransitionError,
} from './state-machines.ts';
import { compareOffers, pricePerBaseUnit, sameDimension } from './units.ts';
import { computeTrust, isSuspiciousPrice, TRUST_WEIGHTS } from './trust.ts';

// ---------- RBAC ----------
test('guest can only read public data', () => {
  assert.equal(can('GUEST', 'catalog.read'), true);
  assert.equal(can('GUEST', 'orders.create'), false);
  assert.equal(can('GUEST', 'chat.use'), false);
  assert.equal(can('GUEST', 'prices.create'), false);
});

test('buyer cannot create prices or moderate', () => {
  assert.equal(can('BUYER', 'prices.create'), false);
  assert.equal(can('BUYER', 'prices.moderate'), false);
  assert.equal(can('BUYER', 'orders.create'), true);
});

test('seller can manage own products and prices but not moderate or manage users', () => {
  assert.equal(can('SELLER', 'products.create'), true);
  assert.equal(can('SELLER', 'prices.create'), true);
  assert.equal(can('SELLER', 'prices.moderate'), false);
  assert.equal(can('SELLER', 'users.manage'), false);
  assert.equal(can('SELLER', 'products.delete'), false);
});

test('moderator has no access to settings, users, roles or payments', () => {
  for (const p of ['system.settings', 'users.manage', 'roles.manage', 'payments.view', 'audit.read'] as const) {
    assert.equal(can('MODERATOR', p), false, p);
  }
  assert.equal(can('MODERATOR', 'prices.moderate'), true);
  assert.equal(can('MODERATOR', 'disputes.resolve'), true);
});

test('super admin has everything except acting as a contract party', () => {
  for (const p of PERMISSIONS) {
    if (p === 'contracts.sign' || p === 'contracts.create') assert.equal(can('SUPER_ADMIN', p), false, p);
    else assert.equal(can('SUPER_ADMIN', p), true, p);
  }
});

test('every permission listed for a role exists in the global list', () => {
  for (const role of ROLES) {
    for (const p of ROLE_PERMISSIONS[role]) assert.ok(PERMISSIONS.includes(p), `${role}:${p}`);
  }
});

test('canAny checks several roles', () => {
  assert.equal(canAny(['GUEST', 'BUYER'], 'orders.create'), true);
  assert.equal(canAny(['GUEST'], 'orders.create'), false);
});

// ---------- State machines ----------
test('order happy path is allowed step by step', () => {
  const path = ['CREATED', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'DELIVERED', 'ACCEPTED', 'COMPLETED'] as const;
  for (let i = 0; i < path.length - 1; i++) assertOrderTransition(path[i], path[i + 1]);
});

test('order cannot skip steps or leave terminal states', () => {
  assert.throws(() => assertOrderTransition('CREATED', 'SHIPPED'), InvalidTransitionError);
  assert.throws(() => assertOrderTransition('COMPLETED', 'CANCELLED'), InvalidTransitionError);
  assert.throws(() => assertOrderTransition('CANCELLED', 'CREATED'), InvalidTransitionError);
  assert.equal(canTransitionOrder('DELIVERED', 'CANCELLED'), false);
});

test('every order and contract status has a transition entry and only known targets', () => {
  for (const s of ORDER_STATUSES) for (const t of ORDER_TRANSITIONS[s]) assert.ok(ORDER_STATUSES.includes(t));
  for (const s of CONTRACT_STATUSES) for (const t of CONTRACT_TRANSITIONS[s]) assert.ok(CONTRACT_STATUSES.includes(t));
});

test('contract needs both signatures before it is fully signed', () => {
  assertContractTransition('DRAFT', 'PENDING_REVIEW');
  assertContractTransition('PENDING_REVIEW', 'WAITING_FOR_BUYER');
  assertContractTransition('WAITING_FOR_BUYER', 'PARTIALLY_SIGNED');
  assertContractTransition('PARTIALLY_SIGNED', 'FULLY_SIGNED');
  assertContractTransition('FULLY_SIGNED', 'ACTIVE');
  assert.throws(() => assertContractTransition('WAITING_FOR_BUYER', 'FULLY_SIGNED'), InvalidTransitionError);
  assert.throws(() => assertContractTransition('DRAFT', 'ACTIVE'), InvalidTransitionError);
});

test('terminal contract states have no way out', () => {
  for (const s of ['COMPLETED', 'CANCELLED', 'EXPIRED'] as const) assert.equal(CONTRACT_TRANSITIONS[s].length, 0);
});

// ---------- Units and comparison ----------
test('5 kg bag and 1 kg are compared per kg, not by raw price', () => {
  const r = compareOffers({ price: 25000, unit: 'kg', quantity: 5 }, { price: 6000, unit: 'kg', quantity: 1 });
  assert.equal(r.comparable, true);
  if (r.comparable) {
    assert.equal(r.baseA, 5000);
    assert.equal(r.baseB, 6000);
    assert.ok(Math.abs(r.diffPercent - -16.6667) < 0.001);
  }
});

test('grams and kilograms normalise to the same base', () => {
  assert.equal(pricePerBaseUnit({ price: 500, unit: 'g', quantity: 100 }), 5000);
  assert.equal(pricePerBaseUnit({ price: 8000, unit: 'kg', quantity: 1 }), 8000);
  assert.equal(pricePerBaseUnit({ price: 1000, unit: 't', quantity: 1 }), 1);
});

test('different dimensions and packs are not compared', () => {
  const a = compareOffers({ price: 8000, unit: 'kg', quantity: 1 }, { price: 9000, unit: 'l', quantity: 1 });
  assert.deepEqual(a, { comparable: false, reason: 'DIFFERENT_DIMENSION' });
  const b = compareOffers({ price: 8000, unit: 'qadoq', quantity: 1 }, { price: 9000, unit: 'kg', quantity: 1 });
  assert.deepEqual(b, { comparable: false, reason: 'PACK_WITHOUT_SIZE' });
  const c = compareOffers({ price: 8000, unit: 'xx', quantity: 1 }, { price: 9000, unit: 'kg', quantity: 1 });
  assert.deepEqual(c, { comparable: false, reason: 'UNKNOWN_UNIT' });
  assert.equal(sameDimension('kg', 'g'), true);
  assert.equal(sameDimension('qadoq', 'qadoq'), false);
});

test('invalid quantity or price is rejected, not silently computed', () => {
  assert.equal(pricePerBaseUnit({ price: 100, unit: 'kg', quantity: 0 }), null);
  assert.equal(pricePerBaseUnit({ price: -1, unit: 'kg', quantity: 1 }), null);
});

// ---------- Trust score ----------
const base = {
  price: 5200,
  sellerVerified: true,
  ageHours: 2,
  hasPhotoEvidence: true,
  independentConfirmations: 3,
  historyPoints: 10,
  regionMedian: 5200,
  moderation: 'APPROVED',
} as const;

test('trust weights sum to 100', () => {
  assert.equal(Object.values(TRUST_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('perfect evidence gives 100, with factors', () => {
  const r = computeTrust(base);
  assert.equal(r.status, 'SCORED');
  assert.equal(r.score, 100);
});

test('no reference and too little history says "insufficient data", never a number', () => {
  const r = computeTrust({ ...base, regionMedian: undefined, historyPoints: 1 });
  assert.equal(r.status, 'INSUFFICIENT_DATA');
  assert.equal(r.score, null);
});

test('rejected price scores 0', () => {
  const r = computeTrust({ ...base, moderation: 'REJECTED' });
  assert.equal(r.status, 'REJECTED');
  assert.equal(r.score, 0);
});

test('old price loses freshness and is flagged stale after 7 days', () => {
  const fresh = computeTrust(base);
  const old = computeTrust({ ...base, ageHours: 8 * 24 });
  assert.ok(old.score !== null && fresh.score !== null && old.score < fresh.score);
  assert.equal(old.stale, true);
  assert.equal(fresh.stale, false);
});

test('unverified seller without photo scores lower', () => {
  const r = computeTrust({ ...base, sellerVerified: false, hasPhotoEvidence: false });
  assert.equal(r.score, 100 - 25 - 15);
});

test('price far from regional median is suspicious, near is not, unknown median is not judged', () => {
  assert.equal(isSuspiciousPrice(9000, 5200), true);
  assert.equal(isSuspiciousPrice(5500, 5200), false);
  assert.equal(isSuspiciousPrice(9000, undefined), false);
});
