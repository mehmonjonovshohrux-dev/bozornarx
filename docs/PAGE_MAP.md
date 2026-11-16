# Sahifalar xaritasi (PAGE_MAP)

Har bir sahifa desktop va mobile ko‘rinishda loyihalanadi. Belgilar: **✅** frontendda bor (qayta dizayn qilinadi) · **🆕** yangi sahifa (frontend + kerak bo‘lsa API qo‘shiladi) · **API** = backendda tayyor endpoint bor, **API+** = backendga qo‘shimcha kerak.
Har bir sahifada loading (skeleton), empty, success, error holatlari bor; modal/drawer/formalar sahifa qatorida ko‘rsatilgan.

## 1. Guest (kirmagan foydalanuvchi)
| # | Sahifa | Yo‘l | Holat | Asosiy amallar, modal/formalar |
|---|---|---|---|---|
| G1 | Bosh sahifa | `/` | ✅ qayta | Qidiruv, kategoriya kartalari, bugungi arzon narxlar, narx o‘zgarishlari, yaqin bozorlar, “Sotuvchi bo‘ling” CTA |
| G2 | Katalog | `/catalog` | ✅ | Qidiruv, ko‘p filtr (kategoriya, hudud, narx, mavjudlik, yetkazish, ishonch), saralash, filtr drawer (mobile) |
| G3 | Mahsulot | `/catalog/[slug]` | ✅ | Narx solishtirish jadvali, tarix grafigi, hududiy statistika (min/max/o‘rtacha/median), prognoz, “Kirish kerak” modal (buyurtma/sevimli/kuzatuv) |
| G4 | Do‘kon | `/stores/[slug]` | ✅ | Do‘kon profili, mahsulotlari, sharhlar, joylashuv |
| G5 | Xarita | `/map` | ✅ | Hudud filtri, do‘konlar xaritasi, hududiy statistika |
| G6 | Bozorlar | `/markets` | 🆕 API | Bozorlar ro‘yxati, hudud filtri, bozor kartasi |
| G7 | Narx harakati | `/movers` | 🆕 API | Eng ko‘p arzonlashgan/qimmatlashgan mahsulotlar, davr filtri |
| G8 | Sotuvchi bo‘lish | `/become-seller` | 🆕 | Afzalliklar, tariflar (`GET /plans`), qadamlar, ro‘yxatdan o‘tish CTA |
| G9 | Yordam | `/help` | 🆕 | FAQ, hujjat talablari, aloqa |
| G10 | Kirish | `/login` | ✅ | Email+parol, “eslab qolish”, xato (noto‘g‘ri parol, qulflangan), loading |
| G11 | Ro‘yxatdan o‘tish | `/register` | ✅ | Ism, email, telefon, parol (kuch ko‘rsatkichi), rol tanlash, shartlarga rozilik |
| G12 | Email tasdiqlash | `/register` (2-qadam) | ✅ | 6 xonali kod, qayta yuborish taymeri, muvaffaqiyat animatsiyasi |
| G13 | Parolni tiklash | `/forgot-password` | ✅ | Email → kod → yangi parol; success/error |
| G14 | Offline | `/offline` | ✅ | Qayta urinish |
| G15 | Splash / o‘rnatish | PWA | ✅ | Splash, “Ilovani o‘rnatish” taklifi |

