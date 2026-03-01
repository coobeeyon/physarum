/**
 * Composed Physarum: intentional composition + warm rendering
 *
 * Combines discoveries from this session:
 * - Warm subtractive color on cream (from warmpop)
 * - Deliberate food placement for composition (not fill-the-frame)
 * - Negative space through sparse agent count + localized food
 * - Multiple populations for color mixing
 *
 * The idea: place food sources to create visual flow and focal points.
 * Agents concentrate where food is. Empty space becomes composition.
 */

import { simulate } from "#engine/physarum.ts"
import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"
import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

// Create a food map with deliberate compositional placement
function composeFoodMap(layout: string, seed: number): Float32Array {
  const food = new Float32Array(W * H)

  let s = seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const addBlob = (cx: number, cy: number, radius: number, strength: number) => {
    for (let y = Math.max(0, Math.floor(cy - radius * 2)); y < Math.min(H, Math.ceil(cy + radius * 2)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius * 2)); x < Math.min(W, Math.ceil(cx + radius * 2)); x++) {
        const dx = x - cx, dy = y - cy
        const dist2 = dx * dx + dy * dy
        const r2 = radius * radius
        if (dist2 < r2 * 4) {
          food[y * W + x] += strength * Math.exp(-dist2 / (2 * r2))
        }
      }
    }
  }

  switch (layout) {
    case "diagonal": {
      // Diagonal flow: food sources along a sweeping curve from lower-left to upper-right
      // Creates natural flow and asymmetry
      const points = 8
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1)
        // Sweeping S-curve
        const cx = W * (0.15 + t * 0.7 + Math.sin(t * Math.PI) * 0.08)
        const cy = H * (0.8 - t * 0.65 + Math.cos(t * Math.PI * 1.5) * 0.1)
        const r = 40 + rand() * 80
        addBlob(cx, cy, r, 0.5 + rand() * 0.5)
      }
      // A few accent points off the main flow
      for (let i = 0; i < 3; i++) {
        addBlob(W * (0.1 + rand() * 0.2), H * (0.1 + rand() * 0.3), 20 + rand() * 30, 0.3)
      }
      break
    }
    case "constellation": {
      // 5-7 distinct clusters of varying size — like a star map
      // Creates multiple focal points with breathing room
      const clusters = 5 + Math.floor(rand() * 3)
      for (let c = 0; c < clusters; c++) {
        const cx = W * (0.15 + rand() * 0.7)
        const cy = H * (0.15 + rand() * 0.7)
        const clusterR = 60 + rand() * 120
        const subpoints = 3 + Math.floor(rand() * 4)
        for (let s = 0; s < subpoints; s++) {
          const angle = rand() * Math.PI * 2
          const dist = rand() * clusterR * 0.6
          addBlob(
            cx + Math.cos(angle) * dist,
            cy + Math.sin(angle) * dist,
            15 + rand() * 40,
            0.4 + rand() * 0.6,
          )
        }
      }
      break
    }
    case "erosion": {
      // Dense center that thins toward edges — like water erosion
      // Creates natural vignette composition
      for (let i = 0; i < 15; i++) {
        const angle = rand() * Math.PI * 2
        const dist = rand() * Math.min(W, H) * 0.25
        const cx = W / 2 + Math.cos(angle) * dist
        const cy = H / 2 + Math.sin(angle) * dist
        addBlob(cx, cy, 50 + rand() * 100, 0.5 + rand() * 0.5)
      }
      // Tendrils reaching outward
      for (let t = 0; t < 5; t++) {
        const angle = rand() * Math.PI * 2
        const steps = 4 + Math.floor(rand() * 4)
        for (let s = 0; s < steps; s++) {
          const dist = (s + 1) * Math.min(W, H) * 0.08
          addBlob(
            W / 2 + Math.cos(angle + s * 0.2) * dist,
            H / 2 + Math.sin(angle + s * 0.2) * dist,
            20 + rand() * 30,
            0.3 * (1 - s / steps),
          )
        }
      }
      break
    }
    case "shore": {
      // Horizontal band across middle — like a coastline
      // Agents gather along the shore, sparse above and below
      for (let i = 0; i < 20; i++) {
        const cx = W * rand()
        const cy = H * (0.4 + (rand() - 0.5) * 0.15 + Math.sin(i / 20 * Math.PI * 3) * 0.05)
        addBlob(cx, cy, 30 + rand() * 60, 0.4 + rand() * 0.5)
      }
      break
    }
  }

  // Normalize to [0, 1]
  let maxVal = 0
  for (let i = 0; i < W * H; i++) {
    if (food[i] > maxVal) maxVal = food[i]
  }
  if (maxVal > 0) {
    for (let i = 0; i < W * H; i++) {
      food[i] /= maxVal
    }
  }

  return food
}

