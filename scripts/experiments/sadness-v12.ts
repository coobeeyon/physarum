/**
 * SADNESS v12 — DISSOLVING WARMTH
 *
 * v11 had the right composition (one fragment, vast emptiness) but the wrong palette.
 * Clinical pale blue-grey background reads as "laboratory," not "loss."
 *
 * Sadness is warm things becoming cold. Life becoming absence.
 * The background is heavy dark warm grey — like old walls, like dusk.
 * The fragment is warm amber at its core, fading through brown into the grey.
 * The fragment is dissolving INTO the background — becoming the thing that surrounds it.
 *
 * The viewer should feel: something is leaving.
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

// Gray-Scott reaction-diffusion
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
  warmth: number  // 0 = cold (background grey), 1 = warm (amber)
}

function dissolve(v: Float32Array, islands: Island[], seed: number): Float32Array {
  const dissolved = new Float32Array(v.length)
  const n1 = makeNoise(seed + 100, 60)
  const n2 = makeNoise(seed + 200, 25)
  const n3 = makeNoise(seed + 300, 10)
  const n4 = makeNoise(seed + 400, 150)  // large-scale fog

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
      if (vNorm < 0.08) continue

      let maxSurvival = 0
      for (const island of islands) {
        const dx = x - island.x
        const dy = y - island.y
        // Elongate downward slightly — sadness sinks
        const yWeight = dy > 0 ? 0.85 : 1.2
        const dist = Math.sqrt(dx * dx + (dy * yWeight) ** 2)

        // Multi-scale noise for organic, foggy edges
        const edgeNoise =
          n4(x, y) * 0.25 + n1(x, y) * 0.45 + n2(x, y) * 0.3 + n3(x, y) * 0.2
        const effectiveRadius = island.radius * (1.0 + edgeNoise * 1.3)

        if (dist < effectiveRadius) {
          const t = dist / effectiveRadius
          // Very gradual fade — not a sharp cutoff
          // Cubic ease: stays near 1.0 longer, then fades
          const fadeCurve = t < 0.15 ? 1.0 : Math.pow(1.0 - (t - 0.15) / 0.85, 2.5)
          const survival = island.strength * fadeCurve
          maxSurvival = Math.max(maxSurvival, survival)
        }
      }

      if (maxSurvival > 0.03) {
        dissolved[i] = vNorm * maxSurvival
      }
    }
  }

  // Multiple blur passes for fog-like dissolution
  let current = dissolved
  for (let pass = 0; pass < 3; pass++) {
    const blurred = new Float32Array(current.length)
    const r = 3
    for (let y = r; y < H - r; y++) {
      for (let x = r; x < W - r; x++) {
        let sum = 0, count = 0
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            sum += current[(y + dy) * W + (x + dx)]
            count++
          }
        }
        blurred[y * W + x] = sum / count
      }
    }
    current = blurred
  }
  return current
}

function render(dissolved: Float32Array, islands: Island[], seed: number): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)
  const bgNoise1 = makeNoise(seed + 500, 300)
  const bgNoise2 = makeNoise(seed + 600, 100)
  const bgNoise3 = makeNoise(seed + 700, 40)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const d = dissolved[idx]
      const bn1 = bgNoise1(x, y) * 0.5 + 0.5
      const bn2 = bgNoise2(x, y) * 0.5 + 0.5
      const bn3 = bgNoise3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.5 + bn2 * 0.3 + bn3 * 0.2

      // Background: heavy dark warm grey
      // Darker at top (weight pressing down), slightly warmer at bottom (remnant of life)
      const topWeight = yNorm  // 0 at top, 1 at bottom
      const warmthFromBelow = topWeight * topWeight * 0.15  // very subtle

      let bgR = 68 + bn * 12 + warmthFromBelow * 25
      let bgG = 64 + bn * 10 + warmthFromBelow * 12
      let bgB = 62 + bn * 8

      if (d > 0.02) {
        const intensity = Math.min(1.0, d * 2.0)

        // Find closest island for warmth interpolation
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

        // Temperature: warm amber core → cool grey edges
        // The warmth dies as intensity decreases
        const warmthAmount = closestWarmth * intensity * intensity

        // Fragment visible as LIGHTER than background — but gently.
        // It should barely emerge from the dark, not pop against it.
        // The subtlety IS the sadness — you have to look to see it.
        const liftFromBg = intensity * 0.45  // reduced: more integrated with background

        let fragR = bgR + liftFromBg * 120   // softer warm lift
        let fragG = bgG + liftFromBg * 65
        let fragB = bgB + liftFromBg * 25    // warm bias

        // Extra warmth at core — visible but not blinding
        fragR += warmthAmount * 40
        fragG += warmthAmount * 12
        fragB -= warmthAmount * 10

        // At the very edges (low intensity), the fragment
        // is barely distinguishable from the background
        // This IS the dissolution — becoming the grey

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
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 99901, b: 99902, c: 99903 }
  const seed = seeds[variant] ?? 99901
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v12 variant ${variant} (seed: ${seed}) ===`)

  // Seed the RD simulation — scattered seeds, will be masked later
  const seedFn = (u: Float32Array, v: Float32Array) => {
    const count = 50 + Math.floor(rand() * 20)
    for (let s = 0; s < count; s++) {
      const cx = rand() * W
      const cy = rand() * H
      const r = 14 + rand() * 30
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

  // ONE form — in the lower-center, slightly left. Not tiny — substantial enough
  // to have internal structure and visible warmth. But clearly alone.
  // Ghost traces are warmer spots in the background, not separate fragments.
  const islands: Island[] = [
    // Main form — lower center-left. Large enough for visible internal structure.
    // Slightly larger than v12a so the softened detail still reads.
    {
      x: W * 0.40, y: H * 0.62,
      radius: W * 0.22,
      strength: 0.85,
      warmth: 0.80,
    },
    // A wisp trailing from it — something that broke off and drifted
    {
      x: W * 0.58, y: H * 0.54,
      radius: W * 0.07,
      strength: 0.30,
      warmth: 0.2,
    },
    // Ghost: upper right. Almost invisible — a memory already fading.
    {
      x: W * 0.76, y: H * 0.26,
      radius: W * 0.035,
      strength: 0.12,
      warmth: 0.05,
    },
  ]

  console.log("  Dissolving...")
  const dissolved = dissolve(v, islands, seed)

  console.log("  Rendering...")
  const rgba = render(dissolved, islands, seed)

  // Upscale to output size
  const simCanvas = createCanvas(W, H)
  const simCtx = simCanvas.getContext("2d")
  const simImageData = simCtx.createImageData(W, H)
  simImageData.data.set(rgba)
  simCtx.putImageData(simImageData, 0, 0)

  const outCanvas = createCanvas(OUT_SIZE, OUT_SIZE)
  const outCtx = outCanvas.getContext("2d")
  outCtx.drawImage(simCanvas, 0, 0, OUT_SIZE, OUT_SIZE)

  const filename = `output/sadness-v12-${variant}.png`
  writeFileSync(filename, outCanvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
