/**
 * BozorNarx email server (Google Apps Script Web App).
 *
 * The NestJS backend creates the OTP, stores only its hash, and POSTs a signed JSON request here.
 * This script only renders the HTML and sends it with MailApp. It never stores codes or emails.
 *
 * Script Properties (Project Settings > Script properties):
 *   MAIL_SECRET   required  long random string, same value as GAS_SECRET on Render
 *   APP_URL       required  public web address, e.g. https://bozornarx-web.onrender.com (links in emails must start with it)
 *   SENDER_NAME   optional  display name, default "BozorNarx"
 *   REPLY_TO      optional  reply-to address
 *
 * Request (POST, Content-Type application/json, HTTPS only):
 *   { "ts": 1760000000000, "nonce": "random-string", "body": "<JSON string>", "sig": "<hex HMAC-SHA256>" }
 *   sig = HMAC_SHA256(MAIL_SECRET, ts + "." + nonce + "." + body)
 *   body = JSON string of { "template": "verify_email", "to": "user@example.com", "data": { ... } }
 *
 * Response (always HTTP 200, Apps Script cannot set status codes):
 *   { "ok": true } or { "ok": false, "code": "INVALID_SIGNATURE" | "EXPIRED_TIMESTAMP" | "REPLAY" |
 *     "BAD_REQUEST" | "UNKNOWN_TEMPLATE" | "QUOTA_EXCEEDED" | "SEND_FAILED" | "NOT_CONFIGURED" }
 *
 * Nothing sensitive (codes, addresses, secret) is written to Logger.
 */

var MAX_SKEW_MS = 5 * 60 * 1000;
var NONCE_TTL_SECONDS = 15 * 60;
var BRAND = { green: '#047857', fresh: '#22c55e', orange: '#f97316', cream: '#fbf7ee', ink: '#1f2937', muted: '#6b7280' };

// ───────────── entry points ─────────────

function doPost(e) {
  try {
    return json_(handle_(e));
  } catch (err) {
    // Never echo error text: it could contain request data.
    return json_({ ok: false, code: 'SEND_FAILED' });
  }
}

function doGet() {
  return json_({ ok: true, service: 'bozornarx-mail' }); // health probe, reveals nothing else
}

function handle_(e) {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('MAIL_SECRET');
  var appUrl = props.getProperty('APP_URL');
  if (!secret || secret.length < 32 || !appUrl) return { ok: false, code: 'NOT_CONFIGURED' };

  var raw = e && e.postData && e.postData.contents;
  if (!raw) return { ok: false, code: 'BAD_REQUEST' };
  var req;
  try { req = JSON.parse(raw); } catch (x) { return { ok: false, code: 'BAD_REQUEST' }; }
  if (!req || typeof req.ts !== 'number' || typeof req.nonce !== 'string' || typeof req.body !== 'string' || typeof req.sig !== 'string') {
    return { ok: false, code: 'BAD_REQUEST' };
  }

  var expected = hmacHex_(secret, req.ts + '.' + req.nonce + '.' + req.body);
  if (!safeEqual_(expected, req.sig)) return { ok: false, code: 'INVALID_SIGNATURE' };
  if (Math.abs(Date.now() - req.ts) > MAX_SKEW_MS) return { ok: false, code: 'EXPIRED_TIMESTAMP' };

  var cache = CacheService.getScriptCache();
  var nonceKey = 'n:' + req.nonce.slice(0, 80);
  if (cache.get(nonceKey)) return { ok: false, code: 'REPLAY' };
  cache.put(nonceKey, '1', NONCE_TTL_SECONDS);

  var msg;
  try { msg = JSON.parse(req.body); } catch (x2) { return { ok: false, code: 'BAD_REQUEST' }; }
  if (!msg || typeof msg.to !== 'string' || !isEmail_(msg.to) || typeof msg.template !== 'string') {
    return { ok: false, code: 'BAD_REQUEST' };
  }

  var rendered;
  try {
    rendered = renderEmail_(msg.template, msg.data || {}, appUrl);
  } catch (err) {
    if (err && err.message === 'UNKNOWN_TEMPLATE') return { ok: false, code: 'UNKNOWN_TEMPLATE' };
    return { ok: false, code: 'BAD_REQUEST' };
  }

  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, code: 'QUOTA_EXCEEDED' };

  var options = {
    to: msg.to,
    subject: rendered.subject,
    htmlBody: rendered.html,
    body: rendered.text,
    name: props.getProperty('SENDER_NAME') || 'BozorNarx',
  };
  var replyTo = props.getProperty('REPLY_TO');
  if (replyTo) options.replyTo = replyTo;
  try {
    MailApp.sendEmail(options);
  } catch (err2) {
    var m = String(err2 && err2.message || '');
    if (/too many times|quota|limit exceeded/i.test(m)) return { ok: false, code: 'QUOTA_EXCEEDED' };
    return { ok: false, code: 'SEND_FAILED' };
  }
  return { ok: true };
}

