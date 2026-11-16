import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toPdfText, wrapText } from './text.ts';

test('Uzbek apostrophes and Cyrillic become safe Latin', () => {
  assert.equal(toPdfText('Oʻzbekiston Gʻafur'), "O'zbekiston G'afur");
  assert.equal(toPdfText('Ўзбекистон Қўқон'), "O'zbekiston Qo'qon");
  assert.equal(toPdfText('Иван Шамсиев'), 'Ivan Shamsiev');
});

test('unsupported symbols never reach the PDF as raw code points', () => {
  assert.equal(toPdfText('Narx — 100 😀'), 'Narx - 100 ?');
});

test('wrapText breaks on width and keeps long words', () => {
  const w = (s: string) => s.length;
  assert.deepEqual(wrapText('aaa bbb ccc ddd', 7, w), ['aaa bbb', 'ccc ddd']);
  assert.deepEqual(wrapText('superlongword x', 4, w), ['superlongword', 'x']);
  assert.deepEqual(wrapText('a\nb', 10, w), ['a', 'b']);
});
