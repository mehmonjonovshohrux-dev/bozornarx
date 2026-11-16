import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { toPdfText, wrapText } from '../domain/text';

export interface ContractBody {
  title: string;
  number: string;
  version: number;
  createdAt: string; // ISO
  parties: {
    buyer: { name: string; email: string; phone: string | null };
    seller: { store: string; owner: string; region: string };
  };
  lines: Array<{ name: string; quantity: number; unit: string; unitPrice: number; total: number }>;
  amounts: { subtotal: number; discount: number; delivery: number; total: number; currency: string };
  delivery: { method: string; address: string | null };
  payment: { method: string };
  warrantyDays: number;
  clauses: Array<{ title: string; text: string }>;
}

const GREEN = rgb(0.016, 0.47, 0.34);
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.42, 0.45, 0.5);
const money = (n: number) => n.toLocaleString('en-US').replace(/,/g, ' ');

class Writer {
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  constructor(readonly doc: PDFDocument, readonly font: PDFFont, readonly bold: PDFFont, private readonly footer: string) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([595, 842]);
    this.pageNo += 1;
    this.y = 800;
    this.page.drawText(toPdfText(this.footer), { x: 50, y: 24, size: 8, font: this.font, color: MUTED });
    this.page.drawText(`${this.pageNo}`, { x: 540, y: 24, size: 8, font: this.font, color: MUTED });
  }
  ensure(h: number) {
    if (this.y - h < 50) this.newPage();
  }
  text(s: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; gap?: number; width?: number } = {}) {
    const size = o.size ?? 10;
    const font = o.bold ? this.bold : this.font;
    const x = o.x ?? 50;
    const lines = wrapText(toPdfText(s), o.width ?? 495 - (x - 50), (t) => font.widthOfTextAtSize(t, size));
    for (const l of lines) {
      this.ensure(size + 4);
      this.page.drawText(l, { x, y: this.y, size, font, color: o.color ?? INK });
      this.y -= size + 4;
    }
    this.y -= o.gap ?? 0;
  }
  rule() {
    this.ensure(10);
    this.page.drawLine({ start: { x: 50, y: this.y }, end: { x: 545, y: this.y }, thickness: 0.6, color: rgb(0.85, 0.83, 0.78) });
    this.y -= 10;
  }
  row(cols: string[], xs: number[], bold = false) {
    this.ensure(16);
    const font = bold ? this.bold : this.font;
    cols.forEach((c, i) => this.page.drawText(toPdfText(c).slice(0, i === 0 ? 48 : 18), { x: xs[i]!, y: this.y, size: 9, font, color: INK }));
    this.y -= 15;
  }
}

async function start(footer: string) {
  const doc = await PDFDocument.create();
  const fixed = new Date('2000-01-01T00:00:00Z'); // keeps the bytes stable; the real time is inside the body text
  doc.setCreationDate(fixed);
  doc.setModificationDate(fixed);
  doc.setProducer('BozorNarx');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  return new Writer(doc, font, bold, footer);
}