// ───────────── helpers ─────────────

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function hmacHex_(key, message) {
  var bytes = Utilities.computeHmacSha256Signature(message, key);
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

// Constant-time comparison of two strings.
function safeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isEmail_(s) {
  return s.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(s);
}

function esc_(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function str_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function safeUrl_(url, appUrl) {
  var base = String(appUrl).replace(/\/+$/, '');
  var u = String(url || '');
  if (u.indexOf(base + '/') === 0 || u === base) return u;
  return base; // anything outside our own site falls back to the home page
}

function needCode_(data) {
  var code = String(data.code || '');
  if (!/^\d{6}$/.test(code)) throw new Error('BAD_REQUEST');
  return code;
}

// ───────────── layout ─────────────

function button_(label, url) {
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px"><tr><td align="center" bgcolor="' + BRAND.orange +
    '" style="border-radius:10px"><a href="' + esc_(url) + '" target="_blank" style="display:inline-block;padding:13px 26px;font:600 15px Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px">' +
    esc_(label) + '</a></td></tr></table>';
}

function codeBox_(code) {
  return '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto"><tr><td align="center" bgcolor="#ecfdf5" style="border:1px solid #a7f3d0;border-radius:12px;padding:14px 22px;font:700 34px/1 Consolas,Menlo,monospace;letter-spacing:10px;color:' + BRAND.green + '">' + esc_(code) + '</td></tr></table>';
}

function layout_(title, bodyHtml, preheader) {
  return '<!doctype html><html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>' + esc_(title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + BRAND.cream + '">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc_(preheader || title) + '</div>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="' + BRAND.cream + '"><tr><td align="center" style="padding:24px 12px">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e0cf">' +
    '<tr><td bgcolor="' + BRAND.green + '" style="padding:20px 28px;font:700 22px Arial,Helvetica,sans-serif;color:#ffffff">Bozor<span style="color:#fdba74">Narx</span></td></tr>' +
    '<tr><td style="padding:28px;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:' + BRAND.ink + '">' + bodyHtml + '</td></tr>' +
    '<tr><td style="padding:16px 28px;background:#f8f5ec;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:' + BRAND.muted + '">Bu xat avtomatik yuborilgan, unga javob bermang. Agar bu amalni siz qilmagan bo‘lsangiz, xatni e’tiborsiz qoldiring.<br>BozorNarx — mahalliy bozor narxlari, ishonchli savdo.</td></tr>' +
    '</table></td></tr></table></body></html>';
}

function p_(text) { return '<p style="margin:0 0 14px">' + text + '</p>'; }
function h_(text) { return '<h1 style="margin:0 0 14px;font:700 21px/1.3 Arial,Helvetica,sans-serif;color:' + BRAND.green + '">' + esc_(text) + '</h1>'; }

// ───────────── templates ─────────────
// Each returns { subject, html, text }. All dynamic values are escaped or validated.

var TEMPLATES = {
  verify_email: function (d) {
    var code = needCode_(d), name = str_(d.name, 80), min = Number(d.expiresMin) || 5;
    return {
      subject: 'BozorNarx: tasdiqlash kodi ' + code,
      html: layout_('Email tasdiqlash', h_('Emailingizni tasdiqlang') + p_('Salom' + (name ? ', ' + esc_(name) : '') + '! Ro‘yxatdan o‘tishni yakunlash uchun quyidagi kodni kiriting:') + codeBox_(code) + p_('Kod ' + min + ' daqiqa amal qiladi va faqat bir marta ishlaydi. Kodni hech kimga bermang.'), 'Tasdiqlash kodingiz: ' + code),
      text: 'BozorNarx tasdiqlash kodi: ' + code + '\nKod ' + min + ' daqiqa amal qiladi. Uni hech kimga bermang.',
    };
  },
  welcome: function (d, appUrl) {
    var name = str_(d.name, 80), url = safeUrl_(d.url, appUrl);
    return {
      subject: 'BozorNarx’ga xush kelibsiz',
      html: layout_('Xush kelibsiz', h_('Xush kelibsiz' + (name ? ', ' + name : '') + '!') + p_('Hisobingiz tasdiqlandi. Endi mahalliy bozor narxlarini kuzatishingiz, taqqoslashingiz va sotuvchilar bilan bog‘lanishingiz mumkin.') + button_('BozorNarx’ni ochish', url), 'Hisobingiz tayyor'),
      text: 'Xush kelibsiz! Hisobingiz tasdiqlandi: ' + url,
    };
  },
  password_reset: function (d) {
    var code = needCode_(d), name = str_(d.name, 80), min = Number(d.expiresMin) || 5;
    return {
      subject: 'BozorNarx: parolni tiklash kodi ' + code,
      html: layout_('Parolni tiklash', h_('Parolni tiklash') + p_((name ? esc_(name) + ', ' : '') + 'parolni tiklash uchun kodni kiriting:') + codeBox_(code) + p_('Kod ' + min + ' daqiqa amal qiladi. Agar parolni tiklashni siz so‘ramagan bo‘lsangiz, bu xatni e’tiborsiz qoldiring: parolingiz o‘zgarmaydi.'), 'Parolni tiklash kodi: ' + code),
      text: 'BozorNarx parolni tiklash kodi: ' + code + '\nKod ' + min + ' daqiqa amal qiladi.',
    };
  },
  login_alert: function (d) {
    var name = str_(d.name, 80), title = str_(d.title || 'Xavfsizlik ogohlantirishi', 120), msg = str_(d.message, 400), when = str_(d.when, 60);
    return {
      subject: 'BozorNarx: ' + title,
      html: layout_(title, h_(title) + p_((name ? esc_(name) + ', ' : '') + esc_(msg)) + (when ? p_('Vaqt: ' + esc_(when)) : '') + p_('Bu siz bo‘lmasangiz, parolingizni darhol o‘zgartiring.'), title),
      text: title + '\n' + msg + (when ? '\nVaqt: ' + when : ''),
    };
  },
  new_device: function (d) {
    var name = str_(d.name, 80), device = str_(d.device, 160), ip = str_(d.ip, 64), when = str_(d.when, 60);
    return {
      subject: 'BozorNarx: yangi qurilmadan kirish',
      html: layout_('Yangi qurilma', h_('Yangi qurilmadan kirildi') + p_((name ? esc_(name) + ', ' : '') + 'hisobingizga yangi qurilmadan kirildi.') +
        '<table role="presentation" cellspacing="0" cellpadding="6" border="0" style="margin:8px 0 14px;font:400 14px Arial,Helvetica,sans-serif"><tr><td style="color:' + BRAND.muted + '">Qurilma</td><td>' + esc_(device || 'noma’lum') + '</td></tr><tr><td style="color:' + BRAND.muted + '">IP</td><td>' + esc_(ip || 'noma’lum') + '</td></tr><tr><td style="color:' + BRAND.muted + '">Vaqt</td><td>' + esc_(when) + '</td></tr></table>' +
        p_('Bu siz bo‘lmasangiz, parolingizni o‘zgartiring va barcha seanslardan chiqing.'), 'Yangi qurilmadan kirildi'),
      text: 'Hisobingizga yangi qurilmadan kirildi.\nQurilma: ' + device + '\nIP: ' + ip + '\nVaqt: ' + when,
    };
  },
  contract: function (d, appUrl) {
    var name = str_(d.name, 80), num = str_(d.contractNumber, 40), url = safeUrl_(d.url, appUrl);
    var signed = d.status === 'signed';
    var title = signed ? 'Shartnoma imzolandi' : 'Shartnoma imzo kutmoqda';
    return {
      subject: 'BozorNarx: ' + title + ' №' + num,
      html: layout_(title, h_(title) + p_((name ? esc_(name) + ', ' : '') + 'shartnoma №' + esc_(num) + (signed ? ' ikkala tomon tomonidan imzolandi.' : ' sizning imzoingizni kutmoqda.')) + button_(signed ? 'Shartnomani ko‘rish' : 'Ko‘rib chiqish va imzolash', url), title + ' №' + num),
      text: title + ' №' + num + ': ' + url,
    };
  },
  order: function (d, appUrl) {
    var name = str_(d.name, 80), num = str_(d.orderNumber, 40), status = str_(d.status, 60), url = safeUrl_(d.url, appUrl);
    return {
      subject: 'BozorNarx: buyurtma №' + num,
      html: layout_('Buyurtma', h_('Buyurtma yangilandi') + p_((name ? esc_(name) + ', ' : '') + 'buyurtma №' + esc_(num) + ' holati: <b>' + esc_(status) + '</b>.') + button_('Buyurtmani ko‘rish', url), 'Buyurtma №' + num),
      text: 'Buyurtma №' + num + ' holati: ' + status + '\n' + url,
    };
  },
  price_alert: function (d, appUrl) {
    var name = str_(d.name, 80), product = str_(d.product, 120), price = str_(d.price, 30), unit = str_(d.unit, 20), target = str_(d.target, 30), url = safeUrl_(d.url, appUrl);
    return {
      subject: 'BozorNarx: ' + product + ' narxi ' + price + ' so‘m',
      html: layout_('Narx ogohlantirishi', h_('Narx siz kutgan darajaga yetdi') + p_((name ? esc_(name) + ', ' : '') + '<b>' + esc_(product) + '</b> narxi hozir <b>' + esc_(price) + ' so‘m/' + esc_(unit) + '</b>' + (target ? ' (maqsadingiz: ' + esc_(target) + ' so‘m)' : '') + '.') + button_('Narxlarni ko‘rish', url), product + ': ' + price + ' so‘m'),
      text: product + ' narxi: ' + price + ' so‘m/' + unit + '\n' + url,
    };
  },
};

function renderEmail_(template, data, appUrl) {
  if (!Object.prototype.hasOwnProperty.call(TEMPLATES, template)) throw new Error('UNKNOWN_TEMPLATE');
  return TEMPLATES[template](data, appUrl);
}
