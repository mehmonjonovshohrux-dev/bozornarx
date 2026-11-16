# Known issues

## Fixed
- **Unverified-email re-registration overwrote the password hash** — FIXED. Registration now stores the new password/phone/name/role in `PendingRegistration`; the `users` row keeps an unusable random hash until the OTP is verified, and only then are the pending values applied (one transaction). A live code for an unverified email blocks a second registration (409 `REGISTRATION_IN_PROGRESS`, with `retryAfterSec`). Residual effect: the legitimate owner must wait up to the code lifetime (5 min) to restart, and an unverified account cannot log in with a password (it gets INVALID_CREDENTIALS rather than EMAIL_NOT_VERIFIED).

## Open
- **Nothing from apps/api (NestJS/Prisma) or apps/web (Next.js) has been compiled or run.** The build environment had no network, so `npm install`, `tsc`, `next build` and `prisma validate` have never executed. Verified instead: 56 pure-logic tests; syntax parse of all 74 API and 52 web files; every relative import and named export resolves; every Prisma delegate used in code exists; every relation has its back-relation; every permission used in `Secured(...)` exists. Expect a first round of type errors on your first build.
- No migrations generated (`prisma migrate dev --name init` must be run on a machine with Postgres; the container refuses to start without them).
- Phone OTP returns 503 (no SMS provider).
- Card payments return 503 PROVIDER_NOT_CONFIGURED; E-IMZO signing returns 503/501 (nothing is ever marked "signed" without a verified PKCS#7).
- Real-time events use an in-memory hub: one API instance only (see DECISIONS.md).
- Contract/act PDFs transliterate Uzbek letters to Latin-1 (no Unicode font embedded yet).
- `GET /moderation/stores` etc. are cheap but unpaginated at the DB level for `documents` includes; fine at MVP volume.
- Leftover junk in D:\Projects\bozor from an earlier failed copy: `.w`, `bozornarx.zip`, `bozornarx/` — delete by hand.
