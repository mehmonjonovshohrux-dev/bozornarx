# Architecture
```
Browser (Next.js PWA) ──/api/*──▶ Next rewrite ──▶ NestJS API ──▶ PostgreSQL (Prisma)
                                                    ├─ EventsHub (SSE) ─▶ chat / notifications
                                                    ├─ web-push (VAPID, optional)
                                                    ├─ Mail: Google Apps Script web app
                                                    └─ Adapters: EimzoService, PaymentProvider (not configured)
```
API modules (`apps/api/src`): `auth`, `users`, `audit`, `catalog` (public catalog, products, prices, trust, alerts), `trade` (stores, cart, orders, offers, payments), `contracts` (contracts, disputes, e-imzo adapter, PDF), `chat`, `buyer` (favorites, alerts, complaints, stats), `notifications`, `files`, `admin`, `analytics`, `maintenance`, `domain` (pure logic with tests: permissions, units, pricing, trust, state machines, templates, forecast, text).
Web (`apps/web/src/app`): public `/catalog`, `/catalog/[slug]`, `/stores/[slug]`, `/map`; buyer `/cart /orders /offers /favorites /alerts /contracts /disputes /chat /notifications`; seller `/seller/*`; moderator `/moderation`; admin `/admin`; shared `/dashboard`.
Main flow: product → offer (compare) → cart/offer → order → seller confirms → contract generated → both sign (E-IMZO) → delivery → buyer accepts → payment settled (cash confirmed by seller) → COMPLETED → review.
