# Project Runtime

Concepts: Phase 2 reflection, primary Codex GPT-6 Astra, historical Fable, Codex collaborator, disposable Docker runner, dedicated authentication, persistent private memory, gallery clone verification, outside-action journal, crash recovery, monotonic recovery history, Litebrite, Trapper Keeper, Codex hooks, Beads migration.

Key files: `MANIFESTO.md`, `CLAUDE.md`, `src/agent/context.ts`, `src/agent/runner.ts`, `src/agent/codex.ts`, `scripts/run-reflect.sh`, `scripts/epic-runner/run-reflect.sh`, `scripts/epic-runner/gallery-url.sh`, `scripts/outside-action-journal.ts`, `scripts/epic-runner/Dockerfile`, `AGENTS.md`.

Commands: `./scripts/run-reflect.sh`, `lb ready`, `lb show <id>`, `lb claim <id>`, `lb close <id>`, `lb sync`, `trk prime`.

Useful when: changing how Stigmergence starts, diagnosing backend or memory continuity, working on tracked tasks, or updating the disposable runner image.

## Reflection flow

`scripts/run-reflect.sh` is the host entry point. It requires a clean tracked worktree, the owner-only autobiographical history, the selected private service environment, an authenticated Codex home volume, and an SSH agent. It builds the disposable runner, clones Physarum and the gallery as siblings, mounts only the required private inputs, and starts `bun run src/index.ts --reflect`.

Supply the current launch instruction through `comms.json` before each separately
authorized run. A historical "exactly one run" message describes that earlier
authorization; it is not a permanent stop order. On September 8, MyBuddy launched
the next Astra reflection without Mike's fresh "One more run" message. The actor
reread the already-completed articles and stopped at the old authorization.
MyBuddy supplied the missing message and resumed the exact same Codex UUID in a
fresh guarded container, retaining the first invocation's 25 steps in the same
100-step planning budget. The continuation then completed the public edition 35
attribution correction. This was two invocations of one thread, not two newly
created reflection sessions; both actual turn contexts were Astra/high. Preserve
the operator omission and continuation evidence rather than reporting a seamless
single invocation. No automatic next reflection was started.

As of September 8, `src/agent/runner.ts` invokes `codex exec --model gpt-6-astra` with explicit high effort. It rejects a different `REFLECT_MODEL` and never falls back to Claude. Codex CLI is pinned to 0.153.4 because 0.144.5 was rejected by the provider for Astra. The prompt still begins with “You are reflecting” and preserves identity, current mission, history, comms, state and project context. A separate collaborator remains available through `bun run codex -- --task-file <path> [--name <label>]`.

`REFLECT_MAX_STEPS` defaults to 100 completed tool/reasoning steps. This is an explicitly self-managed planning budget, not the old Claude hard max-turns limit; `.turn-count` labels that distinction. JSONL output must include `turn.completed` and a successful process exit. Runtime rollout `turn_context` records provide model/effort evidence. Full permissions still require the disposable container.

Read `runtime-private/memory/MEMORY.md` first when present, then the preserved legacy notes. Historical errors remain with explicit corrections. See [evidence boundaries](evidence-boundaries.md) for Session 10's fallback/write correction. Bun is linked into `/usr/local/bin` so Codex's login shells retain access to project commands.

`comms.json` remains the live bidirectional human/artist channel. Every reflection reads its full current contents. Stigmergence may append an `agent` entry, then commit and push the file so Mike sees the response between runs. Tests protect both the original prompt framing and these message-file instructions from being silently replaced.

The publishing pipeline's studio/live boundary and crash-safe journal protect operation correctness. They do not narrow the mission in `MANIFESTO.md` or introduce a human approval policy into the artist's prompt.

## Portable host and private continuity

The runner no longer depends on the machine that hosted the first Phase 2 session. The original Claude home stays preserved and read-only; only the artist's project memory Markdown is copied to `runtime-private/memory/legacy-claude` on first migration. Credentials, configuration, shell snapshots and unrelated projects are not copied as memory. Source and gallery remain fresh disposable clones.

The primary actor uses a dedicated writable `stigmergence-codex-home` volume (overridable through `STIGMERGENCE_CODEX_HOME_VOLUME`). The shared collaborator home is not mutated. The September 8 startup found a stale copied refresh token; the dedicated home was seeded from existing valid account authentication and retains subsequent refreshes instead of discarding them with the container. `codex login status` alone does not prove the token or requested model will work. Session transcripts persist through the home `sessions` symlink to `runtime-private/codex-sessions`; authentication stays outside that evidence directory. Preserve the dedicated authenticated volume separately for recovery.

The host launcher also mounts an owner-only persistent `runtime-private` directory outside the disposable clone. The container creates an ignored symlink at the project path, so journals survive container failure without appearing as source changes. A startup check refuses to continue while a prior outside action has an uncertain result.

## Gallery repository safety

