'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Empty, ErrorBox, PageTitle, Pager, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { ago } from '@/lib/fmt';
import { qs, useAction, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Notifications() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const q = useApi<Paged<any> & { unread: number }>(`/notifications${qs({ page, pageSize: 20 })}`);
  const all = useAction(async () => { await api('/notifications/read-all', { method: 'POST', body: {} }); q.reload(); });
  return (
    <AppShell>
      <PageTitle title="Bildirishnomalar" action={<button className="btn btn-ghost" disabled={all.busy || !q.data?.unread} onClick={() => void all.run()}>Hammasini o‘qilgan deb belgilash</button>} />
      <ErrorBox error={q.error ?? all.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title="Bildirishnomalar yo‘q" />}
      <ul className="space-y-2">{q.data?.items.map((n) => (
        <li key={n.id}><button className={`card w-full p-4 text-left ${n.readAt ? '' : 'border-brand-400 bg-brand-50'}`} onClick={async () => { if (!n.readAt) await api(`/notifications/${n.id}/read`, { method: 'POST', body: {} }).catch(() => undefined); const u = n.data?.url; if (typeof u === 'string' && u.startsWith('/')) router.push(u); else q.reload(); }}>
          <p className="font-semibold">{n.title}</p><p className="text-sm text-ink-soft">{n.body}</p><p className="mt-1 text-xs text-ink-muted">{ago(n.createdAt)}</p></button></li>))}</ul>
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <PushSetting />
    </AppShell>
  );
}

const CAT: Record<string, [string, string]> = {
  ORDERS: ['Buyurtmalar va takliflar', 'Yangi buyurtma, holat o‘zgarishi, takliflar'],
  CONTRACTS: ['Shartnomalar', 'Imzo kutilmoqda, imzolandi, yangi versiya'],
  PRICES: ['Narxlar', 'Narx tushdi, narx eskirdi'],
  CHAT: ['Xabarlar', 'Yangi chat xabarlari'],
  DISPUTES: ['Nizo va shikoyatlar', 'Nizo va shikoyat yangiliklari'],
  SYSTEM: ['Tizim', 'Rol, tarif, moderatsiya natijalari'],
};
type Pref = { category: string; inApp: boolean; phone: boolean };

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition ${on ? 'bg-brand-600' : 'bg-cream-300'}`} onClick={() => onChange(!on)}><span className={`block h-6 w-6 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : ''}`} /></button>;
}

function PushSetting() {
  const prefs = useApi<Pref[]>('/notifications/prefs');
  const setPref = useAction(async (p: Pref) => { await api('/notifications/prefs', { method: 'PUT', body: p }); prefs.reload(); });
  const [state, setState] = useState<'unknown' | 'unsupported' | 'off' | 'on' | 'unconfigured' | 'denied'>('unknown');
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return; }
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? 'on' : 'off')).catch(() => setState('unsupported'));
  }, []);
  const toggle = useAction(async () => {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) { await api('/notifications/push/subscribe', { method: 'DELETE', body: { endpoint: existing.endpoint } }); await existing.unsubscribe(); setState('off'); return; }
    const cfg = await api<{ enabled: boolean; publicKey: string | null }>('/notifications/push/config', { auth: false });
    if (!cfg.enabled || !cfg.publicKey) { setState('unconfigured'); return; }
    if ((await Notification.requestPermission()) !== 'granted') { setState('denied'); return; }
    const key = Uint8Array.from(atob(cfg.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    await api('/notifications/push/subscribe', { body: { endpoint: j.endpoint, keys: j.keys } });
    setState('on');
  });
  return (
    <section className="card mt-6 space-y-4 p-4">
      <div>
        <h2 className="font-bold">Bildirishnoma sozlamalari</h2>
        <p className="text-sm text-ink-muted">Yangi xabar kelganda telefonning yuqori qismida ogohlantirish chiqishi mumkin.</p>
      </div>
      <div className="rounded-xl bg-cream-100 p-3">
        <div className="flex items-center justify-between gap-3">
          <div><b className="block text-sm">Telefonda ogohlantirish</b><span className="text-xs text-ink-muted">Ilova yopiq bo‘lsa ham yuqorida ko‘rinadi</span></div>
          {(state === 'on' || state === 'off') && <Switch on={state === 'on'} label="Telefonda ogohlantirish" onChange={() => void toggle.run()} />}
        </div>
        {state === 'unsupported' && <p className="mt-2 text-xs text-ink-muted">Bu qurilma buni qo‘llab-quvvatlamaydi. iPhone’da avval ilovani “Bosh ekranga qo‘shing”.</p>}
        {state === 'unconfigured' && <p className="mt-2 text-xs text-amber-800">Server tomonida bu xizmat hali sozlanmagan, shuning uchun hozircha yoqib bo‘lmaydi.</p>}
        {state === 'denied' && <p className="mt-2 text-xs text-amber-800">Ruxsat berilmadi. Telefon sozlamalaridan ilova uchun bildirishnomaga ruxsat bering.</p>}
        <ErrorBox error={toggle.error} />
      </div>
      <div>
        <div className="mb-1 grid grid-cols-[1fr_56px_56px] gap-2 px-1 text-xs font-semibold text-ink-muted"><span>Turkum</span><span className="text-center">Ilovada</span><span className="text-center">Telefonda</span></div>
        <ul className="divide-y divide-cream-200">
          {(prefs.data ?? []).map((p) => (
            <li key={p.category} className="grid grid-cols-[1fr_56px_56px] items-center gap-2 py-2.5">
              <span><b className="block text-sm">{CAT[p.category]?.[0] ?? p.category}</b><span className="text-xs text-ink-muted">{CAT[p.category]?.[1]}</span></span>
              <span className="grid place-items-center"><Switch on={p.inApp} label={`${CAT[p.category]?.[0]}: ilovada`} onChange={(v) => void setPref.run({ ...p, inApp: v })} /></span>
              <span className="grid place-items-center"><Switch on={p.phone} label={`${CAT[p.category]?.[0]}: telefonda`} onChange={(v) => void setPref.run({ ...p, phone: v })} /></span>
            </li>
          ))}
        </ul>
        <ErrorBox error={prefs.error ?? setPref.error} retry={prefs.reload} />
      </div>
    </section>
  );
}
