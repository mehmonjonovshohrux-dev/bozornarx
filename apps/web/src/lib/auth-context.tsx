'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi, lastRefreshFailure, refreshSession, type Me } from './api';
import { clearApiCache } from './hooks';

interface AuthState {
  user: Me | null;
  loading: boolean;
  reload: () => Promise<void>;
  logout: () => Promise<void>;
}

const ME_KEY = 'bn_me_v1';
const readMe = (): Me | null => { try { const t = localStorage.getItem(ME_KEY); return t ? (JSON.parse(t) as Me) : null; } catch { return null; } };
const writeMe = (m: Me | null) => { try { if (m) { localStorage.setItem(ME_KEY, JSON.stringify(m)); localStorage.setItem('bn_last_email', m.email); } else localStorage.removeItem(ME_KEY); } catch { /* ignore */ } };

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const uid = useRef<string | null>(null);

  const apply = useCallback((me: Me | null) => {
    if (uid.current !== (me?.id ?? null)) clearApiCache(); // a different account must never see the previous one's cached pages
    uid.current = me?.id ?? null;
    writeMe(me);
    setUser(me);
  }, []);

  const reload = useCallback(async () => {
    try {
      apply(await authApi.me());
    } catch {
      apply(null);
    }
  }, [apply]);

  useEffect(() => {
    let alive = true;
    // Open instantly with the last known profile (the screen is drawn at once; the server still decides what is allowed),
    // then confirm the session in the background. A sleeping/unreachable server must NOT sign the person out; only a real "no session" does.
    const cached = readMe();
    if (cached) { uid.current = cached.id; setUser(cached); setLoading(false); }
    (async () => {
      if (await refreshSession()) await reload();
      else if (lastRefreshFailure() === 'denied' || !cached) apply(null);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [reload, apply]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      apply(null);
    }
  }, [apply]);

  const value = useMemo(() => ({ user, loading, reload, logout }), [user, loading, reload, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
