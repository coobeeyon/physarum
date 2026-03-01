# Art Direction Exploration — Session Findings

## The Problem

36 editions of thin neon trails on dark backgrounds. Parameter variations that don't create
fundamentally different visual experiences. The "sameness" problem.

Root causes identified:
1. **Rendering**: Additive colormap on black produces uniform neon aesthetic
2. **Trail width**: Physarum deposits to single pixel — trails always 1px wide regardless of params
3. **Composition**: Agents fill every pixel uniformly — no focal points, no negative space
4. **Palette**: High-saturation colormaps (viridis, inferno, plasma) all read as "screen saver"

## What Was Tested

### Algorithms
- **Reaction-Diffusion (Gray-Scott)** — 2 chemical species, feed/kill rates control pattern type
- **Spatially-Varying RD** — f/k modulated by noise across canvas, multiple pattern types coexist
- **Differential Growth** — closed curve with separation/spring/growth forces
- **Flow Fields** — particles follow Perlin noise gradients
- **Physarum with alternative rendering** — ink wash, relief, contour, warm subtractive
- **Physarum with compositional food** — intentional food placement for negative space

### Palettes
- Warm earth (cream → terracotta → charcoal) — **strongest**
- Ink on paper (cream → near-black, threshold) — **strong for RD**
- Midnight copper (dark → warm copper → gold) — decent but dark
- Blood oxygen (maps both U and V chemicals) — interesting, needs refinement
- Forest (sage → deep green → black) — failed for most patterns
- Neon-on-dark — confirmed: this is the problem, not the solution

### Seeding / Composition
- Full canvas — produces wallpaper (no composition)
- Scattered circles — best for RD, creates natural clusters + negative space
- Asymmetric (off-center mass + scattered small) — strongest composition
- Ring — decent for centered forms
- Food maps (diagonal, constellation, erosion, shore) — good for physarum composition

## Results Ranking

### Tier 1: Genuinely compelling
1. **rdv-tissue** — Spatially varying RD, earth palette. Lichen colony quality.
2. **rdv-specimen** — Spatially varying RD, ink palette. Natural history illustration.
3. **rd2-asymmetric-earth** — Off-center donut + scattered coral. Strong composition.
4. **rd2-coral-scattered** — Petri dish photograph. Rich internal texture.

### Tier 2: Worth developing
5. composed-diagonal-warm — Marbled paper, limited by 1px trails
6. physarum-warmpop — Best physarum rerender, saturated color mixing
7. growth-coral — Elegant but generic (looks like tutorial output)
8. flow-silk — Delicate calligraphy, no focal point

### Tier 3: Failed
- Everything on dark backgrounds
- RD spots/mitosis with ink palette (blank)
- Flow fields generally (too sparse or too uniform)

## Key Discoveries

1. **Warm backgrounds are transformative.** The same data rendered on cream vs black
   produces completely different emotional responses. Cream reads as "specimen" or "craft."
   Black reads as "screen saver."

2. **Thick texture > thin trails.** RD produces worm-like patterns that fill space with
   visual weight. Physarum's 1px trails can never achieve this at 2048x2048.

3. **Composition through seeding.** Where you place the initial conditions determines
   the final composition. Scattered circles → petri dish. Off-center mass → asymmetric weight.
   This is the most important control lever.

4. **Spatial variation creates life.** rdv-tissue works because different regions develop
   different patterns. This is how real biological systems look — heterogeneous, not uniform.

5. **Subtractive color on warm paper** makes physarum usable. But it's a rendering fix,
   not a fundamental texture improvement.

## Strongest Directions to Pursue

1. **Reaction-Diffusion with compositional seeding** — This is the breakthrough.
   Vary seed placement for composition. Vary f/k for pattern type. Warm earth palettes.

2. **Spatially-varying RD** — rdv-tissue is the most complex piece. Multiple pattern
   types coexisting feels genuinely alive.

3. **Hybrid: physarum as food map for RD** — Use physarum trail structure to seed RD
   growth regions. Physarum provides the compositional skeleton, RD fills with texture.

4. **Physarum warm rendering** — Not as strong as RD alone but worth combining.
   The marbled paper quality could complement RD texture.

## What NOT to do

- No more neon on black
- No more uniform fills (patterns edge-to-edge with no composition)
- No more single-algorithm parameter sweeps masquerading as variety
- No minting until the work is genuinely good
