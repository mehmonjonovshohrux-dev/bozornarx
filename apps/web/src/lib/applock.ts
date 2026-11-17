'use client';
// App lock: a PIN (and optionally the phone's fingerprint / face unlock) that protects the app on THIS device after the user has signed in.
// Honest scope: this is a device lock for an already-signed-in session (like a banking app's lock screen). It does not replace the
// server login, and the fingerprint check is done by the phone itself (WebAuthn platform authenticator, user verification required).
const KEY = 'bn_lock_v1';

export interface LockCfg { uid: string; salt: string; hash: string; cred?: string; autoSec: number; len: number }

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function getLock(): LockCfg | null {
  try { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as LockCfg) : null; } catch { return null; }
}
function save(cfg: LockCfg) { localStorage.setItem(KEY, JSON.stringify(cfg)); window.dispatchEvent(new Event('bn-lock-change')); }
export function clearLock() { try { localStorage.removeItem(KEY); sessionStorage.removeItem('bn_unlocked'); } catch { /* ignore */ } window.dispatchEvent(new Event('bn-lock-change')); }

async function derive(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 210_000 }, key, 256));
}

export async function setPin(uid: string, pin: string, autoSec = 60): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prev = getLock();
  save({ uid, salt: b64(salt), hash: await derive(pin, salt), len: pin.length, cred: prev?.uid === uid ? prev.cred : undefined, autoSec });
}
export async function verifyPin(pin: string): Promise<boolean> {
  const c = getLock();
  if (!c) return false;
  return (await derive(pin, unb64(c.salt))) === c.hash;
}
export function setAutoSec(autoSec: number) { const c = getLock(); if (c) save({ ...c, autoSec }); }

export async function biometricAvailable(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}
/** Registers the phone's fingerprint/face as an unlock method (the phone asks for it right now to confirm). */
export async function enableBiometric(email: string): Promise<boolean> {
  const c = getLock();
  if (!c) return false;
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'BozorNarx' },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: email, displayName: email },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    save({ ...c, cred: b64(cred.rawId) });
    return true;
  } catch { return false; }
}
export function disableBiometric() { const c = getLock(); if (c) save({ ...c, cred: undefined }); }
export async function biometricUnlock(): Promise<boolean> {
  const c = getLock();
  if (!c?.cred) return false;
  try {
    const r = await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64(c.cred) as BufferSource }], userVerification: 'required', timeout: 60_000 },
    });
    return !!r;
  } catch { return false; }
}
