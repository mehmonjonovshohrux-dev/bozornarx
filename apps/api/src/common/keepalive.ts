import { Logger } from '@nestjs/common';

/**
 * Keeps the free Render instances from falling asleep: while this API is awake it requests its own public /health and the website
 * every 10 minutes (Render counts that as traffic). Opt-in: KEEP_AWAKE=yes.
 * Render's free plan gives ~750 instance-hours per month for the whole workspace, and two always-on services would need ~1440,
 * so by default it only runs during KEEP_AWAKE_HOURS (UTC+5, "7-19" = 07:00-19:00), i.e. 12 h/day x 2 services = ~720 h/month.
 * Set KEEP_AWAKE_HOURS=0-24 to run all day (only if the workspace has a paid plan).
 */
export function startKeepAlive(): void {
  if (process.env.KEEP_AWAKE !== 'yes') return;
  const log = new Logger('keepalive');
  const self = process.env.RENDER_EXTERNAL_URL?.replace(/\/+$/, '');
  const web = process.env.WEB_ORIGIN?.replace(/\/+$/, '');
  const [from, to] = (process.env.KEEP_AWAKE_HOURS ?? '7-19').split('-').map((x) => Number(x));
  const targets = [self && `${self}/health`, web && `${web}/`].filter((u): u is string => !!u);
  if (targets.length === 0) { log.warn('KEEP_AWAKE=yes but RENDER_EXTERNAL_URL / WEB_ORIGIN are not set; nothing to ping'); return; }
  const tick = async () => {
    const hour = (new Date().getUTCHours() + 5) % 24; // Tashkent
    if (Number.isFinite(from) && Number.isFinite(to) && !(hour >= from! && hour < to!)) return;
    await Promise.all(targets.map((u) => fetch(u, { signal: AbortSignal.timeout(30_000) }).catch(() => undefined)));
  };
  setInterval(() => void tick(), 10 * 60 * 1000).unref();
  log.log(`keep-awake on: ${targets.join(', ')} every 10 min between ${from}:00 and ${to}:00 (UTC+5)`);
}
