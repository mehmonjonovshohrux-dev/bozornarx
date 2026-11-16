'use client';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { openStream } from '@/lib/realtime';
import { Brand } from './Logo';
import { Spinner } from './ui/kit';

interface NavItem { href: string; label: string; icon: string; perm?: string; role?: string; mobile?: boolean }

const NAV: NavItem[] = [
  { href: '/catalog', label: 'Katalog', icon: '🛒', mobile: true },
  { href: '/map', label: 'Xarita', icon: '🗺️' },
  { href: '/cart', label: 'Savat', icon: '🧺', perm: 'orders.create', mobile: true },
  { href: '/orders', label: 'Buyurtmalar', icon: '📦', mobile: true, perm: 'orders.create' },
  { href: '/offers', label: 'Takliflar', icon: '🤝', perm: 'orders.create' },
  { href: '/favorites', label: 'Sevimlilar', icon: '❤️', perm: 'favorites.manage' },
  { href: '/alerts', label: 'Narx ogohlantirishlari', icon: '🔔', perm: 'alerts.manage' },
  { href: '/seller', label: 'Sotuvchi paneli', icon: '🏪', perm: 'stores.manage', mobile: true },
  { href: '/seller/products', label: 'Mahsulotlarim', icon: '🥕', perm: 'products.create' },
  { href: '/seller/prices', label: 'Narxlarim', icon: '🏷️', perm: 'prices.create' },
  { href: '/seller/orders', label: 'Qabul qilingan buyurtmalar', icon: '📥', perm: 'orders.manage' },
  { href: '/seller/offers', label: 'Kelgan takliflar', icon: '💬', perm: 'orders.manage' },
  { href: '/seller/discounts', label: 'Chegirmalar', icon: '🎟️', perm: 'stores.manage' },
  { href: '/contracts', label: 'Shartnomalar', icon: '📄', perm: 'contracts.create' },
  { href: '/disputes', label: 'Nizolar', icon: '⚖️', perm: 'complaints.create' },
  { href: '/chat', label: 'Chat', icon: '💬', perm: 'chat.use', mobile: true },
  { href: '/moderation', label: 'Moderatsiya', icon: '🛡️', perm: 'stores.moderate', mobile: true },
  { href: '/admin', label: 'Admin panel', icon: '⚙️', perm: 'users.manage', mobile: true },
];

export function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const { user, loading, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [loading, user, router, path]);

  const items = useMemo(() => {
    const perms = new Set(user?.permissions ?? []);
    return NAV.filter((n) => !n.perm || perms.has(n.perm));
  }, [user]);

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
  const active = (href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));
  const mobileItems = items.filter((i) => i.mobile).slice(0, 5);

  return (
    <div className="min-h-[100dvh] pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-cream-300 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 text-xl lg:hidden" aria-label="Menyu" onClick={() => setMenu(true)}>☰</button>
            <Link href="/catalog" aria-label="BozorNarx bosh sahifa"><Brand /></Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative rounded-xl p-2 text-xl hover:bg-cream-200" aria-label={`Bildirishnomalar${unread ? `, ${unread} ta o‘qilmagan` : ''}`}>🔔{unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-accent-500 px-1 text-center text-[11px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}</Link>
            <Link href="/dashboard" className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-cream-200 sm:block">{user.profile?.fullName?.split(' ')[0] ?? 'Profil'}</Link>
            <button className="btn btn-ghost !min-h-[40px] !px-3 text-sm" onClick={() => void logout().then(() => router.replace('/login'))}>Chiqish</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-5">
        <aside className="hidden w-60 shrink-0 lg:block"><Nav items={items} active={active} chatUnread={chatUnread} /></aside>
        <main className={clsx('min-w-0 flex-1', wide && 'max-w-none')}>{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t border-cream-300 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden" style={{ gridTemplateColumns: `repeat(${mobileItems.length}, 1fr)` }} aria-label="Asosiy">
        {mobileItems.map((i) => (
          <Link key={i.href} href={i.href} className={clsx('relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold', active(i.href) ? 'text-brand-700' : 'text-ink-muted')}>
            <span className="text-xl" aria-hidden>{i.icon}</span>{i.label.split(' ')[0]}
            {i.href === '/chat' && chatUnread > 0 && <span className="absolute right-[28%] top-1 rounded-full bg-accent-500 px-1.5 text-[10px] text-white">{chatUnread}</span>}
          </Link>
        ))}
      </nav>
      {menu && (
        <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={() => setMenu(false)}>
          <div className="h-full w-72 overflow-y-auto bg-cream-50 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><Brand /><button className="p-2 text-2xl" aria-label="Yopish" onClick={() => setMenu(false)}>×</button></div>
            <div onClick={() => setMenu(false)}><Nav items={items} active={active} chatUnread={chatUnread} /></div>
          </div>
        </div>
      )}
      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-6">{toast}</div>}
    </div>
  );
}

function Nav({ items, active, chatUnread }: { items: NavItem[]; active: (h: string) => boolean; chatUnread: number }) {
  return (
    <nav className="space-y-1" aria-label="Bo‘limlar">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className={clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition', active(i.href) ? 'bg-brand-100 text-brand-800' : 'text-ink-soft hover:bg-cream-200')}>
          <span aria-hidden>{i.icon}</span><span className="flex-1">{i.label}</span>
          {i.href === '/chat' && chatUnread > 0 && <span className="rounded-full bg-accent-500 px-2 text-xs font-bold text-white">{chatUnread}</span>}
        </Link>
      ))}
    </nav>
  );
}
