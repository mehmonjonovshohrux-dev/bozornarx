'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from './api';

export interface Query<T> { data: T | undefined; error: ApiError | null; loading: boolean; reload: () => void }

/** Small fetch hook (no external cache library): re-fetches when `path` changes; `path=null` skips. */
export function useApi<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    api<T>(path).then((d) => { if (mine === seq.current) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (mine === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Xatolik yuz berdi.')); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
  }, [path, tick]);
  // A non-null path with nothing loaded yet is still "loading" (prevents a one-render gap where consumers see no data and no error).
  return { data, error, loading: loading || (path !== null && data === undefined && error === null), reload: useCallback(() => setTick((t) => t + 1), []) };
}

/** Public (no-auth) variant for the guest catalog. */
export function usePublicApi<T>(path: string | null): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const seq = useRef(0);
  useEffect(() => {
    if (path === null) { setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    api<T>(path, { auth: false }).then((d) => { if (mine === seq.current) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (mine === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, 'ERROR', 'Xatolik yuz berdi.')); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
  }, [path, tick]);
  // A non-null path with nothing loaded yet is still "loading" (prevents a one-render gap where consumers see no data and no error).
  return { data, error, loading: loading || (path !== null && data === undefined && error === null), reload: useCallback(() => setTick((t) => t + 1), []) };
}

export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (...a: A): Promise<R | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(...a); } catch (e) { setError(e instanceof ApiError ? e.message : 'Xatolik yuz berdi.'); return undefined; } finally { setBusy(false); }
  }, [fn]); // eslint-disable-line react-hooks/exhaustive-deps
  return { run, busy, error, clear: () => setError(null) };
}

export const qs = (o: Record<string, string | number | boolean | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export interface Paged<T> { items: T[]; total: number; page: number; pageSize: number; pages?: number }

export async function uploadFile(file: File, kind: 'PRODUCT_IMAGE' | 'CHAT' | 'EVIDENCE' | 'STORE_DOC'): Promise<{ id: string }> {
  const data = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = () => rej(new Error('Faylni o‘qib bo‘lmadi'));
    r.readAsDataURL(file);
  });
  return api<{ id: string }>('/files', { body: { kind, dataBase64: data } });
}
