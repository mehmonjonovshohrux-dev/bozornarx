'use client';
import { AppShell } from '@/components/AppShell';
import { PageTitle } from '@/components/ui/kit';

const FAQ: Array<[string, string]> = [
  ['BozorNarx nima?', 'Mahalliy bozor va do‘konlardagi narxlarni kuzatish, solishtirish va xaridor bilan sotuvchi o‘rtasida shartnoma bilan xavfsiz savdo qilish platformasi.'],
  ['Narxlar qayerdan olinadi?', 'Narxlarni tasdiqlangan sotuvchilar kiritadi, moderatorlar tekshiradi. Har bir narxda yangilangan vaqti ko‘rsatiladi.'],
  ['Nega bitta hisobda bitta rol bor?', 'Xaridor, sotuvchi, moderator va administrator rollari aralashmasligi uchun: mas’uliyat va ruxsatlar aniq ajratiladi.'],
  ['Buyurtma qanday beriladi?', 'Mahsulotni savatga qo‘shing, buyurtmani tasdiqlang. Sotuvchi tasdiqlagach, shartnoma avtomatik tuziladi.'],
  ['Shartnomani qanday imzolayman?', 'Shartnoma sahifasida "Imzolash" tugmasini bosing. Demo rejimida parolingizni qayta kiritasiz va rozilik belgisini qo‘yasiz. Har bir tomon faqat o‘zi imzolaydi.'],
  ['Demo imzo E-IMZO bilan bir xilmi?', 'Yo‘q. Demo imzo sinov uchun oddiy elektron imzo. Haqiqiy savdoda E-IMZO yoki tomonlar yozma kelishgan imzo usuli qo‘llanishi kerak.'],
  ['Pul to‘lovi qanday amalga oshadi?', 'Hozirgi versiyada to‘lov naqd (yetkazilganda). Platforma pulni o‘zida saqlamaydi.'],
  ['Mahsulot sifatsiz chiqsa nima qilaman?', 'Buyurtma sahifasidan nizo oching. Moderator ikki tomonning dalillarini ko‘rib chiqadi. Kafolat muddati shartnomada yozilgan.'],
  ['Narx tushganda xabar olsam bo‘ladimi?', 'Ha. "Narx ogohlantirishlari" bo‘limida mahsulot va kerakli narxni belgilang.'],
  ['Ilovani telefonga qanday o‘rnataman?', 'Sozlamalar yoki Xavfsizlik bo‘limidagi "Ilovani o‘rnatish" tugmasini bosing. Ilova bosh ekranda alohida belgi bilan ochiladi.'],
  ['PIN va barmoq izi nima uchun?', 'Ilova ochilganda qo‘shimcha himoya. Barmoq izi faqat qurilmangizda tekshiriladi va serverga yuborilmaydi.'],
  ['Parolni unutsam-chi?', 'Kirish sahifasida "Parolni unutdingizmi?" ni bosing, emailingizga kod yuboriladi.'],
  ['Ma’lumotlarim qanday himoyalanadi?', 'Parollar shifrlangan holda saqlanadi, shartnomalar o‘zgartirilmaydi va hash bilan tekshiriladi. Batafsil: Maxfiylik siyosati.'],
  ['Server sekin javob bersa?', 'Bepul serverda uzoq vaqt foydalanilmasa, uyg‘onishi 30–60 soniya olishi mumkin. Biroz kutib qayta urinib ko‘ring.'],
];

export default function FaqPage() {
  return (
    <AppShell>
      <PageTitle title="Ko‘p beriladigan savollar" sub="Tezkor javoblar" />
      <div className="space-y-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="card group p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold"><span>{q}</span><span aria-hidden className="text-brand-700 transition group-open:rotate-90">›</span></summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</p>
          </details>
        ))}
      </div>
    </AppShell>
  );
}
