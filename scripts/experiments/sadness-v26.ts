/**
 * SADNESS v26 — WORLD DISSOLVING (refined)
 *
 * v25 established the right SCALE (warm field filling upper canvas,
 * dissolving downward) but the execution was flat:
 * - Warm body too uniform (painted wall, not alive)
 * - Dissolution edge too regular (noise threshold = melting ice cream)
 * - Transition too narrow
 * - Fragments invisible
 *
 * Fixes:
 * 1. VISIBLE veins: larger-scale noise, higher contrast. The warm body
 *    should have branching darker lines like a leaf or membrane.
 * 2. Warmth variation: deep amber areas, golden areas, rose patches.
 *    The body is COMPLEX and alive, not a flat fill.
 * 3. Wider dissolution zone (15-20% of canvas height). The warmth
 *    bleeds out gradually over a wide band. Peninsulas of warmth
 *    reach far down; bays of emptiness cut far up.
 * 4. Larger fragments with internal warmth. They're pieces of the
 *    original, still carrying some of its color.
 * 5. The dissolution edge at different scales: large peninsulas
 *    + medium bays + small raggedness.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

function makePRNG(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeNoise(seed: number, scale: number) {
  let s = seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const SIZE = 256
  const gradX = new Float32Array(SIZE)
  const gradY = new Float32Array(SIZE)
  for (let i = 0; i < SIZE; i++) {
    const a = rand() * Math.PI * 2
    gradX[i] = Math.cos(a)
    gradY[i] = Math.sin(a)
  }
  const perm = new Uint16Array(SIZE)
  for (let i = 0; i < SIZE; i++) perm[i] = i
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[perm[i], perm[j]] = [perm[j], perm[i]]
  }
  const hash = (x: number, y: number) => perm[(perm[x & (SIZE - 1)] + y) & (SIZE - 1)]
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  const dot = (gi: number, x: number, y: number) => gradX[gi] * x + gradY[gi] * y
  return (px: number, py: number): number => {
    const x = px / scale, y = py / scale
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const sx = fade(x - x0), sy = fade(y - y0)
    const n00 = dot(hash(x0, y0), x - x0, y - y0)
    const n10 = dot(hash(x0 + 1, y0), x - x0 - 1, y - y0)
    const n01 = dot(hash(x0, y0 + 1), x - x0, y - y0 - 1)
    const n11 = dot(hash(x0 + 1, y0 + 1), x - x0 - 1, y - y0 - 1)
    const nx0 = n00 + sx * (n10 - n00)
    const nx1 = n01 + sx * (n11 - n01)
    return nx0 + sy * (nx1 - nx0)
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 26001, b: 26002, c: 26003, d: 26004, e: 26005 }
  const seed = seeds[variant] ?? 26001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v26 variant ${variant} (seed: ${seed}) ===`)

  // Background
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)

  // Vein structure — LARGER scale for visibility at thumbnail
  const veinNoise1 = makeNoise(seed + 200, 70)   // was 30 — larger veins
  const veinNoise2 = makeNoise(seed + 210, 35)   // was 15 — medium veins
  const veinNoise3 = makeNoise(seed + 220, 120)  // was 55 — very large structural

  // Warmth variation (color shifts within body)
  const warmVar1 = makeNoise(seed + 250, 250)    // large warm/cool patches
  const warmVar2 = makeNoise(seed + 260, 100)    // medium color shifts
  const warmVar3 = makeNoise(seed + 270, 50)     // small variation

  // Dissolution edge — MULTIPLE scales for organic feel
  const edgeBig = makeNoise(seed + 300, 400)     // huge peninsulas/bays
  const edgeMed = makeNoise(seed + 310, 150)     // medium warping
  const edgeSmall = makeNoise(seed + 320, 55)    // fine raggedness

  // Dissolution within the transition zone
  const dissNoise1 = makeNoise(seed + 400, 50)
  const dissNoise2 = makeNoise(seed + 410, 20)
  const dissNoise3 = makeNoise(seed + 420, 8)    // very fine dissolution

  // Fragment noise
  const fragNoise = makeNoise(seed + 500, 22)

  // === Dissolution edge ===
  const baseEdgeY = H * (0.38 + rand() * 0.06)  // slightly higher than v25
  console.log(`  Base dissolution edge at ~${Math.round(baseEdgeY)}`)

  // Pre-compute edge per column with multi-scale warp
  const edgeY = new Float32Array(W)
  for (let x = 0; x < W; x++) {
    const big = edgeBig(x, baseEdgeY) * H * 0.15    // ±15% of canvas = huge peninsulas
    const med = edgeMed(x, baseEdgeY) * H * 0.06    // ±6%
    const small = edgeSmall(x, baseEdgeY) * H * 0.025 // ±2.5%
    edgeY[x] = baseEdgeY + big + med + small
  }

  // Transition zone width: 18% of canvas height (wider than v25's 8%)
  const transZoneH = H * 0.18

  // === Fragments: larger, warmer, more visible ===
  interface Fragment {
    x: number; y: number; size: number; warmth: number; opacity: number
  }
  const fragments: Fragment[] = []
  const numFragments = 15 + Math.floor(rand() * 8)

  for (let i = 0; i < numFragments; i++) {
    const fx = W * (0.08 + rand() * 0.84)
    const localEdge = edgeY[Math.min(W - 1, Math.max(0, Math.round(fx)))]
    const fallProgress = rand()
    const fy = localEdge + transZoneH * 0.5 + fallProgress * H * 0.30

    const sizeFactor = Math.max(0.12, 1.0 - fallProgress * 0.75)
    const size = (20 + rand() * 55) * sizeFactor  // larger than v25
    const warmth = Math.max(0, 0.65 - fallProgress * 0.7)  // warmer at start
    const opacity = Math.max(0.04, 0.5 - fallProgress * 0.4)  // more visible

    fragments.push({ x: fx, y: fy, size, warmth, opacity })
  }

  // Drip trails
  interface Drip { x: number; startY: number; endY: number; width: number; opacity: number }
  const drips: Drip[] = []
  const numDrips = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < numDrips; i++) {
    const dx = W * (0.08 + rand() * 0.84)
    const localEdge = edgeY[Math.min(W - 1, Math.max(0, Math.round(dx)))]
    drips.push({
      x: dx,
      startY: localEdge - H * 0.01,
      endY: localEdge + H * (0.06 + rand() * 0.22),
      width: 1.5 + rand() * 3.0,
      opacity: 0.07 + rand() * 0.12,
    })
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips`)
  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background
      const bn = bgNoise1(x, y) * 0.6 + bgNoise2(x, y) * 0.4 + 0.5
      const vertFade = y / H
      let bgR = 234 + bn * 5 - vertFade * 10
      let bgG = 226 + bn * 4 - vertFade * 14
      let bgB = 218 + bn * 3 - vertFade * 8

      // Dissolution edge for this column
      const localEdge = edgeY[x]
      const edgeDist = (y - localEdge) / transZoneH  // -ve = above, +ve = below

      let ink = 0
      let warmth = 0

      // === Color variation parameters for the warm body ===
      // These add amber, rose, and gold patches
      const wv1 = warmVar1(x, y) * 0.5 + 0.5
      const wv2 = warmVar2(x, y) * 0.5 + 0.5
      const wv3 = warmVar3(x, y) * 0.5 + 0.5

      if (edgeDist < -0.1) {
        // === DEEP in the warm body ===
        const depth = Math.min(1.0, -edgeDist * 2.0)

        // Vein structure — LARGER scale, HIGHER contrast
        const v1 = Math.abs(veinNoise1(x, y))
        const v2 = Math.abs(veinNoise2(x, y))
        const v3 = Math.abs(veinNoise3(x, y))

        // Multi-scale veins: combine for visible network
        const vein = Math.min(v1, v2 * 1.2) * 0.6 + v3 * 0.4  // min creates sharper ridges
        const veinStrength = Math.max(0, 1.0 - vein * 2.8)

        // Base ink: thicker in body, veins create darker lines
        ink = 0.35 + depth * 0.30 + veinStrength * 0.30
        ink = Math.min(1.0, ink)

        // Warmth with visible variation
        warmth = 0.60 + depth * 0.15
        warmth += wv1 * 0.12  // large warm/cool patches
        warmth += wv2 * 0.06  // medium variation
        warmth += veinStrength * 0.12  // veins are warmer
        warmth = Math.min(1.0, warmth)

      } else if (edgeDist < 0) {
        // === NEAR the dissolution edge (above, but warmth is draining) ===
        const nearness = 1.0 + edgeDist / 0.1  // 0 = at -0.1, 1 = at edge

        // Veins still visible but fading
        const v1 = Math.abs(veinNoise1(x, y))
        const v2 = Math.abs(veinNoise2(x, y))
        const vein = Math.min(v1, v2 * 1.2)
        const veinStrength = Math.max(0, 1.0 - vein * 3.0) * (1.0 - nearness * 0.7)

        // Ink thins near the edge
        ink = 0.30 + veinStrength * 0.20
        // Dissolution noise creates holes
        const dn1 = dissNoise1(x, y) * 0.5 + 0.5
        const dn2 = dissNoise2(x, y) * 0.5 + 0.5
        const holes = nearness * (dn1 * 0.5 + dn2 * 0.5)
        ink *= Math.max(0.02, 1.0 - holes * 1.5)

        // Warmth drains progressively
        warmth = 0.55 * (1.0 - nearness * 0.6)
        warmth += wv1 * 0.06 * (1.0 - nearness)
        warmth += veinStrength * 0.08

      } else if (edgeDist < 1.0) {
        // === IN the dissolution zone ===
        const transT = edgeDist  // 0 = at edge, 1 = fully dissolved

        // Dissolution noise determines what survives
        const dn1 = dissNoise1(x, y) * 0.5 + 0.5
        const dn2 = dissNoise2(x, y) * 0.5 + 0.5
        const dn3 = dissNoise3(x, y) * 0.5 + 0.5
        const survivalNoise = dn1 * 0.4 + dn2 * 0.35 + dn3 * 0.25

        // More needs to survive early in the transition
        const threshold = transT * 0.9
        if (survivalNoise > threshold) {
          const survivalStrength = (survivalNoise - threshold) / (1.0 - threshold + 0.01)
          ink = 0.15 + survivalStrength * 0.25 * (1.0 - transT)
          warmth = Math.max(0, 0.35 * (1.0 - transT * 1.3) * survivalStrength)

          // Faint veins in surviving patches
          const v1 = Math.abs(veinNoise1(x, y))
          if (v1 < 0.12 && transT < 0.5) {
            ink += 0.08 * (1.0 - transT * 2.0)
          }
        }
      }

      // === Fragments below dissolution zone ===
      if (edgeDist >= 0.5) {
        for (const frag of fragments) {
          const fdx = x - frag.x, fdy = y - frag.y
          const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
          const fn = fragNoise(x, y) * 0.25
          const effDist = fdist / frag.size + fn
          if (effDist < 1.0) {
            const falloff = 1.0 - effDist
            const fragInk = falloff * falloff * frag.opacity
            const fragWarmth = frag.warmth * falloff * falloff
            if (fragInk > ink) {
              ink = fragInk
              warmth = fragWarmth
            }
          }
        }
      }

      // === Drip trails ===
      if (edgeDist > -0.05) {
        for (const drip of drips) {
          if (y < drip.startY || y > drip.endY) continue
          const dripT = (y - drip.startY) / (drip.endY - drip.startY)
          const dripWander = makeNoise(seed + Math.floor(drip.x * 7), 20)(drip.x, y) * 4
          const dripDx = Math.abs(x - drip.x - dripWander)
          const dripW = drip.width * (1.0 - dripT * 0.65)
          if (dripDx < dripW) {
            const dripFalloff = 1.0 - dripDx / dripW
            const dripInk = dripFalloff * drip.opacity * (1.0 - dripT * dripT)
            ink = Math.min(1.0, ink + dripInk * 0.35)
          }
        }
      }

      // === Final color ===
      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Color: warm amber with variation → cold grey
      // Add color variation within the warm tones
      const roseShift = wv2 * 0.15    // some areas more rose
      const goldShift = wv3 * 0.10    // some areas more gold

      const warmR = 155 + roseShift * 30 + goldShift * 20
      const warmG = 78 - roseShift * 15 + goldShift * 15
      const warmB = 35 - roseShift * 5 - goldShift * 10
      const coldR = 128, coldG = 122, coldB = 118

      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.4)
      const r = bgR * (1 - opacity) + inkR * opacity
      const g = bgG * (1 - opacity) + inkG * opacity
      const b = bgB * (1 - opacity) + inkB * opacity

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }
    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-v26-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
