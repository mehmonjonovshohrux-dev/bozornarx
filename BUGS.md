# Known issues

## Fixed
- **Unverified-email re-registration overwrote the password hash** — FIXED. Registration now stores the new password/phone/name/role in `PendingRegistration`; the `users` row keeps an unusable random hash until the OTP is verified, and only then are the pending values applied (one transaction). A live code for an unverified email blocks a second registration (409 `REGISTRATION_IN_PROGRESS`, with `retryAfterSec`). Residual effect: the legitimate owner must wait up to the code lifetime (5 min) to restart, and an unverified account cannot log in with a password (it gets INVALID_CREDENTIALS rather than EMAIL_NOT_VERIFIED).

## Open
- **Compiled on 2026-11-16:** `prisma validate` OK, `tsc` (API) and `next build` (web, 29 pages) pass after fixing 2 schema mismatches. Still never RUN against a database or over HTTP: expect runtime bugs on first use.
- Initial migration generated with `prisma migrate diff` (apps/api/prisma/migrations/00000000000000_init); not yet applied to any database. Append-only triggers mentioned in schema.prisma are not in it.
- Phone OTP returns 503 (no SMS provider).
- Card payments return 503 PROVIDER_NOT_CONFIGURED; E-IMZO signing returns 503/501 (nothing is ever marked "signed" without a verified PKCS#7).
- Real-time events use an in-memory hub: one API instance only (see DECISIONS.md).
- Contract/act PDFs transliterate Uzbek letters to Latin-1 (no Unicode font embedded yet).
- `GET /moderation/stores` etc. are cheap but unpaginated at the DB level for `documents` includes; fine at MVP volume.
- Leftover junk in D:\Projects\bozor from an earlier failed copy: `.w`, `bozornarx.zip`, `bozornarx/` — delete by hand.
