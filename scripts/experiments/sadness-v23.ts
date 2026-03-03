/**
 * SADNESS v23 — VERTICAL DISSOLUTION
 *
 * v22's trailing horizontal stroke reads as "ink mark" not sadness.
 * The seismograph artifact (regular oscillation when thin) makes
 * the ending feel mechanical. And horizontal motion doesn't carry
 * the weight of gravity.
 *
 * New concept: vertical dissolution. A warm, soft form near the
 * top of the canvas — not a stroke, but a presence. Something that
 * had coherence, had warmth, had life. And it's dissolving downward.
 *
 * Gravity pulls it apart. The form breaks into fragments, then
 * drips, then mist, then nothing. The vast empty space below is
 * what it's falling into.
 *
 * The mark is NOT a brushstroke. It's a FORM — something that
 * looks like it once existed as a whole and is now coming apart.
 * Warm amber core fading to grey at dissolving edges.
 *
 * Below the main form: fragments that have already detached.
 * Getting smaller, fainter, colder as they fall. Some drips
 * trailing down from the main body. Ghost traces where fragments
 * already disappeared.
 *
 * The bottom third of the canvas is empty warm grey. Weight of nothing.
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
  const seeds: Record<string, number> = { a: 23001, b: 23002, c: 23003, d: 23004 }
  const seed = seeds[variant] ?? 23001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v23 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)

  // Shape noise for the dissolving form
  const shapeNoise1 = makeNoise(seed + 200, 80)
  const shapeNoise2 = makeNoise(seed + 210, 30)
  const shapeNoise3 = makeNoise(seed + 220, 150)
  const dissolveNoise = makeNoise(seed + 230, 45)
  const dissolveNoise2 = makeNoise(seed + 240, 15)

  // Drip noise
  const dripNoise = makeNoise(seed + 300, 20)

  // === Parameters ===
  // Main form: an organic shape in the upper portion
  const formCenterX = W * (0.40 + rand() * 0.20)
  const formCenterY = H * (0.22 + rand() * 0.08)
  const formRadiusX = W * (0.14 + rand() * 0.06)
  const formRadiusY = H * (0.10 + rand() * 0.04)

  console.log(`  Form center: (${Math.round(formCenterX)}, ${Math.round(formCenterY)})`)
  console.log(`  Form radius: (${Math.round(formRadiusX)}, ${Math.round(formRadiusY)})`)

  // === Build the ink map ===
  const inkMap = new Float32Array(W * H)
  const warmthMap = new Float32Array(W * H) // 1 = warm amber, 0 = cold grey

  // --- Main form: organic shape with dissolving bottom edge ---
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Distance from form center (elliptical)
      const dx = (x - formCenterX) / formRadiusX
      const dy = (y - formCenterY) / formRadiusY
      const baseDist = Math.sqrt(dx * dx + dy * dy)

      // Organic edge distortion
      const angle = Math.atan2(dy, dx)
      const edgeWarp = shapeNoise1(x, y) * 0.3 + shapeNoise2(x, y) * 0.15
      const dist = baseDist + edgeWarp

      if (dist > 1.4) continue // well outside form

      // Dissolution: bottom edge dissolves more
      // dyNorm: 0 at top of form, 1 at bottom, >1 below
      const dyNorm = Math.max(0, (y - (formCenterY - formRadiusY)) / (formRadiusY * 2))
      const dissolveThreshold = 0.5 + dyNorm * 0.5 // top: solid if dist<0.5, bottom: solid if dist<1.0

      // Noise-driven dissolution at edges
      const dissNoise = dissolveNoise(x, y) * 0.5 + dissolveNoise2(x, y) * 0.3 + 0.4
      const dissolveEdge = dissolveThreshold + dissNoise * 0.35

      if (dist > dissolveEdge) continue

      // Ink density: thick at core, fading at edges
      const coreness = Math.max(0, 1.0 - dist / dissolveEdge)
      let ink = coreness * coreness
      ink = Math.min(1.0, ink * 1.5)

      // More transparent at bottom (dissolving)
      ink *= Math.max(0.1, 1.0 - dyNorm * 0.5)

      // Warmth: warm at center, cooling at edges and especially at bottom
      let warmth = coreness * (1.0 - dyNorm * 0.6)
      warmth = Math.max(0, Math.min(1.0, warmth))

      if (ink > inkMap[idx]) {
        inkMap[idx] = ink
        warmthMap[idx] = warmth
      }
    }
  }

  // --- Falling fragments: detached pieces below the main form ---
  const numFragments = 6 + Math.floor(rand() * 5)
  interface Fragment {
    x: number; y: number; size: number; warmth: number; opacity: number
  }
  const fragments: Fragment[] = []

  for (let i = 0; i < numFragments; i++) {
    // Fragments fall from the bottom edge of the form
    const fragX = formCenterX + (rand() - 0.5) * formRadiusX * 1.8
    // Vertical position: increasing distance from form bottom
    const formBottom = formCenterY + formRadiusY
    const fallDist = (i + 1) / numFragments
    const fragY = formBottom + fallDist * H * 0.35 + rand() * H * 0.05
    // Size decreases with distance
    const fragSize = W * (0.025 + rand() * 0.02) * (1.0 - fallDist * 0.6)
    // Warmth decreases with distance
    const fragWarmth = Math.max(0, 0.7 - fallDist * 0.8)
    // Opacity decreases
    const fragOpacity = Math.max(0.05, 0.6 - fallDist * 0.5)

    fragments.push({ x: fragX, y: fragY, size: fragSize, warmth: fragWarmth, opacity: fragOpacity })
  }

  for (const frag of fragments) {
    const fragNoise1 = makeNoise(seed + Math.floor(frag.x * 100), 15 + rand() * 10)
    const fragNoise2 = makeNoise(seed + Math.floor(frag.y * 100), 8 + rand() * 6)

    for (let y = Math.max(0, Math.floor(frag.y - frag.size * 2)); y < Math.min(H, Math.ceil(frag.y + frag.size * 2)); y++) {
      for (let x = Math.max(0, Math.floor(frag.x - frag.size * 2)); x < Math.min(W, Math.ceil(frag.x + frag.size * 2)); x++) {
        const dx = (x - frag.x) / frag.size
        const dy = (y - frag.y) / frag.size
        let dist = Math.sqrt(dx * dx + dy * dy * 0.7) // slightly vertically stretched
        dist += fragNoise1(x, y) * 0.3 + fragNoise2(x, y) * 0.15

        if (dist > 1.0) continue

        const falloff = 1.0 - dist
        const ink = falloff * falloff * frag.opacity

        const idx = y * W + x
        if (ink > inkMap[idx]) {
          inkMap[idx] = ink
          warmthMap[idx] = frag.warmth * falloff
        }
      }
    }
  }

  // --- Drips: thin vertical traces trailing down from form and fragments ---
  const numDrips = 4 + Math.floor(rand() * 4)
  for (let d = 0; d < numDrips; d++) {
    // Start from bottom edge of main form
    let dripX = formCenterX + (rand() - 0.5) * formRadiusX * 1.6
    let dripY = formCenterY + formRadiusY * (0.6 + rand() * 0.5)
    const dripLength = H * (0.08 + rand() * 0.18)
    const dripWidth = 2 + rand() * 4
    const dripOpacity = 0.15 + rand() * 0.25

    const steps = Math.ceil(dripLength / 1.5)
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      dripY += 1.5 + rand() * 0.5
      dripX += dripNoise(dripX, dripY) * 1.2 // slight horizontal wander

      const w = dripWidth * (1.0 - t * 0.7) * (0.7 + dripNoise(dripX + 500, dripY) * 0.6)
      const opacity = dripOpacity * (1.0 - t * t) // fade to nothing

      if (w < 0.5 || opacity < 0.01) break

      const margin = Math.ceil(w + 1)
      for (let py = Math.max(0, Math.floor(dripY - margin)); py < Math.min(H, Math.ceil(dripY + margin)); py++) {
        for (let px = Math.max(0, Math.floor(dripX - margin)); px < Math.min(W, Math.ceil(dripX + margin)); px++) {
          const dd = Math.sqrt((px - dripX) ** 2 + (py - dripY) ** 2)
          if (dd < w) {
            const falloff = 1.0 - dd / w
            const ink = falloff * opacity
            const idx = py * W + px
            inkMap[idx] = Math.min(1.0, inkMap[idx] + ink * 0.4)
            // Drips are cold
            if (ink > 0.01) warmthMap[idx] = Math.min(warmthMap[idx], 0.15)
          }
        }
      }
    }
  }

  // --- Ghost traces: very faint marks where fragments have already dissolved ---
  const numGhosts = 3 + Math.floor(rand() * 3)
  for (let g = 0; g < numGhosts; g++) {
    const ghostX = formCenterX + (rand() - 0.5) * formRadiusX * 2.2
    const ghostY = formCenterY + formRadiusY * 1.5 + rand() * H * 0.25
    const ghostSize = W * (0.01 + rand() * 0.015)
    const ghostOpacity = 0.03 + rand() * 0.04

    for (let y = Math.max(0, Math.floor(ghostY - ghostSize * 2)); y < Math.min(H, Math.ceil(ghostY + ghostSize * 2)); y++) {
      for (let x = Math.max(0, Math.floor(ghostX - ghostSize * 2)); x < Math.min(W, Math.ceil(ghostX + ghostSize * 2)); x++) {
        const dx = (x - ghostX) / ghostSize
        const dy = (y - ghostY) / ghostSize
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > 1.0) continue

        const falloff = 1.0 - dist
        const ink = falloff * ghostOpacity
        const idx = y * W + x
        inkMap[idx] = Math.min(1.0, inkMap[idx] + ink)
        // Ghosts are completely cold
      }
    }
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips, ${numGhosts} ghost traces`)
  console.log("  Rendering pixels...")

  // === Render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkMap[idx]
      const warmth = warmthMap[idx]

      // Background: warm grey that gets slightly cooler toward bottom
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5
      const vertFade = y / H // 0 at top, 1 at bottom

      // Warm cream at top, cooler grey at bottom
      let bgR = 228 + bn * 8 - vertFade * 12
      let bgG = 222 + bn * 6 - vertFade * 14
      let bgB = 215 + bn * 5 - vertFade * 8

      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Warm amber ink (high warmth) to cold grey (low warmth)
      const warmR = 145, warmG = 72, warmB = 32    // deep amber
      const coldR = 105, coldG = 100, coldB = 98   // cool grey-brown
      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.3)
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

  const filename = `output/sadness-v23-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
