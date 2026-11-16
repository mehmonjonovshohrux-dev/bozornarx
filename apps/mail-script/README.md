# BozorNarx email server (Google Apps Script)

Sends the 8 email templates (verify_email, welcome, password_reset, login_alert, new_device, contract, order, price_alert) from your Gmail account. The API signs every request with HMAC; the script rejects wrong signatures, old timestamps and replays.

## Setup (about 5 minutes)
1. Open https://script.google.com → **New project**. Paste the whole of `Code.gs`.
2. **Project Settings → Script Properties** → add:
   - `MAIL_SECRET` = a random string of at least 32 characters (`openssl rand -base64 48`)
   - `APP_URL` = your web address, e.g. `https://bozornarx-web.onrender.com`
   - `SENDER_NAME` = `BozorNarx` (optional), `REPLY_TO` (optional)
3. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Authorise the Gmail permission when asked. Copy the URL ending in `/exec`.
4. Put the URL in the API as `GAS_URL` and the same secret as `GAS_SECRET`.
5. After you edit Code.gs you must create a **new version** (Deploy → Manage deployments → Edit → New version), otherwise the old code keeps running.

## Limits
Gmail via Apps Script: about 100 recipients/day on a free Gmail account, 1,500 on Google Workspace. The script returns `QUOTA_EXCEEDED` instead of failing silently. For real traffic use a Workspace account or a transactional email provider.

## Troubleshooting
- API log `MAIL_BAD_RESPONSE`: the web app is not deployed with access “Anyone”, or the URL is wrong.
- `INVALID_SIGNATURE`: `GAS_SECRET` ≠ `MAIL_SECRET`. `EXPIRED_TIMESTAMP`: server clock off by more than 5 minutes.
- `NOT_CONFIGURED`: Script Properties missing.
- Mail in Spam: send a few mails to yourself first, mark “Not spam”.

Tests (no network): `node apps/mail-script/mail-script.test.mjs`
