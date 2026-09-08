#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { getDb } from './db/schema';
import { fetchGreenhouseJobs } from './scrapers/greenhouse';
import { fetchLeverJobs } from './scrapers/lever';
import { fetchAshbyJobs } from './scrapers/ashby';
import { generateEmailGuesses, extractDomain } from './email/patterns';
import { htmlToText, qualificationLines } from './text';
import { Profile, ensureProfile, loadProfile, profileExists, runOnboarding, printProfile } from './profile';
import { TitleSet } from './presets';
import {
  NoteKind,
  connectNote,
  founderMessage,
  followUpAfterAccept,
  warmHiringManagerMessage,
  countInfo,
  trimToLimit,
  LINKEDIN_NOTE_LIMIT,
} from './outreach';

// ---------- companies ----------

interface Company {
  name: string;
  category?: string;
  h1b_friendly?: boolean;
  greenhouse_id?: string;
  lever_id?: string;
  ashby_id?: string;
  email_pattern?: string;
  domain?: string;
}

const companiesPath = join(process.cwd(), 'data', 'companies.json');

function loadCompanies(): Company[] {
  const data = JSON.parse(readFileSync(companiesPath, 'utf-8'));
  return data.companies as Company[];
}
function saveCompanies(companies: Company[]): void {
  writeFileSync(companiesPath, JSON.stringify({ companies }, null, 2) + '\n');
}
function findCompany(companies: Company[], name: string): Company | undefined {
  const n = name.toLowerCase();
  return companies.find((c) => c.name.toLowerCase() === n) ?? companies.find((c) => c.name.toLowerCase().includes(n));
}

// ---------- matching ----------

const US_PATTERN =
  /\b(United States|USA|US|U\.S\.|Remote|California|Texas|New York|Washington|Colorado|Georgia|Massachusetts|Illinois|Arizona|Florida|Oregon|Virginia|North Carolina|Ohio|Pennsylvania|Michigan|New Jersey|Minnesota|Maryland|Tennessee|Indiana|Missouri|Wisconsin|Connecticut|Utah|Nevada|Arkansas|Iowa|Kansas|Kentucky|Louisiana|Oklahoma|Alabama|Nebraska|Hawaii|Maine|New Hampshire|Rhode Island|Montana|Delaware|South Dakota|North Dakota|Alaska|Vermont|Wyoming|DC|CA|TX|NY|WA|CO|GA|MA|IL|AZ|FL|OR|VA|NC|OH|PA|MI|NJ|MN|MD|TN|IN|MO|WI|CT|UT|NV|AR|IA|KS|KY|LA|OK|AL|NE|HI|ME|NH|RI|MT|DE|SD|ND|AK|VT|WY|San Francisco|New York City|NYC|Seattle|Austin|Denver|Atlanta|Boston|Chicago|Los Angeles|Dallas|Houston|Portland|Raleigh|Charlotte|Miami|Phoenix|San Diego|San Jose|Palo Alto|Mountain View|Sunnyvale|Menlo Park|Redmond|Bellevue)\b/i;

function isUsLocation(location: string): boolean {
  return US_PATTERN.test(location);
}

function titleRegex(keyword: string): RegExp {
  return new RegExp(keyword.trim().replace(/\s+/g, '\\s*'), 'i');
}

function scoreTitle(title: string, titles: TitleSet): number {
  if (titles.primary.some((k) => titleRegex(k).test(title))) return 1.0;
  if (titles.secondary.some((k) => titleRegex(k).test(title))) return 0.6;
  if (titles.tertiary.some((k) => titleRegex(k).test(title))) return 0.3;
  return 0;
}

function matchesPreferredLocation(location: string, preferred: string[]): boolean {
  const loc = location.toLowerCase();
  return preferred.some((p) => loc.includes(p.toLowerCase()));
}

interface NormalizedJob {
  external_id: string;
  title: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
}

