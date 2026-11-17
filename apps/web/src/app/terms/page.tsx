import { LegalPage, Sec } from '@/components/LegalPage';

export const metadata = { title: 'Foydalanish shartlari — BozorNarx' };

export default function TermsPage() {
  return (
    <LegalPage title="Foydalanish shartlari (ommaviy oferta, DEMO)" updated="17.11.2026">
      <Sec t="1. Umumiy qoidalar">
        <p>BozorNarx — mahalliy bozor narxlarini kuzatish, solishtirish va xaridor bilan sotuvchi o‘rtasida xavfsiz savdo shartnomasini tuzishga yordam beruvchi axborot platformasi. Ro‘yxatdan o‘tish yoki xizmatdan foydalanish ushbu shartlarni qabul qilish (aksept) hisoblanadi.</p>
        <p>Operator: [kompaniya nomi, STIR, manzil, aloqa — haqiqiy ishga tushirishda to‘ldiriladi]. Hozirgi demo versiyada real savdo va real to‘lov amalga oshirilmaydi.</p>
      </Sec>
      <Sec t="2. Hisob va xavfsizlik">
        <p>Foydalanuvchi to‘g‘ri ma’lumot kiritadi, parolini sir saqlaydi va hisobi orqali bajarilgan harakatlar uchun mas’uldir. Shubhali holat aniqlansa, hisob cheklanishi mumkin.</p>
      </Sec>
      <Sec t="3. Rollar va mas’uliyat">
        <p>Sotuvchi mahsulot haqida to‘g‘ri ma’lumot (nomi, narxi, sifati, sotuvchi kimligi va aloqasi) berishga majbur. Xaridor buyurtma va shartnoma shartlarini o‘qib tasdiqlaydi. Platforma savdo tomoni emas: tovar sifati va yetkazib berish uchun sotuvchi javob beradi, platforma esa shartnoma, tarix va nizolar markazi vositasida yordam beradi.</p>
      </Sec>
      <Sec t="4. Elektron shartnoma va imzo">
        <p>Buyurtma sotuvchi tomonidan tasdiqlangach, shartnoma avtomatik shakllanadi (o‘zbek tilida, narx, miqdor, yetkazib berish va kafolat shartlari bilan). Tomonlar elektron hujjatlar orqali aksept qilish yo‘li bilan shartnoma tuzishi mumkin.</p>
        <p>Har bir tomon shartnomani faqat o‘z hisobidan, o‘zi imzolaydi. Demo rejimida imzo — oddiy elektron imzo: parolni qayta kiritish va rozilik belgisi. Imzo vaqti, qurilma ma’lumoti va hujjat hashi (SHA-256) saqlanadi; hujjat o‘zgarsa, imzo yangidan talab qilinadi. Bu rejim E-IMZO (elektron raqamli imzo) emas.</p>
        <p>Haqiqiy savdoda E-IMZO yoki tomonlar yozma kelishgan imzo usuli qo‘llanishi kerak.</p>
      </Sec>
      <Sec t="5. Narxlar va to‘lov">
        <p>Platformadagi narxlar axborot xarakteriga ega bo‘lib, sotuvchi tomonidan o‘zgarishi mumkin; shartnomadagi narx yakuniy hisoblanadi. Demo versiyada platforma pul mablag‘larini qabul qilmaydi va saqlamaydi.</p>
      </Sec>
      <Sec t="6. Iste’molchi huquqlari va nizolar">
        <p>Sifatsiz tovar uchun xaridor shartnomada ko‘rsatilgan muddat ichida e’tiroz bildiradi. Nizolar avval nizolar markazida muzokaralar orqali, kelishilmasa amaldagi qonunchilikka muvofiq sudda ko‘riladi. Iste’molchining qonun bilan berilgan huquqlari bu shartlar bilan cheklanmaydi.</p>
      </Sec>
      <Sec t="7. Taqiqlangan harakatlar">
        <p>Soxta e’lon, boshqa shaxs nomidan harakat qilish, tizimga ruxsatsiz kirish, qonunga zid tovarlar savdosi va boshqa foydalanuvchilarga zarar yetkazish taqiqlanadi.</p>
      </Sec>
      <Sec t="8. Shartlarni o‘zgartirish">
        <p>Shartlar yangilanishi mumkin; yangi tahrir e’lon qilingan vaqtdan kuchga kiradi. Muhim o‘zgarishlar haqida foydalanuvchilarga xabar beriladi.</p>
      </Sec>
    </LegalPage>
  );
}
