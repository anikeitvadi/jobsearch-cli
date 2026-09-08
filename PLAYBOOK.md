# The playbook

This is the loop. The CLI does the mechanical parts. You do the reading and the sending.

## 0. Setup, once

`npm install`, then `npx tsx src/cli.ts init`. Answer in plain words, the way you'd talk to a friend. The proof points matter most: one outcome each, with a number in it. Every message the tool drafts is built from them.

Add the companies you actually want with `jobsearch find-board "Company Name"`. It guesses the Greenhouse, Lever, or Ashby slug and tracks the one that answers. If it can't find one, the careers page tells you the slug (`boards.greenhouse.io/<id>`, `jobs.lever.co/<id>`, `jobs.ashbyhq.com/<id>`) and `--slug` takes it.

## 1. Find (daily, 10 minutes)

`jobsearch check` pulls new postings and scores them against your titles. `jobsearch jobs` is everything stored, best first. `jobsearch show <id>` prints one with the lines that read like the bar pulled out. `jobsearch skip <id>` drops the ones you won't do.

Then read the posting. The whole thing, line by line. Match yourself against the minimum qualifications honestly. A title is not the job. Two rules:

- Off-lane means you're missing the core of the job. Adjacent-but-viable means you clear the minimums and the gap is preferred-tier or title-only. Apply to the second kind.
- Be honest about years. If the bar is five and you have three, apply anyway and say "three, not five" when asked. Never inflate.

## 2. Apply (same day)

Resume of record, no tailoring unless the form asks a question. Short answers: what you did, one number, done. Log it: `jobsearch apply --job <id>` (or `apply "<company>" "<role>"`).

## 3. Reach out (same day, 3 to 6 people, all verified)

Cold applications get filtered. People don't. The day you apply, message:

- The person who runs the team the role sits in (Head of X, Director of X). Hiring-manager tier.
- At a small company, the founder or CEO. Congratulate a real thing (the raise, the launch), then the note.
- One recruiter or talent person.
- One or two peers in the exact seat.

Find them with the links in `jobsearch research "<company>"`, then open each profile and confirm the title and the company are current. Never message from a search result. Never message anyone you haven't verified.

Draft with `jobsearch outreach "<company>" "<role>" --to "First Last" --kind dm|peer|recruiter|founder --log`. Read it out loud as yourself. Send. The tool logs who you messaged.

InMail only if it's free (open profile, no credit line in the compose header). Otherwise a connect note.

## 4. Message rules (learned the hard way)

- Write the way you talk. Short sentences. One idea each. No "leverage," no "passionate," no "excited to."
- One outcome with a number, matched to the reader. Integration person gets the integration story. AI person gets the AI story.
- The ask is a favor you're requesting, never an offer of your time. Banned: "I've got 15 minutes," "I'd like 15 minutes," "if useful," "I'd take it."
- Connect notes close with "Would love the opportunity to bring value to the team" (decision makers) or "Would love the chance to talk and learn more" (peers). Nothing cleverer.
- No meta lines about the process ("wanted you to hear it from me, not the ATS"). Say what happened. "I applied to X today."
- No fake familiarity. If you're connected but never talked: "we're connected on here but haven't actually talked, so hi."
- Never state a fact that isn't true. Not a location, not a title, not a number.
- Under 300 characters for connect notes. The tool counts.
- Sign with your short name.

## 5. Follow up (weekly, 5 minutes)

`jobsearch followups`. Accepts at 7 days, replies at 14.

- Accepted but quiet: send the follow-up the tool drafts. One proof point, a small ask, an out.
- Nudge once, with something new (a proof point they haven't seen). Then stop. `outreach-status "<name>" no_reply`.
- Application with no response after your cadence: one note to the recruiter you already found. Then move on.

## 6. The warm hiring-manager message (the one that converts)

When someone senior can actually move you forward, don't send the 300-character note. Send the fuller one (`--kind dm` prints it):

1. Prove you read the whole role, then quote the exact phrase that got you.
2. Tie that phrase to something real about you.
3. "Quick on me:" a short narrative. Identity line, one strong metric story, one thing about the people side, one relevant build, a tie to their direction.
4. Warm close. Learn more, happy to send a resume, whenever works.

About 250 words. It got a screen where a hundred cold applications didn't.

## 7. Screens and rounds

- The day before any live round: rehearse out loud, recorded. Watch it back. This is the whole difference between knowing the answer and saying it.
- Pre-call: water, stand up, notes open, three questions picked.
- After: write down the questions they asked before you grade yourself. No self-grade for 24 hours. Your read of how it went is unreliable in the first hour.
- Recruiter screen: 60-second story, why them, why this seat, logistics. One hour of prep, not a day.

## 8. Recently funded companies

A company that raised this month is hiring this month. Find the raise, find the people, message within days. Say congrats on the real thing. Weekly check-ins beat one big pitch.

## 9. "Why you?" fields (about 2,000 characters)

Three paragraphs. (1) A wall of shipped work, concrete nouns, one number each, ending on why you build. (2) The day job in three proof points. (3) The honest gap, then how you learn ("I learn a domain by deploying into it"), then the belief tied to their words, then the wanting, said once, at the end, after the evidence.

## 10. Keep the pipeline honest

"Pipeline is dry" is a feeling. `jobsearch pipeline` is the fact. When it feels dry, run `check`, apply to one, message four. That's a day.
