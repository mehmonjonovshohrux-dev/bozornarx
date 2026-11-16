// Text helpers for PDF output. The standard PDF fonts only cover Latin-1, so Uzbek letters (oʻ, gʻ) and Cyrillic are
// transliterated. Embedding a Unicode font (Noto Sans) removes this limitation: see TASKS.md.

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: "'", ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', қ: 'q', ғ: "g'", ў: "o'", ҳ: 'h',
};

export function toPdfText(input: string): string {
  let out = '';
  for (const ch of input.normalize('NFC')) {
    const lower = ch.toLowerCase();
    if (CYR[lower] !== undefined) {
      const t = CYR[lower]!;
      out += ch !== lower && t.length ? t[0]!.toUpperCase() + t.slice(1) : t;
    } else if ('ʻʼ‘’`´'.includes(ch)) out += "'";
    else if ('“”«»'.includes(ch)) out += '"';
    else if ('–—−'.includes(ch)) out += '-';
    else if (ch === '\n' || ch === '\t') out += ch === '\t' ? ' ' : '\n';
    else if (ch.charCodeAt(0) <= 255) out += ch;
    else out += '?';
  }
  return out;
}

/** Greedy word wrap using a width function (so it works with any font metrics). */
export function wrapText(text: string, maxWidth: number, width: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (width(test) <= maxWidth || !line) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}