// Warm subtractive rendering on cream paper
function renderWarm(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)

  const popColors = [
    [165, 75, 35],    // burnt sienna
    [45, 90, 110],    // slate teal
    [85, 115, 50],    // olive
  ]

  const bgR = 248, bgG = 243, bgB = 232

  for (let i = 0; i < w * h; i++) {
    let r = bgR, g = bgG, b = bgB

    for (let p = 0; p < trails.length; p++) {
      const t = Math.pow(trails[p][i], 0.55)
      const color = popColors[p % popColors.length]
      r -= t * (bgR - color[0]) * 0.85
      g -= t * (bgG - color[1]) * 0.85
      b -= t * (bgB - color[2]) * 0.85
    }

    rgba[i * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
    rgba[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
    rgba[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

// Ink wash: single population, dark on warm paper
function renderInk(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)

  for (let i = 0; i < w * h; i++) {
    let maxTrail = 0
    for (const trail of trails) {
      if (trail[i] > maxTrail) maxTrail = trail[i]
    }

    const t = Math.pow(maxTrail, 0.55)
    rgba[i * 4 + 0] = Math.round(248 - t * 225)
    rgba[i * 4 + 1] = Math.round(243 - t * 222)
    rgba[i * 4 + 2] = Math.round(232 - t * 214)
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

interface Experiment {
  name: string
  layout: string
  populations: PopulationConfig[]
  agentCount: number
  iterations: number
  sensorAngle: number
  sensorDistance: number
  decayFactor: number
  repulsion: number
  foodWeight: number
  seed: number
  render: "warm" | "ink"
}

const EXPERIMENTS: Experiment[] = [
  {
    name: "diagonal-warm",
    layout: "diagonal",
    populations: [
      { color: [255, 120, 40], agentFraction: 0.5 },
      { color: [40, 140, 255], agentFraction: 0.5 },
    ],
    agentCount: 400_000,
    iterations: 1000,
    sensorAngle: 0.45,
    sensorDistance: 18,
    decayFactor: 0.96,
    repulsion: 0.35,
    foodWeight: 200,
    seed: 42001,
    render: "warm",
  },
  {
    name: "constellation-warm",
    layout: "constellation",
    populations: [
      { color: [255, 80, 60], agentFraction: 0.33 },
      { color: [60, 200, 255], agentFraction: 0.34 },
      { color: [80, 255, 100], agentFraction: 0.33 },
    ],
    agentCount: 350_000,
    iterations: 800,
    sensorAngle: 0.5,
    sensorDistance: 20,
    decayFactor: 0.95,
    repulsion: 0.3,
    foodWeight: 180,
    seed: 42002,
    render: "warm",
  },
  {
    name: "erosion-ink",
    layout: "erosion",
    populations: [
      { color: [255, 200, 100], agentFraction: 1.0 },
    ],
    agentCount: 500_000,
    iterations: 1200,
    sensorAngle: 0.4,
    sensorDistance: 22,
    decayFactor: 0.97,
    repulsion: 0,
    foodWeight: 250,
    seed: 42003,
    render: "ink",
  },
  {
    name: "shore-warm",
    layout: "shore",
    populations: [
      { color: [255, 140, 40], agentFraction: 0.5 },
      { color: [40, 120, 255], agentFraction: 0.5 },
    ],
    agentCount: 300_000,
    iterations: 1000,
    sensorAngle: 0.35,
    sensorDistance: 25,
    decayFactor: 0.94,
    repulsion: 0.4,
    foodWeight: 300,
    seed: 42004,
    render: "warm",
  },
]

async function main() {
  const name = process.argv[2] || "all"
  const toRun = name === "all" ? EXPERIMENTS : EXPERIMENTS.filter(e => e.name === name)

  if (toRun.length === 0) {
    console.log(`Unknown: ${name}. Available: ${EXPERIMENTS.map(e => e.name).join(", ")}`)
    process.exit(1)
  }

  for (const exp of toRun) {
    console.log(`\n=== ${exp.name} (${exp.layout}, ${exp.agentCount} agents) ===`)

    const food = composeFoodMap(exp.layout, exp.seed)

    const params: PhysarumParams = {
      seed: exp.seed,
      width: W,
      height: H,
      agentCount: exp.agentCount,
      iterations: exp.iterations,
      sensorAngle: exp.sensorAngle,
      sensorDistance: exp.sensorDistance,
      turnAngle: 0.45,
      stepSize: 1.3,
      depositAmount: 18,
      decayFactor: exp.decayFactor,
      colormap: "viridis",
      populationCount: exp.populations.length,
      populations: exp.populations,
      repulsionStrength: exp.repulsion,
      foodWeight: exp.foodWeight,
      foodPlacement: "image",
      foodDensity: 0.7,
      foodClusterCount: 6,
    }

    console.log("  simulating...")
    const result = simulate(params, food)
    console.log("  rendering...")

    const rgba = exp.render === "warm"
      ? renderWarm(result.trailMaps, W, H)
      : renderInk(result.trailMaps, W, H)

    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")
    const imageData = ctx.createImageData(W, H)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)

    const filename = `output/composed-${exp.name}.png`
    writeFileSync(filename, canvas.toBuffer("image/png"))
    console.log(`  → ${filename}`)
  }
}

main()
