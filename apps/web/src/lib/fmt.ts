export const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(n).replace(/,/g, ' ')} so‘m`);
export const dt = (s: string | Date | null | undefined) => (s ? new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) : '—');
export const day = (s: string | Date | null | undefined) => (s ? new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium' }).format(new Date(s)) : '—');
export const ago = (s: string | Date) => {
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60_000);
  if (m < 1) return 'hozir';
  if (m < 60) return `${m} daqiqa oldin`;
  if (m < 1440) return `${Math.round(m / 60)} soat oldin`;
  return `${Math.round(m / 1440)} kun oldin`;
};

export const ORDER_STATUS: Record<string, string> = {
  CREATED: 'Yangi', PENDING: 'Kutilmoqda', CONFIRMED: 'Tasdiqlandi', PROCESSING: 'Tayyorlanmoqda', READY: 'Tayyor', SHIPPED: 'Yo‘lda', DELIVERED: 'Yetkazildi',
  ACCEPTED: 'Qabul qilindi', COMPLETED: 'Yakunlandi', CANCELLED: 'Bekor qilindi', DISPUTED: 'Nizo', REJECTED: 'Rad etildi',
};
export const CONTRACT_STATUS: Record<string, string> = {
  DRAFT: 'Qoralama', PENDING_REVIEW: 'Tekshiruvda', WAITING_FOR_BUYER: 'Xaridor imzosi kutilmoqda', WAITING_FOR_SELLER: 'Sotuvchi imzosi kutilmoqda',
  PARTIALLY_SIGNED: 'Bir tomon imzolagan', FULLY_SIGNED: 'Ikkala tomon imzolagan', ACTIVE: 'Amalda', COMPLETED: 'Bajarildi', CANCELLED: 'Bekor qilindi', DISPUTED: 'Nizo', EXPIRED: 'Muddati o‘tgan',
};
export const OFFER_STATUS: Record<string, string> = { PENDING: 'Javob kutilmoqda', ACCEPTED: 'Qabul qilindi', REJECTED: 'Rad etildi', COUNTERED: 'Qarshi taklif', CANCELLED: 'Bekor qilindi', EXPIRED: 'Muddati o‘tdi' };
export const DISPUTE_STATUS: Record<string, string> = { OPEN: 'Ochiq', IN_REVIEW: 'Ko‘rib chiqilmoqda', RESOLVED: 'Hal qilindi', APPEALED: 'Apellyatsiya', CLOSED: 'Yopilgan' };
export const STORE_STATUS: Record<string, string> = { PENDING: 'Tekshiruvda', VERIFIED: 'Tasdiqlangan', REJECTED: 'Rad etilgan', SUSPENDED: 'To‘xtatilgan' };
export const MOD_STATUS: Record<string, string> = { PENDING: 'Tekshiruvda', APPROVED: 'Tasdiqlangan', REJECTED: 'Rad etilgan' };
export const TRUST: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' | 'muted' }> = {
  TRUSTED: { label: 'Ishonchli', tone: 'ok' }, NORMAL: { label: 'Oddiy', tone: 'muted' }, SUSPICIOUS: { label: 'Shubhali', tone: 'bad' },
  OUTDATED: { label: 'Eskirgan', tone: 'warn' }, INSUFFICIENT_DATA: { label: 'Ma’lumot yetarli emas', tone: 'muted' },
};
export const ROLE_LABEL: Record<string, string> = { BUYER: 'Xaridor', SELLER: 'Sotuvchi', MODERATOR: 'Moderator', SUPER_ADMIN: 'Super Admin' };
export const PAYMENT_METHOD: Record<string, string> = { CASH_ON_DELIVERY: 'Yetkazilganda naqd', CARD: 'Karta (ulanmagan)' };

/** Post-login target: only same-site absolute paths are honoured (no open redirect). */
export function safeNext(fallback = '/dashboard'): string {
  if (typeof window === 'undefined') return fallback;
  const n = new URLSearchParams(window.location.search).get('next');
  return n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : fallback;
}
