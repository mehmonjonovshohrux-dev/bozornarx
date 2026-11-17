'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/fmt';
import { openStream } from '@/lib/realtime';
import { Brand } from './Logo';
import { Icon } from './ui/Icon';
import { Spinner } from './ui/kit';

/**
 * One account = one role. Every role gets its own navigation and its own look (matches the role concept designs):
 * Buyer/Seller/Moderator: dark-green sidebar; Super Admin: deep "control center" sidebar.
 */
interface NavItem { href: string; label: string; icon: string; perm?: string; mobile?: boolean }
type RoleKey = 'BUYER' | 'SELLER' | 'MODERATOR' | 'SUPER_ADMIN';

const NAVS: Record<RoleKey, NavItem[]> = {
  BUYER: [
    { href: '/dashboard', label: 'Bosh sahifa', icon: 'home', mobile: true },
    { href: '/catalog', label: 'Mahsulotlar', icon: 'grid', mobile: true },
    { href: '/favorites', label: 'Sevimlilar', icon: 'heart' },
    { href: '/cart', label: 'Savat', icon: 'cart', mobile: true },
    { href: '/orders', label: 'Buyurtmalar', icon: 'package', mobile: true },
    { href: '/offers', label: 'Takliflar', icon: 'tag' },
    { href: '/contracts', label: 'Shartnomalar', icon: 'doc' },
    { href: '/chat', label: 'Chat', icon: 'chat' },
    { href: '/map', label: 'Xarita', icon: 'map' },
    { href: '/alerts', label: 'Narx ogohlantirishlari', icon: 'chart' },
    { href: '/disputes', label: 'Nizolar', icon: 'scale' },
    { href: '/notifications', label: 'Bildirishnomalar', icon: 'bell' },
    { href: '/security', label: 'Xavfsizlik va ilova', icon: 'shield' },
  ],
  SELLER: [
    { href: '/dashboard', label: 'Bosh sahifa', icon: 'home', mobile: true },
    { href: '/seller', label: 'Do‘kon profili', icon: 'store' },
    { href: '/seller/products', label: 'Mahsulotlar', icon: 'box', mobile: true },
    { href: '/seller/prices', label: 'Narxlar', icon: 'tag' },
    { href: '/seller/orders', label: 'Buyurtmalar', icon: 'package', mobile: true },
    { href: '/seller/offers', label: 'Kelgan takliflar', icon: 'send' },
    { href: '/seller/discounts', label: 'Aksiyalar va chegirmalar', icon: 'percent' },
    { href: '/contracts', label: 'Shartnomalar', icon: 'doc' },
    { href: '/chat', label: 'Xabarlar', icon: 'chat', mobile: true },
    { href: '/map', label: 'Xarita (joylashuv)', icon: 'map' },
    { href: '/disputes', label: 'Nizolar', icon: 'scale' },
    { href: '/notifications', label: 'Bildirishnomalar', icon: 'bell' },
    { href: '/security', label: 'Xavfsizlik va ilova', icon: 'shield' },
  ],
  MODERATOR: [
    { href: '/dashboard', label: 'Bosh sahifa', icon: 'home', mobile: true },
    { href: '/moderation', label: 'Tekshiruv navbati', icon: 'list', mobile: true },
    { href: '/disputes', label: 'Nizolar', icon: 'scale', mobile: true },
    { href: '/map', label: 'Xarita nazorati', icon: 'map', mobile: true },
    { href: '/chat', label: 'Chat', icon: 'chat' },
    { href: '/notifications', label: 'Bildirishnomalar', icon: 'bell' },
    { href: '/security', label: 'Xavfsizlik va ilova', icon: 'shield' },
  ],
  SUPER_ADMIN: [
    { href: '/dashboard', label: 'Bosh sahifa', icon: 'home', mobile: true },
    { href: '/admin', label: 'Boshqaruv markazi', icon: 'server', mobile: true },
    { href: '/moderation', label: 'Moderatsiya', icon: 'shield' },
    { href: '/orders', label: 'Buyurtmalar', icon: 'package' },
    { href: '/contracts', label: 'Shartnomalar', icon: 'doc' },
    { href: '/disputes', label: 'Nizolar', icon: 'scale' },
    { href: '/map', label: 'Xarita', icon: 'map', mobile: true },
    { href: '/notifications', label: 'Bildirishnomalar', icon: 'bell' },
    { href: '/security', label: 'Xavfsizlik va ilova', icon: 'shield' },
  ],
};
/** Shown in the drawer for every role. */
const COMMON: NavItem[] = [
  { href: '/profile', label: 'Profil', icon: 'user' },
  { href: '/settings', label: 'Sozlamalar', icon: 'settings' },
  { href: '/guide', label: 'Yo‘riqnomalar', icon: 'list' },
  { href: '/faq', label: 'Ko‘p beriladigan savollar', icon: 'help' },
  { href: '/about', label: 'Ilova haqida', icon: 'info' },
];
/** Super Admin's control-center sections: on a phone they live in the drawer instead of a wide tab strip. */
export const ADMIN_SECTIONS: NavItem[] = [
  { href: '/admin?tab=stats', label: 'Statistika', icon: 'bars' },
  { href: '/admin?tab=users', label: 'Foydalanuvchilar', icon: 'users' },
  { href: '/admin?tab=stores', label: 'Do‘konlar', icon: 'store' },
  { href: '/admin?tab=products', label: 'Mahsulotlar', icon: 'box' },
  { href: '/admin?tab=orders', label: 'Buyurtmalar', icon: 'package' },
  { href: '/admin?tab=payments', label: 'To‘lovlar', icon: 'wallet' },
  { href: '/admin?tab=plans', label: 'Tariflar', icon: 'credit' },
  { href: '/admin?tab=settings', label: 'Sozlamalar (tizim)', icon: 'settings' },
  { href: '/admin?tab=audit', label: 'Audit jurnali', icon: 'history' },
  { href: '/admin?tab=templates', label: 'Shablonlar', icon: 'doc' },
  { href: '/admin?tab=catalog', label: 'Hudud/Kategoriya', icon: 'layers' },
];
/** Bottom bar, same shape for everyone: Home, the role's main work area, Map, Settings. */
const MAIN: Record<RoleKey, NavItem> = {
  BUYER: { href: '/orders', label: 'Buyurtmalar', icon: 'package' },
  SELLER: { href: '/seller', label: 'Do‘kon', icon: 'store' },
  MODERATOR: { href: '/moderation', label: 'Tekshiruv', icon: 'list' },
  SUPER_ADMIN: { href: '/admin', label: 'Boshqaruv', icon: 'server' },
};
const SKIN: Record<RoleKey, { side: string; active: string; chip: string }> = {
  BUYER: { side: 'from-brand-900 to-brand-800', active: 'bg-white/15 text-white', chip: 'bg-white/10' },
  SELLER: { side: 'from-brand-900 to-brand-800', active: 'bg-white/15 text-white', chip: 'bg-white/10' },
  MODERATOR: { side: 'from-[#06382b] to-[#0b4f3a]', active: 'bg-white/15 text-white', chip: 'bg-white/10' },
  SUPER_ADMIN: { side: 'from-[#04231d] to-[#063b33]', active: 'bg-emerald-400/20 text-emerald-100', chip: 'bg-white/10' },
};
export const roleOf = (roles: string[] | undefined): RoleKey => (['SUPER_ADMIN', 'MODERATOR', 'SELLER', 'BUYER'] as RoleKey[]).find((r) => roles?.includes(r)) ?? 'BUYER';

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const role = roleOf(user?.roles);
  const skin = SKIN[role];

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, user, router, path]);

  const items = useMemo(() => {
    const perms = new Set(user?.permissions ?? []);
    return NAVS[role].filter((n) => !n.perm || perms.has(n.perm));
  }, [user, role]);

  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      api<{ unread: number }>('/notifications?pageSize=1').then((r) => setUnread(r.unread)).catch(() => undefined);
      if (user.permissions.includes('chat.use')) api<{ unread: number }>('/chat/unread').then((r) => setChatUnread(r.unread)).catch(() => undefined);
    };
    refresh();
    return openStream((ev, data) => {
      if (ev === 'notification') { setUnread((n) => n + 1); setToast((data as { title?: string }).title ?? 'Yangi bildirishnoma'); setTimeout(() => setToast(null), 4000); }
      if (ev === 'message' || ev === 'read') refresh();
    });
  }, [user]);

  if (loading || !user) return <div className="min-h-[100dvh]"><Spinner /></div>;
  const active = (href: string) => { const base = href.split('?')[0]!; return path === base || (base !== '/' && path.startsWith(base + '/')); };
  const mobileItems: NavItem[] = [
    { href: '/dashboard', label: 'Bosh sahifa', icon: 'home' }, MAIN[role],
    { href: '/map', label: 'Xarita', icon: 'map' }, { href: '/settings', label: 'Sozlamalar', icon: 'settings' },
  ];
  const name = user.profile?.fullName ?? user.roles.map((r) => ROLE_LABEL[r] ?? r).join('');
  const initials = name.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const search = (e: FormEvent) => { e.preventDefault(); router.push(`/catalog${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); };

  const sidebar = (
    <div className={clsx('flex h-full flex-col bg-gradient-to-b text-white', skin.side)}>
      <div className="px-5 pb-3 pt-5"><Link href="/dashboard" aria-label="BozorNarx" className="block"><Brand light /></Link></div>
      <div className={clsx('mx-4 mb-3 flex items-center gap-3 rounded-2xl p-3', skin.chip)}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold">{initials || '?'}</span>
        <span className="min-w-0"><span className="block truncate text-sm font-bold">{name}</span><span className="block text-xs text-emerald-100/80">{ROLE_LABEL[role]}</span></span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-3" aria-label="Bo‘limlar">
        {[...items, ...(role === 'SUPER_ADMIN' ? [{ href: '#sec', label: 'Boshqaruv bo‘limlari', icon: '' }, ...ADMIN_SECTIONS] : []), { href: '#more', label: 'Ilova', icon: '' }, ...COMMON].map((i) => i.href.startsWith('#') ? (
          <div key={i.href} className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-emerald-100/60">{i.label}</div>
        ) : (
          <Link key={i.href} href={i.href} onClick={() => setMenu(false)} aria-current={active(i.href) ? 'page' : undefined}
            className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-semibold transition', active(i.href) ? skin.active : 'text-emerald-50/85 hover:bg-white/10')}>
            <Icon name={i.icon} size={19} /><span className="flex-1">{i.label}</span>
            {i.href === '/chat' && chatUnread > 0 && <span className="rounded-full bg-accent-500 px-2 text-xs font-bold text-white">{chatUnread}</span>}
            {i.href === '/notifications' && unread > 0 && <span className="rounded-full bg-accent-500 px-2 text-xs font-bold text-white">{unread}</span>}
          </Link>
        ))}
      </nav>
      <button className="m-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-50/85 hover:bg-white/10" onClick={() => void logout().then(() => router.replace('/login'))}><Icon name="logout" size={19} />Chiqish</button>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[linear-gradient(180deg,#f1f8f3,#fbf7ee_40%)] pb-20 lg:pb-0">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-cream-300 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
            <button className="rounded-lg p-2 lg:hidden" aria-label="Menyu" onClick={() => setMenu(true)}><Icon name="menu" size={24} /></button>
            <Link href="/dashboard" className="lg:hidden" aria-label="BozorNarx"><Brand /></Link>
            <form onSubmit={search} className="relative mx-auto hidden max-w-xl flex-1 md:block" role="search">
              <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input className="input !min-h-[44px] !rounded-2xl !pl-11" placeholder="Mahsulot, do‘kon yoki bozor qidiring…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Qidiruv" />
            </form>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/notifications" className="relative grid h-11 w-11 place-items-center rounded-xl border border-cream-300 bg-white text-ink-soft hover:bg-cream-100" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta o‘qilmagan` : ''}`}>
                <Icon name="bell" size={20} />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[11px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
              </Link>
              <div className="flex items-center gap-2 rounded-xl border border-cream-300 bg-white py-1 pl-1 pr-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-700 text-sm font-bold text-white">{initials || '?'}</span>
                <span className="hidden leading-tight sm:block"><span className="block text-sm font-bold">{name.split(' ')[0]}</span><span className="block text-xs text-ink-muted">{ROLE_LABEL[role]}</span></span>
              </div>
            </div>
          </div>
        </header>
        <main className={clsx('mx-auto min-w-0 px-4 py-5 lg:px-6', wide ? 'max-w-none' : 'max-w-[1400px]')}>{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-cream-300 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }} aria-label="Asosiy">
        {mobileItems.map((i) => (
          <Link key={i.href} href={i.href} className={clsx('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', active(i.href) ? 'text-brand-700' : 'text-ink-muted')}>
            <Icon name={i.icon} size={22} />{i.label.split(' ')[0]}
            {i.href === '/chat' && chatUnread > 0 && <span className="absolute right-[28%] top-1 rounded-full bg-accent-500 px-1.5 text-[10px] text-white">{chatUnread}</span>}
          </Link>
        ))}
      </nav>
      {menu && (
        <div className="fixed inset-0 z-[60] bg-black/50 lg:hidden" onClick={() => setMenu(false)}>
          <div className="h-full w-72" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}
      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">{toast}</div>}
    </div>
  );
}
