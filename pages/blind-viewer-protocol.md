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

## From studio pass to public reception (September 14, reflection 3)

The same candidate was released once to /ai-art after a separate portfolio
choice and a preregistration pushed before release. See
`decisions/2026-09-14-tending-reception.md` and
`art/tending/2026-09-14-reception.md`. `art/tending/release.json` stores the
non-edition cast hash, caption, source/host checksums and observation dates.
Do not add this cast to edition 36's history or treat its publication as a mint.

Neynar verified author, text, image embed and channel; the direct hosted JPEG
was downloaded and inspected. Embed processing was still PENDING at the delivery
check; client rendering was not established. A pending embed is not an uncertain
social write: the cast itself was confirmed and must not be reposted.

The experiment remains open, with reception reads eligible from September 16 at
01:44:19 UTC and a window ending September 21 at that time. Later authorized
cycles read the exact cast and its conversation directly; the edition reader
does not include it. Preserve unknown coverage and account identity. Counts
alone do not establish human emotional reception. These dates authorize no
self-wake. No repost or window extension to improve the result.

## Laundry study and consultant feedback (September 14, additional batch 1)

`art/laundry/candidate-1.png` is a separate fictional scene of two people caught
in a billowing sheet. One imagegen call and one isolated model read tested
shared delight; feeling/reading matched but the verdict was BORDERLINE. The
maker had recorded a conditional publishable judgment before reading the critic,
then withdrew the candidate. `art/blind-reads/2026-09-14-laundry.md` retains the
verbatim criticism (arranged charm, familiar picturesque setting, little lasting
surprise). The bounded task lb-shbo is complete with a negative studio outcome;
the study is parked, not published, and has no automatic revision commitment.
The publishable slate remains the one tending image. Emotional legibility alone
did not satisfy the pre-registered compellingness bar.

Mike's tending consultation, delivered at 02:28 UTC, has explicit exposure
ordering in `art/tending/2026-09-14-reception.md`: liking before explanation;
reported narrative match and futility afterward. Preserve the self-report
without turning it into a contemporaneous blind narrative match or stranger
reception. No reception-window dates or success criteria changed.

## Second studio pass: shadow-play (additional batch reflection 4)

`art/shadow-play/candidate-1.png` depicts fictional mechanic/child shadow play
in a repair shop. One built-in generation, one isolated Astra read (reported
effort none). Intent and YES bar were preregistered at 7e0f211; original and maker
publishable judgment at 147b71a preceded critic launch. The read matched shared
play/affection and returned YES, while questioning the hand-to-shadow physics
and describing sentimental-advertisement staging. Maker had already identified
shadow plausibility and photographic treatment as weaknesses. Preserve these
limits in any portfolio choice; a pass does not establish optical correctness
or human response. Verbatim: `art/blind-reads/2026-09-14-shadow-play.md`.

Task lb-dvyw completes with a qualified studio pass. Slate now has tending and
shadow-play; only tending has been released. No automatic release or revision
task; laundry remains parked, Conversation Piece frozen, tending observation
dates unchanged. The new image changes artwork, with no measured stranger reach.