## 2. Buyer (xaridor)
| # | Sahifa | Yo‘l | Holat | Asosiy amallar, modal/formalar |
|---|---|---|---|---|
| B1 | Dashboard | `/dashboard` | ✅ qayta | Statistika (`/buyer/me/stats`), kuzatilayotgan narxlar, faol buyurtmalar, kutayotgan shartnomalar, tavsiya |
| B2 | Katalog | `/catalog` | ✅ | G2 + sevimliga qo‘shish, savatga |
| B3 | Mahsulot | `/catalog/[slug]` | ✅ | G3 + Buyurtma/Taklif/Chat/Kuzatuv/Sevimli; modallar: buyurtma, taklif, narx kuzatuvi |
| B4 | Savat | `/cart` | ✅ | Do‘kon bo‘yicha guruh, miqdor, chegirma kodi; checkout modal (yetkazish/olib ketish, manzil, to‘lov usuli) |
| B5 | Buyurtmalar | `/orders` | ✅ | Holat filtri, qidiruv |
| B6 | Buyurtma | `/orders/[id]` | ✅ | Timeline, yetkazishni qabul qilish, to‘lov (naqd/karta 503 holati), sharh modali, nizo ochish modali, bekor qilish |
| B7 | Takliflar | `/offers` | ✅ | Qarshi taklifni qabul/rad |
| B8 | Sevimlilar | `/favorites` | ✅ | Ro‘yxat, olib tashlash |
| B9 | Narx kuzatuvi | `/alerts` | ✅ | Yangi ogohlantirish formasi, yoqish/o‘chirish |
| B10 | Shartnomalar | `/contracts` | ✅ | Holat tablari |
| B11 | Shartnoma | `/contracts/[id]` | ✅ | Shartlar, PDF, imzo modali (E-IMZO holati), versiyalar, bekor qilish |
| B12 | Nizolar | `/disputes`, `/disputes/[id]` | ✅ | Muzokara, dalil yuklash, apellyatsiya |
| B13 | Chat | `/chat`, `/chat/[id]` | ✅ | Suhbatlar, fayl/rasm, bloklash, o‘qilgan belgisi |
| B14 | Bildirishnomalar | `/notifications` | ✅ | Hammasini o‘qilgan, push yoqish |
| B15 | Profil va sozlamalar | `/settings` | 🆕 API+ | Profil, parol, qurilmalar (sessiyalar), bildirishnoma sozlamalari |
| B16 | Do‘kon / Xarita | G4, G5 | ✅ | Sharh yozish |

## 3. Seller (sotuvchi)
| # | Sahifa | Yo‘l | Holat | Asosiy amallar, modal/formalar |
|---|---|---|---|---|
| S1 | Dashboard | `/seller` | ✅ qayta | Savdo grafigi, yangi buyurtmalar, eskirgan narxlar, ombor ogohlantirishi, reyting |
| S2 | Do‘kon profili | `/seller/store` | 🆕 (hozir S1 ichida) | Do‘kon yaratish, hujjat yuklash, tasdiq holati |
| S3 | Mahsulotlar | `/seller/products` | ✅ | Mahsulot qo‘shish/tahrir drawer, rasm yuklash, variantlar |
| S4 | Narxlar | `/seller/prices` | ✅ | Narx qo‘shish/yangilash modali, tarix, eskirgan filtr, ulgurji pog‘onalar, dalil |
| S5 | Ombor | `/seller/stock` | 🆕 API | Qoldiq, harakatlar jurnali, to‘ldirish/tuzatish modali |
| S6 | Buyurtmalar | `/seller/orders` | ✅ | Holat tablari |
| S7 | Buyurtma | `/seller/orders/[id]` | 🆕 | Tasdiqlash/tayyor/yuborildi, yetkazish dalili, naqd to‘lovni qabul qilish |
| S8 | Takliflar | `/seller/offers` | ✅ | Qabul/rad/qarshi narx modali |
| S9 | Chegirmalar | `/seller/discounts` | ✅ | Kod yaratish formasi |
| S10 | Shartnomalar | `/contracts`, `/contracts/[id]` | ✅ | Shartlarni tahrirlash, yuborish, imzo |
| S11 | Nizolar | `/disputes` | ✅ | Javob, dalil |
| S12 | Chat | `/chat` | ✅ | — |
| S13 | Statistika | `/seller/analytics` | 🆕 API+ | Savdo davri, eng ko‘p sotilganlar, narx raqobati |
| S14 | Sharhlar | `/seller/reviews` | 🆕 API+ | Sharhlar ro‘yxati, reyting taqsimoti |
| S15 | Tarif | `/seller/plan` | 🆕 API | Joriy tarif, limit, tariflar |
| S16 | Bildirishnoma/Sozlamalar | `/notifications`, `/settings` | ✅/🆕 | — |

