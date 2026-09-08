import { Profile } from './profile';

export type NoteKind = 'dm' | 'peer' | 'recruiter' | 'founder';

export interface NoteInput {
  profile: Profile;
  company: string;
  role: string;
  first: string;
  kind: NoteKind;
  /** One clause tying you to this company, e.g. "most of it API work between systems that disagree". */
  clause?: string;
  /** Peer notes only: one line of genuine curiosity about their path or the work. */
  curiosity?: string;
  /** "today", "this morning", "yesterday". */
  when?: string;
  /** Founder notes: the thing you're congratulating them on, e.g. "the Series C". */
  hook?: string;
  /** Which proof point to use (1-based). Defaults to the first. */
  proof?: number;
  /** Date you applied, for the follow-up message, e.g. "Sep 8". */
  appliedOn?: string;
}

export const LINKEDIN_NOTE_LIMIT = 300;

function lowerFirst(s: string): string {
  if (!s) return s;
  if (/^I(\s|'|$)/.test(s)) return s; // "I build..." stays capitalized
  return s[0].toLowerCase() + s.slice(1);
}
function upperFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
function clean(s: string | undefined): string {
  return (s ?? '').trim().replace(/\.+$/, '');
}

function proofPoint(profile: Profile, n?: number): string {
  const idx = Math.max((n ?? 1) - 1, 0);
  return clean(profile.proof_points[idx] ?? profile.proof_points[0] ?? '');
}

/** "{Headline}, {clause}, and {side line}." with whatever parts exist. */
function aboutSentence(profile: Profile, clause?: string, withSide = true): string {
  const head = upperFirst(clean(profile.headline));
  const cl = clean(clause);
  const side = withSide ? lowerFirst(clean(profile.side_line)) : '';
  const parts = [head, cl].filter(Boolean);
  if (parts.length === 0 && !side) return '';
  if (side) {
    if (parts.length === 0) return upperFirst(side) + '.';
    return `${parts.join(', ')}, and ${side}.`;
  }
  return parts.join(', ') + '.';
}

export function connectNote(i: NoteInput): string {
  const p = i.profile;
  const when = i.when ?? 'today';
  const opener = `Hi ${i.first}, I applied to ${i.company}'s ${i.role} role ${when}.`;
  const sign = p.sign_off || p.name.split(' ')[0];

  if (i.kind === 'peer') {
    const about = aboutSentence(p, undefined, true);
    const curiosity = clean(i.curiosity) || `Curious what the ${i.role} seat looks like day to day at ${i.company}`;
    return `${opener} ${about} ${curiosity}. Would love the chance to talk and learn more. ${sign}`.replace(/\s+/g, ' ');
  }

  if (i.kind === 'recruiter') {
    const about = aboutSentence(p, i.clause, true);
    const visa = clean(p.sponsorship_line);
    const visaSentence = visa ? `${visa}. ` : '';
    return `${opener} ${about} ${visaSentence}Would love the opportunity to bring value to the team. ${sign}`.replace(/\s+/g, ' ');
  }

  // dm (decision maker) and founder-as-connect-note
  const about = aboutSentence(p, i.clause, true);
  const congrats = i.kind === 'founder' && i.hook ? `congrats on ${clean(i.hook)}. ` : '';
  return `Hi ${i.first}, ${congrats}I applied to ${i.company}'s ${i.role} role ${when}. ${about} Would love the opportunity to bring value to the team. ${sign}`.replace(/\s+/g, ' ');
}

/** InMail or email to a founder / senior leader. Longer, one proof point, city close. */
export function founderMessage(i: NoteInput): string {
  const p = i.profile;
  const when = i.when ?? 'today';
  const sign = p.sign_off || p.name.split(' ')[0];
  const congrats = i.hook ? `congrats on ${clean(i.hook)}. ` : '';
  const head = lowerFirst(clean(p.headline));
  const proof = proofPoint(p, i.proof);
  const side = clean(p.side_line);
  const cl = clean(i.clause);

  const para1 = `Hi ${i.first}, ${congrats}I applied to the ${i.role} role ${when}.`.replace(/, I applied/, ', I applied');
  const bits: string[] = [];
  if (head) bits.push(`I've spent ${head}${cl ? `, ${cl}` : ''}.`);
  if (proof) bits.push(`The one I'm proudest of: ${lowerFirst(proof)}.`);
  if (side) bits.push(`${upperFirst(side)}.`);
  const para2 = bits.join(' ');
  const close = p.city
    ? `The dream is to be building with like-minded people in ${p.city}, would love the opportunity to add value.`
    : `Would love the opportunity to add value to the team.`;

  return [para1, para2, close, sign].filter(Boolean).join('\n\n');
}

/** After they accept the connect. One proof point, a favor-sized ask, an out. */
export function followUpAfterAccept(i: NoteInput): string {
  const p = i.profile;
  const when = i.appliedOn ? `on ${i.appliedOn}` : 'recently';
  const sign = p.sign_off || p.name.split(' ')[0];
  const proof = proofPoint(p, i.proof);
  const proofSentence = proof ? ` ${upperFirst(proof)}.` : '';
  return `Thanks for connecting, ${i.first}. Quick one: I applied to the ${i.role} role at ${i.company} ${when}.${proofSentence} If you're willing to point me to the right person or share what the team is looking for, I'd be grateful. No pressure either way. ${sign}`;
}

/** The warm hiring-manager message shape that converts to screens. Fill the two bracketed parts by hand. */
export function warmHiringManagerMessage(i: NoteInput): string {
  const p = i.profile;
  const sign = p.sign_off || p.name.split(' ')[0];
  const head = lowerFirst(clean(p.headline));
  const proofs = p.proof_points.slice(0, 3).map(clean).filter(Boolean);
  const side = clean(p.side_line);

  const para1 = `Hi ${i.first}, saw the ${i.role} role at ${i.company} and read the whole thing. The "[exact phrase from the posting that you actually reacted to]" part got me. [One sentence on why that phrase is true of you, with something real behind it.]`;
  const story = [
    head ? `Quick on me: ${head}.` : 'Quick on me:',
    ...proofs.map((pp) => `${upperFirst(pp)}.`),
    side ? `${upperFirst(side)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const para3 = `I'd love to learn more about the team and where I might fit. Happy to send my resume and grab time whenever works for you.`;
  return [para1, story, para3, sign].join('\n\n');
}

export function countInfo(text: string): { chars: number; over: boolean } {
  const chars = [...text].length;
  return { chars, over: chars > LINKEDIN_NOTE_LIMIT };
}

/** Try to get a note under the limit: drop the clause, then the side line. */
export function trimToLimit(i: NoteInput): { text: string; dropped: string[] } {
  const dropped: string[] = [];
  let text = connectNote(i);
  if (!countInfo(text).over) return { text, dropped };
  if (i.clause) {
    dropped.push('clause');
    text = connectNote({ ...i, clause: undefined });
    if (!countInfo(text).over) return { text, dropped };
  }
  if (i.profile.side_line) {
    dropped.push('side line');
    text = connectNote({ ...i, clause: undefined, profile: { ...i.profile, side_line: '' } });
  }
  return { text, dropped };
}
