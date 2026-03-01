/**
 * Reaction-Diffusion v2: Better seeding, full canvas coverage,
 * varied compositions, richer palettes.
 *
 * Key insight from v1: the coral-organic was the strongest output.
 * It had composition (centered form in negative space), texture
 * (thick worm-like patterns), and warmth (cream background).
 *
 * This version explores:
 * - Full canvas seeding (patterns everywhere, natural variation)
 * - Asymmetric seeding (composition through seed placement)
 * - Richer color palettes (not just monochrome mapping)
 * - Higher iterations for fuller development
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

const Du = 0.16
const Dv = 0.08

function simulate(
  f: number,
  k: number,
  iterations: number,
  seedFn: (u: Float32Array, v: Float32Array, W: number, H: number) => void,
): { u: Float32Array; v: Float32Array } {
  const N = W * H
  const u = new Float32Array(N).fill(1.0)
  const v = new Float32Array(N).fill(0.0)
  const uNext = new Float32Array(N)
  const vNext = new Float32Array(N)

  seedFn(u, v, W, H)

  const dt = 1.0

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

        uNext[i] = u[i] + dt * (Du * lapU - uvv + f * (1.0 - u[i]))
        vNext[i] = v[i] + dt * (Dv * lapV + uvv - (f + k) * v[i])
      }
    }
    u.set(uNext)
    v.set(vNext)

    if (iter % 2000 === 0) console.log(`  iteration ${iter}/${iterations}`)
  }

  return { u, v }
}

// ---- Seeding strategies ----

function seedFullCanvas(u: Float32Array, v: Float32Array, w: number, h: number) {
  // Random noise everywhere — patterns emerge from everywhere
  for (let i = 0; i < w * h; i++) {
    if (Math.random() < 0.5) {
      u[i] = 0.5 + Math.random() * 0.1
      v[i] = 0.25 + Math.random() * 0.1
    }
  }
}

function seedScattered(u: Float32Array, v: Float32Array, w: number, h: number) {
  // 30-50 scattered circles of varying sizes — organic growth from distributed points
  const count = 30 + Math.floor(Math.random() * 20)
  for (let s = 0; s < count; s++) {
    const cx = Math.random() * w
    const cy = Math.random() * h
    const r = 10 + Math.random() * 40
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue
        const px = ((Math.floor(cx + dx)) % w + w) % w
        const py = ((Math.floor(cy + dy)) % h + h) % h
        const i = py * w + px
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }
}

function seedAsymmetric(u: Float32Array, v: Float32Array, w: number, h: number) {
  // Off-center large seed + scattered small seeds — compositional asymmetry
  // Main mass in lower-left
  const cx = w * 0.35
  const cy = h * 0.6
  const r = Math.min(w, h) * 0.2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < r * r) {
        const i = y * w + x
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }
  // Small seeds in upper-right
  for (let s = 0; s < 8; s++) {
    const sx = w * 0.6 + Math.random() * w * 0.3
    const sy = Math.random() * h * 0.4
    const sr = 5 + Math.random() * 15
    for (let dy = -sr; dy <= sr; dy++) {
      for (let dx = -sr; dx <= sr; dx++) {
        if (dx * dx + dy * dy > sr * sr) continue
        const px = Math.min(w - 1, Math.max(0, Math.floor(sx + dx)))
        const py = Math.min(h - 1, Math.max(0, Math.floor(sy + dy)))
        const i = py * w + px
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }
}

function seedRing(u: Float32Array, v: Float32Array, w: number, h: number) {
  // Ring seed — patterns grow inward and outward
  const cx = w / 2, cy = h / 2
  const r1 = Math.min(w, h) * 0.25
  const r2 = Math.min(w, h) * 0.30
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > r1 && dist < r2) {
        const i = y * w + x
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }
}

// ---- Color palettes ----

type ColorFn = (u: Float32Array, v: Float32Array) => Uint8ClampedArray

function paletteWarmEarth(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange

    // Warm earth: off-white → terracotta → charcoal
    const r = Math.round(250 - t * 200)
    const g = Math.round(242 - t * 205)
    const b = Math.round(230 - t * 200)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function paletteMidnightCopper(u: Float32Array, v: Float32Array): Uint8ClampedArray {
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

    // Deep charcoal → warm copper → bright gold
    const r = Math.round(25 + t2 * 200)
    const g = Math.round(20 + t2 * 140)
    const b = Math.round(30 + t * 40)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function paletteBloodOxygen(u: Float32Array, v: Float32Array): Uint8ClampedArray {
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

    // Use BOTH chemicals: U controls blue, V controls red
    // Where V is high (pattern): deep red
    // Where U is high (background): dark blue-grey
    const r = Math.round(20 + tv * 180)
    const g = Math.round(15 + tv * 20 + tu * 30)
    const b = Math.round(25 + tu * 60 - tv * 15)

    rgba[i * 4 + 0] = Math.max(0, Math.min(255, r))
    rgba[i * 4 + 1] = Math.max(0, Math.min(255, g))
    rgba[i * 4 + 2] = Math.max(0, Math.min(255, b))
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

function paletteForest(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange

    // Pale sage → deep forest → near-black
    const r = Math.round(225 - t * 185)
    const g = Math.round(235 - t * 175)
    const b = Math.round(215 - t * 185)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return rgba
}

// ---- Experiments ----

interface Experiment {
  name: string
  f: number
  k: number
  iterations: number
  seed: (u: Float32Array, v: Float32Array, w: number, h: number) => void
  palette: ColorFn
}

const EXPERIMENTS: Experiment[] = [
  // Full canvas labyrinth — rich texture edge to edge
  {
    name: "labyrinth-full",
    f: 0.042, k: 0.063,
    iterations: 15000,
    seed: seedFullCanvas,
    palette: paletteWarmEarth,
  },
  // Scattered coral on warm background
  {
    name: "coral-scattered",
    f: 0.0545, k: 0.062,
    iterations: 12000,
    seed: seedScattered,
    palette: paletteWarmEarth,
  },
  // Asymmetric composition — off-center growth
  {
    name: "asymmetric-earth",
    f: 0.0545, k: 0.062,
    iterations: 12000,
    seed: seedAsymmetric,
    palette: paletteWarmEarth,
  },
  // Ring growth — inward and outward
  {
    name: "ring-copper",
    f: 0.042, k: 0.063,
    iterations: 14000,
    seed: seedRing,
    palette: paletteMidnightCopper,
  },
  // Full canvas spots — biological texture
  {
    name: "spots-full",
    f: 0.030, k: 0.062,
    iterations: 15000,
    seed: seedFullCanvas,
    palette: paletteForest,
  },
  // Worms with both chemicals mapped
  {
    name: "worms-blood",
    f: 0.058, k: 0.065,
    iterations: 12000,
    seed: seedScattered,
    palette: paletteBloodOxygen,
  },
]

async function main() {
  const name = process.argv[2] || "all"
  const toRun = name === "all"
    ? EXPERIMENTS
    : EXPERIMENTS.filter(e => e.name === name)

  if (toRun.length === 0) {
    console.log(`Unknown experiment: ${name}`)
    console.log(`Available: ${EXPERIMENTS.map(e => e.name).join(", ")}`)
    process.exit(1)
  }

  for (const exp of toRun) {
    console.log(`\n=== ${exp.name} (f=${exp.f}, k=${exp.k}, ${exp.iterations} iters) ===`)
    const { u, v } = simulate(exp.f, exp.k, exp.iterations, exp.seed)
    const rgba = exp.palette(u, v)

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")
    const imageData = ctx.createImageData(W, H)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)

    const filename = `output/rd2-${exp.name}.png`
    writeFileSync(filename, canvas.toBuffer("image/png"))
    console.log(`  → ${filename}`)
  }
}

main()
