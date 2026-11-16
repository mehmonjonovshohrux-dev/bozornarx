import { BasketMark } from '@/components/Logo';

export const metadata = { title: 'Oflayn' };

export default function Offline() {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-6 text-center">
      <div>
        <div className="mx-auto w-fit opacity-80"><BasketMark size={96} /></div>
        <h1 className="mt-5 text-2xl font-extrabold text-brand-800">Internet aloqasi yo‘q</h1>
        <p className="mt-2 text-ink-soft">Aloqa tiklangach sahifa qayta ishlaydi. Narxlar va buyurtmalar uchun internet kerak.</p>
        <a href="/" className="btn btn-primary mt-6">Qayta urinish</a>
      </div>
    </main>
  );
}
