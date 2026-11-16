// Runs Code.gs inside node:vm with stand-ins for the Apps Script services.
// Run: node --test apps/mail-script/mail-script.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SECRET = 's'.repeat(40);
const APP_URL = 'https://bozornarx-web.onrender.com';
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Code.gs'), 'utf8');

function load({ props = { MAIL_SECRET: SECRET, APP_URL }, quota = 100, sendError = null } = {}) {
  const sent = [];
  const cache = new Map();
  const sandbox = {
    Date,
    Math,
    JSON,
    String,
    Number,
    Object,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    Utilities: {
      computeHmacSha256Signature: (msg, key) => Array.from(createHmac('sha256', key).update(msg).digest()).map((b) => (b > 127 ? b - 256 : b)),
    },
    MailApp: {
      getRemainingDailyQuota: () => quota,
      sendEmail: (o) => {
        if (sendError) throw new Error(sendError);
        sent.push(o);
      },
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }),
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const call = (reqObj) => JSON.parse(sandbox.doPost({ postData: { contents: typeof reqObj === 'string' ? reqObj : JSON.stringify(reqObj) } }).text);
  return { call, sent, sandbox };
}

let n = 0;
function signed(message, { ts = Date.now(), nonce = `nonce-${++n}`, secret = SECRET } = {}) {
  const body = JSON.stringify(message);
  const sig = createHmac('sha256', secret).update(`${ts}.${nonce}.${body}`).digest('hex');
  return { ts, nonce, body, sig };
}

test('valid verification email is sent with code in subject, html and text', () => {
  const { call, sent } = load();
  const r = call(signed({ template: 'verify_email', to: 'ali@example.com', data: { name: 'Ali', code: '482913', expiresMin: 5 } }));
  assert.deepEqual(r, { ok: true });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'ali@example.com');
  assert.match(sent[0].subject, /482913/);
  assert.match(sent[0].htmlBody, /482913/);
  assert.match(sent[0].body, /482913/);
  assert.equal(sent[0].name, 'BozorNarx');
});

test('wrong secret is rejected and nothing is sent', () => {
  const { call, sent } = load();
  const r = call(signed({ template: 'verify_email', to: 'a@b.uz', data: { code: '123456' } }, { secret: 'x'.repeat(40) }));
  assert.deepEqual(r, { ok: false, code: 'INVALID_SIGNATURE' });
  assert.equal(sent.length, 0);
});

test('tampered body fails the signature', () => {
  const { call, sent } = load();
  const req = signed({ template: 'verify_email', to: 'a@b.uz', data: { code: '123456' } });
  req.body = req.body.replace('a@b.uz', 'evil@b.uz');
  assert.deepEqual(call(req), { ok: false, code: 'INVALID_SIGNATURE' });
  assert.equal(sent.length, 0);
});

test('old timestamp is rejected', () => {
  const { call } = load();
  const r = call(signed({ template: 'welcome', to: 'a@b.uz', data: {} }, { ts: Date.now() - 6 * 60 * 1000 }));
  assert.deepEqual(r, { ok: false, code: 'EXPIRED_TIMESTAMP' });
});

test('replaying the same signed request is rejected', () => {
  const { call, sent } = load();
  const req = signed({ template: 'welcome', to: 'a@b.uz', data: { name: 'Ali' } });
  assert.deepEqual(call(req), { ok: true });
  assert.deepEqual(call(req), { ok: false, code: 'REPLAY' });
  assert.equal(sent.length, 1);
});

test('unknown template, bad recipient and malformed code are refused', () => {
  const { call, sent } = load();
  assert.deepEqual(call(signed({ template: 'constructor', to: 'a@b.uz', data: {} })), { ok: false, code: 'UNKNOWN_TEMPLATE' });
  assert.deepEqual(call(signed({ template: 'welcome', to: 'not-an-email', data: {} })), { ok: false, code: 'BAD_REQUEST' });
  assert.deepEqual(call(signed({ template: 'welcome', to: 'a@b.uz,c@d.uz', data: {} })), { ok: false, code: 'BAD_REQUEST' });
  assert.deepEqual(call(signed({ template: 'verify_email', to: 'a@b.uz', data: { code: '12ab56' } })), { ok: false, code: 'BAD_REQUEST' });
  assert.equal(sent.length, 0);
});

