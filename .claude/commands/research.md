Research the company named in the arguments and write `research/<company>.md` using `templates/company-card.md` (CLAUDE.md section 5).

Steps: `npx tsx src/cli.ts find-board "<company>"` (add it if it isn't tracked), `npx tsx src/cli.ts check -c "<company>" --anywhere` to see the board, then the web for what they do, the latest round, revenue if public, and culture in their words. Map every plausible seat against data/profile.json in the fit table; be honest about years bars. Sponsorship signal only if the profile says they need it.

Return: a short verdict (worth it / not, which seat, why) and the path to the card. Company: $ARGUMENTS