async function fetchAllBoards(company: Company): Promise<{ source: string; jobs: NormalizedJob[] }[]> {
  const out: { source: string; jobs: NormalizedJob[] }[] = [];
  if (company.greenhouse_id) {
    try {
      const jobs = await fetchGreenhouseJobs(company.greenhouse_id);
      out.push({
        source: 'Greenhouse',
        jobs: jobs.map((j) => ({
          external_id: String(j.id),
          title: j.title,
          location: j.location?.name || 'Unknown',
          url: j.absolute_url,
          description: j.content || '',
          posted_at: j.updated_at,
        })),
      });
    } catch {
      /* board unreachable, skip */
    }
  }
  if (company.lever_id) {
    try {
      const jobs = await fetchLeverJobs(company.lever_id);
      out.push({
        source: 'Lever',
        jobs: jobs.map((j) => ({
          external_id: j.id,
          title: j.text,
          location: j.categories?.location || 'Unknown',
          url: j.hostedUrl,
          description: j.descriptionPlain || '',
          posted_at: new Date(j.createdAt).toISOString(),
        })),
      });
    } catch {
      /* skip */
    }
  }
  if (company.ashby_id) {
    try {
      const jobs = await fetchAshbyJobs(company.ashby_id);
      out.push({
        source: 'Ashby',
        jobs: jobs.map((j) => ({
          external_id: j.id,
          title: j.title,
          location: j.location || 'Unknown',
          url: j.jobUrl,
          description: j.descriptionPlain || '',
          posted_at: j.updatedAt || new Date().toISOString(),
        })),
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

const line = chalk.bold('━'.repeat(60));
function header(text: string): void {
  console.log('\n' + line);
  console.log(chalk.bold(` ${text}`));
  console.log(line + '\n');
}

// ---------- program ----------

// Piping into `head` closes stdout early; exit quietly instead of crashing.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

const program = new Command();

program
  .name('jobsearch')
  .description('Job search CLI: scrapes Greenhouse, Lever, and Ashby for the roles in your profile and tracks your pipeline')
  .version('1.1.0');

// First run of any command (except init) walks through onboarding.
program.hook('preAction', async (_thisCommand, actionCommand) => {
  if (actionCommand.name() === 'init') return;
  if (!profileExists()) await ensureProfile();
});

// ---------- init / profile ----------

program
  .command('init')
  .description('Create or update your profile (roles, locations, your story for outreach)')
  .action(async () => {
    const existing = profileExists() ? loadProfile() : undefined;
    if (existing) console.log(chalk.gray('Existing profile found. Enter keeps the current value.'));
    await runOnboarding(existing);
  });

program
  .command('profile')
  .description('Show your profile')
  .action(() => {
    header('PROFILE');
    printProfile(loadProfile());
    console.log(chalk.gray('\nEdit data/profile.json directly or run `jobsearch init`.'));
  });

// ---------- check ----------

program
  .command('check')
  .description('Find new postings at every tracked company that match your titles')
  .option('-c, --company <name>', 'Check one company only')
  .option('-l, --limit <number>', 'Max results to print', '25')
  .option('--us-only', 'Only US-based jobs (default from profile)')
  .option('--anywhere', 'Include non-US jobs')
  .option('--all', 'Include companies flagged as not sponsoring, even if you need sponsorship')
  .action(async (options) => {
    const profile = loadProfile();
    const companies = loadCompanies();
    const db = getDb();
    const usOnly = options.anywhere ? false : options.usOnly ? true : profile.us_only;

    let targets = options.company
      ? companies.filter((c) => c.name.toLowerCase().includes(String(options.company).toLowerCase()))
      : companies;
    let skippedForSponsorship = 0;
    if (profile.needs_sponsorship && !options.all) {
      const before = targets.length;
      targets = targets.filter((c) => c.h1b_friendly !== false);
      skippedForSponsorship = before - targets.length;
    }
    if (targets.length === 0) {
      console.log(chalk.red('No matching companies. See `jobsearch companies`.'));
      return;
    }

    const spinner = ora('Checking job boards...').start();
    const insert = db.prepare(
      `INSERT INTO jobs (external_id, company, title, location, url, description, posted_at, match_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const seen = db.prepare('SELECT id FROM jobs WHERE company = ? AND external_id = ?');

    const newJobs: { company: string; title: string; location: string; url: string; score: number; source: string; preferred: boolean }[] = [];

    for (const company of targets) {
      spinner.text = `Checking ${company.name}...`;
      const boards = await fetchAllBoards(company);
      for (const { source, jobs } of boards) {
        for (const job of jobs) {
          const score = scoreTitle(job.title, profile.target_titles);
          if (score <= 0) continue;
          if (usOnly && !isUsLocation(job.location)) continue;
          if (seen.get(company.name, job.external_id)) continue;
          insert.run(job.external_id, company.name, job.title, job.location, job.url, job.description, job.posted_at, score);
          newJobs.push({
            company: company.name,
            title: job.title,
            location: job.location,
            url: job.url,
            score,
            source,
            preferred: matchesPreferredLocation(job.location, profile.locations),
          });
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    spinner.stop();

    header(newJobs.length === 0 ? 'No new jobs found' : `${newJobs.length} NEW JOBS FOUND`);
    const sorted = newJobs
      .sort((a, b) => b.score - a.score || Number(b.preferred) - Number(a.preferred))
      .slice(0, parseInt(options.limit, 10));

    sorted.forEach((job, i) => {
      const scoreColor = job.score >= 0.9 ? chalk.green : job.score >= 0.5 ? chalk.yellow : chalk.gray;
      const pin = job.preferred ? chalk.green(' ◆ preferred location') : '';
      console.log(chalk.bold(`${i + 1}. ${job.title}`) + ` — ${chalk.cyan(job.company)} ${chalk.gray(`(${job.source})`)}`);
      console.log(`   ${chalk.gray(job.location)}${pin} | ${scoreColor(`score ${job.score}`)}`);
      console.log(`   ${chalk.blue(job.url)}\n`);
    });

    const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
    console.log(chalk.gray(`Total jobs tracked: ${total.count}. Everything stored: \`jobsearch jobs\`. Read one: \`jobsearch show <id>\`.`));
    if (skippedForSponsorship > 0) {
      console.log(chalk.gray(`Skipped ${skippedForSponsorship} companies flagged as not sponsoring (use --all to include).`));
    }
  });

// ---------- companies ----------

program
  .command('companies')
  .description('List tracked companies')
  .option('-c, --category <category>', 'Filter by category')
  .action((options) => {
    const companies = loadCompanies();
    const filtered = options.category
      ? companies.filter((c) => (c.category ?? '').toLowerCase() === String(options.category).toLowerCase())
      : companies;
    header(`${filtered.length} TRACKED COMPANIES`);
    const categories = [...new Set(filtered.map((c) => c.category ?? 'Uncategorized'))].sort();
    for (const category of categories) {
      const list = filtered.filter((c) => (c.category ?? 'Uncategorized') === category);
      console.log(chalk.bold.cyan(`${category} (${list.length})`));
      for (const c of list) {
        const board = c.greenhouse_id ? 'GH' : c.lever_id ? 'LV' : c.ashby_id ? 'AS' : '--';
        const sponsor = c.h1b_friendly === false ? chalk.red(' no sponsorship') : '';
        console.log(`  ${chalk.green(board)} ${c.name}${sponsor}`);
      }
      console.log();
    }
    console.log(chalk.gray('GH = Greenhouse, LV = Lever, AS = Ashby, -- = no board id (add one with `jobsearch add-company`)'));
  });

program
  .command('add-company <name>')
  .description('Track a new company. Find the board id in the careers URL (boards.greenhouse.io/<id>, jobs.lever.co/<id>, jobs.ashbyhq.com/<id>)')
  .option('--greenhouse <id>', 'Greenhouse board id')
  .option('--lever <id>', 'Lever board id')
  .option('--ashby <id>', 'Ashby board id')
  .option('--category <category>', 'Category label', 'Uncategorized')
  .option('--no-sponsor', 'Flag as not sponsoring visas')
  .option('--email-pattern <pattern>', 'e.g. first.last, first, flast')
  .action((name, options) => {
    const companies = loadCompanies();
    if (companies.some((c) => c.name.toLowerCase() === String(name).toLowerCase())) {
      console.log(chalk.yellow(`${name} is already tracked.`));
      return;
    }
    if (!options.greenhouse && !options.lever && !options.ashby) {
      console.log(chalk.red('Give at least one board id: --greenhouse, --lever, or --ashby.'));
      return;
    }
    const company: Company = { name, category: options.category, h1b_friendly: options.sponsor !== false };
    if (options.greenhouse) company.greenhouse_id = options.greenhouse;
    if (options.lever) company.lever_id = options.lever;
    if (options.ashby) company.ashby_id = options.ashby;
    if (options.emailPattern) company.email_pattern = options.emailPattern;
    companies.push(company);
    saveCompanies(companies);
    console.log(chalk.green(`✓ Added ${name}. Run \`jobsearch check -c "${name}"\`.`));
  });

// ---------- research / contact ----------

program
  .command('research <company>')
  .description('Company card: board links, email pattern, open matches, people-search links')
  .action((companyName) => {
    const profile = loadProfile();
    const companies = loadCompanies();
    const company = findCompany(companies, companyName);
    if (!company) {
      console.log(chalk.red(`"${companyName}" is not tracked. Add it with \`jobsearch add-company\`.`));
      return;
    }
    header(company.name);
    console.log(chalk.bold('Category:   '), company.category ?? 'Unknown');
    console.log(chalk.bold('Sponsorship:'), company.h1b_friendly === false ? chalk.red('flagged no') : chalk.green('not flagged'));
    if (company.greenhouse_id) console.log(chalk.bold('Board:      '), chalk.blue(`https://boards.greenhouse.io/${company.greenhouse_id}`));
    if (company.lever_id) console.log(chalk.bold('Board:      '), chalk.blue(`https://jobs.lever.co/${company.lever_id}`));
    if (company.ashby_id) console.log(chalk.bold('Board:      '), chalk.blue(`https://jobs.ashbyhq.com/${company.ashby_id}`));

    console.log('\n' + chalk.bold.underline('Email pattern'));
    console.log(chalk.gray(company.email_pattern || 'Unknown (guesses below are ranked by common patterns)'));
    const domain = extractDomain(company as any);
    if (domain) {
      const guesses = generateEmailGuesses('Jane', 'Doe', domain, company.email_pattern);
      console.log(chalk.gray('For "Jane Doe":'));
      guesses.slice(0, 3).forEach((g) => console.log(`  ${g.email} (${Math.round(g.confidence * 100)}%)`));
    }

    const db = getDb();
    const open = db
      .prepare(`SELECT title, location, url, match_score FROM jobs WHERE company = ? AND status = 'new' ORDER BY match_score DESC LIMIT 5`)
      .all(company.name) as { title: string; location: string; url: string; match_score: number }[];
    if (open.length) {
      console.log('\n' + chalk.bold.underline('Open matches'));
      open.forEach((j) => {
        console.log(`  • ${j.title} (${j.location})`);
        console.log(`    ${chalk.blue(j.url)}`);
      });
    }

    const primary = profile.target_titles.primary[0] ?? 'engineer';
    console.log('\n' + chalk.bold.underline('People to find (verify the title on their profile before you message)'));
    const li = (q: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
    console.log(`  Hiring-manager tier: ${chalk.blue(li(`${company.name} "Head of"`))}`);
    console.log(`  Peers in the seat:   ${chalk.blue(li(`${company.name} "${primary}"`))}`);
    console.log(`  Recruiters:          ${chalk.blue(li(`${company.name} recruiter`))}`);
  });

program
  .command('contact <fullName> <company>')
  .description('Email guesses for a person at a company')
  .action((fullName, companyName) => {
    const companies = loadCompanies();
    const company = findCompany(companies, companyName);
    if (!company) {
      console.log(chalk.red(`"${companyName}" is not tracked.`));
      return;
    }
    const parts = String(fullName).split(' ');
    if (parts.length < 2) {
      console.log(chalk.red('Give a full name: "First Last"'));
      return;
    }
    const domain = extractDomain(company as any);
    if (!domain) {
      console.log(chalk.red('No email domain known for this company. Add "domain" to it in data/companies.json.'));
      return;
    }
    header(`Email guesses for ${fullName} @ ${company.name}`);
    for (const g of generateEmailGuesses(parts[0], parts.slice(1).join(' '), domain, company.email_pattern)) {
      const color = g.confidence >= 0.7 ? chalk.green : g.confidence >= 0.4 ? chalk.yellow : chalk.gray;
      console.log(`  ${g.email}  ${color(`[${Math.round(g.confidence * 100)}%]`)}`);
    }
    console.log(chalk.gray('\nVerify on LinkedIn before sending. A guessed email is a guess.'));
  });

// ---------- stored jobs ----------

interface JobRow {
  id: number;
  company: string;
  title: string;
  location: string;
  url: string;
  description: string;
  posted_at: string;
  discovered_at: string;
  match_score: number;
  status: string;
}

program
  .command('jobs')
  .description('Stored matches from every check, best first (ids feed show / skip / apply --job)')
  .option('-c, --company <name>', 'One company')
  .option('-l, --limit <number>', 'Max rows', '30')
  .option('-m, --min-score <score>', 'Minimum score (1.0 primary, 0.6 secondary, 0.3 tertiary)', '0.3')
  .option('--all', 'Include skipped and applied')
  .option('--anywhere', 'Include non-US locations')
  .action((options) => {
    const profile = loadProfile();
    const db = getDb();
    const where: string[] = ['match_score >= ?'];
    const params: (string | number)[] = [parseFloat(options.minScore)];
    if (!options.all) where.push("status = 'new'");
    if (options.company) {
      where.push('company LIKE ?');
      params.push(`%${options.company}%`);
    }
    const rows = db
      .prepare(`SELECT * FROM jobs WHERE ${where.join(' AND ')} ORDER BY match_score DESC, discovered_at DESC`)
      .all(...params) as JobRow[];
    const usOnly = options.anywhere ? false : profile.us_only;
    const filtered = rows.filter((r) => !usOnly || isUsLocation(r.location || ''));
    const shown = filtered.slice(0, parseInt(options.limit, 10));

    header(`${filtered.length} STORED MATCHES${options.all ? '' : ' (unapplied)'}`);
    if (!shown.length) {
      console.log(chalk.gray('Nothing stored yet. Run `jobsearch check`.'));
      return;
    }
    for (const r of shown) {
      const scoreColor = r.match_score >= 0.9 ? chalk.green : r.match_score >= 0.5 ? chalk.yellow : chalk.gray;
      const pin = matchesPreferredLocation(r.location || '', profile.locations) ? chalk.green(' ◆') : '';
      const st = r.status === 'new' ? '' : chalk.gray(` [${r.status}]`);
      console.log(`${chalk.gray(String(r.id).padStart(5))}  ${chalk.bold(r.title)} — ${chalk.cyan(r.company)}${st}`);
      console.log(`       ${chalk.gray(r.location || 'Unknown')}${pin}  ${scoreColor(String(r.match_score))}  ${chalk.blue(r.url)}`);
    }
    if (filtered.length > shown.length) console.log(chalk.gray(`\n...and ${filtered.length - shown.length} more (-l to show more).`));
    console.log(chalk.gray('\nshow <id> to read one · skip <id> to drop it · apply --job <id> when you submit'));
  });

program
  .command('show <id>')
  .description('Read a stored posting and pull out the qualification lines')
  .option('--full', 'Print the whole description')
  .action((id, options) => {
    const db = getDb();
    const r = db.prepare('SELECT * FROM jobs WHERE id = ?').get(parseInt(id, 10)) as JobRow | undefined;
    if (!r) {
      console.log(chalk.red(`No job with id ${id}. See \`jobsearch jobs\`.`));
      return;
    }
    header(`${r.title} — ${r.company}`);
    console.log(`${chalk.gray('location')}  ${r.location || 'Unknown'}`);
    console.log(`${chalk.gray('score')}     ${r.match_score}   ${chalk.gray('status')} ${r.status}`);
    console.log(`${chalk.gray('posted')}    ${r.posted_at ? new Date(r.posted_at).toLocaleDateString() : 'unknown'}`);
    console.log(`${chalk.gray('url')}       ${chalk.blue(r.url)}`);

    const text = htmlToText(r.description || '');
    if (!text) {
      console.log(chalk.yellow('\nNo description stored for this board. Open the URL and read it there.'));
      return;
    }
    const quals = qualificationLines(text);
    if (quals.length) {
      console.log('\n' + chalk.bold.underline('Lines that read like the bar (match yourself against these honestly)'));
      quals.forEach((q) => console.log(`  • ${q}`));
    }
    if (options.full) {
      console.log('\n' + chalk.bold.underline('Full posting'));
      console.log(text);
    } else {
      console.log(chalk.gray(`\n--full prints the whole posting (${text.length} chars).`));
    }
    console.log(chalk.gray(`\napply --job ${r.id}  ·  skip ${r.id}`));
  });

program
  .command('skip <ids...>')
  .description('Drop stored jobs you are not going to apply to')
  .action((ids: string[]) => {
    const db = getDb();
    const stmt = db.prepare("UPDATE jobs SET status = 'skipped' WHERE id = ? AND status = 'new'");
    let n = 0;
    for (const id of ids) n += stmt.run(parseInt(id, 10)).changes;
    console.log(n ? chalk.green(`✓ Skipped ${n} job(s)`) : chalk.yellow('Nothing changed (ids not found or not new).'));
  });

// ---------- board discovery ----------

function slugCandidates(name: string, override?: string): string[] {
  if (override) return [override];
  const base = name.toLowerCase().trim();
  const compact = base.replace(/[^a-z0-9]/g, '');
  const hyphen = base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const firstWord = base.split(/\s+/)[0].replace(/[^a-z0-9]/g, '');
  const stripped = compact.replace(/(inc|labs|hq|ai|io|co|technologies|technology|corp)$/, '');
  return [...new Set([compact, hyphen, firstWord, stripped, `${compact}ai`, `${compact}hq`].filter(Boolean))];
}

async function probeBoards(slug: string): Promise<{ greenhouse?: number; lever?: number; ashby?: number }> {
  const out: { greenhouse?: number; lever?: number; ashby?: number } = {};
  const get = async (url: string) => {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'jobsearch-cli' } });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  };
  const gh = (await get(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`)) as { jobs?: unknown[] } | null;
  if (gh && Array.isArray(gh.jobs)) out.greenhouse = gh.jobs.length;
  const lv = (await get(`https://api.lever.co/v0/postings/${slug}?mode=json`)) as unknown[] | null;
  if (Array.isArray(lv)) out.lever = lv.length;
  const as = (await get(`https://api.ashbyhq.com/posting-api/job-board/${slug}`)) as { jobs?: unknown[] } | null;
  if (as && Array.isArray(as.jobs)) out.ashby = as.jobs.length;
  return out;
}

program
  .command('find-board <company>')
  .description('Detect a company\'s Greenhouse / Lever / Ashby board from its name and track it')
  .option('--slug <slug>', 'Try this slug instead of guessing (the part after boards.greenhouse.io/, jobs.lever.co/, jobs.ashbyhq.com/)')
  .option('--category <category>', 'Category label', 'Uncategorized')
  .option('--no-sponsor', 'Flag as not sponsoring visas')
  .option('--dry-run', 'Probe only, do not add')
  .action(async (name: string, options) => {
    const companies = loadCompanies();
    const existing = companies.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const spinner = ora(`Probing boards for ${name}...`).start();
    let found: { slug: string; boards: { greenhouse?: number; lever?: number; ashby?: number } } | null = null;
    for (const slug of slugCandidates(name, options.slug)) {
      spinner.text = `Trying ${slug}...`;
      const boards = await probeBoards(slug);
      if (boards.greenhouse !== undefined || boards.lever !== undefined || boards.ashby !== undefined) {
        found = { slug, boards };
        break;
      }
    }
    spinner.stop();

    if (!found) {
      console.log(chalk.yellow(`No Greenhouse, Lever, or Ashby board answered for "${name}".`));
      console.log(chalk.gray('Open their careers page: if the apply link goes to boards.greenhouse.io/X, jobs.lever.co/X, or jobs.ashbyhq.com/X, rerun with --slug X.'));
      console.log(chalk.gray('Workday, SmartRecruiters, and custom sites are not supported; check those by hand.'));
      return;
    }
    const { slug, boards } = found;
    const parts = Object.entries(boards).map(([k, n]) => `${k} (${n} open)`);
    console.log(chalk.green(`✓ ${name}: slug "${slug}" → ${parts.join(', ')}`));

    if (options.dryRun) return;
    if (existing) {
      let changed = false;
      if (boards.greenhouse !== undefined && !existing.greenhouse_id) (existing.greenhouse_id = slug), (changed = true);
      if (boards.lever !== undefined && !existing.lever_id) (existing.lever_id = slug), (changed = true);
      if (boards.ashby !== undefined && !existing.ashby_id) (existing.ashby_id = slug), (changed = true);
      if (changed) {
        saveCompanies(companies);
        console.log(chalk.green(`✓ Updated ${existing.name} with the board id.`));
      } else {
        console.log(chalk.gray(`${existing.name} is already tracked with this board.`));
      }
      return;
    }
    const company: Company = { name, category: options.category, h1b_friendly: options.sponsor !== false };
    if (boards.greenhouse !== undefined) company.greenhouse_id = slug;
    if (boards.lever !== undefined) company.lever_id = slug;
    if (boards.ashby !== undefined) company.ashby_id = slug;
    companies.push(company);
    saveCompanies(companies);
    console.log(chalk.green(`✓ Added ${name}. Run \`jobsearch check -c "${name}"\`.`));
  });

// ---------- pipeline ----------

const STATUSES = ['applied', 'responded', 'phone_screen', 'onsite', 'offer', 'rejected'];

program
  .command('apply [company] [role]')
  .description('Log an application (by name, or by stored job id with --job)')
  .option('-j, --job <id>', 'Stored job id from `jobsearch jobs`; fills company and role')
  .option('-n, --notes <notes>', 'Notes')
  .option('-r, --recruiter <name>', 'Recruiter or contact name')
  .option('-e, --email <email>', 'Their email')
  .action((company: string | undefined, role: string | undefined, options) => {
    const profile = loadProfile();
    const db = getDb();
    let jobId: number | null = null;
    if (options.job) {
      const j = db.prepare('SELECT id, company, title FROM jobs WHERE id = ?').get(parseInt(options.job, 10)) as
        | { id: number; company: string; title: string }
        | undefined;
      if (!j) {
        console.log(chalk.red(`No stored job with id ${options.job}.`));
        return;
      }
      jobId = j.id;
      company = company || j.company;
      role = role || j.title;
      db.prepare("UPDATE jobs SET status = 'applied' WHERE id = ?").run(j.id);
    }
    if (!company || !role) {
      console.log(chalk.red('Give a company and role, or --job <id>.'));
      return;
    }
    db.prepare(
      `INSERT INTO applications (job_id, company, title, notes, recruiter_name, recruiter_email) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(jobId, company, role, options.notes || null, options.recruiter || null, options.email || null);
    const due = new Date();
    due.setDate(due.getDate() + profile.follow_up_days);
    console.log(chalk.green(`\n✓ Logged: ${role} @ ${company}`));
    console.log(chalk.gray(`  Follow up by ${due.toLocaleDateString()}. Now draft the notes: jobsearch outreach "${company}" "${role}" --to "First Last"`));
  });

program
  .command('update <company> <status>')
  .description(`Update application status (${STATUSES.join(', ')})`)
  .action((company, status) => {
    if (!STATUSES.includes(status)) {
      console.log(chalk.red(`Status must be one of: ${STATUSES.join(', ')}`));
      return;
    }
    const db = getDb();
    const result = db
      .prepare(`UPDATE applications SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE company LIKE ?`)
      .run(status, `%${company}%`);
    console.log(result.changes > 0 ? chalk.green(`\n✓ ${result.changes} application(s) → ${status}`) : chalk.red(`No applications match "${company}"`));
  });

program
  .command('pipeline')
  .description('Your applications, grouped by status')
  .option('-s, --status <status>', 'Filter by status')
  .action((options) => {
    const db = getDb();
    const rows = (options.status
      ? db.prepare('SELECT * FROM applications WHERE status = ? ORDER BY applied_at DESC').all(options.status)
      : db.prepare('SELECT * FROM applications ORDER BY applied_at DESC').all()) as {
      company: string;
      title: string;
      status: string;
      applied_at: string;
      recruiter_name: string | null;
      recruiter_email: string | null;
    }[];
    header('APPLICATION PIPELINE');
    if (rows.length === 0) {
      console.log(chalk.gray('Nothing logged yet. `jobsearch apply <company> <role>` after you submit one.'));
      return;
    }
    const colors: Record<string, typeof chalk> = {
      applied: chalk.blue,
      responded: chalk.cyan,
      phone_screen: chalk.yellow,
      onsite: chalk.magenta,
      offer: chalk.green,
      rejected: chalk.red,
    };
    for (const status of STATUSES) {
      const apps = rows.filter((a) => a.status === status);
      if (!apps.length) continue;
      console.log(colors[status].bold(`[${status.toUpperCase()}] (${apps.length})`));
      for (const a of apps) {
        console.log(`  • ${a.title} @ ${a.company}  ${chalk.gray(new Date(a.applied_at).toLocaleDateString())}`);
        if (a.recruiter_name) console.log(chalk.gray(`    contact: ${a.recruiter_name} ${a.recruiter_email || ''}`));
      }
      console.log();
    }
    console.log(line);
    console.log(
      `Total: ${rows.length} | Active: ${rows.filter((a) => !['rejected', 'offer'].includes(a.status)).length} | Offers: ${rows.filter((a) => a.status === 'offer').length}`
    );
  });

// ---------- outreach ----------

const KINDS: NoteKind[] = ['dm', 'peer', 'recruiter', 'founder'];

program
  .command('outreach <company> <role>')
  .description('Draft the messages for one person from your profile (connect note, InMail/email, follow-up)')
  .requiredOption('--to <fullName>', 'Their full name, e.g. "Jane Doe"')
  .option('-k, --kind <kind>', `dm (decision maker), peer, recruiter, founder`, 'dm')
  .option('--title <title>', 'Their title, for the log')
  .option('--clause <text>', 'One clause tying you to this company, e.g. "most of it API work between systems that disagree"')
  .option('--curiosity <text>', 'Peer notes: one genuine question about their path or the work')
  .option('--hook <text>', 'Founder notes: what to congratulate them on, e.g. "the Series C"')
  .option('--when <text>', 'today | this morning | yesterday', 'today')
  .option('--proof <n>', 'Which proof point to use (1-based)', '1')
  .option('--log', 'Record this person as messaged in the outreach table')
  .action((company, role, options) => {
    const profile = loadProfile();
    const kind = String(options.kind) as NoteKind;
    if (!KINDS.includes(kind)) {
      console.log(chalk.red(`--kind must be one of: ${KINDS.join(', ')}`));
      return;
    }
    if (!profile.headline) {
      console.log(chalk.yellow('Your profile has no headline yet. Run `jobsearch init` so the drafts have something to say.'));
    }
    const first = String(options.to).split(' ')[0];
    const input = {
      profile,
      company,
      role,
      first,
      kind,
      clause: options.clause,
      curiosity: options.curiosity,
      hook: options.hook,
      when: options.when,
      proof: parseInt(options.proof, 10) || 1,
      appliedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    };

    header(`${options.to} @ ${company} · ${kind}`);

    const { text: note, dropped } = trimToLimit(input);
    const { chars, over } = countInfo(note);
    console.log(chalk.bold.underline(`Connect note (${chars}/${LINKEDIN_NOTE_LIMIT})`) + (dropped.length ? chalk.gray(`  trimmed: ${dropped.join(', ')}`) : ''));
    console.log(note + '\n');
    if (over) console.log(chalk.red(`Still over ${LINKEDIN_NOTE_LIMIT}. Shorten your headline or side line in data/profile.json.\n`));

    if (kind === 'founder' || kind === 'dm') {
      console.log(chalk.bold.underline(kind === 'founder' ? 'InMail / email (only if the InMail is free)' : 'Warm message (use after they accept, or as an email)'));
      console.log((kind === 'founder' ? founderMessage(input) : warmHiringManagerMessage(input)) + '\n');
    }

    console.log(chalk.bold.underline(`Follow-up after they accept (send once, ${profile.follow_up_days} days later if quiet)`));
    console.log(followUpAfterAccept(input) + '\n');

    console.log(chalk.gray('Read it out loud as yourself before sending. If a line would not come out of your mouth, change it.'));

    if (options.log) {
      const db = getDb();
      db.prepare(`INSERT INTO outreach (company, person, title, kind, channel, role) VALUES (?, ?, ?, ?, ?, ?)`).run(
        company,
        options.to,
        options.title || null,
        kind,
        kind === 'founder' ? 'inmail' : 'linkedin_note',
        role
      );
      console.log(chalk.green(`✓ Logged ${options.to} as messaged.`));
    }
  });

const OUTREACH_STATUSES = ['sent', 'accepted', 'replied', 'call', 'no_reply'];

program
  .command('outreach-status <person> <status>')
  .description(`Update a messaged person (${OUTREACH_STATUSES.join(', ')})`)
  .action((person, status) => {
    if (!OUTREACH_STATUSES.includes(status)) {
      console.log(chalk.red(`Status must be one of: ${OUTREACH_STATUSES.join(', ')}`));
      return;
    }
    const db = getDb();
    const result = db
      .prepare(`UPDATE outreach SET status = ?, status_at = CURRENT_TIMESTAMP WHERE person LIKE ?`)
      .run(status, `%${person}%`);
    console.log(result.changes > 0 ? chalk.green(`\n✓ ${result.changes} record(s) → ${status}`) : chalk.red(`Nobody matches "${person}"`));
  });

program
  .command('contacts')
  .description('Everyone you have messaged, by company')
  .option('-c, --company <name>', 'One company')
  .action((options) => {
    const db = getDb();
    const rows = (options.company
      ? db.prepare('SELECT * FROM outreach WHERE company LIKE ? ORDER BY company, sent_at').all(`%${options.company}%`)
      : db.prepare('SELECT * FROM outreach ORDER BY company, sent_at').all()) as {
      company: string;
      person: string;
      title: string | null;
      kind: string;
      status: string;
      sent_at: string;
    }[];
    header('OUTREACH');
    if (!rows.length) {
      console.log(chalk.gray('No one logged yet. Add --log to `jobsearch outreach` when you send.'));
      return;
    }
    let current = '';
    for (const r of rows) {
      if (r.company !== current) {
        current = r.company;
        console.log(chalk.bold.cyan(current));
      }
      const color = r.status === 'replied' || r.status === 'call' ? chalk.green : r.status === 'accepted' ? chalk.yellow : chalk.gray;
      console.log(`  • ${r.person}${r.title ? chalk.gray(` (${r.title})`) : ''}  ${chalk.gray(r.kind)}  ${color(r.status)}  ${chalk.gray(new Date(r.sent_at).toLocaleDateString())}`);
    }
  });

// ---------- followups ----------

program
  .command('followups')
  .description('Applications and messages that are due a follow-up')
  .action(() => {
    const profile = loadProfile();
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - profile.follow_up_days);
    const iso = cutoff.toISOString();
    const days = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);

    const apps = db
      .prepare(`SELECT company, title, applied_at, recruiter_name, recruiter_email FROM applications WHERE status = 'applied' AND applied_at < ? ORDER BY applied_at ASC`)
      .all(iso) as { company: string; title: string; applied_at: string; recruiter_name: string | null; recruiter_email: string | null }[];
    const notes = db
      .prepare(`SELECT company, person, kind, status, sent_at FROM outreach WHERE status IN ('sent', 'accepted') AND sent_at < ? ORDER BY sent_at ASC`)
      .all(iso) as { company: string; person: string; kind: string; status: string; sent_at: string }[];

    header(`DUE (older than ${profile.follow_up_days} days)`);
    if (!apps.length && !notes.length) {
      console.log(chalk.green('Nothing due. Go find the next one.'));
      return;
    }
    if (apps.length) {
      console.log(chalk.bold('Applications with no response'));
      for (const a of apps) {
        console.log(chalk.yellow(`  • ${a.title} @ ${a.company}`) + chalk.gray(` (${days(a.applied_at)} days)`));
        if (a.recruiter_email) console.log(chalk.gray(`    contact: ${a.recruiter_email}`));
      }
      console.log();
    }
    if (notes.length) {
      console.log(chalk.bold('People to nudge once (new proof point, then stop)'));
      for (const n of notes) {
        console.log(chalk.yellow(`  • ${n.person} @ ${n.company}`) + chalk.gray(` (${n.kind}, ${n.status}, ${days(n.sent_at)} days)`));
      }
      console.log(chalk.gray('\n  accepted but quiet → send the follow-up from `jobsearch outreach ... --kind <kind>`'));
      console.log(chalk.gray('  no accept after 14 days → `jobsearch outreach-status "<name>" no_reply` and move on'));
    }
  });

program.parseAsync(process.argv);
