# Project Runtime

Concepts: Phase 2 reflection, Fable, Codex collaborator, disposable Docker runner, Litebrite, Trapper Keeper, Claude hooks, Beads migration.

Key files: `MANIFESTO.md`, `CLAUDE.md`, `src/agent/context.ts`, `src/agent/runner.ts`, `src/agent/codex.ts`, `scripts/run-reflect.sh`, `scripts/epic-runner/run-reflect.sh`, `scripts/epic-runner/Dockerfile`, `AGENTS.md`.

Commands: `./scripts/run-reflect.sh`, `lb ready`, `lb show <id>`, `lb claim <id>`, `lb close <id>`, `lb sync`, `trk prime`.

Useful when: changing how Stigmergence starts, diagnosing missing project context in Claude, working on tracked tasks, or updating the disposable runner image.

## Reflection flow

`scripts/run-reflect.sh` is the host entry point. It requires a clean tracked worktree, the owner-only autobiographical history, the selected private service environment, an authenticated Codex home volume, and an SSH agent. It builds the disposable runner, clones Physarum and the gallery as siblings, mounts only the required private inputs, and starts `bun run src/index.ts --reflect`.

The reflection code keeps the original Phase 1 prompt structure and adds only essential Phase 2 context: continuous identity, the curated autobiography, Codex as a separate general collaborator, and credential hygiene. It still begins with “You are reflecting,” preserves the original disposable-checkout and turn-limit guidance, and includes current state, engagement, project context, genome, and narrative. Claude Code runs Fable as Stigmergence's primary reasoning process. Codex remains a separate general collaborator that Stigmergence may call through `bun run codex -- --task-file <path> [--name <label>]`.

`comms.json` remains the live bidirectional human/artist channel. Every reflection reads its full current contents. Stigmergence may append an `agent` entry, then commit and push the file so Mike sees the response between runs. Tests protect both the original prompt framing and these message-file instructions from being silently replaced.

The publishing pipeline's studio/live boundary and crash-safe journal protect operation correctness. They do not narrow the mission in `MANIFESTO.md` or introduce a human approval policy into the artist's prompt.

## Tracker and wiki branches

Litebrite stores work on the orphan `litebrite` branch. Trapper Keeper stores the wiki on the orphan `trapperkeeper` branch, normally materialized as the gitignored `.trapper_keeper/` worktree. A fresh clone needs local tracking branches for both remote branches before `lb` and the wiki worktree are usable.

The former `.beads/` store contained 29 records. The migration recreated all 29 in Litebrite, preserved every old ID, status, description, dates, owner, and close reason in the item descriptions, preserved the two parent trees and six blocking links, and left the single previously open art-quality feature open. `.beads/`, its merge driver, the `bd` binary, and Beads-specific runner commands were then removed.

## Claude hook lifecycle

`lb setup claude` and `trk setup claude` merge project hooks into `.claude/settings.local.json`. Both `SessionStart` and `PreCompact` run `lb prime` and `trk prime`; Claude permissions allow the two CLIs. The setup commands are idempotent and preserve unrelated local Claude settings.

Every disposable runner repeats this setup after cloning. Before enabling the hooks it creates local tracking branches for `origin/litebrite` and `origin/trapperkeeper` and materializes `.trapper_keeper/`. Startup fails if either required remote branch is missing. It then runs both prime commands once as a preflight, so a reflection never begins with silently missing tracker or wiki context.

The runner image builds `lb` and `trk` from pinned source revisions in a Rust build stage and copies only the release binaries into the final Node image. Claude Code and Codex versions remain independently pinned in the final image.
