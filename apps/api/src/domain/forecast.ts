// Forecast PREPARATION only: clean daily series + simple, explainable baselines.
// This is not a trained model and is never presented to users as a guarantee.

export interface DayPoint { date: string; value: number }

export function movingAverage(series: readonly DayPoint[], window: number): DayPoint[] {
  if (window < 1) throw new Error('window must be >= 1');
  return series.map((p, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = series.slice(from, i + 1);
    const avg = slice.reduce((s, x) => s + x.value, 0) / slice.length;
    return { date: p.date, value: Math.round(avg * 100) / 100 };
  });
}

export interface LinearFit { slopePerDay: number; intercept: number; r2: number }

/** Least squares on day index. Returns null when there are fewer than 3 points. */
export function linearFit(series: readonly DayPoint[]): LinearFit | null {
  const n = series.length;
  if (n < 3) return null;
  const xs = series.map((_, i) => i);
  const ys = series.map((p) => p.value);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slopePerDay: slope, intercept: my - slope * mx, r2 };
}

export interface Projection { date: string; value: number }

/** Straight-line continuation for `days` days after the last point; refuses when the fit is weak (r2 < minR2). */
export function projectLinear(series: readonly DayPoint[], days: number, minR2 = 0.3): { reliable: boolean; fit: LinearFit | null; points: Projection[] } {
  const fit = linearFit(series);
  if (!fit || fit.r2 < minR2 || days < 1) return { reliable: false, fit, points: [] };
  const last = new Date(series[series.length - 1].date + 'T00:00:00Z');
  const points: Projection[] = [];
  for (let d = 1; d <= days; d++) {
    const dt = new Date(last.getTime() + d * 86_400_000);
    const v = fit.intercept + fit.slopePerDay * (series.length - 1 + d);
    points.push({ date: dt.toISOString().slice(0, 10), value: Math.max(0, Math.round(v * 100) / 100) });
  }
  return { reliable: true, fit, points };
}
