# For Codex and other agents

Read `CLAUDE.md` in full and follow it. It is the operating manual for this repo: session start, first launch, the daily loop, how to read a posting honestly, and the message rules.

The files in `.claude/commands/` are the slash-command playbooks (`daily`, `research`, `people`, `prep`, `answers`, `handoff`). Outside Claude Code there is no slash command; when the user asks for one by name, open the matching file and do what it says.

Run the CLI as `npx tsx src/cli.ts <command>`. `--help` lists everything.
