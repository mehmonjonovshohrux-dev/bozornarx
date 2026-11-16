'use client';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, ErrorBox, Field, Modal, PageTitle, Pager, Spinner, Stat, Table, Tabs, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { ROLE_LABEL, dt, money } from '@/lib/fmt';
import { qs, useAction, useApi, usePublicApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
type T = 'stats' | 'users' | 'payments' | 'plans' | 'settings' | 'audit' | 'templates' | 'catalog';
export default function Admin() {
  const [tab, setTab] = useState<T>('stats');
  return (
    <AppShell><PageTitle title="Admin panel" />
      <Tabs<T> tabs={[{ id: 'stats', label: 'Statistika' }, { id: 'users', label: 'Foydalanuvchilar' }, { id: 'payments', label: 'To‘lovlar' }, { id: 'plans', label: 'Tariflar' }, { id: 'settings', label: 'Sozlamalar' }, { id: 'audit', label: 'Audit jurnali' }, { id: 'templates', label: 'Shablonlar' }, { id: 'catalog', label: 'Hudud/Kategoriya' }]} value={tab} onChange={setTab} />
      {tab === 'stats' && <Stats />}{tab === 'users' && <Users />}{tab === 'payments' && <Payments />}{tab === 'plans' && <Plans />}{tab === 'settings' && <Settings />}{tab === 'audit' && <Audit />}{tab === 'templates' && <Templates />}{tab === 'catalog' && <CatalogAdmin />}
    </AppShell>
  );
}

const sum = (o: Record<string, number> | undefined) => Object.values(o ?? {}).reduce((a, b) => a + b, 0);
function Stats() {
  const q = useApi<any>('/admin/stats');
  if (q.loading) return <Spinner />; if (q.error) return <ErrorBox error={q.error} retry={q.reload} />;
  const d = q.data;
  return (<div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Stat label="Faol foydalanuvchilar" value={d.users.active} /><Stat label="Do‘konlar" value={sum(d.stores)} sub={`tasdiqlangan ${d.stores.VERIFIED ?? 0}`} /><Stat label="Mahsulotlar" value={sum(d.products)} sub={`tasdiqlangan ${d.products.APPROVED ?? 0}`} /><Stat label="Faol narxlar" value={d.livePrices} />
      <Stat label="30 kunda buyurtma" value={sum(d.orders30d)} /><Stat label="30 kunlik hajm" value={money(d.volume30d)} sub={`${d.completed30d} bitim`} /><Stat label="Shartnomalar" value={sum(d.contracts)} sub={`imzolangan ${(d.contracts.FULLY_SIGNED ?? 0) + (d.contracts.ACTIVE ?? 0) + (d.contracts.COMPLETED ?? 0)}`} /><Stat label="Ochiq nizo / shikoyat" value={`${d.openDisputes} / ${d.openComplaints}`} tone="accent" /></div>
    <div className="card p-4"><h3 className="mb-2 font-bold">Rollar bo‘yicha</h3><div className="flex flex-wrap gap-2">{Object.entries(d.users.byRole).map(([r, n]) => <Badge key={r}>{ROLE_LABEL[r] ?? r}: {String(n)}</Badge>)}</div>
      <h3 className="mb-2 mt-4 font-bold">Moderatsiya navbatlari</h3><div className="flex flex-wrap gap-2">{Object.entries(d.queues).map(([k, n]) => <Badge key={k} tone={n ? 'warn' : 'muted'}>{k}: {String(n)}</Badge>)}</div></div></div>);
}

function Users() {
  const [page, setPage] = useState(1); const [f, setF] = useState({ q: '', role: '', status: '' }); const [sel, setSel] = useState<any>(null);
  const q = useApi<Paged<any>>(`/admin/users${qs({ ...f, page, pageSize: 15 })}`);
  return (<>
    <div className="mb-4 grid gap-2 sm:grid-cols-3"><input className="input" placeholder="Email, telefon, ism…" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} />
      <select className="input" value={f.role} onChange={(e) => { setF({ ...f, role: e.target.value }); setPage(1); }}><option value="">Barcha rollar</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select className="input" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}><option value="">Barcha holatlar</option><option value="ACTIVE">Faol</option><option value="SUSPENDED">Bloklangan</option><option value="PENDING_VERIFICATION">Tasdiqlanmagan</option></select></div>
    <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
    {q.data && <Table head={['Foydalanuvchi', 'Rollar', 'Holat', 'Ro‘yxatdan o‘tgan', '']}>{q.data.items.map((u) => <tr key={u.id}><td className="px-4 py-3"><b>{u.fullName ?? '—'}</b><br /><span className="text-xs text-ink-muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</span></td><td className="px-4 py-3">{u.roles.map((r: string) => ROLE_LABEL[r] ?? r).join(', ')}</td><td className="px-4 py-3"><Badge tone={statusTone(u.status)}>{u.status}</Badge></td><td className="px-4 py-3 text-ink-muted">{dt(u.createdAt)}</td><td className="px-4 py-3"><button className="font-semibold text-brand-700" onClick={() => setSel(u)}>Boshqarish</button></td></tr>)}</Table>}
    {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
    <UserModal u={sel} onClose={() => { setSel(null); q.reload(); }} />
  </>);
}

function UserModal({ u, onClose }: { u: any; onClose: () => void }) {
  const d = useApi<any>(u ? `/admin/users/${u.id}` : null); const [reason, setReason] = useState('');
  const status = useAction(async (s: string) => { await api(`/admin/users/${u.id}/status`, { body: { status: s, reason } }); onClose(); });
  const role = useAction(async (r: string, action: string) => { await api(`/admin/users/${u.id}/roles`, { body: { role: r, action } }); d.reload(); });
  const rev = useAction(async () => { await api(`/admin/users/${u.id}/revoke-sessions`, { method: 'POST', body: {} }); d.reload(); });
  const x = d.data; const protectedUser = u?.roles.includes('SUPER_ADMIN');
  return (
    <Modal open={!!u} title={u?.email ?? ''} onClose={onClose}>{x && <div className="space-y-4 text-sm">
      <p>Buyurtmalar: <b>{x.orders}</b> · faol seanslar: <b>{x.activeSessions}</b> · shikoyatlar: <b>{x.complaintsAgainst}</b></p>
      {x.stores.length > 0 && <p>Do‘konlar: {x.stores.map((s: any) => `${s.name} (${s.status})`).join(', ')}</p>}
      {!protectedUser && <><div><h3 className="mb-1 font-bold">Rollar</h3><div className="flex flex-wrap gap-2">{['BUYER', 'SELLER', 'MODERATOR'].map((r) => x.roles.includes(r) ? <span key={r} className="btn btn-primary !min-h-[36px] !px-3 cursor-default" aria-current="true">{ROLE_LABEL[r]} (joriy)</span> : <button key={r} className="btn btn-ghost !min-h-[36px] !px-3" disabled={role.busy} onClick={() => void role.run(r, 'ADD')}>{ROLE_LABEL[r]} ga o‘tkazish</button>)}</div><p className="mt-1 text-xs text-ink-muted">Bir foydalanuvchi — bitta rol. Rol almashsa avvalgisi o‘chadi va seanslar tugatiladi.</p></div>
        <Field label="Sabab (bloklash/ochish uchun)"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <div className="flex flex-wrap gap-2">{x.status === 'SUSPENDED' ? <button className="btn btn-primary" disabled={status.busy || reason.trim().length < 3} onClick={() => void status.run('ACTIVE')}>Blokdan chiqarish</button> : x.status === 'ACTIVE' && <button className="btn btn-ghost !text-danger" disabled={status.busy || reason.trim().length < 3} onClick={() => void status.run('SUSPENDED')}>Bloklash</button>}<button className="btn btn-ghost" disabled={rev.busy} onClick={() => void rev.run()}>Barcha seanslarni tugatish</button></div></>}
      {protectedUser && <p className="rounded-xl bg-cream-200 p-3">Super Admin hisobi API orqali o‘zgartirilmaydi.</p>}
      <ErrorBox error={status.error ?? role.error ?? rev.error} /></div>}</Modal>
  );
}

function Payments() {
  const [page, setPage] = useState(1); const q = useApi<Paged<any>>(`/payments${qs({ page, pageSize: 20 })}`);
  return (<><p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Karta to‘lovi provayderi ulanmagan (PAYMENT_PROVIDER_MODE=none): faqat naqd to‘lovlar qayd etiladi. Pul platforma orqali saqlanmaydi (escrow yo‘q).</p>
    <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
    {q.data && <Table head={['Buyurtma', 'Usul', 'Summa', 'Holat', 'Sana']}>{q.data.items.map((p) => <tr key={p.id}><td className="px-4 py-3">{p.order?.number ?? p.orderId}</td><td className="px-4 py-3">{p.provider}</td><td className="px-4 py-3">{money(p.amount)}</td><td className="px-4 py-3"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td><td className="px-4 py-3 text-ink-muted">{dt(p.createdAt)}</td></tr>)}</Table>}
    {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}</>);
}

function Plans() {
  const plans = useApi<any[]>('/admin/plans'); const stores = useApi<Paged<any>>('/moderation/stores?status=VERIFIED&pageSize=100');
  const [f, setF] = useState({ code: '', name: '', priceUzs: '', maxProducts: '' }); const [g, setG] = useState({ storeId: '', planCode: '', months: '1' });
  const save = useAction(async () => { await api('/admin/plans', { method: 'PUT', body: { code: f.code, name: f.name, priceUzs: Number(f.priceUzs), maxProducts: Number(f.maxProducts) } }); setF({ code: '', name: '', priceUzs: '', maxProducts: '' }); plans.reload(); });
  const grant = useAction(async () => { await api('/admin/subscriptions', { body: { storeId: g.storeId, planCode: g.planCode, months: Number(g.months) } }); });
  return (<div className="space-y-4">
    <Table head={['Kod', 'Nomi', 'Narx / oy', 'Maks. mahsulot', 'Faol']}>{plans.data?.map((p) => <tr key={p.id}><td className="px-4 py-3 font-mono">{p.code}</td><td className="px-4 py-3">{p.name}</td><td className="px-4 py-3">{money(p.priceUzs)}</td><td className="px-4 py-3">{p.maxProducts}</td><td className="px-4 py-3">{p.active ? '✓' : '—'}</td></tr>)}</Table>
    <section className="card grid gap-3 p-4 sm:grid-cols-4"><Field label="Kod"><input className="input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field><Field label="Nomi"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Narx (so‘m)"><input className="input" inputMode="decimal" value={f.priceUzs} onChange={(e) => setF({ ...f, priceUzs: e.target.value })} /></Field><Field label="Maks. narx/mahsulot"><input className="input" inputMode="numeric" value={f.maxProducts} onChange={(e) => setF({ ...f, maxProducts: e.target.value })} /></Field>
      <div className="sm:col-span-4"><button className="btn btn-primary" disabled={save.busy || !f.code || !f.name || f.priceUzs === '' || !f.maxProducts} onClick={() => void save.run()}>Tarifni saqlash</button></div></section>
    <section className="card grid gap-3 p-4 sm:grid-cols-4"><Field label="Do‘kon"><select className="input" value={g.storeId} onChange={(e) => setG({ ...g, storeId: e.target.value })}><option value="">Tanlang…</option>{stores.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Field label="Tarif"><select className="input" value={g.planCode} onChange={(e) => setG({ ...g, planCode: e.target.value })}><option value="">Tanlang…</option>{plans.data?.filter((p) => p.active).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></Field><Field label="Oy"><input className="input" inputMode="numeric" value={g.months} onChange={(e) => setG({ ...g, months: e.target.value })} /></Field>
      <div className="flex items-end"><button className="btn btn-accent w-full" disabled={grant.busy || !g.storeId || !g.planCode} onClick={() => void grant.run()}>Faollashtirish</button></div><p className="text-xs text-ink-muted sm:col-span-4">To‘lov tizimi ulanmaganligi sababli tarif administrator tomonidan, sotuvchi to‘lovni boshqa yo‘l bilan to‘lagach, qo‘lda faollashtiriladi.</p></section>
    <ErrorBox error={save.error ?? grant.error ?? plans.error} /></div>);
}

function Settings() {
  const q = useApi<any[]>('/admin/settings'); const [draft, setDraft] = useState<Record<string, string>>({});
  const put = useAction(async (key: string, value: unknown) => { await api(`/admin/settings/${key}`, { method: 'PUT', body: { value } }); setDraft((d) => { const n = { ...d }; delete n[key]; return n; }); q.reload(); });
  return (<div className="space-y-3"><ErrorBox error={q.error ?? put.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
    {q.data?.map((s) => <section key={s.key} className="card flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-mono text-sm font-bold">{s.key}</p><p className="text-sm text-ink-soft">{s.description}</p>{s.isDefault && <p className="text-xs text-ink-muted">Standart qiymat</p>}</div>
      {typeof s.value === 'boolean' ? <button role="switch" aria-checked={s.value} className={`h-8 w-14 rounded-full p-1 transition ${s.value ? 'bg-brand-600' : 'bg-cream-300'}`} onClick={() => void put.run(s.key, !s.value)}><span className={`block h-6 w-6 rounded-full bg-white transition ${s.value ? 'translate-x-6' : ''}`} /></button>
        : <div className="flex gap-2"><input className="input !w-36" inputMode="decimal" value={draft[s.key] ?? String(s.value)} onChange={(e) => setDraft({ ...draft, [s.key]: e.target.value })} aria-label={s.key} /><button className="btn btn-primary" disabled={put.busy || draft[s.key] === undefined} onClick={() => void put.run(s.key, Number(draft[s.key]))}>Saqlash</button></div>}</section>)}</div>);
}

function Audit() {
  const [page, setPage] = useState(1); const [action, setAction] = useState(''); const [entity, setEntity] = useState('');
  const q = useApi<Paged<any>>(`/admin/audit${qs({ action, entityType: entity, page, pageSize: 25 })}`);
  return (<><div className="mb-3 flex flex-wrap gap-2"><input className="input !w-56" placeholder="Amal (masalan LOGIN)" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} /><input className="input !w-44" placeholder="Obyekt turi" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} /><a className="btn btn-ghost" href={`/api/admin/audit.csv${qs({ action, entityType: entity })}`}>CSV</a></div>
    <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
    {q.data && <Table head={['Vaqt', 'Foydalanuvchi', 'Amal', 'Obyekt', 'IP']}>{q.data.items.map((r) => <tr key={r.id}><td className="whitespace-nowrap px-4 py-2 text-ink-muted">{dt(r.at)}</td><td className="px-4 py-2">{r.actor ?? '—'}</td><td className="px-4 py-2 font-mono text-xs">{r.action}</td><td className="px-4 py-2 text-xs">{r.entityType}{r.entityId ? ` · ${String(r.entityId).slice(0, 8)}` : ''}</td><td className="px-4 py-2 text-xs text-ink-muted">{r.ip}</td></tr>)}</Table>}
    {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}</>);
}

function Templates() {
  const q = useApi<any[]>('/admin/templates'); const [open, setOpen] = useState(false);
  const [name, setName] = useState('Oldi-sotdi shartnomasi'); const [clauses, setClauses] = useState([{ title: '', text: '' }]);
  const go = useAction(async () => { await api('/admin/templates', { body: { type: 'SALE', name, clauses: clauses.filter((c) => c.title && c.text) } }); setOpen(false); q.reload(); });
  return (<div className="space-y-3"><div className="flex items-center justify-between"><p className="text-sm text-ink-soft">Shablon o‘zgarmaydi: tahrir yangi versiya yaratadi, eski shartnomalar eski matnda qoladi. Matnda {'{{buyer.name}}'} kabi o‘zgaruvchilar ishlatiladi.</p><button className="btn btn-primary" onClick={() => setOpen(true)}>Yangi versiya (SALE)</button></div>
    <ErrorBox error={q.error} />{q.data?.map((t) => <section key={t.id} className="card p-4"><b>{t.type} · {t.name}</b> v{t.version} {t.active ? <Badge tone="ok">faol</Badge> : <Badge>eski</Badge>}<p className="text-xs text-ink-muted">{(t.clauses as any[]).length} ta band · {dt(t.createdAt)}</p></section>)}
    <Modal open={open} title="Shablon: yangi versiya" onClose={() => setOpen(false)}><div className="space-y-3"><Field label="Nomi"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
      {clauses.map((c, i) => <div key={i} className="space-y-1"><input className="input" placeholder="Band sarlavhasi" value={c.title} onChange={(e) => setClauses(clauses.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} /><textarea className="input" rows={3} placeholder="Matn" value={c.text} onChange={(e) => setClauses(clauses.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} /></div>)}
      <button className="btn btn-ghost" onClick={() => setClauses([...clauses, { title: '', text: '' }])}>+ Band</button><ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || clauses.every((c) => !c.title || !c.text)} onClick={() => void go.run()}>Saqlash</button></div></Modal></div>);
}

function CatalogAdmin() {
  const cats = usePublicApi<any[]>('/catalog/categories'); const regions = usePublicApi<any[]>('/catalog/regions');
  const [cat, setCat] = useState({ name: '', parentId: '' }); const [reg, setReg] = useState({ name: '', type: 'VILOYAT', parentId: '', lat: '', lng: '' }); const [mk, setMk] = useState({ regionId: '', name: '', address: '', lat: '', lng: '' });
  const flat = (c: any[], d = 0): any[] => c.flatMap((x) => [{ id: x.id, name: `${'— '.repeat(d)}${x.name}` }, ...flat(x.children, d + 1)]);
  const addCat = useAction(async () => { await api('/categories', { body: { name: cat.name, parentId: cat.parentId || null } }); setCat({ name: '', parentId: '' }); cats.reload(); });
  const delCat = useAction(async (id: string) => { await api(`/categories/${id}`, { method: 'DELETE' }); cats.reload(); });
  const addReg = useAction(async () => { await api('/admin/regions', { body: { name: reg.name, type: reg.type, parentId: reg.parentId || null, lat: reg.lat ? Number(reg.lat) : undefined, lng: reg.lng ? Number(reg.lng) : undefined } }); setReg({ name: '', type: 'VILOYAT', parentId: '', lat: '', lng: '' }); regions.reload(); });
  const addMk = useAction(async () => { await api('/admin/markets', { body: { regionId: mk.regionId, name: mk.name, address: mk.address || undefined, lat: mk.lat ? Number(mk.lat) : undefined, lng: mk.lng ? Number(mk.lng) : undefined } }); setMk({ regionId: '', name: '', address: '', lat: '', lng: '' }); });
  return (<div className="grid gap-4 lg:grid-cols-3">
    <section className="card space-y-3 p-4"><h3 className="font-bold">Kategoriya</h3><ul className="max-h-40 overflow-y-auto text-sm">{flat(cats.data ?? []).map((c) => <li key={c.id} className="flex justify-between py-0.5">{c.name}<button className="text-danger" onClick={() => void delCat.run(c.id)}>×</button></li>)}</ul>
      <input className="input" placeholder="Nomi" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} /><select className="input" value={cat.parentId} onChange={(e) => setCat({ ...cat, parentId: e.target.value })}><option value="">Asosiy kategoriya</option>{flat(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn btn-primary w-full" disabled={addCat.busy || cat.name.trim().length < 2} onClick={() => void addCat.run()}>Qo‘shish</button><ErrorBox error={addCat.error ?? delCat.error} /></section>
    <section className="card space-y-3 p-4"><h3 className="font-bold">Hudud</h3><input className="input" placeholder="Nomi" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} /><select className="input" value={reg.type} onChange={(e) => setReg({ ...reg, type: e.target.value })}>{['VILOYAT', 'TUMAN', 'SHAHAR', 'MAHALLA'].map((t) => <option key={t}>{t}</option>)}</select>
      <select className="input" value={reg.parentId} onChange={(e) => setReg({ ...reg, parentId: e.target.value })}><option value="">Ota hudud yo‘q</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><input className="input" placeholder="lat" value={reg.lat} onChange={(e) => setReg({ ...reg, lat: e.target.value })} /><input className="input" placeholder="lng" value={reg.lng} onChange={(e) => setReg({ ...reg, lng: e.target.value })} /></div>
      <button className="btn btn-primary w-full" disabled={addReg.busy || reg.name.trim().length < 2} onClick={() => void addReg.run()}>Qo‘shish</button><ErrorBox error={addReg.error} /></section>
    <section className="card space-y-3 p-4"><h3 className="font-bold">Bozor</h3><select className="input" value={mk.regionId} onChange={(e) => setMk({ ...mk, regionId: e.target.value })}><option value="">Hudud…</option>{regions.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select><input className="input" placeholder="Nomi" value={mk.name} onChange={(e) => setMk({ ...mk, name: e.target.value })} /><input className="input" placeholder="Manzil" value={mk.address} onChange={(e) => setMk({ ...mk, address: e.target.value })} />
      <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="lat" value={mk.lat} onChange={(e) => setMk({ ...mk, lat: e.target.value })} /><input className="input" placeholder="lng" value={mk.lng} onChange={(e) => setMk({ ...mk, lng: e.target.value })} /></div><button className="btn btn-primary w-full" disabled={addMk.busy || !mk.regionId || mk.name.trim().length < 2} onClick={() => void addMk.run()}>Qo‘shish</button><ErrorBox error={addMk.error} /></section></div>);
}
