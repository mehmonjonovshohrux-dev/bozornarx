// Contract templates and rendering. Pure: no database, no framework.
// A template is a list of clauses with {{placeholders}}. Rendering FAILS when a placeholder has no value,
// so a contract can never be generated with a hole in it.

export type ContractTypeCode = 'SALE' | 'DELIVERY' | 'WHOLESALE' | 'SUPPLY' | 'PARTNERSHIP' | 'SERVICE' | 'PLATFORM_OFFER';

export interface Clause {
  title: string;
  text: string;
}

export class TemplateError extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing template values: ${missing.join(', ')}`);
    this.name = 'TemplateError';
    this.missing = missing;
  }
}

export function renderText(text: string, vars: Record<string, string>): string {
  const missing = new Set<string>();
  const out = text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    if (v === undefined || v === '') {
      missing.add(key);
      return '';
    }
    return v;
  });
  if (missing.size) throw new TemplateError([...missing]);
  return out;
}

export function renderClauses(clauses: readonly Clause[], vars: Record<string, string>): Clause[] {
  return clauses.map((c) => ({ title: c.title, text: renderText(c.text, vars) }));
}

const COMMON_TAIL: Clause[] = [
  { title: 'Nizolarni hal qilish', text: 'Tomonlar o‘rtasidagi nizolar avvalo muzokaralar yo‘li bilan hal etiladi. Kelishuvga erishilmasa, nizo BozorNarx nizolar markaziga, so‘ng amaldagi qonunchilikka muvofiq sudga havola qilinadi.' },
  { title: 'Elektron imzo', text: 'Shartnoma tomonlar tomonidan E-IMZO elektron raqamli imzosi bilan imzolanadi. Imzolangan hujjat va imzo fayllari BozorNarx arxivida saqlanadi. Shartnomaning o‘zgartirilgan versiyasi yangidan imzolanishi shart.' },
  { title: 'Yakuniy qoidalar', text: 'Shartnoma ikki nusxada, bir xil yuridik kuchga ega elektron ko‘rinishda tuziladi. Shartnoma raqami: {{number}}.' },
];

export const DEFAULT_TEMPLATES: Record<ContractTypeCode, { name: string; clauses: Clause[] }> = {
  SALE: {
    name: 'Oldi-sotdi shartnomasi',
    clauses: [
      { title: 'Shartnoma predmeti', text: 'Sotuvchi ({{sellerName}}) xaridorga ({{buyerName}}) quyidagi mahsulotlarni sotish majburiyatini oladi: {{goods}}.' },
      { title: 'Narx va to‘lov', text: 'Mahsulotlarning umumiy narxi {{total}} so‘m. To‘lov usuli: {{paymentMethod}}. Platforma pul mablag‘larini o‘zida saqlamaydi.' },
      { title: 'Yetkazib berish', text: 'Topshirish usuli: {{deliveryMethod}}. {{deliveryAddress}}' },
      { title: 'Kafolat', text: 'Sifatsiz mahsulot topshirilgan taqdirda xaridor {{warrantyDays}} kun ichida e’tiroz bildirishi mumkin. Sotuvchi mahsulotni almashtiradi yoki pulni qaytaradi.' },
      ...COMMON_TAIL,
    ],
  },
  DELIVERY: {
    name: 'Yetkazib berish shartnomasi',
    clauses: [
      { title: 'Shartnoma predmeti', text: '{{sellerName}} {{buyerName}} uchun quyidagi tovarlarni belgilangan manzilga yetkazib berish majburiyatini oladi: {{goods}}.' },
      { title: 'Muddat va manzil', text: 'Manzil: {{deliveryAddress}}. Muddat: {{period}}.' },
      { title: 'Narx', text: 'Yetkazib berish bilan birga umumiy qiymat {{total}} so‘m.' },
      { title: 'Kafolat', text: 'Yetkazib berish jarayonida shikastlangan tovar uchun {{warrantyDays}} kun ichida e’tiroz bildirish mumkin.' },
      ...COMMON_TAIL,
    ],
  },
  WHOLESALE: {
    name: 'Ulgurji savdo shartnomasi',
    clauses: [
      { title: 'Shartnoma predmeti', text: '{{sellerName}} {{buyerName}}ga ulgurji miqdorda quyidagi mahsulotlarni sotadi: {{goods}}.' },
      { title: 'Narx', text: 'Ulgurji narx asosida umumiy qiymat {{total}} so‘m. To‘lov: {{paymentMethod}}.' },
      { title: 'Topshirish', text: '{{deliveryMethod}}. {{deliveryAddress}}' },
      { title: 'Kafolat', text: '{{warrantyDays}} kun ichida sifat bo‘yicha e’tiroz bildirish mumkin.' },
      ...COMMON_TAIL,
    ],
  },
  SUPPLY: {
    name: 'Muntazam yetkazib berish (ta’minot) shartnomasi',
    clauses: [
      { title: 'Predmet', text: '{{sellerName}} {{buyerName}}ni quyidagi mahsulotlar bilan muntazam ta’minlaydi: {{goods}}.' },
      { title: 'Muddat', text: 'Shartnoma muddati: {{period}}.' },
      { title: 'Narx va to‘lov', text: 'Hisob-kitob shartlari: {{paymentMethod}}. Taxminiy summa: {{total}} so‘m.' },
      ...COMMON_TAIL,
    ],
  },
  PARTNERSHIP: {
    name: 'Hamkorlik shartnomasi',
    clauses: [
      { title: 'Predmet', text: '{{sellerName}} va {{buyerName}} quyidagi yo‘nalishda hamkorlik qiladilar: {{goods}}.' },
      { title: 'Muddat', text: 'Hamkorlik muddati: {{period}}.' },
      { title: 'Moliyaviy shartlar', text: '{{paymentMethod}}. Taxminiy qiymat: {{total}} so‘m.' },
      ...COMMON_TAIL,
    ],
  },
  SERVICE: {
    name: 'Xizmat ko‘rsatish shartnomasi',
    clauses: [
      { title: 'Predmet', text: '{{sellerName}} {{buyerName}}ga quyidagi xizmatlarni ko‘rsatadi: {{goods}}.' },
      { title: 'Muddat va narx', text: 'Muddat: {{period}}. Xizmat qiymati: {{total}} so‘m. To‘lov: {{paymentMethod}}.' },
      ...COMMON_TAIL,
    ],
  },
  PLATFORM_OFFER: {
    name: 'BozorNarx platformasi foydalanish oferta shartnomasi',
    clauses: [
      { title: 'Predmet', text: 'BozorNarx platformasi {{sellerName}} do‘koniga e’lon joylashtirish va savdo vositalaridan foydalanish huquqini beradi: {{goods}}.' },
      { title: 'To‘lov', text: 'Tarif haqi: {{total}} so‘m. {{paymentMethod}}.' },
      { title: 'Muddat', text: '{{period}}.' },
      ...COMMON_TAIL,
    ],
  },
};
