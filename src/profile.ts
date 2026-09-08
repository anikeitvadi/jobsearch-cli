import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import { PRESETS, TitleSet } from './presets';
import { getDb } from './db/schema';

export interface Profile {
  name: string;
  sign_off: string;
  email: string;
  headline: string;
  side_line: string;
  city: string;
  proof_points: string[];
  target_titles: TitleSet;
  locations: string[];
  us_only: boolean;
  needs_sponsorship: boolean;
  sponsorship_line: string;
  years_experience: number | null;
  follow_up_days: number;
  created_at: string;
}

export const PROFILE_PATH = join(process.cwd(), 'data', 'profile.json');

export function profileExists(): boolean {
  return existsSync(PROFILE_PATH);
}

export function loadProfile(): Profile {
  if (!profileExists()) {
    throw new Error('No profile yet. Run `jobsearch init`.');
  }
  const raw = JSON.parse(readFileSync(PROFILE_PATH, 'utf-8')) as Partial<Profile>;
  // Fill any field a hand-edited file might be missing.
  return {
    name: raw.name ?? '',
    sign_off: raw.sign_off ?? (raw.name ?? '').split(' ')[0],
    email: raw.email ?? '',
    headline: raw.headline ?? '',
    side_line: raw.side_line ?? '',
    city: raw.city ?? '',
    proof_points: raw.proof_points ?? [],
    target_titles: raw.target_titles ?? { primary: [], secondary: [], tertiary: [] },
    locations: raw.locations ?? [],
    us_only: raw.us_only ?? true,
    needs_sponsorship: raw.needs_sponsorship ?? false,
    sponsorship_line: raw.sponsorship_line ?? '',
    years_experience: raw.years_experience ?? null,
    follow_up_days: raw.follow_up_days ?? 7,
    created_at: raw.created_at ?? new Date().toISOString(),
  };
}

export function saveProfile(profile: Profile): void {
  mkdirSync(dirname(PROFILE_PATH), { recursive: true });
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2) + '\n');
}

// ---------- prompt helpers ----------

/**
 * Line-buffered prompter. Works interactively and with piped stdin
 * (plain readline drops lines that arrive between questions).
 */
class Prompter {
  private rl: readline.Interface;
  private queue: string[] = [];
  private waiters: ((s: string) => void)[] = [];
  private closed = false;

  constructor() {
    this.rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY) });
    this.rl.on('line', (l) => {
      const w = this.waiters.shift();
      if (w) w(l);
      else this.queue.push(l);
    });
    this.rl.on('close', () => {
      this.closed = true;
      for (const w of this.waiters.splice(0)) w('');
    });
  }

  question(prompt: string): Promise<string> {
    this.rl.setPrompt(prompt);
    this.rl.prompt();
    if (this.queue.length) return Promise.resolve(this.queue.shift() as string);
    if (this.closed) return Promise.resolve('');
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  close(): void {
    this.rl.close();
  }
}

function splitList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ask(rl: Prompter, question: string, fallback = ''): Promise<string> {
  const suffix = fallback ? chalk.gray(` [${fallback}]`) : '';
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  return answer || fallback;
}

