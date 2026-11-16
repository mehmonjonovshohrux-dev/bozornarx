'use client';
import { useState, type ReactNode } from 'react';
import { Empty, ErrorBox, Field, Modal, Pager, Spinner } from '@/components/ui/kit';
import { api } from '@/lib/api';
import { qs, useAction, useApi, type Paged } from '@/lib/hooks';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Decision { id: string; action: string; label: string; danger?: boolean }

/** One reusable queue: lists items from `path`, lets the moderator pick an action and enter the required reason, then POSTs to `${postBase}/${id}`. */
export function ModerationQueue({ path, postBase, params, render, actions, reasonKey = 'reason', actionKey = 'action', empty, extraBody }: {
  path: string; postBase: string; params?: Record<string, string | number | undefined>; render: (item: any) => ReactNode; actions: Array<{ action: string; label: string; danger?: boolean }>;
  reasonKey?: string; actionKey?: string; empty: string; extraBody?: Record<string, unknown>;
}) {
  const [page, setPage] = useState(1); const [sel, setSel] = useState<{ item: any; action: { action: string; label: string; danger?: boolean } } | null>(null); const [reason, setReason] = useState('');
  const q = useApi<Paged<any>>(`${path}${qs({ ...params, page, pageSize: 10 })}`);
  const go = useAction(async () => { await api(`${postBase}/${sel!.item.id}`, { body: { [actionKey]: sel!.action.action, [reasonKey]: reason, ...extraBody } }); setSel(null); setReason(''); q.reload(); });
  return (
    <>
      <ErrorBox error={q.error} retry={q.reload} />{q.loading && !q.data && <Spinner />}
      {q.data?.items.length === 0 && <Empty title={empty} />}
      <ul className="space-y-3">{q.data?.items.map((it) => (
        <li key={it.id} className="card flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1">{render(it)}</div>
          <div className="flex gap-2">{actions.map((a) => <button key={a.action} className={`btn !min-h-[40px] !px-4 ${a.danger ? 'btn-ghost !text-danger' : 'btn-primary'}`} onClick={() => { setSel({ item: it, action: a }); setReason(''); }}>{a.label}</button>)}</div></li>))}</ul>
      {q.data && <Pager page={page} pages={q.data.pages ?? 1} onPage={setPage} />}
      <Modal open={!!sel} title={sel?.action.label ?? ''} onClose={() => setSel(null)}>
        <Field label="Sabab / izoh (foydalanuvchiga ko‘rsatiladi)"><textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <ErrorBox error={go.error} /><button className="btn btn-primary mt-3 w-full" disabled={go.busy || reason.trim().length < 3} onClick={() => void go.run()}>Tasdiqlash</button>
      </Modal>
    </>
  );
}
