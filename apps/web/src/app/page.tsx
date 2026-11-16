import Link from 'next/link';
import { Brand } from '@/components/Logo';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-4 pb-12 pt-6">
      <header className="flex items-center justify-between">
        <Brand />
        <Link href="/login" className="btn btn-ghost">Kirish</Link>
      </header>
      <section className="my-auto py-14 text-center">
        <h1 className="text-4xl font-extrabold leading-tight text-brand-800 sm:text-5xl">Bozor narxlari — <span className="text-accent-500">bir joyda</span></h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-ink-soft">Mahalliy bozorlardagi narxlarni kuzating, sotuvchilarni taqqoslang va xavfsiz savdo qiling.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register" className="btn btn-primary">Ro‘yxatdan o‘tish</Link>
          <Link href="/catalog" className="btn btn-accent">Narxlarni ko‘rish</Link>
          <Link href="/login" className="btn btn-ghost">Kirish</Link>
        </div>
      </section>
    </main>
  );
}
