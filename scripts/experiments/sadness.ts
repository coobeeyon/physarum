/**
 * SADNESS
 *
 * Communicates: loss, emptiness, isolation, dissolution, what-used-to-be.
 *
 * Approach: Generate a rich organic pattern (reaction-diffusion),
 * then dissolve most of it. What remains are small, scattered fragments
 * in a vast grey-blue emptiness.
 *
 * Visual language:
 * - Vast negative space (absence dominates)
 * - Scattered remnants of something that was once whole (loss)
 * - Fragments concentrated lower in the canvas (sinking, heaviness)
 * - Grey-blue-lavender palette (cold, drained of warmth)
 * - Low contrast (muted, exhausted)
 * - Soft edges on fragments (dissolving, not sharp)
 *
 * The viewer should feel: something was here. Most of it is gone.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

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
  f: number,
  k: number,
  iterations: number,
  seedFn: (u: Float32Array, v: Float32Array) => void,
): { u: Float32Array; v: Float32Array } {
  const Du = 0.16
  const Dv = 0.08
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

// ---- Dissolution ----
function dissolve(
  v: Float32Array,
  survivalRate: number,
  sinkBias: number, // how much fragments cluster toward bottom
  seed: number,
): Float32Array {
  const dissolved = new Float32Array(v.length)
  const rand = makePRNG(seed)

  // Multi-scale noise for organic dissolution boundaries
  const noise1 = makeNoise(seed + 100, 250)
  const noise2 = makeNoise(seed + 200, 100)
  const noise3 = makeNoise(seed + 300, 40)

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

      // Only consider pixels that have pattern (V > threshold)
      if (vNorm < 0.15) continue

      // Dissolution map: multi-scale noise + vertical bias
      const n = noise1(x, y) * 0.5 + noise2(x, y) * 0.3 + noise3(x, y) * 0.2

      // Vertical bias: fragments survive more toward the bottom (sinking)
      const verticalBias = (y / H) * sinkBias

      // Survival threshold: lower = more survives
      const survivalThreshold = 1.0 - survivalRate
      const survivalScore = n * 0.5 + 0.5 + verticalBias

      if (survivalScore > survivalThreshold) {
        dissolved[i] = vNorm
      }
    }
  }

  // Soften edges of surviving fragments — blur pass
  const softened = new Float32Array(dissolved.length)
  const blurR = 3
  for (let y = blurR; y < H - blurR; y++) {
    for (let x = blurR; x < W - blurR; x++) {
      let sum = 0
      let count = 0
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
function render(
  dissolved: Float32Array,
  seed: number,
): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)

  // Subtle background texture — not uniform, but barely perceptible
  const bgNoise = makeNoise(seed + 500, 300)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const d = dissolved[idx]

      // Background: pale grey with cool blue undertone
      // Like overcast sky reflected in wet concrete
      const n = bgNoise(x, y) * 0.5 + 0.5
      const bgR = 205 + n * 10
      const bgG = 210 + n * 8
      const bgB = 220 + n * 6

      if (d > 0.01) {
        // Fragment color: darker grey-blue
        // Low contrast — fragments are visible but not vivid
        // They're remnants, not declarations
        const intensity = Math.min(1.0, d * 1.5)

        // Fragments: cool grey-blue, slightly darker than background
        const fragR = bgR - intensity * 95
        const fragG = bgG - intensity * 85
        const fragB = bgB - intensity * 70

        rgba[idx * 4 + 0] = Math.round(Math.max(0, fragR))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, fragG))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, fragB))
      } else {
        rgba[idx * 4 + 0] = Math.round(bgR)
        rgba[idx * 4 + 1] = Math.round(bgG)
        rgba[idx * 4 + 2] = Math.round(bgB)
      }
      rgba[idx * 4 + 3] = 255
    }
  }

  return rgba
}

// ---- Main ----

interface SadnessVariant {
  name: string
  rdF: number
  rdK: number
  rdIterations: number
  survivalRate: number  // what fraction of the pattern survives (lower = more empty)
  sinkBias: number      // how much fragments cluster toward bottom
  seed: number
  seedingStyle: "scattered" | "full" | "single"
}

const VARIANTS: Record<string, SadnessVariant> = {
  // Most of a coral pattern dissolved — scattered remnants sinking
  v1: {
    name: "dissolution-coral",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.08,
    sinkBias: 0.3,
    seed: 77701,
    seedingStyle: "scattered",
  },
  // Worm pattern almost entirely gone — faint traces of what connected
  v2: {
    name: "dissolution-worms",
    rdF: 0.058, rdK: 0.065,
    rdIterations: 10000,
    survivalRate: 0.06,
    sinkBias: 0.25,
    seed: 77702,
    seedingStyle: "scattered",
  },
  // A single growth point that barely developed — isolated and alone
  v3: {
    name: "isolated-growth",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 6000,
    survivalRate: 0.3,
    sinkBias: 0.1,
    seed: 77703,
    seedingStyle: "single",
  },
  // Labyrinth pattern nearly gone — traces of complex connections dissolved
  v4: {
    name: "dissolution-labyrinth",
    rdF: 0.042, rdK: 0.063,
    rdIterations: 12000,
    survivalRate: 0.05,
    sinkBias: 0.35,
    seed: 77704,
    seedingStyle: "scattered",
  },
}

async function main() {
  const variant = process.argv[2] || "v1"

  const config = VARIANTS[variant]
  if (!config) {
    console.log(`Unknown variant: ${variant}`)
    console.log(`Available: ${Object.keys(VARIANTS).join(", ")}`)
    process.exit(1)
  }

  const rand = makePRNG(config.seed)

  console.log(`=== SADNESS ${variant}: ${config.name} ===`)
  console.log(`  RD params: f=${config.rdF}, k=${config.rdK}, ${config.rdIterations} iterations`)
  console.log(`  Survival rate: ${config.survivalRate}, sink bias: ${config.sinkBias}`)

  // Seed function
  const seedFn = (u: Float32Array, v: Float32Array) => {
    if (config.seedingStyle === "single") {
      // Single small growth — alone in the void
      const cx = W * 0.45
      const cy = H * 0.6  // slightly below center — heavy, sinking
      const r = 30
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > r * r) continue
          const px = Math.floor(cx + dx)
          const py = Math.floor(cy + dy)
          if (px < 0 || px >= W || py < 0 || py >= H) continue
          const i = py * W + px
          u[i] = 0.5 + rand() * 0.1
          v[i] = 0.25 + rand() * 0.1
        }
      }
    } else if (config.seedingStyle === "scattered") {
      // Scattered seeds — will create a rich pattern that we then dissolve
      const count = 40 + Math.floor(rand() * 15)
      for (let s = 0; s < count; s++) {
        const cx = rand() * W
        const cy = rand() * H
        const r = 10 + rand() * 30
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
    } else {
      // Full canvas
      for (let i = 0; i < W * H; i++) {
        if (rand() < 0.5) {
          u[i] = 0.5 + rand() * 0.1
          v[i] = 0.25 + rand() * 0.1
        }
      }
    }
  }

  console.log("  Simulating reaction-diffusion...")
  const { u, v } = simulateRD(config.rdF, config.rdK, config.rdIterations, seedFn)

  console.log("  Dissolving...")
  const dissolved = dissolve(v, config.survivalRate, config.sinkBias, config.seed)

  console.log("  Rendering...")
  const rgba = render(dissolved, config.seed)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
