'use client';
import { useState } from 'react';
import { ErrorBox, Field } from '@/components/ui/kit';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function TermsForm({ initial, onSubmit, busy, error, submitLabel }: { initial?: any; onSubmit: (t: any) => void; busy: boolean; error: string | null; submitLabel: string }) {
  const [t, setT] = useState({ subject: '', amount: '', period: '', paymentTerms: '', deliveryTerms: '', deliveryAddress: '', warrantyDays: '14', ...initial });
  const set = (k: string, v: string) => setT((o: any) => ({ ...o, [k]: v }));
  const out = () => ({ subject: t.subject, amount: Number(t.amount), warrantyDays: Number(t.warrantyDays), ...Object.fromEntries(['period', 'paymentTerms', 'deliveryTerms', 'deliveryAddress'].filter((k) => t[k]).map((k) => [k, t[k]])) });
  return (
    <div className="space-y-3">
      <Field label="Shartnoma predmeti"><textarea className="input" rows={2} value={t.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Summa (so‘m)"><input className="input" inputMode="decimal" value={t.amount} onChange={(e) => set('amount', e.target.value)} /></Field><Field label="Kafolat (kun)"><input className="input" inputMode="numeric" value={t.warrantyDays} onChange={(e) => set('warrantyDays', e.target.value)} /></Field></div>
      <Field label="Muddat"><input className="input" value={t.period} onChange={(e) => set('period', e.target.value)} /></Field>
      <Field label="To‘lov shartlari"><input className="input" value={t.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} /></Field>
      <Field label="Yetkazib berish shartlari"><input className="input" value={t.deliveryTerms} onChange={(e) => set('deliveryTerms', e.target.value)} /></Field>
      <Field label="Yetkazib berish manzili"><input className="input" value={t.deliveryAddress} onChange={(e) => set('deliveryAddress', e.target.value)} /></Field>
      <ErrorBox error={error} />
      <button className="btn btn-primary w-full" disabled={busy || t.subject.trim().length < 3 || !(Number(t.amount) >= 0) || t.amount === ''} onClick={() => onSubmit(out())}>{submitLabel}</button>
    </div>
  );
}