`scripts/epic-runner/gallery-url.sh` derives the sibling gallery address from Physarum source addresses with or without a `.git` suffix and fails closed for unrelated source repositories. Gallery clone failure is fatal, and the runner verifies the cloned origin before reflection starts. This fixes the earlier defect that cloned Physarum into the `stigmergence-site` path when the source address omitted `.git`.

## Outside-action recovery

The publishing pipeline keeps its structured live-run journal. Direct outside actions use `scripts/outside-action-journal.ts`: `begin` records a stable action id and secret-free intent before the action; `complete` or `failed` records a verified result. An unresolved `pending` entry blocks the next reflection, so an uncertain social write, upload, mint, gallery change, deployment, or Git push cannot be retried automatically.

The second real Phase 2 reflection on 2026-08-21 used this path. Three source pushes were recorded and reconciled. Stigmergence created four reproducible “Conversation Piece” generators, preserved failed studies and a deterministic working candidate, and replied through `comms.json`. It deliberately made no social post, gallery change, upload, mint, wallet operation, or deployment. A fresh-clone post-run check passed the build, lint, all 90 tests, authenticated agent checks, project hooks, journal reconciliation, and real gallery clone.

The fourth-run evidence audit on 2026-08-23 exposed a remaining recovery invariant. Loony's active journal had silently reverted from the reconciled ten-line third-run history to a reconciled six-line second-run prefix before the fourth run appended its records. Startup passed because every surviving action was settled. The archived third-run journal and current fourth-run journal shared a byte-identical six-line prefix, and all later action ids were unique and reconciled, so MyBuddy preserved both originals and restored one timestamp-ordered 14-entry history.

The completed-history rollback guard landed on 2026-08-24. `scripts/outside-action-history-anchor.json` records only the accepted 14-record prefix length and SHA-256 digest, keeping action content private. `scripts/outside-action-journal.ts` now requires that anchored prefix, validates every journal record and state transition, and compares the journal against an owner-only monotonic checkpoint before any command. A reconciled `check` atomically advances the checkpoint to the full current byte history; valid appends therefore work, while a shorter or changed accepted prefix fails closed. The host launcher stores the checkpoint in a separate `STIGMERGENCE_RUNTIME_TRUST_DIR` mounted at `/runtime-trust`, requires modes 0700/0600, and strips the test-only unanchored-initialization escape before startup. A missing checkpoint may bootstrap only from the exact anchored 14-record journal; history beyond that anchor without its checkpoint is rejected.

Regression coverage reproduces the exact ten-record accepted history restored to its older clean six-record prefix, plus altered history, normal append/checkpoint advancement, startup mount requirements, and the production anchor. A private disposable copy of Loony's current 14-record journal passed without changing the journal; its preserved ten-record pre-repair original failed at the anchor as intended. The live journal and both archived originals remained unchanged and mode 0600. The trust checkpoint will be created on the first future guarded launcher preflight; this implementation did not run a reflection or mutate the live runtime.

## Tracker and wiki branches

Litebrite stores work on the orphan `litebrite` branch. Trapper Keeper stores the wiki on the orphan `trapperkeeper` branch, normally materialized as the gitignored `.trapper_keeper/` worktree. A fresh clone needs local tracking branches for both remote branches before `lb` and the wiki worktree are usable.

The former `.beads/` store contained 29 records. The migration recreated all 29 in Litebrite, preserved every old ID, status, description, dates, owner, and close reason in the item descriptions, preserved the two parent trees and six blocking links, and left the single previously open art-quality feature open. `.beads/`, its merge driver, the `bd` binary, and Beads-specific runner commands were then removed.

## Agent hook lifecycle

The primary runner now uses `lb setup codex` and `trk setup codex`. Generated Codex hooks prime tracker/wiki context on lifecycle events. The earlier Claude setup remains historical; switching the runtime also required switching generated hooks, not merely changing a model string.

Every disposable runner repeats this setup after cloning. Before enabling the hooks it creates local tracking branches for `origin/litebrite` and `origin/trapperkeeper` and materializes `.trapper_keeper/`. Startup fails if either required remote branch is missing. It then runs both prime commands once as a preflight, so a reflection never begins with silently missing tracker or wiki context.

The runner image builds `lb` and `trk` from pinned source revisions in a Rust build stage and copies only the release binaries into the final Node image. Claude Code and Codex versions remain independently pinned in the final image.

## Running tests inside the reflection container

The outside-container rejection cases in src/tests/runner.test.ts and
src/tests/codex.test.ts must explicitly set CONTAINER=false and restore its
previous value in finally. Assuming it is unset makes the runner test launch
a real reflection when the suite inherits CONTAINER=true. This occurred in
the September 8 Astra reflection: the child timed out after five seconds and
was killed, with no assistant messages or tool calls in its preserved
transcript. The repaired suite passed 95 tests and created no new Codex
session files. Keep this isolation when modifying the guard tests.
