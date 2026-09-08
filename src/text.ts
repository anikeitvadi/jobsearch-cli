/** Turn a job-board description (HTML, escaped HTML, or plain text) into readable lines. */
export function htmlToText(raw: string): string {
  if (!raw) return '';
  let s = raw;
  // Greenhouse returns HTML with entities escaped; unescape once, then strip tags.
  if (/&lt;\w/.test(s)) s = unescapeEntities(s);
  s = s
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, '');
  s = unescapeEntities(s);
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function unescapeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/g, '"')
    .replace(/&ndash;|&mdash;|&#8211;|&#8212;/g, '-')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

const QUAL_PATTERN =
  /(\b\d+\s*\+?\s*(?:years|yrs)\b|\byears? of\b|\brequired\b|\brequirements?\b|\bmust\b|\bminimum\b|\bqualifications?\b|\bexperience (?:with|in|building|leading|working)\b|\bproficien|\bfluen|\bdegree\b|\bbachelor|\bwe're looking for\b|\bwhat you'll need\b|\bwhat you bring\b|\bnice to have\b|\bbonus\b)/i;

/** Lines that read like qualifications or bars. */
export function qualificationLines(text: string, max = 18): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const l = line.replace(/^-\s*/, '').trim();
    if (l.length < 12 || l.length > 260) continue;
    if (!QUAL_PATTERN.test(l)) continue;
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
    if (out.length >= max) break;
  }
  return out;
}
