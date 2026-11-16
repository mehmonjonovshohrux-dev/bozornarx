import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TEMPLATES, TemplateError, renderClauses, renderText } from './contract-templates.ts';

test('renders placeholders', () => {
  assert.equal(renderText('Salom {{name}}!', { name: 'Ali' }), 'Salom Ali!');
});

test('missing value fails loudly, naming every missing key', () => {
  assert.throws(() => renderText('{{a}} va {{b}}', { a: '1' }), (e: unknown) => e instanceof TemplateError && e.missing.join() === 'b');
  assert.throws(() => renderText('{{a}}', { a: '' }), TemplateError);
});

test('every default template renders with a full variable set and keeps no placeholder', () => {
  const vars = { sellerName: 'S', buyerName: 'B', goods: 'G', total: '1000', paymentMethod: 'Naqd', deliveryMethod: 'Olib ketish', deliveryAddress: 'Manzil', warrantyDays: '14', period: '1 yil', number: 'BN-1' };
  for (const [type, t] of Object.entries(DEFAULT_TEMPLATES)) {
    const out = renderClauses(t.clauses, vars);
    assert.ok(out.length >= 3, type);
    for (const c of out) assert.ok(!c.text.includes('{{'), `${type}:${c.title}`);
  }
});

test('every template contains the e-signature and dispute clauses', () => {
  for (const [type, t] of Object.entries(DEFAULT_TEMPLATES)) {
    const titles = t.clauses.map((c) => c.title);
    assert.ok(titles.includes('Elektron imzo'), type);
    assert.ok(titles.includes('Nizolarni hal qilish'), type);
  }
});
