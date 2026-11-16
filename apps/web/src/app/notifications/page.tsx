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

function PushSetting() {
  const [state, setState] = useState<'unknown' | 'unsupported' | 'off' | 'on' | 'unconfigured'>('unknown');
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
    if ((await Notification.requestPermission()) !== 'granted') return;
    const key = Uint8Array.from(atob(cfg.publicKey.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    const j = sub.toJSON();
    await api('/notifications/push/subscribe', { body: { endpoint: j.endpoint, keys: j.keys } });
    setState('on');
  });
  return (
    <section className="card mt-6 p-4"><h2 className="font-bold">Push bildirishnomalar</h2>
      {state === 'unsupported' && <p className="mt-1 text-sm text-ink-muted">Bu brauzer push’ni qo‘llab-quvvatlamaydi. iPhone’da avval ilovani “Bosh ekranga qo‘shing”.</p>}
      {state === 'unconfigured' && <p className="mt-1 text-sm text-warn">Server push kalitlari (VAPID) sozlanmagan, shuning uchun hozircha yoqib bo‘lmaydi.</p>}
      {(state === 'on' || state === 'off') && <button className="btn btn-ghost mt-2" disabled={toggle.busy} onClick={() => void toggle.run()}>{state === 'on' ? 'Push’ni o‘chirish' : 'Push’ni yoqish'}</button>}
      <ErrorBox error={toggle.error} />
    </section>
  );
}
