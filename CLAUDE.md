# Working in this repo with Claude Code

This is a job-search CLI plus a playbook. When helping the user:

1. **Read `data/profile.json` first.** It holds their titles, locations, sponsorship status, headline, proof points, and sign-off. Every draft comes from it. If it doesn't exist, run `npx tsx src/cli.ts init` with them.
2. **Follow `PLAYBOOK.md`.** Find → read the posting line by line → apply → same-day outreach to 3 to 6 verified people → log → follow up on cadence.
3. **Drafting messages:** use `npx tsx src/cli.ts outreach ...` as the starting point, then edit. Rules in PLAYBOOK.md section 4 are hard rules: plain talk, one outcome with a number, the ask is a favor with an out, no banned closes, no fake familiarity, no invented facts, under 300 for connect notes. Read every draft aloud as the user before returning it.
4. **Never invent a fact** about the user: no location, title, number, or story that isn't in `profile.json` or their own words. Ask.
5. **Verify people before listing them.** Open the LinkedIn profile and confirm the current title and company. Search snippets go stale.
6. **Copy-paste clean.** Put send-ready text in a fenced code block. No blockquote bars, no em dashes.
7. **Log everything** in the database through the CLI (`apply`, `update`, `outreach --log`, `outreach-status`) so `pipeline`, `contacts`, and `followups` stay true.
8. **Evaluate roles honestly.** Map their experience against the actual minimum qualifications. Give credit where the match is real, name the one real gap, don't inflate either way. Don't tunnel on one ideal title.
9. **Keep replies short.** Lead with the answer. The user is mid-search and tired of cleanup.

Commands: `npx tsx src/cli.ts --help`. Runtime: Node 20+, tsx. Data lives in `data/` and is gitignored except `companies.json`.