/** The exact bytes of this PDF are hashed (SHA-256) and signed by both parties. Generate once per version and store the bytes. */
export async function buildContractPdf(b: ContractBody): Promise<Uint8Array> {
  const w = await start(`BozorNarx shartnoma ${b.number}  |  versiya ${b.version}`);
  w.text('BozorNarx', { size: 11, bold: true, color: GREEN });
  w.text(b.title, { size: 16, bold: true, gap: 2 });
  w.text(`Raqam: ${b.number}    Versiya: ${b.version}    Sana: ${b.createdAt.slice(0, 10)}`, { size: 9, color: MUTED, gap: 6 });
  w.rule();

  w.text('Tomonlar', { bold: true, size: 11 });
  w.text(`Sotuvchi: ${b.parties.seller.store} (${b.parties.seller.owner}), ${b.parties.seller.region}`);
  w.text(`Xaridor: ${b.parties.buyer.name}, ${b.parties.buyer.email}${b.parties.buyer.phone ? `, ${b.parties.buyer.phone}` : ''}`, { gap: 6 });

  if (b.lines.length) {
    w.text('Mahsulotlar', { bold: true, size: 11 });
    const xs = [50, 300, 370, 440];
    w.row(['Nomi', 'Miqdor', `Narx (${b.amounts.currency})`, 'Jami'], xs, true);
    for (const l of b.lines) w.row([l.name, `${l.quantity} ${l.unit}`, money(l.unitPrice), money(l.total)], xs);
    w.y -= 4;
    w.text(`Oraliq jami: ${money(b.amounts.subtotal)}   Chegirma: ${money(b.amounts.discount)}   Yetkazib berish: ${money(b.amounts.delivery)}`, { size: 9, color: MUTED });
    w.text(`UMUMIY SUMMA: ${money(b.amounts.total)} ${b.amounts.currency}`, { bold: true, size: 11, gap: 6 });
    w.rule();
  }

  b.clauses.forEach((c, i) => {
    w.text(`${i + 1}. ${c.title}`, { bold: true, size: 10.5 });
    w.text(c.text, { gap: 6 });
  });

  w.ensure(110);
  w.rule();
  w.text('Imzolar (E-IMZO elektron raqamli imzo)', { bold: true, size: 11, gap: 4 });
  w.text(`Sotuvchi: ${b.parties.seller.owner}  (${b.parties.seller.store})`);
  w.text('Imzo: E-IMZO orqali; imzo ma’lumotlari tizimda saqlanadi.', { size: 9, color: MUTED, gap: 6 });
  w.text(`Xaridor: ${b.parties.buyer.name}`);
  w.text('Imzo: E-IMZO orqali; imzo ma’lumotlari tizimda saqlanadi.', { size: 9, color: MUTED });
  return w.doc.save();
}

export interface DeliveryActData {
  number: string;
  orderNumber: string;
  seller: string;
  buyer: string;
  address: string | null;
  method: string;
  deliveredAt: string | null;
  acceptedAt: string | null;
  carrier: string | null;
  trackingRef: string | null;
  lines: Array<{ name: string; quantity: number; unit: string }>;
}

/** Delivery / acceptance act (dalolatnoma). It records platform events; it is NOT an E-IMZO signed document and says so. */
export async function buildDeliveryActPdf(a: DeliveryActData): Promise<Uint8Array> {
  const w = await start(`BozorNarx yetkazib berish dalolatnomasi ${a.number}`);
  w.text('BozorNarx', { size: 11, bold: true, color: GREEN });
  w.text('Yetkazib berish va qabul qilish dalolatnomasi', { size: 16, bold: true, gap: 2 });
  w.text(`Dalolatnoma: ${a.number}    Buyurtma: ${a.orderNumber}`, { size: 9, color: MUTED, gap: 6 });
  w.rule();
  w.text(`Sotuvchi: ${a.seller}`);
  w.text(`Xaridor: ${a.buyer}`);
  w.text(`Topshirish usuli: ${a.method}${a.address ? `, manzil: ${a.address}` : ''}`);
  if (a.carrier || a.trackingRef) w.text(`Yetkazuvchi: ${a.carrier ?? '-'}  Kuzatuv raqami: ${a.trackingRef ?? '-'}`);
  w.text(`Topshirilgan vaqt: ${a.deliveredAt ?? 'hali topshirilmagan'}`);
  w.text(`Xaridor qabul qilgan vaqt: ${a.acceptedAt ?? 'hali qabul qilinmagan'}`, { gap: 6 });
  w.text('Topshirilgan mahsulotlar', { bold: true, size: 11 });
  const xs = [50, 400];
  w.row(['Nomi', 'Miqdor'], xs, true);
  for (const l of a.lines) w.row([l.name, `${l.quantity} ${l.unit}`], xs);
  w.y -= 8;
  w.rule();
  w.text('Eslatma: bu hujjat BozorNarx platformasidagi tasdiqlangan amallar (sotuvchi topshirdi, xaridor hisobi orqali qabul qildi) asosida avtomatik tuzilgan elektron qaydnoma. U E-IMZO bilan imzolanmagan.', { size: 9, color: MUTED });
  return w.doc.save();
}
