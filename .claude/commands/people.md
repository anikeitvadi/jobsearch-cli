Find and verify 3 to 6 people at the company for the role in the arguments, then draft their notes (CLAUDE.md sections 6 and 7).

Targets: the person who runs the team the role sits in, the founder/CEO if the company is small, one recruiter or talent person, one or two peers in the exact seat. Use the LinkedIn links from `npx tsx src/cli.ts research "<company>"`. Verify every person on their actual profile (browser tools if available; otherwise ask the user to confirm) and note the degree. Never list anyone unverified.

Draft each note with `npx tsx src/cli.ts outreach "<company>" "<role>" --to "First Last" --kind <dm|peer|recruiter|founder>` and edit against the message rules. Write the batch to `outreach/<YYYY-MM-DD>-<company>.md` using `templates/outreach-batch.md` with char counts. Do not send anything. Return the list of people with titles and the two most important notes in fenced blocks. Arguments: $ARGUMENTS
