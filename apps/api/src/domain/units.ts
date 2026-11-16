// Unit normalisation for price comparison.
// Prices are compared only when both sides reduce to the same base unit.
// Packs ("qadoq") have no fixed size, so they are comparable only via a variant that states its content size.

export type Dimension = 'MASS' | 'VOLUME' | 'COUNT' | 'LENGTH' | 'AREA' | 'CUBIC';

export interface UnitDef {
  code: string;
  name: string;
  dimension: Dimension | 'PACK';
  /** multiplier to the base unit of its dimension (kg, l, dona, m, m2, m3); null = not convertible */
  toBase: number | null;
}

export const UNITS: Record<string, UnitDef> = {
  kg: { code: 'kg', name: 'kilogramm', dimension: 'MASS', toBase: 1 },
  g: { code: 'g', name: 'gramm', dimension: 'MASS', toBase: 0.001 },
  t: { code: 't', name: 'tonna', dimension: 'MASS', toBase: 1000 },
  l: { code: 'l', name: 'litr', dimension: 'VOLUME', toBase: 1 },
  ml: { code: 'ml', name: 'millilitr', dimension: 'VOLUME', toBase: 0.001 },
  dona: { code: 'dona', name: 'dona', dimension: 'COUNT', toBase: 1 },
  qadoq: { code: 'qadoq', name: 'qadoq', dimension: 'PACK', toBase: null },
  m: { code: 'm', name: 'metr', dimension: 'LENGTH', toBase: 1 },
  m2: { code: 'm2', name: 'kvadrat metr', dimension: 'AREA', toBase: 1 },
  m3: { code: 'm3', name: 'kub metr', dimension: 'CUBIC', toBase: 1 },
};

export interface PricedOffer {
  /** total price in UZS for `quantity` of `unit` */
  price: number;
  unit: string;
  /** how many `unit` the price is for (e.g. 5 for a 5 kg bag) */
  quantity: number;
}

/** Price per one base unit (per kg, per litre, ...), or null when it cannot be computed honestly. */
export function pricePerBaseUnit(offer: PricedOffer): number | null {
  const u = UNITS[offer.unit];
  if (!u || u.toBase === null) return null;
  if (!(offer.quantity > 0) || !(offer.price >= 0)) return null;
  return offer.price / (offer.quantity * u.toBase);
}

export function sameDimension(a: string, b: string): boolean {
  const ua = UNITS[a];
  const ub = UNITS[b];
  return !!ua && !!ub && ua.dimension !== 'PACK' && ua.dimension === ub.dimension;
}

export type CompareResult =
  | { comparable: true; baseA: number; baseB: number; diffPercent: number }
  | { comparable: false; reason: 'UNKNOWN_UNIT' | 'PACK_WITHOUT_SIZE' | 'DIFFERENT_DIMENSION' | 'INVALID_INPUT' };

/** Compare two offers by price per base unit. diffPercent = how much more expensive A is than B. */
export function compareOffers(a: PricedOffer, b: PricedOffer): CompareResult {
  const ua = UNITS[a.unit];
  const ub = UNITS[b.unit];
  if (!ua || !ub) return { comparable: false, reason: 'UNKNOWN_UNIT' };
  if (ua.dimension === 'PACK' || ub.dimension === 'PACK') return { comparable: false, reason: 'PACK_WITHOUT_SIZE' };
  if (ua.dimension !== ub.dimension) return { comparable: false, reason: 'DIFFERENT_DIMENSION' };
  const baseA = pricePerBaseUnit(a);
  const baseB = pricePerBaseUnit(b);
  if (baseA === null || baseB === null || baseB === 0) return { comparable: false, reason: 'INVALID_INPUT' };
  return { comparable: true, baseA, baseB, diffPercent: ((baseA - baseB) / baseB) * 100 };
}

export const BASE_UNIT_BY_DIMENSION: Record<Exclude<Dimension, never>, string> = { MASS: 'kg', VOLUME: 'l', COUNT: 'dona', LENGTH: 'm', AREA: 'm2', CUBIC: 'm3' };

/** Code of the base unit for a unit code (kg for g/t/kg ...), or null for packs and unknown units. */
export function baseUnitCode(code: string): string | null {
  const u = UNITS[code];
  return u && u.dimension !== 'PACK' ? BASE_UNIT_BY_DIMENSION[u.dimension] : null;
}
