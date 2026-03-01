/**
 * SADNESS v11 — ALONE
 *
 * One fragment. Small. Low on the canvas. Vast emptiness above.
 *
 * v10 had multiple fragments scattered around — it read as a diagram.
 * This version strips to the essential: one thing, alone, in too much space.
 *
 * The fragment has warmth at its core (life, barely) fading to cold at edges.
 * Two ghost traces far away — memories already gone.
 *
 * The viewer should feel: alone.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const SIM_SIZE = 1024
const OUT_SIZE = 2048
let W = SIM_SIZE
let H = SIM_SIZE

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

interface Island {
  x: number; y: number
  radius: number
  strength: number
  warmth: number
}

function dissolve(v: Float32Array, islands: Island[], seed: number): Float32Array {
  const dissolved = new Float32Array(v.length)
  const n1 = makeNoise(seed + 100, 50)
  const n2 = makeNoise(seed + 200, 20)
  const n3 = makeNoise(seed + 300, 8)
  const n4 = makeNoise(seed + 400, 120)

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
        const aboveFactor = dy < 0 ? 1.5 : 1.0
        const belowExtend = dy > 0 ? 0.4 : 0.0
        const dist = Math.sqrt(dx * dx + (dy * aboveFactor) ** 2)

        const edgeNoise =
          n4(x, y) * 0.3 + n1(x, y) * 0.5 + n2(x, y) * 0.35 + n3(x, y) * 0.25
        const effectiveRadius = island.radius * (1.0 + edgeNoise * 1.1 + belowExtend)

        if (dist < effectiveRadius) {
          const t = dist / effectiveRadius
          const fadeCurve = t < 0.2 ? 1.0 : 1.0 - (t - 0.2) / 0.8
          const survival = island.strength * fadeCurve * fadeCurve
          maxSurvival = Math.max(maxSurvival, survival)
        }
      }

      if (maxSurvival > 0.05) {
        dissolved[i] = vNorm * maxSurvival
      }
    }
  }

  // Gentle blur
  const softened = new Float32Array(dissolved.length)
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      let sum = 0, count = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          sum += dissolved[(y + dy) * W + (x + dx)]
          count++
        }
      }
      softened[y * W + x] = sum / count
    }
  }
  return softened
}

function render(dissolved: Float32Array, islands: Island[], seed: number): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)
  const bgNoise1 = makeNoise(seed + 500, 400)
  const bgNoise2 = makeNoise(seed + 600, 150)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const d = dissolved[idx]
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + 0.5

      // Background: pale gradient — lighter at top (open, empty), cooler at bottom (weight)
      const bgR = 220 - yNorm * 22 + bn * 7
      const bgG = 222 - yNorm * 20 + bn * 5
      const bgB = 230 - yNorm * 14 + bn * 3

      if (d > 0.02) {
        const intensity = Math.min(1.0, d * 1.8)

        // Find closest island for warmth
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

        // Warmth gradient: concentrated at the dense core, dying at edges
        const warmthShift = closestWarmth * intensity * intensity
        let fragR = bgR - intensity * 170
        let fragG = bgG - intensity * 170
        let fragB = bgB - intensity * 150
        // Warmth: amber/brown at core, cold grey-blue at edges
        fragR += warmthShift * 90
        fragG += warmthShift * 35
        fragB -= warmthShift * 25

        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, fragR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, fragG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, fragB)))
      } else {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
      }
      rgba[idx * 4 + 3] = 255
    }
  }
  return rgba
}

async function main() {
  const rand = makePRNG(77711)

  console.log("=== SADNESS v11: alone ===")

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

  console.log("  Simulating reaction-diffusion...")
  const { v } = simulateRD(0.0545, 0.062, 10000, seedFn)

  // ONE main fragment — small, low, alone
  // Two ghost traces far away — memories already gone
  const islands: Island[] = [
    // The one thing remaining. Off-center-left, in the lower third.
    // Small relative to the canvas — the emptiness dwarfs it.
    {
      x: W * 0.38, y: H * 0.65,
      radius: W * 0.14,
      strength: 0.85,
      warmth: 0.6,   // warm at core — still alive, barely
    },
    // Ghost 1: far upper-right. Already cold. Almost invisible.
    {
      x: W * 0.78, y: H * 0.22,
      radius: W * 0.035,
      strength: 0.20,
      warmth: 0.0,
    },
    // Ghost 2: far right, mid-height. Even fainter.
    {
      x: W * 0.88, y: H * 0.50,
      radius: W * 0.02,
      strength: 0.12,
      warmth: 0.0,
    },
  ]

  console.log("  Dissolving...")
  const dissolved = dissolve(v, islands, 77711)

  console.log("  Rendering...")
  const rgba = render(dissolved, islands, 77711)

  const simCanvas = createCanvas(W, H)
  const simCtx = simCanvas.getContext("2d")
  const simImageData = simCtx.createImageData(W, H)
  simImageData.data.set(rgba)
  simCtx.putImageData(simImageData, 0, 0)

  const outCanvas = createCanvas(OUT_SIZE, OUT_SIZE)
  const outCtx = outCanvas.getContext("2d")
  outCtx.drawImage(simCanvas, 0, 0, OUT_SIZE, OUT_SIZE)

  const filename = "output/sadness-v11.png"
  writeFileSync(filename, outCanvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
