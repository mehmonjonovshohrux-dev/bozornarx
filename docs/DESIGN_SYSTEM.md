# BozorNarx Design System (v2)

Bitta tizim: 5 rolning hammasida bir xil komponentlar. Dizayn artboardlari (Design artifactlar) ham, kod ham shu tokenlardan foydalanadi.

## Ranglar
| Token | Qiymat | Ishlatilishi |
|---|---|---|
| `brand-900/800/700` | #064e3b / #065f46 / #047857 | Sidebar, asosiy tugma, sarlavhalar |
| `brand-600/500` | #059669 / #10b981 | Havolalar, faol holat |
| `brand-100/50` | #d1fae5 / #ecfdf5 | Yumshoq fon, badge |
| `fresh-500` | #22c55e | Muvaffaqiyat, narx tushdi |
| `accent-500/600` | #f97316 / #ea580c | CTA (“Sotib olish”), diqqat |
| `cream-50/100/200/300` | #fffdf8 / #fbf7ee / #f3ecda / #e7e0cf | Sahifa foni, chegara |
| `ink` / `ink-soft` / `ink-muted` | #1f2937 / #4b5563 / #6b7280 | Matn |
| `warn` / `danger` | #d97706 / #dc2626 | Ogohlantirish / xato |
| Rol aksentlari | Guest #047857 · Buyer #059669 · Seller #ea580c · Moderator #6d5bd0 · Admin #0f172a→#047857 | Faqat rol belgisi va sidebar bezagi uchun |

## Tipografiya
Shrift: Inter → system-ui (`Segoe UI`, Roboto). Hajmlar: 12 (yordamchi) · 14 (matn, jadval) · 16 (asosiy, input — iOS zoom bo‘lmasligi uchun) · 18 · 22 · 28 · 36 (H1). Og‘irliklar: 500 / 600 / 700 / 800 (raqamlar). Raqamlar `tabular-nums`.

## Shakl va chuqurlik
Radius: 10 (input, badge) · 14 (tugma) · 20 (karta) · 28 (hero, modal). Soyalar: `card` = 0 1px 2px rgba(31,41,55,.05), 0 12px 32px -16px rgba(4,120,87,.22); `lift` (hover) = 0 20px 44px -18px rgba(4,120,87,.35). Chegara 1px cream-300. Fokus: 3px brand-400 halqa.

## Komponentlar (hamma rollarda bir xil)
Tugma (primary / accent / ghost / danger / icon) · Input / Select / Textarea / Switch / Segmented / Chip filtri · Karta · **Mahsulot kartasi** (SVG/foto, narx, hudud, trend badge, sevimli) · Status badge · Stat kartasi (raqam + delta + sparkline) · Jadval (desktop) → Karta ro‘yxati (mobile) · Tablar · Modal (desktop) → Bottom sheet (mobile) · Drawer · Toast · Skeleton · Empty / Error / Success holati · Timeline · Grafik (chiziq, ustun, donut) · Breadcrumb · Pagination.

## Navigatsiya
Desktop: chapda 264px sidebar (rolga xos bo‘limlar, guruhlangan), tepada qidiruv + bildirishnoma + profil. Mobile: pastki navigatsiya (4–5 asosiy bo‘lim + “Yana” sheet), sticky top bar, FAB faqat Seller (“Narx qo‘shish”).

## Holatlar (har bir sahifada)
Loading = skeleton (spinner emas) · Empty = illyustratsiya (SVG) + sabab + bitta amal · Success = toast + inline tasdiq · Error = sabab + “Qayta urinish” (API xato kodi ko‘rsatiladi, texnik tafsilot emas).

## Harakat
150–250ms ease-out; faqat transform/opacity; `prefers-reduced-motion` hurmat qilinadi.

## Rasmlar
Barcha mahsulot/kategoriya tasvirlari `apps/web/public/assets` (SVG illyustratsiya, bir uslub). Haqiqiy foto yuklansa, u doim ustun.
