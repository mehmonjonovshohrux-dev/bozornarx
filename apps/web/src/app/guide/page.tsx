'use client';
import { AppShell, roleOf } from '@/components/AppShell';
import { PageTitle } from '@/components/ui/kit';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/fmt';

type Role = 'BUYER' | 'SELLER' | 'MODERATOR' | 'SUPER_ADMIN';
const GUIDE: Record<Role, Array<[string, string[]]>> = {
  BUYER: [
    ['Narxni topish va solishtirish', ['"Mahsulotlar" bo‘limida mahsulotni qidiring.', 'Mahsulot sahifasida do‘konlar narxini, 30 kunlik o‘zgarishni va xaritadagi joylashuvni ko‘ring.', 'Yoqqanini "Sevimlilar"ga qo‘shing, kerakli narx uchun ogohlantirish qo‘ying.']],
    ['Buyurtma berish', ['Savatga qo‘shing, yetkazish yoki olib ketishni tanlang.', 'Buyurtmani tasdiqlang va sotuvchi javobini kuting (Bildirishnomalar).', 'Narx kelishmasa, "Takliflar" orqali o‘z narxingizni yuboring.']],
    ['Shartnomani imzolash', ['Sotuvchi tasdiqlagach, Shartnomalar bo‘limida hujjat paydo bo‘ladi.', 'Matnni o‘qing, "Imzolash"ni bosing, parolingizni kiriting va rozilik belgisini qo‘ying.', 'Ikkala tomon imzolagach shartnoma faol bo‘ladi.']],
    ['Qabul qilish va sharh', ['Mahsulot yetkazilgach, buyurtmani qabul qiling.', 'Do‘konga sharh va baho qoldiring.', 'Muammo bo‘lsa, Nizolar orqali shikoyat oching.']],
  ],
  SELLER: [
    ['Do‘kon va mahsulotlar', ['"Do‘kon profili"ni to‘ldiring va tasdiqlash uchun hujjat yuboring.', 'Mahsulot qo‘shing, narx va qoldiqni kiriting (moderator tasdiqlaydi).', 'Narxni muntazam yangilab turing: eskirgan narx ishonchni kamaytiradi.']],
    ['Buyurtmalar', ['"Buyurtmalar"da yangi buyurtmani ko‘ring va tasdiqlang.', 'Tasdiqlangach shartnoma avtomatik yaratiladi.', 'Holatni yangilang: yo‘lda → yetkazildi.']],
    ['Shartnomani imzolash', ['Shartnomalar bo‘limida hujjatni oching va o‘zingiz imzolang (parolni qayta kiritish bilan).', 'Xaridorning imzosi alohida qo‘yiladi, siz uning o‘rniga imzolay olmaysiz.']],
    ['Takliflar, aksiyalar, xabarlar', ['Xaridor takliflariga qabul, rad yoki qarshi narx bilan javob bering.', 'Chegirma kodlarini "Aksiyalar"da yarating.', 'Savollarga Xabarlar bo‘limida javob bering.']],
  ],
  MODERATOR: [
    ['Tekshiruv navbati', ['"Tekshiruv navbati"da do‘kon, mahsulot, narx va sharhlarni ko‘ring.', 'Har bir qarorga sabab yozing: u jurnalga saqlanadi.']],
    ['Nizolar', ['Nizolar bo‘limida ishni oling, ikki tomonning dalillarini o‘qing.', 'Qaror va izohni yozing; tomonlarga xabar boradi.']],
    ['Shartnomalar', ['Shartnomalarni faqat ko‘rish mumkin: siz tomon emassiz.']],
  ],
  SUPER_ADMIN: [
    ['Boshqaruv markazi', ['Statistikadagi har bir raqamni bossangiz, ro‘yxat ochiladi; ro‘yxatdan elementni bossangiz, tafsiloti chiqadi.', 'Telefonda bo‘limlarga chap yuqoridagi menyu (☰) orqali o‘ting.']],
    ['Foydalanuvchilar', ['Rol berish, bloklash va seanslarni yopish mumkin. Super Admin hisobi himoyalangan.']],
    ['Tizim', ['Sozlamalar, tariflar, shartnoma shablonlari, hudud va kategoriyalarni boshqaring.', 'Audit jurnalida barcha muhim amallar saqlanadi.']],
  ],
};

export default function GuidePage() {
  const { user } = useAuth();
  const role = roleOf(user?.roles);
  return (
    <AppShell>
      <PageTitle title="Yo‘riqnomalar" sub={`${ROLE_LABEL[role]} uchun qadamma-qadam`} />
      <div className="grid gap-4 lg:grid-cols-2">
        {GUIDE[role].map(([title, steps], i) => (
          <section key={title} className="card p-4">
            <h2 className="mb-2 font-bold"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-sm text-white">{i + 1}</span>{title}</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{steps.map((t) => <li key={t}>{t}</li>)}</ul>
          </section>
        ))}
      </div>
      <p className="mt-4 text-sm text-ink-muted">Savolingiz qolsa, "Ko‘p beriladigan savollar" bo‘limiga qarang.</p>
    </AppShell>
  );
}
