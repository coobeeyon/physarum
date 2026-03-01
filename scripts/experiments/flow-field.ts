/**
 * Flow Field Drawing
 *
 * Particles follow a vector field derived from noise functions.
 * Unlike physarum (which creates its own trails), flow fields
 * produce smooth, calligraphic strokes with natural variation.
 *
 * Key difference from physarum: compositional control.
 * The noise field determines structure. Particle density determines weight.
 * Drawing can be sparse or dense, central or edge-focused.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

// Simple 2D Perlin-like noise using hash + smoothstep
// Not a full implementation — uses a grid of random gradients

function createNoiseField(seed: number, scale: number, octaves: number = 3) {
  // Mulberry32 PRNG
  let s = seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Precompute a large random gradient table
  const TABLE_SIZE = 512
  const gradX = new Float32Array(TABLE_SIZE)
  const gradY = new Float32Array(TABLE_SIZE)
  for (let i = 0; i < TABLE_SIZE; i++) {
    const angle = rand() * Math.PI * 2
    gradX[i] = Math.cos(angle)
    gradY[i] = Math.sin(angle)
  }

  // Hash function for grid coordinates
  const perm = new Uint16Array(TABLE_SIZE)
  for (let i = 0; i < TABLE_SIZE; i++) perm[i] = i
  for (let i = TABLE_SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = perm[i]
    perm[i] = perm[j]
    perm[j] = tmp
  }

  const hash = (x: number, y: number) => perm[(perm[x & (TABLE_SIZE - 1)] + y) & (TABLE_SIZE - 1)]

  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10) // smootherstep

  const dot = (gi: number, x: number, y: number) => gradX[gi] * x + gradY[gi] * y

  function noise2d(px: number, py: number): number {
    const x = px / scale
    const y = py / scale

    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const x1 = x0 + 1
    const y1 = y0 + 1

    const sx = fade(x - x0)
    const sy = fade(y - y0)

    const g00 = hash(x0, y0)
    const g10 = hash(x1, y0)
    const g01 = hash(x0, y1)
    const g11 = hash(x1, y1)

    const n00 = dot(g00, x - x0, y - y0)
    const n10 = dot(g10, x - x1, y - y0)
    const n01 = dot(g01, x - x0, y - y1)
    const n11 = dot(g11, x - x1, y - y1)

    const nx0 = n00 + sx * (n10 - n00)
    const nx1 = n01 + sx * (n11 - n01)
    return nx0 + sy * (nx1 - nx0)
  }

  // Multi-octave noise
  return (px: number, py: number): number => {
    let val = 0
    let amp = 1
    let freq = 1
    let maxAmp = 0
    for (let o = 0; o < octaves; o++) {
      val += noise2d(px * freq, py * freq) * amp
      maxAmp += amp
      amp *= 0.5
      freq *= 2
    }
    return val / maxAmp
  }
}

interface FlowConfig {
  name: string
  particleCount: number
  stepsPerParticle: number
  noiseScale: number
  octaves: number
  seed: number
  lineWidth: number
  opacity: number
  // Composition: where particles start
  spawnMode: "uniform" | "center" | "ring" | "edge"
  // Domain warping amount
  warpAmount: number
  // Background
  bgColor: [number, number, number]
  // Stroke color function
  strokeColor: (t: number, x: number, y: number) => [number, number, number, number]
}

const CONFIGS: FlowConfig[] = [
  {
    name: "silk",
    particleCount: 15000,
    stepsPerParticle: 200,
    noiseScale: 250,
    octaves: 4,
    seed: 42,
    lineWidth: 0.8,
    opacity: 0.04,
    spawnMode: "uniform",
    warpAmount: 0,
    bgColor: [252, 248, 240],
    strokeColor: (t, x, y) => {
      // Warm dark ink
      const d = Math.sqrt((x / W - 0.5) ** 2 + (y / H - 0.5) ** 2)
      return [25 + d * 40, 20 + d * 30, 15 + d * 20, 0.06]
    },
  },
  {
    name: "tide",
    particleCount: 8000,
    stepsPerParticle: 300,
    noiseScale: 180,
    octaves: 3,
    seed: 7919,
    lineWidth: 1.5,
    opacity: 0.03,
    spawnMode: "edge",
    warpAmount: 200,
    bgColor: [12, 18, 35],
    strokeColor: (t, x, y) => {
      // Ocean gradient: deep blue → teal → white
      const phase = (Math.sin(t * 3.14 + x / W * 2) + 1) / 2
      return [
        60 + phase * 180,
        120 + phase * 135,
        180 + phase * 75,
        0.05,
      ]
    },
  },
  {
    name: "ember",
    particleCount: 12000,
    stepsPerParticle: 250,
    noiseScale: 150,
    octaves: 5,
    seed: 31415,
    lineWidth: 1.0,
    opacity: 0.04,
    spawnMode: "center",
    warpAmount: 300,
    bgColor: [8, 5, 12],
    strokeColor: (t, x, y) => {
      // Fire: deep red center → orange → yellow edges
      const d = Math.sqrt((x / W - 0.5) ** 2 + (y / H - 0.5) ** 2) * 2
      return [
        200 + d * 55,
        40 + d * 160,
        10 + d * 40,
        0.06,
      ]
    },
  },
  {
    name: "moss",
    particleCount: 20000,
    stepsPerParticle: 150,
    noiseScale: 120,
    octaves: 6,
    seed: 27182,
    lineWidth: 0.6,
    opacity: 0.05,
    spawnMode: "uniform",
    warpAmount: 150,
    bgColor: [240, 238, 228],
    strokeColor: (t, x, y) => {
      // Muted greens and earth tones
      const phase = Math.sin(t * 2 + y / H * 4)
      return [
        30 + phase * 20,
        50 + phase * 30 + Math.sin(x / W * 5) * 15,
        25 + phase * 10,
        0.06,
      ]
    },
  },
]

function generate(config: FlowConfig) {
  console.log(`\n=== ${config.name} ===`)

  const noise = createNoiseField(config.seed, config.noiseScale, config.octaves)
  // Second noise for domain warping
  const warpNoiseX = config.warpAmount > 0 ? createNoiseField(config.seed + 1000, config.noiseScale * 1.5, 2) : null
  const warpNoiseY = config.warpAmount > 0 ? createNoiseField(config.seed + 2000, config.noiseScale * 1.5, 2) : null

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // Background
  ctx.fillStyle = `rgb(${config.bgColor[0]}, ${config.bgColor[1]}, ${config.bgColor[2]})`
  ctx.fillRect(0, 0, W, H)

  ctx.lineWidth = config.lineWidth
  ctx.lineCap = "round"

  // PRNG for particle spawning
  let s = config.seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  for (let p = 0; p < config.particleCount; p++) {
    let x: number, y: number

    switch (config.spawnMode) {
      case "center": {
        const angle = rand() * Math.PI * 2
        const r = rand() * Math.min(W, H) * 0.35
        x = W / 2 + Math.cos(angle) * r
        y = H / 2 + Math.sin(angle) * r
        break
      }
      case "ring": {
        const angle = rand() * Math.PI * 2
        const r = Math.min(W, H) * (0.2 + rand() * 0.15)
        x = W / 2 + Math.cos(angle) * r
        y = H / 2 + Math.sin(angle) * r
        break
      }
      case "edge": {
        const side = Math.floor(rand() * 4)
        if (side === 0) { x = rand() * W; y = 0 }
        else if (side === 1) { x = W; y = rand() * H }
        else if (side === 2) { x = rand() * W; y = H }
        else { x = 0; y = rand() * H }
        break
      }
      default: // uniform
        x = rand() * W
        y = rand() * H
    }

    ctx.beginPath()
    ctx.moveTo(x, y)

    for (let step = 0; step < config.stepsPerParticle; step++) {
      // Domain warping
      let wx = x, wy = y
      if (warpNoiseX && warpNoiseY) {
        wx = x + warpNoiseX(x, y) * config.warpAmount
        wy = y + warpNoiseY(x, y) * config.warpAmount
      }

      const angle = noise(wx, wy) * Math.PI * 2

      x += Math.cos(angle) * 2
      y += Math.sin(angle) * 2

      // Boundaries: stop if out of canvas
      if (x < 0 || x >= W || y < 0 || y >= H) break

      ctx.lineTo(x, y)
    }

    const t = p / config.particleCount
    const [r, g, b, a] = config.strokeColor(t, x, y)
    ctx.strokeStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
    ctx.stroke()

    if (p % 5000 === 0) console.log(`  particle ${p}/${config.particleCount}`)
  }

  const filename = `output/flow-${config.name}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

const configName = process.argv[2] || "all"
const toRun = configName === "all" ? CONFIGS : CONFIGS.filter(c => c.name === configName)

if (toRun.length === 0) {
  console.log(`Unknown config: ${configName}`)
  console.log(`Available: ${CONFIGS.map(c => c.name).join(", ")}`)
  process.exit(1)
}

for (const config of toRun) {
  generate(config)
}
