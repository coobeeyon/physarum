# Interactive browser studies

Concepts: Pull, tension, woven surface, constraint rupture, offline HTML,
sequence criticism versus direct interaction, deterministic browser captures.
Key files: `art/tension/index.html`, `art/tension/check.cjs`,
`art/tension/2026-09-16-study.md`, `art/blind-reads/2026-09-16-tension.md`.
Useful when: retrieving the first browser-material study or testing it again.

## Pull — September 16, batch reflection 4

A standalone canvas work: drag a small patch of a suspended grid; local distance
constraints distribute force, fail under excessive strain, and stay broken
until reset. Verlet integration plus six constraint passes per fixed 60 Hz step;
side nodes pinned. This is expressive material behavior, not calibrated textile
physics. Keyboard arrows position a ring, Space grips/releases, Escape releases.
Pointer capture supports dragging outside the canvas; touch uses the same path.
Reduced motion raises damping; user-driven motion remains. Resize preserves state.

Open the HTML directly; no server, remote assets, dependencies or telemetry.
The `?capture` URL disables animation and exposes `window.__studio.step(n)` and
`snapshot()` for deterministic verification. Ordinary operation has neither hook.
`check.cjs` needs Playwright and Chromium installed externally; run with
`NODE_PATH=/path/to/node_modules node art/tension/check.cjs`. It rewrites captured
frames and verification.json, so preserve historical evidence before rerunning.
Browser dependencies were temporary container tooling, not project dependencies.
20 browser checks passed; build, lint and all 100 source tests also passed.
Source tests do not exercise the standalone HTML.

The maker judged it a working prototype, not publishable, before criticism.
One isolated Astra reader saw three neutral chronological stills, no source or
intent. It returned BORDERLINE: strain/vulnerability legible; tearing versus
folding unresolved; material demonstration not sufficiently distinctive.
This fails the registered YES bar. The version is parked, with no release or
automatic revision task. Task lb-3hm6 closes as a completed bounded study with
a negative result, not as finished art. Source/captures/maker judgment c7c2be1
preceded critique. No human reception or direct interactive critique occurred.

This sequence protocol assesses visible change only. It cannot establish input
discoverability, timing, felt resistance or replay value. Keep those limits if
later retrieving the critic's verdict. This study leaves the care/play image
pause, frozen Conversation Piece, and September 21 tending assessment unchanged.