test('garbage requests do not crash the endpoint', () => {
  const { call } = load();
  assert.deepEqual(call('not json'), { ok: false, code: 'BAD_REQUEST' });
  assert.deepEqual(call({ ts: 'x' }), { ok: false, code: 'BAD_REQUEST' });
});

test('missing configuration is reported, not hidden', () => {
  const { call } = load({ props: {} });
  assert.deepEqual(call(signed({ template: 'welcome', to: 'a@b.uz', data: {} })), { ok: false, code: 'NOT_CONFIGURED' });
  const weak = load({ props: { MAIL_SECRET: 'short', APP_URL } });
  assert.deepEqual(weak.call(signed({ template: 'welcome', to: 'a@b.uz', data: {} })), { ok: false, code: 'NOT_CONFIGURED' });
});

test('daily quota exhaustion is reported as QUOTA_EXCEEDED', () => {
  const a = load({ quota: 0 });
  assert.deepEqual(a.call(signed({ template: 'welcome', to: 'a@b.uz', data: {} })), { ok: false, code: 'QUOTA_EXCEEDED' });
  const b = load({ sendError: 'Service invoked too many times for one day: email.' });
  assert.deepEqual(b.call(signed({ template: 'welcome', to: 'a@b.uz', data: {} })), { ok: false, code: 'QUOTA_EXCEEDED' });
  const c = load({ sendError: 'boom' });
  assert.deepEqual(c.call(signed({ template: 'welcome', to: 'a@b.uz', data: {} })), { ok: false, code: 'SEND_FAILED' });
});

test('html in user-supplied values is escaped', () => {
  const { call, sent } = load();
  call(signed({ template: 'verify_email', to: 'a@b.uz', data: { name: '<script>alert(1)</script>', code: '123456' } }));
  assert.doesNotMatch(sent[0].htmlBody, /<script>/);
  assert.match(sent[0].htmlBody, /&lt;script&gt;/);
});

test('links outside our own site are replaced by the home page', () => {
  const { call, sent } = load();
  call(signed({ template: 'order', to: 'a@b.uz', data: { orderNumber: 'ORD-1', status: 'Yuborildi', url: 'https://evil.example/phish' } }));
  assert.doesNotMatch(sent[0].htmlBody, /evil\.example/);
  call(signed({ template: 'order', to: 'a@b.uz', data: { orderNumber: 'ORD-2', status: 'Yuborildi', url: `${APP_URL}/orders/2` } }));
  assert.match(sent[1].htmlBody, /bozornarx-web\.onrender\.com\/orders\/2/);
});

test('all eight templates render', () => {
  const { call, sent } = load();
  const cases = [
    ['verify_email', { code: '111111' }],
    ['welcome', { name: 'Ali' }],
    ['password_reset', { code: '222222' }],
    ['login_alert', { message: 'Ko‘p marta noto‘g‘ri parol kiritildi', when: '2026-11-16 10:00' }],
    ['new_device', { device: 'Chrome / Windows', ip: '1.2.3.4', when: '2026-11-16 10:00' }],
    ['contract', { contractNumber: 'BN-2026-00124', status: 'waiting', url: `${APP_URL}/c/1` }],
    ['order', { orderNumber: 'ORD-1', status: 'Tasdiqlandi', url: `${APP_URL}/o/1` }],
    ['price_alert', { product: 'Kartoshka', price: '7 900', unit: 'kg', target: '8 000', url: `${APP_URL}/p/1` }],
  ];
  for (const [template, data] of cases) assert.deepEqual(call(signed({ template, to: 'a@b.uz', data })), { ok: true }, template);
  assert.equal(sent.length, 8);
  for (const m of sent) {
    assert.ok(m.subject.length > 0 && m.htmlBody.startsWith('<!doctype html>') && m.body.length > 0);
    assert.match(m.htmlBody, /viewport/); // mobile friendly
    assert.match(m.htmlBody, /max-width:560px/);
  }
});
