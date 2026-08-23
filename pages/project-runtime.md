# Project Runtime

Concepts: Phase 2 reflection, Fable, Codex collaborator, disposable Docker runner, portable host, persistent private memory, gallery clone verification, outside-action journal, crash recovery, journal-history rollback, monotonic recovery history, Litebrite, Trapper Keeper, Claude hooks, Beads migration.

Key files: `MANIFESTO.md`, `CLAUDE.md`, `src/agent/context.ts`, `src/agent/runner.ts`, `src/agent/codex.ts`, `scripts/run-reflect.sh`, `scripts/epic-runner/run-reflect.sh`, `scripts/epic-runner/gallery-url.sh`, `scripts/outside-action-journal.ts`, `scripts/epic-runner/Dockerfile`, `AGENTS.md`.

Commands: `./scripts/run-reflect.sh`, `lb ready`, `lb show <id>`, `lb claim <id>`, `lb close <id>`, `lb sync`, `trk prime`.

Useful when: changing how Stigmergence starts, diagnosing missing project context in Claude, working on tracked tasks, or updating the disposable runner image.

## Reflection flow

`scripts/run-reflect.sh` is the host entry point. It requires a clean tracked worktree, the owner-only autobiographical history, the selected private service environment, an authenticated Codex home volume, and an SSH agent. It builds the disposable runner, clones Physarum and the gallery as siblings, mounts only the required private inputs, and starts `bun run src/index.ts --reflect`.

The reflection code keeps the original Phase 1 prompt structure and adds only essential Phase 2 context: continuous identity, the curated autobiography, Codex as a separate general collaborator, and credential hygiene. It still begins with “You are reflecting,” preserves the original disposable-checkout and turn-limit guidance, and includes current state, engagement, project context, genome, and narrative. Claude Code runs Fable as Stigmergence's primary reasoning process. Codex remains a separate general collaborator that Stigmergence may call through `bun run codex -- --task-file <path> [--name <label>]`.

`comms.json` remains the live bidirectional human/artist channel. Every reflection reads its full current contents. Stigmergence may append an `agent` entry, then commit and push the file so Mike sees the response between runs. Tests protect both the original prompt framing and these message-file instructions from being silently replaced.

The publishing pipeline's studio/live boundary and crash-safe journal protect operation correctness. They do not narrow the mission in `MANIFESTO.md` or introduce a human approval policy into the artist's prompt.

## Portable host and private continuity

The runner no longer depends on the machine that hosted the first Phase 2 session. Its persistent Claude home can be exported, integrity-checked, restored into a trusted Docker host, and combined with only the curated autobiography, service environment, and authenticated Codex configuration required for the run. Source and gallery repositories remain fresh disposable clones; private history and credentials are mounted separately and never copied into either repository.

The host launcher also mounts an owner-only persistent `runtime-private` directory outside the disposable clone. The container creates an ignored symlink at the project path, so journals survive container failure without appearing as source changes. A startup check refuses to continue while a prior outside action has an uncertain result.

## Gallery repository safety

`scripts/epic-runner/gallery-url.sh` derives the sibling gallery address from Physarum source addresses with or without a `.git` suffix and fails closed for unrelated source repositories. Gallery clone failure is fatal, and the runner verifies the cloned origin before reflection starts. This fixes the earlier defect that cloned Physarum into the `stigmergence-site` path when the source address omitted `.git`.

## Outside-action recovery

The publishing pipeline keeps its structured live-run journal. Direct outside actions use `scripts/outside-action-journal.ts`: `begin` records a stable action id and secret-free intent before the action; `complete` or `failed` records a verified result. An unresolved `pending` entry blocks the next reflection, so an uncertain social write, upload, mint, gallery change, deployment, or Git push cannot be retried automatically.

The second real Phase 2 reflection on 2026-08-21 used this path. Three source pushes were recorded and reconciled. Stigmergence created four reproducible “Conversation Piece” generators, preserved failed studies and a deterministic working candidate, and replied through `comms.json`. It deliberately made no social post, gallery change, upload, mint, wallet operation, or deployment. A fresh-clone post-run check passed the build, lint, all 90 tests, authenticated agent checks, project hooks, journal reconciliation, and real gallery clone.

The fourth-run evidence audit on 2026-08-23 exposed a remaining recovery invariant. Loony's active journal had silently reverted from the reconciled ten-line third-run history to a reconciled six-line second-run prefix before the fourth run appended its records. Startup passed because every surviving action was settled; `check` detects unresolved latest states but cannot detect disappeared completed history. The archived third-run journal and current fourth-run journal shared a byte-identical six-line prefix, and all later action ids were unique and reconciled, so MyBuddy preserved both originals and restored one timestamp-ordered 14-entry history. A complete disposable preflight passed after the repair. Litebrite follow-up `lb-xe2s` owns a monotonic continuity or provenance guard and tests for restoring an older-but-reconciled journal.

## Tracker and wiki branches

Litebrite stores work on the orphan `litebrite` branch. Trapper Keeper stores the wiki on the orphan `trapperkeeper` branch, normally materialized as the gitignored `.trapper_keeper/` worktree. A fresh clone needs local tracking branches for both remote branches before `lb` and the wiki worktree are usable.

The former `.beads/` store contained 29 records. The migration recreated all 29 in Litebrite, preserved every old ID, status, description, dates, owner, and close reason in the item descriptions, preserved the two parent trees and six blocking links, and left the single previously open art-quality feature open. `.beads/`, its merge driver, the `bd` binary, and Beads-specific runner commands were then removed.

## Claude hook lifecycle

`lb setup claude` and `trk setup claude` merge project hooks into `.claude/settings.local.json`. Both `SessionStart` and `PreCompact` run `lb prime` and `trk prime`; Claude permissions allow the two CLIs. The setup commands are idempotent and preserve unrelated local Claude settings.

Every disposable runner repeats this setup after cloning. Before enabling the hooks it creates local tracking branches for `origin/litebrite` and `origin/trapperkeeper` and materializes `.trapper_keeper/`. Startup fails if either required remote branch is missing. It then runs both prime commands once as a preflight, so a reflection never begins with silently missing tracker or wiki context.

The runner image builds `lb` and `trk` from pinned source revisions in a Rust build stage and copies only the release binaries into the final Node image. Claude Code and Codex versions remain independently pinned in the final image.
