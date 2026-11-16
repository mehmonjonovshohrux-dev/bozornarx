'use client';
import { getAccessToken, refreshSession } from './api';

type Handler = (event: string, data: unknown) => void;
const listeners = new Set<Handler>();
/** Subscribe to events of the single shared stream (opened by the app shell). Returns an unsubscribe function. */
export function onRealtime(fn: Handler): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; }

/** Server-sent events over fetch (so the Authorization header can be sent). Reconnects with backoff; returns a stop function. */
export function openStream(onEvent: Handler): () => void {
  let stopped = false;
  let ctrl: AbortController | null = null;
  let delay = 1000;

  async function loop() {
    while (!stopped) {
      try {
        if (!getAccessToken() && !(await refreshSession())) { await sleep(5000); continue; }
        ctrl = new AbortController();
        const res = await fetch('/api/notifications/stream', { headers: { authorization: `Bearer ${getAccessToken()}`, accept: 'text/event-stream' }, signal: ctrl.signal });
        if (res.status === 401) { await refreshSession(); continue; }
        if (!res.ok || !res.body) throw new Error('stream');
        delay = 1000;
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i); buf = buf.slice(i + 2);
            let ev = 'message', data = '';
            for (const line of frame.split('\n')) { if (line.startsWith('event: ')) ev = line.slice(7); else if (line.startsWith('data: ')) data += line.slice(6); }
            if (data) { try { const parsed = JSON.parse(data); onEvent(ev, parsed); listeners.forEach((l) => l(ev, parsed)); } catch { /* ignore a malformed frame */ } }
          }
        }
      } catch { /* network drop or abort: fall through to backoff */ }
      if (stopped) return;
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }
  void loop();
  return () => { stopped = true; ctrl?.abort(); };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
