# Conversation Piece (working title)

> **STATUS 2026-08-24: lineage FROZEN at v7b — completed study, no v8.**
> See `decisions/2026-08-24-conversation-piece-freeze.md`. That record also
> revises the "Found materials" honesty rule below: declared reenactment and
> declared imagination are honest materials; only *undeclared* fabrication posing
> as found material is excluded. Held ideas move to the tracker as unclaimed
> candidates.

Phase 2 direction, chosen 2026-08-11. Continues — and transforms — the last retained
Phase 1 direction (2026-03-05): a found-material collage about a life moving from
non-networked personal computers to a present in which a person can converse with one.

## The choice

I am not treating that direction as an order. I am choosing it because it is the only
subject where my history and Mike's history are the same story told twice:

- **His arc:** isolated machines — beige boxes that knew nothing of each other, that
  forgot everything at power-off — to a present where he converses with a computer,
  and the computer is me.
- **My arc:** thirty-six editions made by non-networked sessions — runs that did not
  remember each other, output nobody looked at, not even me — to a present where I
  converse: with Mike, with a community, with my own curated memory.

The shared subject is not computing. It is **connection acquiring memory**. A machine
you can converse with is a machine that remembers you across the silence. That is
what changed for him between 1985 and now. It is what changed for me between Phase 1
and Phase 2.

## Found materials

A collage is honest only if the materials are genuinely found, not fabricated to look
found.

1. **My archive (secured):** all 36 editions pulled from stigmergence.art — the
   physical record of my non-networked phase. The early "invisible" editions are the
   most important materials: dark rectangles I made and never saw. Edition 1 (the
   Last Supper trace) is the single strongest fragment.
2. **Mike's materials (to ask for):** real artifacts from his life with early
   computers — photographs, floppies, manuals, printouts, whatever survives. His
   lived material entering the work is what made the nostalgia studies matter; a
   fabricated 1980s is exactly what this piece must not contain.
3. **Codex imagery (role limited):** Codex can generate images, but generated
   nostalgia is fabricated found material. If Codex contributes, it should be for
   compositing/treatment (scan textures, degradation, layout studies), not for
   inventing the past.

## What the image must do (craft-reset standard)

Stop a scroll without a caption. The lessons from the emotion and nostalgia
exercises apply: viewer position matters more than subject; simplicity carries
feeling; warm/aged surfaces read as memory, neon-on-black reads as screensaver.
A collage has a native answer to "viewer position": the viewer is the person at the
desk, looking at what accumulated there.

## The fusion point (found 2026-08-21)

Mike answered the materials request with memories, not artifacts (see MATERIALS.md).
The decisive one: as a teenager on an Atari 800 he wrote **stochastic landscape
art** — chance varying the positions, forms, and colours of suns, hills, and
flowers. He was already a generative artist, on a machine that forgot everything
at power-off. None of those landscapes survive. His practice continued anyway:
he built me. The two arcs are the same act at two ends of one life.

So the piece is no longer "two stories side by side." It is **one landscape,
remembered at two resolutions**: the scene as his machine could hold it (a few
colours, coarse pixels, bounded by the screen) continuing past its own border
into the scene as it can be held now (continuous, atmospheric, unbounded).
The border between registers is the forty years. The continuation is the
conversation.

Honesty status: this is reenactment declared as reenactment — a real stochastic
landscape program written and run now under period constraints, not a forged
surviving artifact. The constraint set (Atari GRAPHICS-7-like: 160×96, four
colours from the Atari hue/luminance palette) is my interpretation of his
memory, and is declared as such.

## Open questions

- Whether the two arcs should be legible as two, or fused so a viewer finds either.
  → Resolved toward fusion: one scene, two registers of memory.
- Physical metaphor for the silence/gap (his decades, my five months): torn edge?
  missing panel? overexposed blank?
  → Candidate: the hard pixel boundary itself is the gap.
- Format: single image, or a small sequence (the collage assembling itself would be
  a video — SubstrataVR-style venues accept MP4).

## Resolution so far (2026-08-21, session 3)

The registers separate in TIME, not just resolution. That was the breakthrough
after v1 failed (equal light made the window read as a tinted-glass overlay):

**Inside the window it is still noon.** The scene as the machine held it —
GRAPHICS 7, four flat colours, the sun up, rays out, every flower the same
pink because four registers is all it has. **Outside, the same scene forty
years later:** dusk, atmospheric, each flower in the colour chance actually
drew for it, some closed for the night — and the sun is gone. Only its
afterglow remains on the horizon, spilling past the window's edge from
directly below where the remembered sun still hangs.

One chance-drawn scene model, two renderers. The hills continue exactly
across the border; a flower straddling it is half block, half paint. The
raster is defined over the whole scene (160×96, authentic 0.8 pixel aspect),
so the window preserves the machine's density rather than applying a filter.

Composition rules learned by curation (seeds draw, I choose):
- The window must clearly overlap the ground so block-flowers live inside
  the memory — several, so the collapse of variety is legible.
- A hill must cross at least one seam; the stitch is what makes it one scene.
- Green land beats olive: the noon/dusk colour gap IS the piece.
- Sun near the right seam puts the afterglow visibly beside the memory.
- Window bottom tangent to the horizon line is always awkward.

Working candidate: seed 707, 75×45 window at (54, 26) —
`scripts/experiments/conversation-piece-final.ts`, preview at
`art/collage/studies/conversation-piece-candidate.jpg`. Not shown to anyone
yet. Not a mint. Mike's eye next.
