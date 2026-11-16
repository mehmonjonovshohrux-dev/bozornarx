'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ErrorBox, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { dt } from '@/lib/fmt';
import { onRealtime } from '@/lib/realtime';
import { uploadFile, useAction, useApi } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Thread() {
  const { id } = useParams<{ id: string }>();
  const h = useApi<any>(`/chat/conversations/${id}/messages?limit=60`);
  const [msgs, setMsgs] = useState<any[]>([]); const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (h.data) setMsgs(h.data.messages); }, [h.data]);
  useEffect(() => { if (h.data) void api(`/chat/conversations/${id}/read`, { method: 'POST', body: {} }).catch(() => undefined); }, [h.data, id]);
  useEffect(() => onRealtime((ev, data: any) => {
    if (ev === 'message' && data.conversationId === id) { setMsgs((m) => m.some((x) => x.id === data.id) ? m : [...m, { id: data.id, mine: false, body: data.body, fileId: data.fileId, fileType: data.fileType, createdAt: data.createdAt }]); void api(`/chat/conversations/${id}/read`, { method: 'POST', body: {} }).catch(() => undefined); }
    if (ev === 'read' && data.conversationId === id) setMsgs((m) => m.map((x) => (x.mine && !x.readAt ? { ...x, readAt: new Date().toISOString() } : x)));
  }), [id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs.length]);
  const send = useAction(async (fileId?: string) => { const m = await api<any>(`/chat/conversations/${id}/messages`, { body: { body: text.trim() || undefined, fileId } }); setMsgs((x) => [...x, m]); setText(''); });
  const attach = useAction(async (f: File) => { const up = await uploadFile(f, 'CHAT'); await send.run(up.id); });
  const block = useAction(async (on: boolean) => { await api(`/chat/conversations/${id}/${on ? 'block' : 'unblock'}`, { method: 'POST', body: {} }); h.reload(); });
  if (h.loading && !h.data) return <AppShell><Spinner /></AppShell>;
  if (h.error) return <AppShell><ErrorBox error={h.error} retry={h.reload} /></AppShell>;
  const d = h.data;
  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100dvh-9rem)] max-w-2xl flex-col lg:h-[calc(100dvh-8rem)]">
        <div className="mb-2 flex items-center justify-between"><Link href="/chat" className="text-sm font-semibold text-brand-700">← Chat</Link><b>{d.store.name}{d.buyerName ? ` · ${d.buyerName}` : ''}</b>
          {(!d.blocked || d.blockedByMe) && <button className="text-sm text-danger" disabled={block.busy} onClick={() => void block.run(!d.blocked)}>{d.blocked ? 'Blokni ochish' : 'Bloklash'}</button>}</div>
        <div className="card flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
          {msgs.length === 0 && <p className="py-10 text-center text-ink-muted">Birinchi xabarni yozing.</p>}
          {msgs.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] ${m.mine ? 'bg-brand-700 text-white' : 'bg-cream-200 text-ink'}`}>
                {m.fileId && (m.fileType?.startsWith('image/') ? /* eslint-disable-next-line @next/next/no-img-element */ <a href={`/api/files/${m.fileId}`} target="_blank" rel="noreferrer"><img alt="Rasm" src={`/api/files/${m.fileId}`} className="mb-1 max-h-48 rounded-lg" /></a> : <a className="underline" href={`/api/files/${m.fileId}`} target="_blank" rel="noreferrer">📎 Fayl</a>)}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`mt-0.5 text-[11px] ${m.mine ? 'text-brand-100' : 'text-ink-muted'}`}>{dt(m.createdAt)}{m.mine && (m.readAt ? ' ✓✓' : ' ✓')}</p>
              </div></div>))}
          <div ref={end} />
        </div>
        <ErrorBox error={send.error ?? attach.error ?? block.error} />
        {d.blocked ? <p className="mt-2 rounded-xl bg-cream-200 p-3 text-center text-sm">Suhbat bloklangan.</p> : (
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) void send.run(); }}>
            <label className="btn btn-ghost cursor-pointer !px-3" aria-label="Fayl biriktirish">📎<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void attach.run(e.target.files[0])} /></label>
            <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Xabar yozing…" maxLength={2000} aria-label="Xabar" />
            <button className="btn btn-primary" disabled={send.busy || !text.trim()}>Yuborish</button>
          </form>)}
      </div>
    </AppShell>
  );
}