async function askYesNo(rl: Prompter, question: string, fallback: boolean): Promise<boolean> {
  const hint = fallback ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} ${chalk.gray(`(${hint})`)}: `)).trim().toLowerCase();
  if (!answer) return fallback;
  return answer.startsWith('y');
}

async function askList(rl: Prompter, question: string, fallback: string[]): Promise<string[]> {
  const shown = fallback.length ? chalk.gray(`\n  current: ${fallback.join(', ')}`) : '';
  const answer = (
    await rl.question(`${question}${shown}\n  ${chalk.gray('(comma-separated, Enter to keep)')}: `)
  ).trim();
  return answer ? splitList(answer) : fallback;
}

function section(title: string): void {
  console.log('\n' + chalk.bold.cyan(title));
}

// ---------- onboarding ----------

export async function runOnboarding(existing?: Profile): Promise<Profile> {
  const rl = new Prompter();
  const line = chalk.bold('━'.repeat(60));

  console.log('\n' + line);
  console.log(chalk.bold.cyan(' JOBSEARCH SETUP'));
  console.log(line);
  console.log(
    chalk.gray(
      'This builds data/profile.json. The scraper matches job titles against the\n' +
        'roles you enter, and the outreach drafts are written from your story.\n' +
        'Everything stays on your machine. Re-run `jobsearch init` any time.'
    )
  );

  try {
    // 1. Basics
    section('1. You');
    const name = await ask(rl, 'Full name', existing?.name ?? '');
    const signOff = await ask(rl, 'How you sign messages (short name)', existing?.sign_off || name.split(' ')[0]);
    const email = await ask(rl, 'Email (optional, stays local)', existing?.email ?? '');

    // 2. Titles
    section('2. Roles');
    PRESETS.forEach((p, i) => console.log(`  ${chalk.cyan(String(i + 1))}. ${p.label}`));
    const defaultPick = existing ? String(PRESETS.length) : '1';
    const pickRaw = await ask(rl, 'Pick a preset to start from', defaultPick);
    const pickIdx = Math.min(Math.max(parseInt(pickRaw, 10) || 1, 1), PRESETS.length) - 1;
    const preset = PRESETS[pickIdx];

    let titles: TitleSet = existing?.target_titles
      ? { ...existing.target_titles }
      : { ...preset.titles };
    if (existing && preset.key !== 'custom') titles = { ...preset.titles };

    console.log(chalk.gray('Primary titles score 1.0, secondary 0.6, tertiary 0.3. Matching is on the job title.'));
    titles.primary = await askList(rl, 'Primary titles (the seats you want most)', titles.primary);
    titles.secondary = await askList(rl, 'Secondary titles (close enough to look at)', titles.secondary);
    titles.tertiary = await askList(rl, 'Tertiary titles (only if nothing else)', titles.tertiary);
    if (titles.primary.length === 0) {
      console.log(chalk.yellow('You need at least one primary title. Using "Software Engineer".'));
      titles.primary = ['Software Engineer'];
    }

    // 3. Location
    section('3. Where');
    const locations = await askList(
      rl,
      'Preferred locations (cities or "Remote"; matches get flagged)',
      existing?.locations ?? ['Remote']
    );
    const usOnly = await askYesNo(rl, 'Only show US-based jobs by default?', existing?.us_only ?? true);
    const city = await ask(
      rl,
      'City you want to build in, for founder messages (optional, e.g. NYC)',
      existing?.city ?? ''
    );

    // 4. Sponsorship
    section('4. Visa');
    const needsSponsorship = await askYesNo(
      rl,
      'Do you need visa sponsorship? (if yes, companies flagged as not sponsoring are hidden)',
      existing?.needs_sponsorship ?? false
    );
    let sponsorshipLine = existing?.sponsorship_line ?? '';
    if (needsSponsorship) {
      sponsorshipLine = await ask(
        rl,
        'One calm sentence on your status, for recruiter notes',
        sponsorshipLine || 'I am already cap-counted on my H-1B, so this is a transfer, not a lottery petition.'
      );
    } else {
      sponsorshipLine = await ask(
        rl,
        'Line for recruiter notes (Enter to keep, or blank it with "-")',
        sponsorshipLine || 'No visa sponsorship needed.'
      );
      if (sponsorshipLine === '-') sponsorshipLine = '';
    }

    // 5. Story
    section('5. Your story (this is what the outreach drafts are built from)');
    console.log(
      chalk.gray(
        'Write these the way you would say them to a friend. Plain words, no titles from a resume.\n' +
          'Example headline: "3+ years leading enterprise implementations"\n' +
          'Example proof point: "Took over a stalled healthcare rollout as PM and got it to 10K runs a day at 100% uptime"'
      )
    );
    const headline = await ask(
      rl,
      'Headline: one clause on what you do (starts a sentence, no period)',
      existing?.headline ?? ''
    );
    const proofPoints: string[] = [];
    const prior = existing?.proof_points ?? [];
    for (let i = 0; i < 4; i++) {
      const fallback = prior[i] ?? '';
      const label = i === 0 ? 'Proof point 1 (one outcome, with a number in it)' : `Proof point ${i + 1} (Enter to stop)`;
      const answer = await ask(rl, label, fallback);
      if (!answer) break;
      proofPoints.push(answer.replace(/\.+$/, ''));
    }
    const sideLine = await ask(
      rl,
      'Side line: what you do outside the day job, if it helps (optional, e.g. "I build with AI on the side")',
      existing?.side_line ?? ''
    );

    // 6. Cadence
    section('6. Cadence');
    const yearsRaw = await ask(
      rl,
      'Years of experience (optional)',
      existing?.years_experience != null ? String(existing.years_experience) : ''
    );
    const years = yearsRaw ? parseFloat(yearsRaw) : null;
    const cadenceRaw = await ask(rl, 'Days before an application or a note needs a follow-up', String(existing?.follow_up_days ?? 7));
    const followUpDays = Math.max(parseInt(cadenceRaw, 10) || 7, 1);

    const profile: Profile = {
      name,
      sign_off: signOff,
      email,
      headline: headline.replace(/\.+$/, ''),
      side_line: sideLine.replace(/\.+$/, ''),
      city,
      proof_points: proofPoints,
      target_titles: titles,
      locations,
      us_only: usOnly,
      needs_sponsorship: needsSponsorship,
      sponsorship_line: sponsorshipLine,
      years_experience: years != null && Number.isFinite(years) ? years : null,
      follow_up_days: followUpDays,
      created_at: existing?.created_at ?? new Date().toISOString(),
    };

    saveProfile(profile);
    getDb(); // creates data/jobsearch.db and tables

    console.log('\n' + line);
    console.log(chalk.green.bold(` Saved ${PROFILE_PATH}`));
    console.log(line);
    printProfile(profile);
    console.log('\n' + chalk.bold('Next:'));
    console.log(`  ${chalk.cyan('jobsearch check')}                        scan every company in data/companies.json`);
    console.log(`  ${chalk.cyan('jobsearch apply <company> <role>')}       log an application`);
    console.log(`  ${chalk.cyan('jobsearch outreach <company> <role> --to "First Last"')}   draft the notes`);
    console.log(`  Read ${chalk.cyan('PLAYBOOK.md')} for the whole loop.\n`);

    return profile;
  } finally {
    rl.close();
  }
}

export function printProfile(p: Profile): void {
  const none = chalk.gray('none');
  console.log(`  Name:         ${p.name || none}  (signs as ${p.sign_off || none})`);
  console.log(`  Headline:     ${p.headline || none}`);
  console.log(`  Proof points: ${p.proof_points.length ? '' : none}`);
  p.proof_points.forEach((pp, i) => console.log(`    ${i + 1}. ${pp}`));
  console.log(`  Side line:    ${p.side_line || none}`);
  console.log(`  City:         ${p.city || none}`);
  console.log(`  Primary:      ${p.target_titles.primary.join(', ') || none}`);
  console.log(`  Secondary:    ${p.target_titles.secondary.join(', ') || none}`);
  console.log(`  Tertiary:     ${p.target_titles.tertiary.join(', ') || none}`);
  console.log(`  Locations:    ${p.locations.join(', ') || chalk.gray('any')}  (US only: ${p.us_only ? 'yes' : 'no'})`);
  console.log(`  Sponsorship:  ${p.needs_sponsorship ? 'needed' : 'not needed'}${p.sponsorship_line ? `  "${p.sponsorship_line}"` : ''}`);
  console.log(`  Experience:   ${p.years_experience != null ? `${p.years_experience} yrs` : none}`);
  console.log(`  Follow-ups:   every ${p.follow_up_days} days`);
}

/** Load the profile, or walk the user through onboarding if there is none. */
export async function ensureProfile(): Promise<Profile> {
  if (profileExists()) return loadProfile();
  console.log(chalk.yellow('\nNo profile found. Setting one up first.'));
  return runOnboarding();
}
