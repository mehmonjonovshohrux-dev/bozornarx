// Photo resolver. Real photos only (see lib/photos.ts). Returns null when nothing matches, so the UI shows a neutral placeholder
// (never a drawing). A seller's uploaded photo is handled in <ProductImage> and always wins.
import { CATEGORY_PHOTO_RULES, PHOTOS } from './photos';

const norm = (s: string) => s.toLowerCase().replace(/[ʻʼ‘’`']/g, '').replace(/\s+/g, ' ').trim();

// Order matters: first match wins. Value = key in PHOTOS (product name).
const PRODUCT_RULES: Array<[RegExp, string]> = [
  [/kartoshka/, 'Kartoshka'], [/piyoz/, 'Piyoz'], [/sabzi/, 'Sabzi'], [/pomidor/, 'Pomidor'], [/bodring/, 'Bodring'], [/olma|nok |behi/, 'Olma'],
  [/tovuq|parranda|broyler|kurka/, 'Tovuq go‘shti'], [/mol |qoy|goshti|gosht|kabob|qiyma/, 'Mol go‘shti'], [/tuxum/, 'Tuxum'],
  [/sut|qatiq|qaymoq|kefir|smetana/, 'Sut'], [/^un |^un$|bugdoy|\bun\b/, 'Un'], [/guruch|grechka|yorma|manka|nohat|mosh|loviya|dukkak/, 'Guruch'],
  [/yog$|\byog\b|moy|zaytun/, 'O‘simlik yog‘i'], [/shakar|qand|tuz/, 'Shakar'], [/non|patir|lavash|bulochka|somsa/, 'Non'],
];

export function productArt(name: string, category?: string | null): string | null {
  const n = norm(name) + ' ';
  for (const [re, k] of PRODUCT_RULES) if (re.test(n)) return PHOTOS[k] ?? null;
  return categoryArt(category);
}
export function categoryArt(category?: string | null): string | null {
  const raw = norm(category ?? ''); const c = raw.replace(/\s+/g, '-');
  for (const [re, k] of CATEGORY_PHOTO_RULES) if (re.test(c) || re.test(raw)) return PHOTOS[k] ?? null;
  return null;
}
