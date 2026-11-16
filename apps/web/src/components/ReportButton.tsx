'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { ErrorBox, Field, Modal } from './ui/kit';

/** “Shikoyat qilish”: only for signed-in users who may file complaints. */
export function ReportButton({ targetType, targetId, label = '🚩 Shikoyat' }: { targetType: 'PRICE' | 'PRODUCT' | 'STORE' | 'USER' | 'CONTRACT' | 'REVIEW'; targetId: string; label?: string }) {
  const { user } = useAuth(); const [open, setOpen] = useState(false); const [reason, setReason] = useState(''); const [details, setDetails] = useState(''); const [done, setDone] = useState(false);
  const go = useAction(async () => { await api('/complaints', { body: { targetType, targetId, reason, details: details || undefined } }); setDone(true); });
  if (!user?.permissions.includes('complaints.create')) return null;
  return (<>
    <button className="text-sm font-semibold text-ink-muted underline" onClick={() => { setOpen(true); setDone(false); }}>{label}</button>
    <Modal open={open} title="Shikoyat yuborish" onClose={() => setOpen(false)}>{done ? <p className="text-brand-700">Shikoyatingiz moderatorga yuborildi.</p> : <div className="space-y-3">
      <Field label="Sabab"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: narx noto‘g‘ri" /></Field><Field label="Tafsilot"><textarea className="input" rows={3} value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
      <ErrorBox error={go.error} /><button className="btn btn-primary w-full" disabled={go.busy || reason.trim().length < 5} onClick={() => void go.run()}>Yuborish</button></div>}</Modal></>);
}
