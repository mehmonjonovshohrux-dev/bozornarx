import { LegalPage, Sec } from '@/components/LegalPage';

export const metadata = { title: 'Maxfiylik siyosati — BozorNarx' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Maxfiylik siyosati (DEMO)" updated="17.11.2026">
      <Sec t="1. Qanday ma’lumotlar yig‘iladi">
        <p>Ro‘yxatdan o‘tishda: ism, email, telefon (ixtiyoriy), parol (faqat shifrlangan ko‘rinishda). Foydalanish jarayonida: buyurtmalar, shartnomalar, xabarlar, sevimlilar, qurilma va IP ma’lumotlari (xavfsizlik va imzo dalili uchun).</p>
      </Sec>
      <Sec t="2. Maqsad va asos">
        <p>Ma’lumotlar xizmatni ko‘rsatish, shartnoma tuzish va imzolash, nizolarni hal qilish, xavfsizlikni ta’minlash va qonun talablarini bajarish uchun qayta ishlanadi. Asos: sizning roziligingiz va shartnomani bajarish. Rozilikni ro‘yxatdan o‘tishda belgi qo‘yish orqali berasiz.</p>
      </Sec>
      <Sec t="3. Kimlarga ko‘rsatiladi">
        <p>Shartnoma va buyurtma tomonlariga (xaridor va sotuvchi) o‘zaro zarur ma’lumotlar ko‘rinadi. Boshqa uchinchi shaxslarga faqat qonun talab qilganda yoki sizning roziligingiz bilan beriladi. Ma’lumotlar sotilmaydi.</p>
      </Sec>
      <Sec t="4. Saqlash va xavfsizlik">
        <p>Parollar bir tomonlama shifrlanadi. Imzolangan shartnomalar dalil sifatida o‘chirilmaydi. Biometrik (barmoq izi) ochish faqat qurilmangizning o‘zida ishlaydi; biometrik ma’lumot serverga yuborilmaydi.</p>
        <p>Saqlash joyi va muddati haqiqiy ishga tushirishda yurist bilan O‘zbekistonning “Shaxsiy ma’lumotlar to‘g‘risida”gi qonuni talablariga (jumladan, ayrim toifadagi ma’lumotlarni mamlakat ichida saqlash va ma’lumotlar bazasini ro‘yxatdan o‘tkazish) muvofiq belgilanadi.</p>
      </Sec>
      <Sec t="5. Sizning huquqlaringiz">
        <p>Ma’lumotlaringizni ko‘rish, to‘g‘rilash, o‘chirishni so‘rash va rozilikni qaytarib olish huquqiga egasiz. So‘rov: [aloqa emaili — haqiqiy ishga tushirishda to‘ldiriladi]. Qonun bo‘yicha saqlanishi shart bo‘lgan hujjatlar (masalan, imzolangan shartnoma) bundan mustasno.</p>
      </Sec>
      <Sec t="6. Cookie va qurilma xotirasi">
        <p>Tizimga kirish holati va ilova qulfi (PIN) uchun brauzer xotirasidan foydalaniladi. Reklama maqsadidagi kuzatuv ishlatilmaydi.</p>
      </Sec>
    </LegalPage>
  );
}
