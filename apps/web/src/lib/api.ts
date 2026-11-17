// Browser API client. Requests go to /api/* on this same site; Next rewrites them to the backend (see next.config.mjs).
// The access token lives only in memory. The refresh token is an httpOnly cookie that JavaScript cannot read.

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function hasAccessToken() {
  return accessToken !== null;
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: Record<string, unknown> };
}

// The free server sleeps after ~15 min without traffic and needs up to ~50 s to wake. Instead of showing "server not responding" right away,
// retry (network errors on GET/auth calls, and 502/503/504 which mean "nothing was processed") and tell the UI so it can show a friendly banner.
const WAKE_DELAYS = [1500, 2500, 3500, 5000, 6000, 8000, 10000, 12000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function serverState(state: 'waking' | 'ok') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bn-server', { detail: state }));
}

async function send(path: string, method: string, body: unknown, withAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = { 'x-client': 'web' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const retryNetwork = method === 'GET' || path.startsWith('/auth/');
  let woke = false;
  for (let attempt = 0; ; attempt++) {
    if (withAuth && accessToken) headers.authorization = `Bearer ${accessToken}`;
    let res: Response | null = null;
    try {
      res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' });
    } catch {
      if (!retryNetwork || attempt >= WAKE_DELAYS.length) {
        if (woke) serverState('ok');
        throw new ApiError(0, 'NETWORK', 'Server javob bermayapti. Internetni tekshiring yoki bir ozdan keyin qayta urinib ko‘ring.');
      }
    }
    if (res && ![502, 503, 504].includes(res.status)) {
      if (woke) serverState('ok');
      return res;
    }
    if (attempt >= WAKE_DELAYS.length) {
      if (woke) serverState('ok');
      if (res) return res;
      throw new ApiError(0, 'NETWORK', 'Server javob bermayapti. Bir ozdan keyin qayta urinib ko‘ring.');
    }
    woke = true;
    serverState('waking');
    await sleep(WAKE_DELAYS[attempt]!);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, [502, 503, 504].includes(res.status) ? 'UNAVAILABLE' : 'BAD_RESPONSE', [502, 503, 504].includes(res.status) ? 'Server hozir band yoki uyg‘onmoqda. 1 daqiqadan keyin qayta urinib ko‘ring.' : 'Serverdan noto‘g‘ri javob keldi.');
  }
  if (res.ok && json.success) return json.data as T;
  const e = json.error;
  throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? 'Xatolik yuz berdi.', e?.details);
}

/** Exchanges the refresh cookie for a new access token. Resolves false when there is no valid session. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await send('/auth/refresh', 'POST', {}, false);
      const data = await parse<{ accessToken: string }>(res);
      accessToken = data.accessToken;
      return true;
    } catch {
      accessToken = null;
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const auth = opts.auth ?? true;
  let res = await send(path, method, opts.body, auth);
  if (res.status === 401 && auth && (await refreshSession())) {
    res = await send(path, method, opts.body, auth); // one retry with the new token
  }
  return parse<T>(res);
}

// ───────────── typed endpoints ─────────────

export interface CodeSent {
  email: string;
  expiresInSec: number;
  resendAfterSec: number;
}
export interface Me {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  phone: string | null;
  profile: { fullName: string; locale: string } | null;
  roles: string[];
  permissions: string[];
  createdAt: string;
}
export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export const authApi = {
  register: (body: { fullName: string; email: string; phone?: string; password: string; role: 'BUYER' | 'SELLER'; acceptTerms: true }) =>
    api<CodeSent>('/auth/register', { body, auth: false }),
  resend: (email: string) => api<CodeSent>('/auth/resend-otp', { body: { email }, auth: false }),
  verifyEmail: async (email: string, code: string) => {
    const r = await api<{ accessToken: string }>('/auth/verify-email', { body: { email, code }, auth: false });
    accessToken = r.accessToken;
  },
  login: async (email: string, password: string) => {
    const r = await api<{ accessToken: string }>('/auth/login', { body: { email, password }, auth: false });
    accessToken = r.accessToken;
  },
  logout: async () => {
    try {
      await api<unknown>('/auth/logout', { method: 'POST', body: {} });
    } finally {
      accessToken = null;
    }
  },
  forgot: (email: string) => api<{ expiresInSec: number; resendAfterSec: number }>('/auth/forgot-password', { body: { email }, auth: false }),
  reset: (body: { email: string; code: string; newPassword: string }) => api<unknown>('/auth/reset-password', { body, auth: false }),
  me: () => api<Me>('/me'),
  sessions: () => api<SessionInfo[]>('/auth/sessions'),
  revokeSession: (id: string) => api<unknown>(`/auth/sessions/${id}`, { method: 'DELETE' }),
};
