Write the application free-text answers for the company in the arguments, into `applications/<company>/` as `.txt` files, one per question, counted with `wc -c` (CLAUDE.md section 8).

Ask for the exact questions and character limits if they weren't pasted. "Why you" fields use `templates/why-you.md`. Short fields: what they did, one number, done. Every fact comes from data/profile.json or the user's words. No cover letter unless the form or the user asks for one.

Return each answer in a fenced block with its char count. Arguments: $ARGUMENTS
