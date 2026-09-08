Run the daily loop from CLAUDE.md section 3.

1. Read the top block of HANDOFF.md. Ask how they are and what has moved (replies, invites, rejections). Log what they report with the CLI.
2. `npx tsx src/cli.ts check` then `npx tsx src/cli.ts jobs -l 15`. For the top matches, read each with `show <id>` and give a one-line honest fit read (off-lane / adjacent-viable / strong), naming the one real gap.
3. `npx tsx src/cli.ts followups`. For anything due, give the exact message to send in a fenced block.
4. End with the short list for today: at most three items, first one is the single most important.

Keep replies short. Don't apply or send anything yourself; they do that. $ARGUMENTS
