# jobsearch-cli

A job search assistant for the terminal. It scrapes Greenhouse, Lever, and Ashby boards for the roles in your profile, tracks your applications and the people you message, and drafts outreach from your own story.

## Setup

```bash
git clone <this repo> && cd jobsearch-cli
npm install
npx tsx src/cli.ts init      # builds data/profile.json (roles, locations, your story)
```

Node 20 or newer. Everything stays on your machine: `data/profile.json` and the database are gitignored.

## Daily

```bash
npx tsx src/cli.ts check                              # new matching postings across tracked companies
npx tsx src/cli.ts jobs                               # everything stored, best first
npx tsx src/cli.ts show 42                            # read one, with the qualification lines pulled out
npx tsx src/cli.ts apply --job 42                     # log it when you submit
npx tsx src/cli.ts outreach "Stripe" "Solutions Architect" --to "Jane Doe" --kind dm --log
npx tsx src/cli.ts followups
```

## Everything

| Command | What it does |
|---|---|
| `init` | Create or update your profile |
| `profile` | Show it |
| `check` | Find new postings that match your titles (`--anywhere`, `--all`, `-c`) |
| `jobs` | Stored matches, best first, with ids (`-c`, `-m`, `--all`) |
| `show <id>` | Read a stored posting; pulls out the lines that read like the bar (`--full`) |
| `skip <id...>` | Drop postings you won't apply to |
| `companies` | List tracked companies |
| `find-board <company>` | Detect its Greenhouse / Lever / Ashby board from the name and track it (`--slug`, `--dry-run`) |
| `add-company <name> --greenhouse\|--lever\|--ashby <id>` | Track one when you already know the id |
| `research <company>` | Board links, email pattern, open matches, people-search links |
| `contact "<First Last>" <company>` | Email guesses for a person |
| `apply <company> <role>` or `apply --job <id>` | Log an application |
| `update <company> <status>` | applied, responded, phone_screen, onsite, offer, rejected |
| `pipeline` | Your applications by status |
| `outreach <company> <role> --to "<name>" [--kind dm\|peer\|recruiter\|founder]` | Draft the connect note, the longer message, and the follow-up |
| `outreach-status "<name>" <status>` | sent, accepted, replied, call, no_reply |
| `contacts` | Everyone you've messaged |
| `followups` | What's due |

`npm run <script>` shortcuts exist for the common ones (`npm run check`, `npm run pipeline`).

## With Claude Code (the intended way)

Open this folder in Claude Code. `CLAUDE.md` is the operating manual: on first launch it sets up your profile with you, creates `HANDOFF.md`, and then runs the loop with you every session. Slash commands:

| Command | Does |
|---|---|
| `/daily` | Check boards, read the top matches honestly, what's due, the short list for today |
| `/research <company>` | Company card: what it is, money, board fit table, culture, next |
| `/people <company> <role>` | Find and verify 3 to 6 people, draft their notes into `outreach/` |
| `/prep <company>` | Interview prep card into `prep/` |
| `/answers <company>` | Application free-text answers into `applications/`, char-counted |
| `/handoff` | Rewrite `HANDOFF.md` so the next session starts where this one ended |

Your files (`HANDOFF.md`, `research/`, `outreach/`, `applications/`, `prep/`, `data/profile.json`, the database) are gitignored, so the repo stays shareable.

## The method

Read `PLAYBOOK.md`. The tool is the easy part.

## Adding companies

`npx tsx src/cli.ts find-board "Company Name"` guesses the board slug and adds it. If that fails, `data/companies.json` is a list of `{ name, category, h1b_friendly, greenhouse_id | lever_id | ashby_id, email_pattern }` and the board id is the slug in the careers URL. `h1b_friendly: false` hides a company from `check` when your profile says you need sponsorship.
