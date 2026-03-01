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

// Simulation runs at SIM_SIZE for speed, render upscales to OUT_SIZE
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

// ---- Dissolution with survival islands ----
interface SurvivalIsland {
  x: number
  y: number
  radius: number
  strength: number // 0-1, how much pattern survives here
}

function dissolve(
  v: Float32Array,
  survivalRate: number,
  sinkBias: number,
  seed: number,
  largeMode: boolean = false,
  teardropMode: boolean = false,
  composedMode: boolean = false,
): Float32Array {
  const dissolved = new Float32Array(v.length)
  const rand = makePRNG(seed)

  // Generate survival islands — scattered remnant positions
  // Biased toward lower portion (sinking), well-separated for isolation
  const islands: SurvivalIsland[] = []

  if (composedMode) {
    // HAND-PLACED composition for maximum emotional impact
    // Main remnant: large, off-center-left, in the lower third
    // This is the thing you're still holding onto
    islands.push({
      x: W * 0.38, y: H * 0.62,
      radius: W * 0.18,
      strength: 0.75,
    })

    // Second fragment: smaller, fading, upper-right
    // Already half-gone — a memory dissolving
    islands.push({
      x: W * 0.68, y: H * 0.35,
      radius: W * 0.11,
      strength: 0.45,
    })

    // Third: tiny, very faint, far from others
    // Almost gone — you can barely remember
    islands.push({
      x: W * 0.15, y: H * 0.28,
      radius: W * 0.05,
      strength: 0.25,
    })

    // Ghost traces — barely perceptible wisps
    islands.push({
      x: W * 0.82, y: H * 0.72,
      radius: W * 0.025,
      strength: 0.15,
    })
    islands.push({
      x: W * 0.52, y: H * 0.85,
      radius: W * 0.02,
      strength: 0.12,
    })
  } else if (largeMode) {
    // LARGE FRAGMENTS mode: 3-4 major remnants with enough internal detail
    // to see the organic structure that was lost
    const mainCount = 3 + Math.floor(rand() * 2)

    // Place fragments with minimum separation to avoid overlap
    const placed: { x: number; y: number }[] = []
    for (let attempt = 0; attempt < mainCount * 20 && placed.length < mainCount; attempt++) {
      const x = W * 0.12 + rand() * W * 0.76
      // Biased toward lower half — sinking, heavy
      const yRaw = 0.3 + rand() * 0.55 + sinkBias * 0.15
      const y = H * Math.min(0.85, yRaw)

      // Check separation from existing islands
      let tooClose = false
      for (const p of placed) {
        const dist = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2)
        if (dist < W * 0.22) { tooClose = true; break }
      }
      if (tooClose) continue

      placed.push({ x, y })

      // First fragment is largest (the main remnant), others progressively smaller
      const sizeScale = placed.length === 1 ? 1.0 : 0.5 + rand() * 0.4
      const radius = W * (0.14 + rand() * 0.10) * sizeScale
      islands.push({
        x, y, radius,
        // First fragment strongest, others fading
        strength: placed.length === 1 ? 0.65 + rand() * 0.2 : 0.3 + rand() * 0.35,
      })
    }

    // A few tiny ghost traces — barely visible remnants
    for (let i = 0; i < 4; i++) {
      islands.push({
        x: rand() * W,
        y: H * (0.2 + rand() * 0.7),
        radius: W * (0.01 + rand() * 0.02),
        strength: 0.12 + rand() * 0.18,
      })
    }
  } else {
    // Original mode: smaller, more numerous fragments
    const islandCount = 4 + Math.floor(rand() * 3)
    for (let i = 0; i < islandCount; i++) {
      const x = W * 0.1 + rand() * W * 0.8
      const yBias = 0.4 + rand() * 0.5 + sinkBias * 0.1
      const y = H * Math.min(0.88, yBias)
      const radius = W * (0.05 + rand() * 0.07)
      islands.push({
        x, y, radius,
        strength: 0.35 + rand() * 0.35,
      })
    }

    // Tiny barely-visible fragments scattered around (ghosts)
    for (let i = 0; i < 6; i++) {
      islands.push({
        x: rand() * W,
        y: H * (0.15 + rand() * 0.75),
        radius: W * (0.008 + rand() * 0.015),
        strength: 0.15 + rand() * 0.25,
      })
    }
  }

  // AGGRESSIVE noise for organic, ragged, non-circular edges
  const noise1 = makeNoise(seed + 100, 40)  // smaller scale = more jagged
  const noise2 = makeNoise(seed + 200, 15)  // fine detail
  const noise3 = makeNoise(seed + 300, 80)  // large-scale shape distortion

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

      // Only consider pixels that have pattern
      if (vNorm < 0.12) continue

      // Check proximity to any survival island
      let maxSurvival = 0
      for (const island of islands) {
        const dx = x - island.x
        const dy = y - island.y

        let dist: number
        let effectiveRadius: number

        if (teardropMode) {
          // ASYMMETRIC distance: compressed above island center, extended below
          // Creates teardrop/drip shape — gravity pulling the fragment down
          const aboveFactor = dy < 0 ? 1.6 : 1.0  // tighter above
          const belowExtend = dy > 0 ? 0.7 : 0.0   // extended below
          dist = Math.sqrt(dx * dx + (dy * aboveFactor) ** 2)

          const edgeNoise = noise1(x, y) * 0.6 + noise2(x, y) * 0.35 + noise3(x, y) * 0.25
          effectiveRadius = island.radius * (1.0 + edgeNoise * 0.9 + belowExtend)
        } else {
          dist = Math.sqrt(dx * dx + dy * dy)
          // AGGRESSIVE noise distortion for ragged, organic edges
          const edgeNoise = noise1(x, y) * 0.5 + noise2(x, y) * 0.3 + noise3(x, y) * 0.2
          effectiveRadius = island.radius * (1.0 + edgeNoise * 0.8)
        }

        if (dist < effectiveRadius) {
          // Gradual fade at edges — dissolution, not a hard boundary
          const t = dist / effectiveRadius
          const fadeCurve = teardropMode
            ? (t < 0.3 ? 1.0 : 1.0 - (t - 0.3) / 0.7) // wider core for teardrops
            : (t < 0.4 ? 1.0 : 1.0 - (t - 0.4) / 0.6)
          const survival = island.strength * fadeCurve * fadeCurve
          maxSurvival = Math.max(maxSurvival, survival)
        }
      }

      if (maxSurvival > 0.1) {
        dissolved[i] = vNorm * maxSurvival
      }
    }
  }

  // Soften edges — gentle blur
  const softened = new Float32Array(dissolved.length)
  const blurR = 2
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
        // Fragment color: muted grey-blue, but enough contrast to read
        // These are remnants — not bold, but present enough to mourn
        const intensity = Math.min(1.0, d * 1.4)

        // Fragments: cool grey with slight warmth in darkest areas
        // Enough contrast to see the internal RD structure
        const fragR = bgR - intensity * 95
        const fragG = bgG - intensity * 90
        const fragB = bgB - intensity * 75

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
  // LARGE fragments — enough internal detail to see what was lost
  // Fewer, bigger, well-separated remnants in vast emptiness
  v5: {
    name: "remnants-large",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.10,
    sinkBias: 0.25,
    seed: 77705,
    seedingStyle: "scattered",
  },
  // Even larger single dominant fragment + 2 fading echoes
  v6: {
    name: "last-fragment",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.12,
    sinkBias: 0.20,
    seed: 77706,
    seedingStyle: "scattered",
  },
  // TEARDROPS — fragments dissolving downward, gravity pulling them apart
  // Asymmetric survival zones: tighter top, bleeding downward
  v7: {
    name: "falling-apart",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.10,
    sinkBias: 0.15,
    seed: 77707,
    seedingStyle: "scattered",
  },
  // COMPOSED — hand-placed fragments for intentional composition
  // One dominant remnant (what you hold onto), fading ghosts (what's already gone)
  v8: {
    name: "what-remains",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.10,
    sinkBias: 0.0,
    seed: 77708,
    seedingStyle: "scattered",
  },
  // COMPOSED + TEARDROP — the definitive version
  // Hand-placed composition with downward dissolution and extreme edge noise
  v9: {
    name: "grief",
    rdF: 0.0545, rdK: 0.062,
    rdIterations: 10000,
    survivalRate: 0.10,
    sinkBias: 0.0,
    seed: 77709,
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
  const largeMode = variant === "v5" || variant === "v6" || variant === "v7"
  const teardropMode = variant === "v7" || variant === "v9"
  const composedMode = variant === "v8" || variant === "v9"
  const dissolved = dissolve(v, config.survivalRate, config.sinkBias, config.seed, largeMode, teardropMode, composedMode)

  console.log("  Rendering at simulation size...")
  const rgba = render(dissolved, config.seed)

  // Render at simulation size, then upscale to output size
  const simCanvas = createCanvas(W, H)
  const simCtx = simCanvas.getContext("2d")
  const simImageData = simCtx.createImageData(W, H)
  simImageData.data.set(rgba)
  simCtx.putImageData(simImageData, 0, 0)

  // Upscale with bilinear interpolation (slight blur is fine for sadness — softens edges)
  const outCanvas = createCanvas(OUT_SIZE, OUT_SIZE)
  const outCtx = outCanvas.getContext("2d")
  outCtx.drawImage(simCanvas, 0, 0, OUT_SIZE, OUT_SIZE)

  const filename = `output/sadness-${variant}.png`
  writeFileSync(filename, outCanvas.toBuffer("image/png"))
  console.log(`  → ${filename} (${OUT_SIZE}x${OUT_SIZE})`)
}

main()
