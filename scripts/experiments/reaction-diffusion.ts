/**
 * Reaction-Diffusion: Gray-Scott model
 *
 * Two chemicals (U and V) diffuse and react:
 *   U + 2V → 3V  (autocatalytic)
 *   V → P         (decay)
 *
 * Parameters f (feed rate) and k (kill rate) control pattern type:
 *   - Spots, stripes, coral, labyrinthine, worms, mitosis
 *
 * Fundamentally different visual language from physarum trails.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 1024
const H = 1024

// Diffusion rates
const Du = 0.16
const Dv = 0.08

// Gray-Scott parameters — these control the pattern type
// f = feed rate (replenish U), k = kill rate (remove V)
interface Preset {
  name: string
  f: number
  k: number
  iterations: number
}

const PRESETS: Preset[] = [
  { name: "coral",       f: 0.0545, k: 0.062,  iterations: 8000 },
  { name: "mitosis",     f: 0.0367, k: 0.0649, iterations: 6000 },
  { name: "worms",       f: 0.058,  k: 0.065,  iterations: 8000 },
  { name: "spots",       f: 0.030,  k: 0.062,  iterations: 8000 },
  { name: "labyrinth",   f: 0.042,  k: 0.063,  iterations: 10000 },
  { name: "holes",       f: 0.039,  k: 0.058,  iterations: 8000 },
  { name: "waves",       f: 0.014,  k: 0.054,  iterations: 6000 },
]

function simulate(f: number, k: number, iterations: number): { u: Float32Array; v: Float32Array } {
  const N = W * H
  const u = new Float32Array(N).fill(1.0)
  const v = new Float32Array(N).fill(0.0)
  const uNext = new Float32Array(N)
  const vNext = new Float32Array(N)

  // Seed: square region in center + some random seeds
  const cx = W / 2, cy = H / 2
  const seedR = Math.min(W, H) / 8
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy
      if (dx * dx + dy * dy < seedR * seedR) {
        const i = y * W + x
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }

  // Additional random seeds for asymmetry
  for (let s = 0; s < 20; s++) {
    const sx = Math.floor(Math.random() * W)
    const sy = Math.floor(Math.random() * H)
    const sr = 5 + Math.random() * 15
    for (let dy = -sr; dy <= sr; dy++) {
      for (let dx = -sr; dx <= sr; dx++) {
        if (dx * dx + dy * dy > sr * sr) continue
        const px = ((sx + dx) % W + W) % W
        const py = ((sy + dy) % H + H) % H
        const i = py * W + px
        u[i] = 0.5 + Math.random() * 0.1
        v[i] = 0.25 + Math.random() * 0.1
      }
    }
  }

  const dt = 1.0

  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 0; y < H; y++) {
      const ym = ((y - 1) + H) % H
      const yp = (y + 1) % H
      for (let x = 0; x < W; x++) {
        const xm = ((x - 1) + W) % W
        const xp = (x + 1) % W
        const i = y * W + x

        // 5-point Laplacian
        const lapU = u[ym * W + x] + u[yp * W + x] + u[y * W + xm] + u[y * W + xp] - 4 * u[i]
        const lapV = v[ym * W + x] + v[yp * W + x] + v[y * W + xm] + v[y * W + xp] - 4 * v[i]

        const uvv = u[i] * v[i] * v[i]

        uNext[i] = u[i] + dt * (Du * lapU - uvv + f * (1.0 - u[i]))
        vNext[i] = v[i] + dt * (Dv * lapV + uvv - (f + k) * v[i])
      }
    }

    // Swap buffers
    u.set(uNext)
    v.set(vNext)

    if (iter % 1000 === 0) {
      console.log(`  iteration ${iter}/${iterations}`)
    }
  }

  return { u, v }
}

// Color palette: warm cream background, dark organic forms
function renderOrganic(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)

  // Find V range for normalization
  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange

    // Warm palette: cream → burnt sienna → deep brown → near-black
    const r = Math.round(245 - t * 210)
    const g = Math.round(235 - t * 215)
    const b = Math.round(220 - t * 205)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

// Color palette: deep ocean
function renderOcean(u: Float32Array, v: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(W * H * 4)

  let vMin = Infinity, vMax = -Infinity
  for (let i = 0; i < W * H; i++) {
    if (v[i] < vMin) vMin = v[i]
    if (v[i] > vMax) vMax = v[i]
  }
  const vRange = vMax - vMin || 1

  for (let i = 0; i < W * H; i++) {
    const t = (v[i] - vMin) / vRange
    const t2 = t * t  // gamma for contrast

    // Deep navy → teal → bright cyan/white
    const r = Math.round(8 + t2 * 180)
    const g = Math.round(15 + t2 * 220)
    const b = Math.round(40 + t * 215)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

// Two-tone: ink on paper
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

    // Sharp threshold with slight softness
    const ink = Math.max(0, Math.min(1, (t - 0.15) * 4))

    // Off-white paper → dark ink
    const r = Math.round(248 - ink * 225)
    const g = Math.round(244 - ink * 224)
    const b = Math.round(238 - ink * 218)

    rgba[i * 4 + 0] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

async function main() {
  const presetName = process.argv[2] || "all"
  const renderStyle = process.argv[3] || "all"

  const presetsToRun = presetName === "all"
    ? PRESETS
    : PRESETS.filter(p => p.name === presetName)

  if (presetsToRun.length === 0) {
    console.log(`Unknown preset: ${presetName}`)
    console.log(`Available: ${PRESETS.map(p => p.name).join(", ")}`)
    process.exit(1)
  }

  const renderers = renderStyle === "all"
    ? [
        { name: "organic", fn: renderOrganic },
        { name: "ocean", fn: renderOcean },
        { name: "ink", fn: renderInk },
      ]
    : [
        renderStyle === "organic" ? { name: "organic", fn: renderOrganic } :
        renderStyle === "ocean" ? { name: "ocean", fn: renderOcean } :
        { name: "ink", fn: renderInk }
      ]

  for (const preset of presetsToRun) {
    console.log(`\n=== ${preset.name} (f=${preset.f}, k=${preset.k}) ===`)
    const { u, v } = simulate(preset.f, preset.k, preset.iterations)

    for (const renderer of renderers) {
      const rgba = renderer.fn(u, v)
      const canvas = createCanvas(W, H)
      const ctx = canvas.getContext("2d")
      const imageData = ctx.createImageData(W, H)
      imageData.data.set(rgba)
      ctx.putImageData(imageData, 0, 0)

      const filename = `output/rd-${preset.name}-${renderer.name}.png`
      writeFileSync(filename, canvas.toBuffer("image/png"))
      console.log(`  → ${filename}`)
    }
  }
}

main()
