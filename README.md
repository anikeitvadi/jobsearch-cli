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
npx tsx src/cli.ts check -c Stripe                    # one company
npx tsx src/cli.ts apply "Stripe" "Solutions Architect"
npx tsx src/cli.ts outreach "Stripe" "Solutions Architect" --to "Jane Doe" --kind dm --log
npx tsx src/cli.ts followups
```

## Everything

| Command | What it does |
|---|---|
| `init` | Create or update your profile |
| `profile` | Show it |
| `check` | Find new postings that match your titles (`--anywhere`, `--all`, `-c`) |
| `companies` | List tracked companies |
| `add-company <name> --greenhouse\|--lever\|--ashby <id>` | Track another one |
| `research <company>` | Board links, email pattern, open matches, people-search links |
| `contact "<First Last>" <company>` | Email guesses for a person |
| `apply <company> <role>` | Log an application |
| `update <company> <status>` | applied, responded, phone_screen, onsite, offer, rejected |
| `pipeline` | Your applications by status |
| `outreach <company> <role> --to "<name>" [--kind dm\|peer\|recruiter\|founder]` | Draft the connect note, the longer message, and the follow-up |
| `outreach-status "<name>" <status>` | sent, accepted, replied, call, no_reply |
| `contacts` | Everyone you've messaged |
| `followups` | What's due |

`npm run <script>` shortcuts exist for the common ones (`npm run check`, `npm run pipeline`).

## The method

Read `PLAYBOOK.md`. The tool is the easy part.

If you use Claude Code, `CLAUDE.md` tells it how to work in this repo: read your profile, follow the playbook, never invent a fact about you.

## Adding companies

`data/companies.json` is a list of `{ name, category, h1b_friendly, greenhouse_id | lever_id | ashby_id, email_pattern }`. The board id is the slug in the careers URL. `h1b_friendly: false` hides a company from `check` when your profile says you need sponsorship.
