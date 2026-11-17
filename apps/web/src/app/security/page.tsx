'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { InstallButton } from '@/components/InstallButton';
import { PageTitle } from '@/components/ui/kit';
import { biometricAvailable, clearLock, disableBiometric, enableBiometric, getLock, setAutoSec, setPin, verifyPin } from '@/lib/applock';
import { useAuth } from '@/lib/auth-context';

export default function SecurityPage() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(getLock());
  const [bioOk, setBioOk] = useState(false);
  const [pin1, setPin1] = useState('');
  const [pin2, setPin2] = useState('');
  const [cur, setCur] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const mine = !!cfg && cfg.uid === user?.id;

  useEffect(() => {
    void biometricAvailable().then(setBioOk);
    const h = () => setCfg(getLock());
    window.addEventListener('bn-lock-change', h);
    return () => window.removeEventListener('bn-lock-change', h);
  }, []);

  async function create() {
    setMsg(null);
    if (!user) return;
    if (!/^\d{4,6}$/.test(pin1)) return setMsg({ ok: false, t: 'PIN 4–6 ta raqamdan iborat bo‘lsin.' });
    if (/^(\d)\1+$/.test(pin1) || '0123456789'.includes(pin1) || '9876543210'.includes(pin1)) return setMsg({ ok: false, t: 'Juda oddiy PIN (masalan 1234 yoki 1111). Boshqasini tanlang.' });
    if (pin1 !== pin2) return setMsg({ ok: false, t: 'PIN kodlar bir xil emas.' });
    await setPin(user.id, pin1, 60);
    try { sessionStorage.setItem('bn_unlocked', '1'); } catch { /* ignore */ }
    setPin1(''); setPin2('');
    setMsg({ ok: true, t: 'Ilova qulfi yoqildi.' });
  }
  async function remove() {
    if (!(await verifyPin(cur))) return setMsg({ ok: false, t: 'Joriy PIN noto‘g‘ri.' });
    clearLock(); setCur(''); setMsg({ ok: true, t: 'Ilova qulfi o‘chirildi.' });
  }
  async function bio() {
    setMsg(null);
    if (mine && cfg?.cred) { disableBiometric(); return setMsg({ ok: true, t: 'Barmoq izi o‘chirildi.' }); }
    const ok = await enableBiometric(user?.email ?? 'user');
    setMsg(ok ? { ok: true, t: 'Barmoq izi / yuz bilan ochish yoqildi.' } : { ok: false, t: 'Yoqib bo‘lmadi. Telefonda barmoq izi yoki ekran qulfi sozlanganini tekshiring.' });
  }

  return (
    <AppShell>
      <PageTitle title="Xavfsizlik va ilova" />
      <div className="mx-auto max-w-xl space-y-4">
        <section className="card space-y-3 p-5">
          <h2 className="text-lg font-bold">Ilova qulfi</h2>
          <p className="text-sm text-ink-soft">Ilova ochilganda yoki fonda turib qaytganda PIN (yoki barmoq izi) so‘raladi. Bu shu telefonni himoya qiladi; hisobga kirish paroli almashmaydi. 5 marta xato kiritilsa, tizimdan chiqariladi.</p>
          {!mine ? (
            <>
              <label className="label" htmlFor="p1">Yangi PIN (4–6 raqam)</label>
              <input id="p1" className="input" inputMode="numeric" type="password" autoComplete="off" maxLength={6} value={pin1} onChange={(e) => setPin1(e.target.value.replace(/\D/g, ''))} />
              <label className="label" htmlFor="p2">PIN ni takrorlang</label>
              <input id="p2" className="input" inputMode="numeric" type="password" autoComplete="off" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
              <button className="btn btn-primary w-full" onClick={() => void create()}>Qulfni yoqish</button>
            </>
          ) : (
            <>
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">Ilova qulfi yoqilgan ✓</p>
              <label className="label" htmlFor="auto">Qachon qulflansin</label>
              <select id="auto" className="input" value={cfg?.autoSec ?? 60} onChange={(e) => setAutoSec(Number(e.target.value))}>
                <option value={0}>Ilovadan chiqqanda darhol</option><option value={30}>30 soniyadan keyin</option><option value={60}>1 daqiqadan keyin</option><option value={300}>5 daqiqadan keyin</option>
              </select>
              {bioOk ? <button className="btn btn-ghost w-full" onClick={() => void bio()}>{cfg?.cred ? 'Barmoq izi bilan ochishni o‘chirish' : 'Barmoq izi / yuz bilan ochishni yoqish'}</button> : <p className="text-sm text-ink-muted">Bu qurilmada barmoq izi/yuz bilan ochish mavjud emas yoki sozlanmagan.</p>}
              <label className="label" htmlFor="cur">Qulfni o‘chirish uchun joriy PIN</label>
              <div className="flex gap-2"><input id="cur" className="input" inputMode="numeric" type="password" maxLength={6} value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} /><button className="btn btn-ghost" onClick={() => void remove()}>O‘chirish</button></div>
            </>
          )}
          {msg && <p role="status" className={`rounded-xl px-3 py-2 text-sm font-medium ${msg.ok ? 'bg-brand-50 text-brand-800' : 'bg-red-50 text-danger'}`}>{msg.t}</p>}
        </section>
        <section className="card space-y-3 p-5"><h2 className="text-lg font-bold">Ilovani yuklab olish</h2><p className="text-sm text-ink-soft">Telefon bosh ekraniga o‘rnating: to‘liq ekranda, brauzer satrisiz ochiladi.</p><InstallButton /></section>
      </div>
    </AppShell>
  );
}
