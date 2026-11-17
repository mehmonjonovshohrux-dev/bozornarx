'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { Badge, ErrorBox, Field, Modal, Spinner, statusTone } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { CONTRACT_STATUS, dt, money } from '@/lib/fmt';
import { useAction, useApi } from '@/lib/hooks';
import { TermsForm } from '@/components/TermsForm';
import { PasswordInput } from '@/components/PasswordInput';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function ContractPage() {
  const { id } = useParams<{ id: string }>();
  const c = useApi<any>(`/contracts/${id}`);
  const [modal, setModal] = useState<null | 'sign' | 'cancel' | 'edit' | 'clauses'>(null);
  const post = (path: string, body: unknown = {}) => async () => { await api(`/contracts/${id}/${path}`, { body }); setModal(null); c.reload(); };
  const submit = useAction(post('submit')); const reopen = useAction(post('reopen'));
  if (c.loading && !c.data) return <AppShell><Spinner /></AppShell>;
  if (c.error) return <AppShell><ErrorBox error={c.error} retry={c.reload} /></AppShell>;
  const d = c.data; const a = d.actions;
  return (
    <AppShell>
      <Link href="/contracts" className="mb-3 block text-sm font-semibold text-brand-700">← Shartnomalar</Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-brand-800">{d.number}</h1><p className="text-ink-muted">Versiya {d.version} · {d.type}{d.order && <> · <Link className="underline" href={`/orders/${d.order.id}`}>Buyurtma {d.order.number}</Link></>}</p></div>
        <Badge tone={statusTone(d.status)}>{CONTRACT_STATUS[d.status] ?? d.status}</Badge>
      </div>
      <ErrorBox error={submit.error ?? reopen.error} />
      <div className="mb-4 flex flex-wrap gap-2">
        <a className="btn btn-ghost" href={`/api/contracts/${id}/pdf`} target="_blank" rel="noreferrer">📄 PDF</a>
        {a.canEdit && !d.order && <button className="btn btn-ghost" onClick={() => setModal('edit')}>✏️ Tahrirlash</button>}
        {a.canEdit && d.order && d.myRole === 'seller' && <button className="btn btn-ghost" onClick={() => setModal('clauses')}>✏️ Qo‘shimcha band</button>}
        {a.canSubmit && <button className="btn btn-primary" disabled={submit.busy} onClick={() => void submit.run()}>Yuborish</button>}
        {a.canReopen && <button className="btn btn-ghost" disabled={reopen.busy} onClick={() => void reopen.run()}>Shartlarni qayta ochish</button>}
        {a.canSign && <button className="btn btn-accent" onClick={() => setModal('sign')}>✍️ Imzolash</button>}
        {a.canCancel && <button className="btn btn-ghost !text-danger" onClick={() => setModal('cancel')}>Bekor qilish</button>}
        {['FULLY_SIGNED', 'ACTIVE', 'COMPLETED'].includes(d.status) && <a className="btn btn-ghost" href={`/api/contracts/${id}/bundle`} target="_blank" rel="noreferrer">🗄️ Arxiv paketi (JSON)</a>}
      </div>
      {d.demoSigning && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="note">DEMO rejimi: imzolar oddiy elektron imzo (shaxsiy parolni qayta kiritish) bilan qo‘yiladi. Bu E-IMZO emas.</p>}
      {!d.eimzo.configured && !d.demoSigning && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="note">{d.eimzo.message}</p>}
      <article className="card space-y-4 p-5">
        <h2 className="text-lg font-bold text-brand-800">{d.body.title}</h2>
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-cream-100 p-3"><b>Xaridor</b><p>{d.body.parties.buyer.name}</p><p className="text-ink-muted">{d.body.parties.buyer.email}</p></div>
          <div className="rounded-xl bg-cream-100 p-3"><b>Sotuvchi</b><p>{d.body.parties.seller.store}</p><p className="text-ink-muted">{d.body.parties.seller.owner} · {d.body.parties.seller.region}</p></div>
        </div>
        {d.body.lines?.length > 0 && <table className="w-full text-sm"><thead className="text-left text-ink-muted"><tr><th className="py-1">Mahsulot</th><th>Miqdor</th><th>Narx</th><th className="text-right">Jami</th></tr></thead>
          <tbody>{d.body.lines.map((l: any, i: number) => <tr key={i} className="border-t border-cream-200"><td className="py-1">{l.name}</td><td>{l.quantity} {l.unit}</td><td>{money(l.unitPrice)}</td><td className="text-right">{money(l.total)}</td></tr>)}</tbody></table>}
        <p className="text-right text-lg font-extrabold">Jami: {money(d.body.amounts.total)}</p>
        <p className="text-sm text-ink-soft">Yetkazib berish: {d.body.delivery.method}{d.body.delivery.address ? ` — ${d.body.delivery.address}` : ''} · To‘lov: {d.body.payment.method} · Kafolat: {d.body.warrantyDays} kun</p>
        {d.body.clauses.map((cl: any, i: number) => <section key={i}><h3 className="font-bold">{i + 1}. {cl.title}</h3><p className="whitespace-pre-wrap text-ink-soft">{cl.text}</p></section>)}
        <p className="break-all border-t border-cream-200 pt-3 text-xs text-ink-muted">SHA-256: {d.documentSha256}</p>
      </article>
      <section className="card mt-4 p-4"><h2 className="mb-2 font-bold">Imzolar</h2>
        {d.versions[0].signatures.length === 0 ? <p className="text-sm text-ink-muted">Hali imzolanmagan.</p> : d.versions[0].signatures.map((s: any) => <p key={s.id} className="text-sm">{s.partyRole === 'BUYER' ? 'Xaridor' : 'Sotuvchi'}: {s.certSubject ?? '—'} · {dt(s.signedAt)} · {s.provider === 'DEMO_SIMPLE' ? <Badge tone="warn">DEMO imzo (parol bilan, E-IMZO emas)</Badge> : <Badge tone="ok">E-IMZO tekshirilgan</Badge>}</p>)}
        <h2 className="mb-1 mt-4 font-bold">Versiyalar</h2><ul className="text-sm text-ink-soft">{d.versions.map((v: any) => <li key={v.version}>v{v.version} — {dt(v.createdAt)} — <a className="underline" href={`/api/contracts/${id}/pdf?version=${v.version}`} target="_blank" rel="noreferrer">PDF</a></li>)}</ul></section>
      <section className="card mt-4 p-4"><h2 className="mb-2 font-bold">Tarix</h2><ol className="space-y-1 text-sm">{d.events.map((e: any) => <li key={e.id}><span className="text-ink-muted">{dt(e.createdAt)}</span> — {e.type}</li>)}</ol></section>
      <SignModal open={modal === 'sign'} id={id} info={d} onClose={() => { setModal(null); c.reload(); }} />
      <CancelModal open={modal === 'cancel'} id={id} onClose={() => { setModal(null); c.reload(); }} />
      <EditModal open={modal === 'edit'} id={id} onClose={() => { setModal(null); c.reload(); }} />
      <ClausesModal open={modal === 'clauses'} id={id} onClose={() => { setModal(null); c.reload(); }} />
    </AppShell>
  );
}

