/**
 * SADNESS v10 — WHAT REMAINS
 *
 * The concept from v8/v9 was right: generate a rich pattern, then dissolve most of it.
 * Scattered remnants in vast emptiness. Loss made visible.
 *
 * What v8/v9 got wrong:
 * - Too faint — invisible on a phone screen
 * - Background too flat — no atmosphere, no space
 * - Fragment edges too circular — looked designed, not dissolved
 * - No warmth in fragments — they were once alive
 *
 * This version fixes all four:
 * - Fragments are dark enough to read clearly (but still muted, not bold)
 * - Background has subtle vertical gradient and texture (sky/atmosphere)
 * - Fragment edges use multi-octave noise with fine detail for truly organic shapes
 * - Fragments have very slight warmth — the ghost of what they were
 *
 * The viewer should feel: something was here. Most of it is gone.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const SIM_SIZE = 1024
const OUT_SIZE = 2048
let W = SIM_SIZE
let H = SIM_SIZE

// ---- PRNG ----
function makePRNG(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Noise ----
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

// ---- Gray-Scott RD simulation ----
function simulateRD(
  f: number, k: number, iterations: number,
  seedFn: (u: Float32Array, v: Float32Array) => void,
): { u: Float32Array; v: Float32Array } {
  const Du = 0.16, Dv = 0.08
  const N = W * H
  const u = new Float32Array(N).fill(1.0)
  const v = new Float32Array(N).fill(0.0)
  const uNext = new Float32Array(N)
  const vNext = new Float32Array(N)

  seedFn(u, v)

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < H; y++) {
      const ym = ((y - 1) + H) % H
      const yp = (y + 1) % H
      for (let x = 0; x < W; x++) {
        const xm = ((x - 1) + W) % W
        const xp = (x + 1) % W
        const i = y * W + x
        const lapU = u[ym * W + x] + u[yp * W + x] + u[y * W + xm] + u[y * W + xp] - 4 * u[i]
        const lapV = v[ym * W + x] + v[yp * W + x] + v[y * W + xm] + v[y * W + xp] - 4 * v[i]
        const uvv = u[i] * v[i] * v[i]
        uNext[i] = u[i] + (Du * lapU - uvv + f * (1.0 - u[i]))
        vNext[i] = v[i] + (Dv * lapV + uvv - (f + k) * v[i])
      }
    }
    u.set(uNext)
    v.set(vNext)
    if (iter % 2000 === 0) console.log(`  RD iteration ${iter}/${iterations}`)
  }
  return { u, v }
}

// ---- Survival islands (hand-placed composition) ----
interface Island {
  x: number; y: number
  radius: number
  strength: number  // 0-1
  warmth: number    // how much warmth remains in this fragment (0 = cold, 1 = warm)
}

function getIslands(): Island[] {
  return [
    // Main remnant: large, lower-left of center, sinking
    // This is the thing you're still holding onto
    {
      x: W * 0.36, y: H * 0.58,
      radius: W * 0.20,
      strength: 0.85,
      warmth: 0.55,   // still warm at its core — the last thing to go cold
    },

    // Second fragment: smaller, upper-right, fading
    // Already going — a memory dissolving
    {
      x: W * 0.70, y: H * 0.32,
      radius: W * 0.12,
      strength: 0.55,
      warmth: 0.15,
    },

    // Third: small, far upper-left, nearly gone
    // You can barely remember this part
    {
      x: W * 0.18, y: H * 0.25,
      radius: W * 0.06,
      strength: 0.35,
      warmth: 0.05,
    },

    // Ghost traces — barely perceptible wisps at the edges
    {
      x: W * 0.80, y: H * 0.70,
      radius: W * 0.03,
      strength: 0.18,
      warmth: 0.0,
    },
    {
      x: W * 0.50, y: H * 0.82,
      radius: W * 0.025,
      strength: 0.12,
      warmth: 0.0,
    },
    {
      x: W * 0.25, y: H * 0.72,
      radius: W * 0.02,
      strength: 0.10,
      warmth: 0.0,
    },
  ]
}

// ---- Dissolution ----
function dissolve(v: Float32Array, islands: Island[], seed: number): Float32Array {
  const dissolved = new Float32Array(v.length)

  // Multi-octave noise for truly organic, torn fragment edges
  const n1 = makeNoise(seed + 100, 50)    // large-scale shape distortion
  const n2 = makeNoise(seed + 200, 20)    // medium raggedness
  const n3 = makeNoise(seed + 300, 8)     // fine torn-edge detail
  const n4 = makeNoise(seed + 400, 120)   // very large-scale asymmetry

  // Find V range
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const vNorm = (v[i] - vMin) / vRange
      if (vNorm < 0.10) continue

      let maxSurvival = 0
      for (const island of islands) {
        const dx = x - island.x
        const dy = y - island.y

        // Asymmetric: compressed above, extended below (gravity, sinking)
        const aboveFactor = dy < 0 ? 1.4 : 1.0
        const belowExtend = dy > 0 ? 0.5 : 0.0
        const dist = Math.sqrt(dx * dx + (dy * aboveFactor) ** 2)

        // AGGRESSIVE multi-octave noise for truly organic edges
        // Each octave adds finer detail — the edge looks TORN, not smooth
        const edgeNoise =
          n4(x, y) * 0.3 +   // large-scale asymmetry
          n1(x, y) * 0.5 +   // shape distortion
          n2(x, y) * 0.35 +  // raggedness
          n3(x, y) * 0.2     // fine tears
        const effectiveRadius = island.radius * (1.0 + edgeNoise * 1.0 + belowExtend)

        if (dist < effectiveRadius) {
          // Gradual fade at edges — dissolution, not a hard boundary
          const t = dist / effectiveRadius
          const fadeCurve = t < 0.25 ? 1.0 : 1.0 - (t - 0.25) / 0.75
          const survival = island.strength * fadeCurve * fadeCurve
          maxSurvival = Math.max(maxSurvival, survival)
        }
      }

      if (maxSurvival > 0.05) {
        dissolved[i] = vNorm * maxSurvival
      }
    }
  }

  // Gentle blur to soften edges (sadness is not sharp)
  const softened = new Float32Array(dissolved.length)
  const blurR = 2
  for (let y = blurR; y < H - blurR; y++) {
    for (let x = blurR; x < W - blurR; x++) {
      let sum = 0, count = 0
      for (let dy = -blurR; dy <= blurR; dy++) {
        for (let dx = -blurR; dx <= blurR; dx++) {
          sum += dissolved[(y + dy) * W + (x + dx)]
          count++
        }
      }
      softened[y * W + x] = sum / count
    }
  }
  return softened
}

// ---- Rendering ----
function render(dissolved: Float32Array, islands: Island[], seed: number): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)

  // Background: subtle vertical gradient + texture
  // Top: slightly lighter (distant sky quality)
  // Bottom: slightly darker, cooler (earth/weight)
  const bgNoise1 = makeNoise(seed + 500, 400)   // large-scale background texture
  const bgNoise2 = makeNoise(seed + 600, 150)   // medium texture

  for (let y = 0; y < H; y++) {
    const yNorm = y / H // 0 at top, 1 at bottom
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const d = dissolved[idx]

      // Background with vertical gradient
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + 0.5
      // Top: 218-222 (pale, open)
      // Bottom: 190-198 (cooler, heavier, closing in)
      const gradientR = 218 - yNorm * 25 + bn * 8
      const gradientG = 220 - yNorm * 22 + bn * 6
      const gradientB = 228 - yNorm * 15 + bn * 4  // blue stays higher → cooler, heavier at bottom

      if (d > 0.02) {
        // Fragment color: MUCH more contrast than v8/v9
        // Dark enough to read clearly, but muted (not bold)
        const intensity = Math.min(1.0, d * 1.6)

        // Find which island this pixel is closest to (for warmth)
        let closestWarmth = 0
        let closestDist = Infinity
        for (const island of islands) {
          const dx = x - island.x
          const dy = y - island.y
          const dist = dx * dx + dy * dy
          if (dist < closestDist) {
            closestDist = dist
            closestWarmth = island.warmth
          }
        }

        // Fragment: warmth dying at the edges
        // Center of fragment: warm brown/amber (still alive, barely)
        // Edges of fragment: cold grey-blue (heat already gone)
        // The warmth gradient IS the sadness — life leaving from outside in
        const warmthShift = closestWarmth * intensity * intensity  // squared = concentrated in center
        // Base: dark grey-blue (cold, dead)
        let fragR = gradientR - intensity * 165
        let fragG = gradientG - intensity * 165
        let fragB = gradientB - intensity * 145
        // Add warmth proportional to intensity AND island warmth
        // Only the densest part of the main fragment retains any warmth
        fragR += warmthShift * 80   // warm amber/brown
        fragG += warmthShift * 30   // subtle
        fragB -= warmthShift * 20   // less blue = warmer

        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, fragR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, fragG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, fragB)))
      } else {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, gradientR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, gradientG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, gradientB)))
      }
      rgba[idx * 4 + 3] = 255
    }
  }

  return rgba
}

// ---- Main ----
async function main() {
  const rand = makePRNG(77710)

  console.log("=== SADNESS v10: what-remains ===")

  // Seed RD with scattered circles — creates rich pattern to dissolve
  const seedFn = (u: Float32Array, v: Float32Array) => {
    const count = 45 + Math.floor(rand() * 15)
    for (let s = 0; s < count; s++) {
      const cx = rand() * W
      const cy = rand() * H
      const r = 12 + rand() * 28
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const px = ((Math.floor(cx + dx)) % W + W) % W
          const py = ((Math.floor(cy + dy)) % H + H) % H
          const i = py * W + px
          u[i] = 0.5 + rand() * 0.1
          v[i] = 0.25 + rand() * 0.1
        }
      }
    }
  }

  console.log("  Simulating reaction-diffusion (1024x1024)...")
  const { v } = simulateRD(0.0545, 0.062, 10000, seedFn)

  const islands = getIslands()
  console.log(`  Dissolving (${islands.length} survival islands)...`)
  const dissolved = dissolve(v, islands, 77710)

  console.log("  Rendering...")
  const rgba = render(dissolved, islands, 77710)

  // Render at sim size, upscale to output size
  const simCanvas = createCanvas(W, H)
  const simCtx = simCanvas.getContext("2d")
  const simImageData = simCtx.createImageData(W, H)
  simImageData.data.set(rgba)
  simCtx.putImageData(simImageData, 0, 0)

  const outCanvas = createCanvas(OUT_SIZE, OUT_SIZE)
  const outCtx = outCanvas.getContext("2d")
  outCtx.drawImage(simCanvas, 0, 0, OUT_SIZE, OUT_SIZE)

  const filename = "output/sadness-v10.png"
  writeFileSync(filename, outCanvas.toBuffer("image/png"))
  console.log(`  → ${filename} (${OUT_SIZE}x${OUT_SIZE})`)
}

main()