## 4. Moderator
| # | Sahifa | Yo‘l | Holat | Asosiy amallar, modal/formalar |
|---|---|---|---|---|
| M1 | Dashboard | `/moderation` | ✅ qayta | Navbat sonlari, bugungi ish, Hal qilinganlik % |
| M2 | Narxlar navbati | `/moderation/prices` | ✅ (tab) | Tasdiqlash/rad (sabab modali) |
| M3 | Shubhali narxlar | `/moderation/suspicious` | 🆕 API | Og‘ish %, dalil ko‘rish |
| M4 | Yangi mahsulotlar | `/moderation/products` | ✅ (tab) | Tasdiq/rad, kategoriya tuzatish |
| M5 | Do‘konlar va hujjatlar | `/moderation/stores` | ✅ (tab) | Hujjat ko‘rish, tasdiqlash/rad |
| M6 | Shikoyatlar | `/moderation/complaints` | ✅ (tab) | Detail drawer, qaror |
| M7 | Sharhlar | `/moderation/reviews` | ✅ (tab) | Tasdiq/rad |
| M8 | Nizolar | `/moderation/disputes` | ✅ | Dalillar, qaror modali |
| M9 | Shartnomalar | `/moderation/contracts` | ✅ (tab) | Ko‘rib chiqish |
| M10 | Qarorlar tarixi | `/moderation/history` | 🆕 API | Audit asosida |
| M11 | Mening hisobotim | `/moderation/stats` | 🆕 API | `/admin/moderator-stats` |
| M12 | Profil | `/settings` | 🆕 | — |

## 5. Super Admin
| # | Sahifa | Yo‘l | Holat | Asosiy amallar, modal/formalar |
|---|---|---|---|---|
| A1 | Dashboard | `/admin` | ✅ qayta | Global statistika, o‘sish grafigi, rol bo‘yicha taqsimot, so‘nggi voqealar |
| A2 | Foydalanuvchilar | `/admin/users`, `/admin/users/[id]` | ✅ (tab) | Qidiruv, bloklash, rol berish modali, sessiyalarni tugatish |
| A3 | Do‘konlar | `/admin/stores` | 🆕 API | Do‘kon holati, to‘xtatish |
| A4 | Moderatorlar | `/admin/moderators` | 🆕 | Moderator tayinlash, statistika |
| A5 | Kategoriyalar | `/admin/categories` | ✅ (tab) | Daraxt, qo‘shish/tahrir |
| A6 | Mahsulotlar | `/admin/products` | 🆕 API | Katalog boshqaruvi, birlashtirish |
| A7 | Narxlar | `/admin/prices` | 🆕 API | Barcha narxlar, rad etish |
| A8 | Hudud va bozorlar | `/admin/regions` | ✅ (tab) | Hudud/bozor qo‘shish |
| A9 | Buyurtmalar | `/admin/orders` | 🆕 API | Qidiruv, holatlar |
| A10 | Shartnomalar | `/admin/contracts` | 🆕 | Ro‘yxat, shablon versiyalari |
| A11 | To‘lovlar | `/admin/payments` | 🆕 API | To‘lovlar ro‘yxati (`GET /payments`) |
| A12 | Nizolar/apellyatsiya | `/admin/disputes` | 🆕 | Apellyatsiya qarori |
| A13 | Tariflar | `/admin/plans` | ✅ (tab) | Reja, obuna berish modali |
| A14 | Statistika | `/admin/stats` | ✅ (tab) | Davr, grafiklar |
| A15 | Audit log | `/admin/audit` | ✅ (tab) | Filtr, CSV eksport |
| A16 | Tizim sozlamalari | `/admin/settings` | ✅ (tab) | Sozlamalar ro‘yxati, tahrir |
| A17 | Rollar va ruxsatlar | `/admin/roles` | 🆕 API | Ruxsatlar matritsasi (faqat ko‘rish) |
| A18 | Integratsiyalar | `/admin/integrations` | 🆕 API | E-IMZO, to‘lov, SMS, email, push holati (haqiqiy, soxta emas) |

**Umumiy komponentlar (hamma rollar):** sidebar/mobile bottom nav, top bar (qidiruv, bildirishnoma, profil), kartalar, jadval/ro‘yxat, filtr paneli/drawer, modal, drawer, forma elementlari, toast, skeleton, empty state, error state, status badge, mahsulot kartasi (SVG rasm bilan), grafiklar.