function SignModal({ open, id, info, onClose }: { open: boolean; id: string; info: any; onClose: () => void }) {
  const [pkcs7, setP] = useState('');
  const [pw, setPw] = useState('');
  const [agree, setAgree] = useState(false);
  const go = useAction(async () => { await api(`/contracts/${id}/sign`, { body: { pkcs7Base64: pkcs7.trim() } }); onClose(); });
  const demo = useAction(async () => { await api(`/contracts/${id}/sign-demo`, { body: { password: pw, agree: true } }); setPw(''); setAgree(false); onClose(); });
  const ok = info.eimzo.configured;
  return (
    <Modal open={open} title={ok ? 'Elektron imzo (E-IMZO)' : 'Shartnomani imzolash'} onClose={onClose}>
      <p className="mb-3 text-sm text-ink-soft">Imzolanadigan hujjat SHA-256: <span className="break-all font-mono text-xs">{info.documentSha256}</span></p>
      {ok ? (
        <div className="space-y-3"><Field label="PKCS#7 imzo (Base64)" hint="E-IMZO dasturi bilan hujjat PDF’i imzolangandan keyingi natija."><textarea className="input font-mono text-xs" rows={5} value={pkcs7} onChange={(e) => setP(e.target.value)} /></Field>
          <ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || pkcs7.trim().length < 100} onClick={() => void go.run()}>Imzoni yuborish</button></div>
      ) : info.demoSigning ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">DEMO rejimi: bu oddiy elektron imzo (hisob parolini qayta kiritish). U E-IMZO emas. Har bir tomon faqat o‘z hisobidan, o‘zi imzolaydi.</p>
          <Field label="Parolingizni qayta kiriting (shaxsingizni tasdiqlash)"><PasswordInput className="input" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
          <label className="flex items-start gap-3 text-sm text-ink-soft"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-[#047857]" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>Shartnoma matni bilan tanishdim va shartlariga roziman. Bu mening shaxsiy imzom ekanini tasdiqlayman. (<Link href="/terms" className="font-semibold text-brand-700" target="_blank">Foydalanish shartlari</Link>)</span></label>
          <ErrorBox error={demo.error} />
          <button className="btn btn-primary w-full" disabled={demo.busy || !agree || pw.length < 1} onClick={() => void demo.run()}>✍️ Shaxsan imzolayman</button>
        </div>
      ) : <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{info.eimzo.message} Imzo qo‘lda “imzolangan” deb belgilanmaydi.</p>}
    </Modal>
  );
}
function CancelModal({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const [r, setR] = useState(''); const go = useAction(async () => { await api(`/contracts/${id}/cancel`, { body: { reason: r } }); onClose(); });
  return <Modal open={open} title="Shartnomani bekor qilish" onClose={onClose}><Field label="Sabab"><textarea className="input" rows={3} value={r} onChange={(e) => setR(e.target.value)} /></Field><ErrorBox error={go.error} /><button className="btn btn-primary mt-3 w-full" disabled={go.busy || r.trim().length < 3} onClick={() => void go.run()}>Bekor qilish</button></Modal>;
}
function EditModal({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const go = useAction(async (terms: unknown) => { await api(`/contracts/${id}/terms`, { method: 'PATCH', body: { terms } }); onClose(); });
  return <Modal open={open} title="Shartlarni tahrirlash" onClose={onClose}><TermsForm busy={go.busy} error={go.error} onSubmit={(t) => void go.run(t)} submitLabel="Yangi versiya saqlash" /></Modal>;
}
function ClausesModal({ open, id, onClose }: { open: boolean; id: string; onClose: () => void }) {
  const [title, setTitle] = useState(''); const [text, setText] = useState('');
  const go = useAction(async () => { await api(`/contracts/${id}/order-terms`, { method: 'PATCH', body: { extraClauses: [{ title, text }] } }); onClose(); });
  return <Modal open={open} title="Qo‘shimcha band" onClose={onClose}><div className="space-y-3"><Field label="Sarlavha"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field><Field label="Matn"><textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} /></Field><ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || title.trim().length < 2 || text.trim().length < 5} onClick={() => void go.run()}>Saqlash</button></div></Modal>;
}
