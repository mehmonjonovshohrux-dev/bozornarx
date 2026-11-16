// Trust score for a price record.
// Rules from the product brief: score only from real evidence; if there is not enough data say so;
// never invent a percentage. The weights below are an INITIAL PROPOSAL and need business sign-off.

export type ModerationState = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface TrustInput {
  price: number;
  sellerVerified: boolean;
  /** hours since the price was last confirmed or updated */
  ageHours: number;
  hasPhotoEvidence: boolean;
  /** confirmations from other, independent users or sellers */
  independentConfirmations: number;
  /** number of earlier price points for the same product and region */
  historyPoints: number;
  /** median price of the same product in the same region; undefined if unknown */
  regionMedian?: number;
  moderation: ModerationState;
}

export const TRUST_WEIGHTS = {
  sellerVerified: 25,
  freshness: 20,
  photo: 15,
  confirmations: 15,
  history: 10,
  regionalFit: 15,
} as const; // sums to 100

export const FRESH_FULL_HOURS = 24;
export const FRESH_ZERO_HOURS = 14 * 24;
export const CONFIRMATIONS_FOR_FULL = 3;
export const HISTORY_FOR_FULL = 10;
export const MIN_HISTORY_POINTS = 3;
export const FIT_FULL_PCT = 10;
export const FIT_ZERO_PCT = 50;
export const STALE_AFTER_HOURS = 7 * 24;
export const SUSPICIOUS_DEVIATION_PCT = 40;

export type TrustResult =
  | { status: 'INSUFFICIENT_DATA'; score: null; factors: Record<string, number>; stale: boolean }
  | { status: 'REJECTED'; score: 0; factors: Record<string, number>; stale: boolean }
  | { status: 'SCORED'; score: number; factors: Record<string, number>; stale: boolean };

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function deviationPercent(price: number, median: number): number {
  return (Math.abs(price - median) / median) * 100;
}

export function isSuspiciousPrice(price: number, regionMedian: number | undefined): boolean {
  if (regionMedian === undefined || !(regionMedian > 0)) return false; // cannot judge without a reference
  return deviationPercent(price, regionMedian) > SUSPICIOUS_DEVIATION_PCT;
}

export function computeTrust(i: TrustInput): TrustResult {
  const stale = i.ageHours > STALE_AFTER_HOURS;
  if (i.moderation === 'REJECTED') return { status: 'REJECTED', score: 0, factors: {}, stale };

  const hasReference = i.regionMedian !== undefined && i.regionMedian > 0;
  if (!hasReference && i.historyPoints < MIN_HISTORY_POINTS) {
    return { status: 'INSUFFICIENT_DATA', score: null, factors: {}, stale };
  }

  const w = TRUST_WEIGHTS;
  const freshness = clamp01(1 - (i.ageHours - FRESH_FULL_HOURS) / (FRESH_ZERO_HOURS - FRESH_FULL_HOURS));
  const fit = hasReference
    ? clamp01(1 - (deviationPercent(i.price, i.regionMedian as number) - FIT_FULL_PCT) / (FIT_ZERO_PCT - FIT_FULL_PCT))
    : 0;

  const factors = {
    sellerVerified: i.sellerVerified ? w.sellerVerified : 0,
    freshness: Math.round(w.freshness * freshness),
    photo: i.hasPhotoEvidence ? w.photo : 0,
    confirmations: Math.round(w.confirmations * clamp01(i.independentConfirmations / CONFIRMATIONS_FOR_FULL)),
    history: Math.round(w.history * clamp01(i.historyPoints / HISTORY_FOR_FULL)),
    regionalFit: Math.round(w.regionalFit * fit),
  };
  const score = Object.values(factors).reduce((a, b) => a + b, 0);
  return { status: 'SCORED', score, factors, stale };
}
