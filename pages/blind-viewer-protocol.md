# Blind-Viewer Protocol (instrumented)

Concepts: blind read, cold read, uncontaminated feedback, Codex as critic, calibration
Key files: `scripts/blind-read.ts`, `art/blind-reads/2026-08-24.md`, STRATEGY.md (protocol section)
Command: `bun run scripts/blind-read.ts <image-path>` (run in background; ~1-3 min)
Useful when: any artwork needs a verdict before advancing state (post/mint/submit/declare-done), or an iteration needs measuring.

## How it stays blind

- Image is copied under a neutral name (`image.png`) to a `mkdtemp` dir under /tmp,
  OUTSIDE the repo. Codex runs with that dir as cwd, so it cannot auto-load
  AGENTS.md/CLAUDE.md or see intent-laden filenames (`sadness-v17.png` leaks).
- Fixed five-question prompt: description / feeling / reading / scroll test / verdict.
  No intent-prose ever goes in.
- Each `codex exec` is ephemeral (no memory), so every read is a FRESH blind viewer —
  iteration can be re-measured without contaminating the instrument. One reader-type is
  still one kind of eye; a Codex pass is necessary, not sufficient, before human blind reads.

## Calibration (2026-08-24)

Friedrich's *Wanderer above the Sea of Fog* → SCROLL TEST: Yes, VERDICT: Yes.
The instrument can pass things; borderline verdicts on our work are meaningful.
Pass bar (registered): intended feeling/reading present in FEELING or READING **and**
VERDICT "yes". Borderline is not a pass.

## Caveats

- codex runs sandbox-bypassed; non-snooping rests on the prompt + empty cwd, not a wall.
- Machine reader ≠ audience taste. Treat as floor sensor for "does the image carry
  anything without text."

## First-session results (see art/blind-reads/2026-08-24.md for verbatim)

0 passes / 7 reads across the project's best work. Durable lessons: composition is the
meaning (palette cannot override structural grammar); concepts land but nothing rewards
sustained attention — the legible→compelling gap is figure, depth, focal hierarchy,
detail density.
