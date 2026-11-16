// Pure money / statistics rules for catalog, orders and charts. No database, no framework: easy to test.
// Amounts are UZS. All results are rounded to 2 decimals.

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface PriceStats {
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
}

export function priceStats(values: readonly number[]): PriceStats {
  if (values.length === 0) return { count: 0, min: null, max: null, avg: null, median: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return { count: values.length, min: Math.min(...values), max: Math.max(...values), avg: round2(sum / values.length), median: median(values) };
}

export interface Tier {
  minQuantity: number;
  unitPrice: number;
}

/** Wholesale: the tier with the largest minQuantity that the quantity reaches wins; otherwise the base price. */
export function unitPriceFor(basePrice: number, quantity: number, tiers: readonly Tier[]): number {
  let best: Tier | null = null;
  for (const t of tiers) {
    if (quantity >= t.minQuantity && (best === null || t.minQuantity > best.minQuantity)) best = t;
  }
  return best ? best.unitPrice : basePrice;
}

export interface OrderLine {
  quantity: number;
  unitPrice: number;
}

export interface Totals {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  total: number;
}

export function orderTotals(lines: readonly OrderLine[], opts: { discountPercent?: number; discountMinAmount?: number; deliveryFee?: number } = {}): Totals {
  const subtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const pct = opts.discountPercent ?? 0;
  const eligible = pct > 0 && pct <= 100 && subtotal >= (opts.discountMinAmount ?? 0);
  const discountAmount = eligible ? round2((subtotal * pct) / 100) : 0;
  const deliveryFee = round2(opts.deliveryFee ?? 0);
  return { subtotal, discountAmount, deliveryFee, total: round2(subtotal - discountAmount + deliveryFee) };
}

export interface HistoryPoint {
  price: number;
  at: Date;
}
export interface DayBucket {
  date: string; // YYYY-MM-DD (UTC)
  min: number;
  max: number;
  avg: number;
  last: number;
  count: number;
}

/** Groups price points per UTC day for charts. `last` = the latest price of that day. */
export function bucketByDay(points: readonly HistoryPoint[]): DayBucket[] {
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const map = new Map<string, number[]>();
  for (const p of sorted) {
    const k = p.at.toISOString().slice(0, 10);
    const arr = map.get(k);
    if (arr) arr.push(p.price);
    else map.set(k, [p.price]);
  }
  return [...map.entries()].map(([date, ps]) => ({
    date,
    min: Math.min(...ps),
    max: Math.max(...ps),
    avg: round2(ps.reduce((a, b) => a + b, 0) / ps.length),
    last: ps[ps.length - 1]!,
    count: ps.length,
  }));
}

export interface Trend {
  status: 'INSUFFICIENT_DATA' | 'OK';
  slopePerDay: number | null;
  direction: 'UP' | 'DOWN' | 'FLAT' | null;
  points: number;
}

/**
 * Least-squares slope over daily averages. This is a TREND indicator, not a forecast:
 * it is the data preparation step for a future forecasting model. Needs at least 5 distinct days.
 */
export function priceTrend(buckets: readonly DayBucket[], flatBandPctPerDay = 0.2): Trend {
  if (buckets.length < 5) return { status: 'INSUFFICIENT_DATA', slopePerDay: null, direction: null, points: buckets.length };
  const t0 = Date.parse(buckets[0]!.date);
  const xs = buckets.map((b) => (Date.parse(b.date) - t0) / 86_400_000);
  const ys = buckets.map((b) => b.avg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  if (den === 0 || my === 0) return { status: 'INSUFFICIENT_DATA', slopePerDay: null, direction: null, points: n };
  const slope = num / den;
  const pct = (slope / my) * 100;
  return { status: 'OK', slopePerDay: round2(slope), direction: Math.abs(pct) < flatBandPctPerDay ? 'FLAT' : slope > 0 ? 'UP' : 'DOWN', points: n };
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[ʻʼ‘’`']/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'item';

/** Price alert: BELOW fires when price <= target, ABOVE when price >= target. Both per the same unit. */
export function alertTriggered(direction: 'BELOW' | 'ABOVE', target: number, current: number): boolean {
  return direction === 'BELOW' ? current <= target : current >= target;
}

/** Offer rules: the buyer's counter must stay within the stated bounds. */
export function validOfferPrice(offered: number, listed: number): boolean {
  return offered > 0 && offered <= listed * 1.0 && offered >= listed * 0.3; // below 30% of list price is rejected as non-serious
}
