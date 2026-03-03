/**
 * SADNESS v27 — FAILING REACH
 *
 * A single large gestural mark that reaches upward from the lower canvas.
 * It starts with full warmth — wide, amber, confident. As it arcs up
 * and curves, it thins, the color drains to grey, trembling increases,
 * and the mark breaks apart into fragments. It never reaches the top.
 *
 * The vast empty space above the failed reach IS the sadness.
 * The trajectory droops like a sigh — the gesture of giving up.
 *
 * This avoids the horizon problem (v25/v26) because the mark is a
 * diagonal/curved gesture, not a horizontal division.
 *
 * Key elements:
 * - Bezier trajectory: rise → apex → droop
 * - Width: 150px → 6px (narrowing with loss of strength)
 * - Color: warm amber → cold grey (warmth draining away)
 * - Edge: smooth → ragged → dry brush → dissolution
 * - Gaps appear in later sections (the mark breaking)
 * - Fragments scatter below the droop (pieces falling off)
 * - Drip trails from the thickest section (warmth running down)
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
  const seeds: Record<string, number> = { a: 27001, b: 27002, c: 27003, d: 27004, e: 27005 }
  const seed = seeds[variant] ?? 27001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v27 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const edgeNoise1 = makeNoise(seed + 200, 12)
  const edgeNoise2 = makeNoise(seed + 210, 35)
  const dryNoise = makeNoise(seed + 220, 4)       // dry brush striations
  const gapNoise = makeNoise(seed + 230, 18)       // gaps in the mark
  const tremorNoise1 = makeNoise(seed + 240, 30)   // large-scale trembling
  const tremorNoise2 = makeNoise(seed + 245, 10)   // fine trembling
  const colorNoise = makeNoise(seed + 300, 70)     // color variation within warm section
  const fragNoise = makeNoise(seed + 400, 20)      // fragment shape distortion

  // === Define the trajectory ===
  // Start: lower-left area
  const startX = W * (0.12 + rand() * 0.10)
  const startY = H * (0.78 + rand() * 0.06)

  // Apex: upper area (where the reach peaks)
  const apexX = W * (0.36 + rand() * 0.12)
  const apexY = H * (0.16 + rand() * 0.08)

  // End: center-right, drooped down (the failure)
  const endX = W * (0.58 + rand() * 0.18)
  const endY = H * (0.48 + rand() * 0.14)

  console.log(`  Start: (${Math.round(startX)}, ${Math.round(startY)})`)
  console.log(`  Apex:  (${Math.round(apexX)}, ${Math.round(apexY)})`)
  console.log(`  End:   (${Math.round(endX)}, ${Math.round(endY)})`)

  // Cubic bezier control points
  // P1 pulls strongly upward (the force of the reach)
  // P2 is near the apex, starting to droop
  const P0 = [startX, startY]
  const P1 = [
    startX + (apexX - startX) * 0.45,
    startY - (startY - apexY) * 1.05,  // pulls BEYOND the apex height
  ]
  const P2 = [
    apexX + (endX - apexX) * 0.45,
    apexY + (endY - apexY) * 0.15,     // just starting to droop
  ]
  const P3 = [endX, endY]

  function bezier(t: number): [number, number] {
    const u = 1 - t
    return [
      u*u*u*P0[0] + 3*u*u*t*P1[0] + 3*u*t*t*P2[0] + t*t*t*P3[0],
      u*u*u*P0[1] + 3*u*u*t*P1[1] + 3*u*t*t*P2[1] + t*t*t*P3[1],
    ]
  }

  function bezierTangent(t: number): [number, number] {
    const u = 1 - t
    const dx = 3*u*u*(P1[0]-P0[0]) + 6*u*t*(P2[0]-P1[0]) + 3*t*t*(P3[0]-P2[0])
    const dy = 3*u*u*(P1[1]-P0[1]) + 6*u*t*(P2[1]-P1[1]) + 3*t*t*(P3[1]-P2[1])
    const len = Math.sqrt(dx*dx + dy*dy) || 1
    return [dx/len, dy/len]
  }

  // === Sample the path ===
  const NUM_SAMPLES = 1500
  interface PathPoint {
    x: number; y: number; t: number
    nx: number; ny: number  // perpendicular (normal) direction
  }
  const path: PathPoint[] = []

  for (let i = 0; i <= NUM_SAMPLES; i++) {
    const t = i / NUM_SAMPLES
    const [bx, by] = bezier(t)
    const [tx, ty] = bezierTangent(t)

    // Perpendicular direction
    const nx = -ty, ny = tx

    // Add trembling — increases with t, multi-frequency
    const tremorAmp = 1.0 + t * t * 55    // grows from 1px to 56px
    const tr1 = tremorNoise1(bx, by) * tremorAmp * 0.7
    const tr2 = tremorNoise2(bx, by) * tremorAmp * 0.3

    // Add hesitation pools — the mark slows and puddles at certain t values
    // (simulated by reducing displacement between consecutive points)

    path.push({
      x: bx + nx * (tr1 + tr2),
      y: by + ny * (tr1 + tr2),
      t,
      nx, ny,
    })
  }

  // === Properties along the path ===
  function getWidth(t: number): number {
    // Start wide, reach peak width at t=0.08, then gradually narrow
    if (t < 0.08) return 80 + 80 * (t / 0.08)       // 80→160 (building up)
    if (t < 0.35) return 160 - 30 * ((t - 0.08) / 0.27) // 160→130 (slight thinning during rise)
    if (t < 0.55) return 130 * (1 - (t - 0.35) / 0.20 * 0.45)  // 130→72 (thinning at apex)
    if (t < 0.75) return 72 * (1 - (t - 0.55) / 0.20 * 0.7)    // 72→22 (rapid thinning)
    return Math.max(2.5, 22 * (1 - (t - 0.75) / 0.25 * 0.88))  // 22→2.6 (nearly nothing)
  }

  function getWarmth(t: number): number {
    // Warm amber at start, draining to grey
    if (t < 0.25) return 1.0
    if (t < 0.55) return 1.0 - (t - 0.25) / 0.30 * 0.7   // 1.0→0.3
    if (t < 0.75) return 0.3 - (t - 0.55) / 0.20 * 0.25   // 0.3→0.05
    return Math.max(0.0, 0.05 - (t - 0.75) / 0.25 * 0.05)  // →0
  }

  function getOpacity(t: number): number {
    if (t < 0.4) return 0.92
    if (t < 0.65) return 0.92 - (t - 0.4) / 0.25 * 0.35   // 0.92→0.57
    return Math.max(0.06, 0.57 - (t - 0.65) / 0.35 * 0.51)  // 0.57→0.06
  }

  // === Render ink buffer ===
  const inkBuffer = new Float32Array(W * H)
  const warmBuffer = new Float32Array(W * H)

  console.log("  Rendering gesture...")
  let lastPct = -1

  for (let i = 0; i < path.length; i += 1) {
    const p = path[i]
    const t = p.t
    const width = getWidth(t)
    const warmth = getWarmth(t)
    const opacity = getOpacity(t)

    // Skip if in a gap
    if (t > 0.45) {
      const gn = gapNoise(p.x, p.y) * 0.5 + 0.5
      const gapThreshold = (t - 0.45) * 1.3
      if (gn < gapThreshold * 0.55) continue  // gap in the mark
    }

    const margin = Math.ceil(width * 1.5)
    const minX = Math.max(0, Math.floor(p.x - margin))
    const maxX = Math.min(W - 1, Math.ceil(p.x + margin))
    const minY = Math.max(0, Math.floor(p.y - margin))
    const maxY = Math.min(H - 1, Math.ceil(p.y + margin))

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - p.x, dy = py - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Edge distortion — gets more ragged with t
        const en1 = edgeNoise1(px, py) * (0.25 + t * 0.5)
        const en2 = edgeNoise2(px, py) * (0.15 + t * 0.3)
        const effWidth = width * (1.0 + en1 + en2)

        if (dist < effWidth) {
          // Dry brush effect after t=0.5
          if (t > 0.50) {
            const dn = dryNoise(px, py) * 0.5 + 0.5
            const dryThreshold = (t - 0.50) * 1.5
            if (dn < dryThreshold * 0.65) continue  // striation gap
          }

          const falloff = 1.0 - dist / effWidth
          const inkAmount = falloff * falloff * opacity

          const idx = py * W + px
          if (inkAmount > inkBuffer[idx]) {
            inkBuffer[idx] = inkAmount

            // Color variation within the warm section
            const cn = colorNoise(px, py) * 0.5 + 0.5
            const localWarmth = warmth + (cn - 0.5) * 0.15 * warmth
            warmBuffer[idx] = Math.max(0, Math.min(1, localWarmth))
          }
        }
      }
    }

    const pct = Math.floor(i / path.length * 100)
    if (pct % 20 === 0 && pct !== lastPct) { console.log(`    ${pct}%`); lastPct = pct }
  }

  // === Fragments: pieces that have broken off the droop section ===
  interface Fragment {
    x: number; y: number; size: number; warmth: number; opacity: number
  }
  const fragments: Fragment[] = []
  const numFragments = 10 + Math.floor(rand() * 8)

  for (let i = 0; i < numFragments; i++) {
    // Position along the later part of the path
    const pathT = 0.45 + rand() * 0.50  // from mid-droop onward
    const pathIdx = Math.floor(pathT * path.length)
    const pp = path[Math.min(pathIdx, path.length - 1)]

    // Fragment falls below the path
    const fallDist = 30 + rand() * 200
    const driftX = (rand() - 0.5) * 80

    const fx = pp.x + driftX + pp.nx * fallDist * 0.3
    const fy = pp.y + fallDist  // falls downward

    // Fragments further from the path are smaller, colder, fainter
    const distFactor = Math.max(0.1, 1.0 - fallDist / 250)
    const size = (8 + rand() * 30) * distFactor
    const warmth = getWarmth(pathT) * distFactor * 0.7
    const opacity = Math.max(0.04, 0.35 * distFactor)

    if (fx > 0 && fx < W && fy > 0 && fy < H) {
      fragments.push({ x: fx, y: fy, size, warmth, opacity })
    }
  }

  // Render fragments into ink buffer
  for (const frag of fragments) {
    const ir = Math.ceil(frag.size * 1.5)
    for (let py = Math.max(0, Math.floor(frag.y - ir)); py < Math.min(H, Math.ceil(frag.y + ir)); py++) {
      for (let px = Math.max(0, Math.floor(frag.x - ir)); px < Math.min(W, Math.ceil(frag.x + ir)); px++) {
        const dx = px - frag.x, dy = py - frag.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const fn = fragNoise(px, py) * 0.3
        const effSize = frag.size * (1.0 + fn)
        if (dist < effSize) {
          const falloff = 1.0 - dist / effSize
          const inkAmount = falloff * falloff * frag.opacity
          const idx = py * W + px
          if (inkAmount > inkBuffer[idx]) {
            inkBuffer[idx] = inkAmount
            warmBuffer[idx] = frag.warmth
          }
        }
      }
    }
  }

  // === Drip trails from the thickest section ===
  interface Drip {
    x: number; startY: number; endY: number; width: number
    warmth: number; opacity: number
  }
  const drips: Drip[] = []
  const numDrips = 4 + Math.floor(rand() * 4)

  for (let i = 0; i < numDrips; i++) {
    // Drips from the early/thick section (t = 0.05 to 0.3)
    const pathT = 0.05 + rand() * 0.25
    const pathIdx = Math.floor(pathT * path.length)
    const pp = path[Math.min(pathIdx, path.length - 1)]

    const dripLen = H * (0.04 + rand() * 0.15)
    drips.push({
      x: pp.x + (rand() - 0.5) * getWidth(pathT) * 0.6,
      startY: pp.y + getWidth(pathT) * 0.3,
      endY: pp.y + getWidth(pathT) * 0.3 + dripLen,
      width: 1.5 + rand() * 3.0,
      warmth: 0.5 + rand() * 0.3,
      opacity: 0.06 + rand() * 0.10,
    })
  }

  // Render drips
  const dripWander = makeNoise(seed + 500, 25)
  for (const drip of drips) {
    for (let y = Math.max(0, Math.floor(drip.startY)); y < Math.min(H, Math.ceil(drip.endY)); y++) {
      const dripT = (y - drip.startY) / (drip.endY - drip.startY)
      const wx = dripWander(drip.x, y) * 5
      const w = drip.width * (1.0 - dripT * 0.6)
      const op = drip.opacity * (1.0 - dripT * dripT)
      for (let x = Math.max(0, Math.floor(drip.x + wx - w * 2)); x < Math.min(W, Math.ceil(drip.x + wx + w * 2)); x++) {
        const dx = Math.abs(x - drip.x - wx)
        if (dx < w) {
          const falloff = 1.0 - dx / w
          const inkAmount = falloff * op
          const idx = y * W + x
          inkBuffer[idx] = Math.min(1.0, inkBuffer[idx] + inkAmount * 0.3)
          if (warmBuffer[idx] < drip.warmth * (1 - dripT)) {
            warmBuffer[idx] = drip.warmth * (1 - dripT)
          }
        }
      }
    }
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips`)
  console.log("  Final render...")

  // === Final pixel render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkBuffer[idx]
      const warmth = warmBuffer[idx]

      // Background: warm cream with subtle variation
      const bn = bgNoise1(x, y) * 0.6 + bgNoise2(x, y) * 0.4 + 0.5
      let bgR = 236 + bn * 5
      let bgG = 228 + bn * 4
      let bgB = 220 + bn * 3

      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Ink color: warm amber → cold grey based on warmth
      // Amber: deeper and richer than plain orange
      const warmR = 160 + warmth * 15
      const warmG = 82 + warmth * 8
      const warmB = 30
      // Cold grey: slightly warm grey (not blue-cold)
      const coldR = 140
      const coldG = 135
      const coldB = 132

      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.5)
      const r = bgR * (1 - opacity) + inkR * opacity
      const g = bgG * (1 - opacity) + inkG * opacity
      const b = bgB * (1 - opacity) + inkB * opacity

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-v27-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
