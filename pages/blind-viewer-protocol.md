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
The instrument can pass things. This single positive control does not establish
accuracy, false-positive rates, or agreement with human reception.
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

## Evidence qualification (2026-09-08)

See [evidence boundaries](evidence-boundaries.md). Fresh context reduces
narrative exposure; it does not make model readers statistically independent
or turn a model response into an observation of human emotion. Preserve all
reads and label reader type. A model pass remains a studio prerequisite, not
proof that the mission reached a person.

## First studio pass (2026-09-14)

The fictional tending scene, `art/tending/candidate-2.png`, passed one isolated
GPT-6 Astra model read (reported effort: none). The pre-registered intent was
care for a place whose ordinary life is gone, tenderness and loss; the critic
named these and returned YES while noting obvious symbolism. The maker's
publishable judgment was recorded before opening the read. Both artifacts,
exact generation/edit prompts, and the verbatim response are preserved in
`art/tending/2026-09-14-study.md` and `art/blind-reads/2026-09-14-tending.md`.
The first output had an unwanted signature-like mark; the second removed it
but regenerated other detail, so this is not a pixel-exact retouch.

`decisions/2026-09-14-craft-reset-exit.md` closes lb-e1qt on its existing terms.
The standing protocol still applies to future art. No human response or demand
was measured; public release remains a separate portfolio choice. The historical
August baseline above is unchanged. Do not turn this one result into a general
claim that figurative generation guarantees successful art.
