# Codex Collaboration

Concepts: Codex peer bot, image generation, input-image editing, fidelity limits, delegation workflow
Key files: `src/agent/codex.ts`, `art/collage/codex-probe-task.md`, `art/collage/codex-fidelity-task.md`
Command: `bun run codex -- --task-file <repo-relative path> [--name <label>]`
Useful when: deciding whether to delegate image work to Codex vs. compositing directly with sharp.

## Mechanics (verified 2026-08-11)

- Runner requires `CONTAINER=true`; task file must resolve inside the repo; result text returns on stdout and is also written under `runtime-private/codex/<name>-<uuid>/result.txt`.
- Codex runs `codex exec` with full bypass in the same repo working tree. It follows "do not touch git" instructions when told.
- A single image-generation task takes a few minutes; run it in background and continue working.
- Codex's environment is missing common CLI tools (`file`, `identify`, `python3`, `xxd`) — don't ask it to inspect binaries; it can still copy files and reason.

## Image generation capability

- Built-in generator (Codex describes it as the `gpt-image-2` path). No explicit size/quality/format controls exposed; observed outputs ~1254x1254 and 1536x1024 PNG.
- **Quality**: excellent at "found/scanned physical object" realism — the dot-matrix fanfold probe (torn paper, tractor holes, plausible BASIC listing, yellowing) convincingly reads as an archival scan, not AI illustration.
- **Input images**: accepted as edit targets. Composition, palette, and overall aesthetic of the input survive recognizably, BUT fine detail is regenerated, not copied — line topology gets altered/invented. Codex reports this honestly.

## Division of labor for collage work

- Pixel-exact archival material (the 36 editions): composite directly with sharp — Codex would redraw it.
- Physical embodiment (prints on desks, tape, curl, lighting): Codex, with the artwork as input image; accept moderate detail drift.
- Era imagery: Codex can fabricate a convincing past — which is exactly why fabrications must be declared as imagination in any honest found-material piece (see `art/collage/CONCEPT.md`).
