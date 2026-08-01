# Agent Instructions

This project uses Litebrite for task tracking and Trapper Keeper for the
LLM-maintained project wiki. Claude setup lives in `.claude/`; the generated
startup and pre-compaction hooks run `lb prime` and `trk prime` automatically.

## Tracked Work

```bash
lb ready              # Find open, unblocked, unclaimed work
lb show <id>          # Read full task context
lb claim <id>         # Claim work and sync the tracker branch
lb close <id>         # Close completed work
lb sync               # Sync tracker changes
```

When doing tracked work, claim before implementation, commit the source change,
close the item, then sync.

## Wiki

The wiki lives at `.trapper_keeper/` as a gitignored worktree.

- Read `.trapper_keeper/toc.md` and `.trapper_keeper/index.md` before exploring.
- Update durable architecture, decisions, and operational knowledge when it
  changes.
- Keep `toc.md`, `index.md`, and `log.md` consistent.
- Commit wiki changes with
  `git -C .trapper_keeper add -A && git -C .trapper_keeper commit -m "<message>"`.

If a fresh clone does not yet have the local tracker branches or wiki worktree,
create tracking branches for `origin/litebrite` and `origin/trapperkeeper`, add
the `.trapper_keeper` worktree, then run `lb setup claude` and
`trk setup claude`.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY when the active authority permits it:
   ```bash
   git pull --rebase
   lb sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- A higher-priority instruction that explicitly forbids pushing still controls;
  report the local commit and the withheld push in that case.
