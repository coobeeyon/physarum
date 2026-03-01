/**
 * Reaction-Diffusion with Spatially Varying Parameters
 *
 * The key insight: f (feed rate) and k (kill rate) determine pattern type.
 * By varying them across the canvas, different regions develop different
 * textures — spots transition to stripes transition to labyrinth.
 * Like biological tissue differentiating.
 *
 * Uses smooth noise fields to modulate f and k,
 * creating organic transitions between pattern types.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

const Du = 0.16
const Dv = 0.08

// Noise for parameter modulation
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

interface Preset {
  name: string
  // f and k ranges to interpolate between
  fMin: number; fMax: number
  kMin: number; kMax: number
  iterations: number
  noiseScale: number
  seed: number
  palette: "earth" | "ink" | "mineral" | "deep"
}

const PRESETS: Preset[] = [
  {
    name: "tissue",
    // Spans from spots (low f, mid k) through worms to labyrinth (mid f, mid k)
    fMin: 0.025, fMax: 0.055,
    kMin: 0.058, kMax: 0.065,
    iterations: 14000,
    noiseScale: 400,
    seed: 42,
    palette: "earth",
  },
  {
    name: "terrain",
    // Spans from holes (mid f, low k) through coral to mitosis
    fMin: 0.030, fMax: 0.060,
    kMin: 0.060, kMax: 0.068,
    iterations: 14000,
    noiseScale: 500,
    seed: 7919,
    palette: "mineral",
  },
  {
    name: "specimen",
    // Tight range around coral → labyrinth transition
    fMin: 0.038, fMax: 0.055,
    kMin: 0.061, kMax: 0.064,
    iterations: 12000,
    noiseScale: 350,
    seed: 31415,
    palette: "ink",
  },
  {
    name: "abyss",
    // Wide range — many pattern types
    fMin: 0.020, fMax: 0.062,
    kMin: 0.055, kMax: 0.067,
    iterations: 14000,
    noiseScale: 600,
    seed: 27182,
    palette: "deep",
  },
]

function simulate(preset: Preset): { u: Float32Array; v: Float32Array; fMap: Float32Array; kMap: Float32Array } {
  const N = W * H
  const u = new Float32Array(N).fill(1.0)
  const v = new Float32Array(N).fill(0.0)
  const uNext = new Float32Array(N)
  const vNext = new Float32Array(N)

  // Build parameter maps using noise
  const fMap = new Float32Array(N)
  const kMap = new Float32Array(N)
  const noiseF = makeNoise(preset.seed, preset.noiseScale)
  const noiseK = makeNoise(preset.seed + 5000, preset.noiseScale * 1.3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      // Map noise [-0.5, 0.5] to [0, 1]
      const tf = noiseF(x, y) * 0.5 + 0.5
      const tk = noiseK(x, y) * 0.5 + 0.5
      fMap[i] = preset.fMin + tf * (preset.fMax - preset.fMin)
      kMap[i] = preset.kMin + tk * (preset.kMax - preset.kMin)
    }
  }

  // Seed: scattered circles across canvas
  let s = preset.seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let seed = 0; seed < 40; seed++) {
    const cx = rand() * W
    const cy = rand() * H
    const r = 8 + rand() * 25
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

  const dt = 1.0

  for (let iter = 0; iter < preset.iterations; iter++) {
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
        const f = fMap[i]
        const k = kMap[i]

        uNext[i] = u[i] + dt * (Du * lapU - uvv + f * (1.0 - u[i]))
        vNext[i] = v[i] + dt * (Dv * lapV + uvv - (f + k) * v[i])
      }
    }
    u.set(uNext)
    v.set(vNext)

    if (iter % 2000 === 0) console.log(`  iteration ${iter}/${preset.iterations}`)
  }

  return { u, v, fMap, kMap }
}

function renderEarth(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange
    // Warm parchment → burnt umber → charcoal
    rgba[i * 4 + 0] = Math.round(248 - t * 208)
    rgba[i * 4 + 1] = Math.round(240 - t * 210)
    rgba[i * 4 + 2] = Math.round(225 - t * 200)
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function renderInk(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange
    // Cream paper → sepia ink, with moderate contrast
    const ink = Math.pow(t, 0.8) // slight gamma
    rgba[i * 4 + 0] = Math.round(250 - ink * 220)
    rgba[i * 4 + 1] = Math.round(245 - ink * 220)
    rgba[i * 4 + 2] = Math.round(235 - ink * 215)
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function renderMineral(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  let uMin = Infinity, uMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
    if (u[i] < uMin) uMin = u[i]
    if (u[i] > uMax) uMax = u[i]
  }
  const vRange = vMax - vMin || 1
  const uRange = uMax - uMin || 1

  for (let i = 0; i < W * H; i++) {
    const tv = (v[i] - vMin) / vRange
    const tu = (u[i] - uMin) / uRange

    // Mineral tones: slate → warm sandstone → deep ochre
    // U chemical gives blue-grey, V gives warm amber
    rgba[i * 4 + 0] = Math.round(210 - tu * 80 + tv * 40)
    rgba[i * 4 + 1] = Math.round(205 - tu * 90 + tv * 10)
    rgba[i * 4 + 2] = Math.round(200 - tu * 50 - tv * 40)
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function renderDeep(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange
    const t2 = t * t

    // Indigo-black → muted teal → warm highlight
    rgba[i * 4 + 0] = Math.round(15 + t2 * 160 + t * 30)
    rgba[i * 4 + 1] = Math.round(18 + t2 * 120 + t * 50)
    rgba[i * 4 + 2] = Math.round(30 + t * 80)
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

const PALETTES: Record<string, (u: Float32Array, v: Float32Array) => Uint8ClampedArray> = {
  earth: renderEarth,
  ink: renderInk,
  mineral: renderMineral,
  deep: renderDeep,
}

async function main() {
  const name = process.argv[2] || "all"
  const toRun = name === "all" ? PRESETS : PRESETS.filter(p => p.name === name)

  if (toRun.length === 0) {
    console.log(`Unknown: ${name}. Available: ${PRESETS.map(p => p.name).join(", ")}`)
    process.exit(1)
  }

  for (const preset of toRun) {
    console.log(`\n=== ${preset.name} (f=${preset.fMin}-${preset.fMax}, k=${preset.kMin}-${preset.kMax}) ===`)
    const { u, v } = simulate(preset)
    const rgba = PALETTES[preset.palette](u, v)

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")
    const imageData = ctx.createImageData(W, H)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)

    const filename = `output/rdv-${preset.name}.png`
    writeFileSync(filename, canvas.toBuffer("image/png"))
    console.log(`  → ${filename}`)
  }
}

main()
