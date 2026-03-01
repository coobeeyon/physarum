/**
 * Alternative physarum rendering
 *
 * Same simulation engine, completely different visual output.
 * The trail field is a 2D scalar field. Instead of mapping it through
 * a colormap (neon on black), render it as:
 * 1. Ink wash on warm paper (inverted, with texture)
 * 2. Relief/topographic (gradient-based shading)
 * 3. Threshold layers (multiple thresholds composited)
 */

import { simulate } from "#engine/physarum.ts"
import { generateFoodMap } from "#engine/food.ts"
import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"
import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 1024
const H = 1024

// Quick simulation with interesting parameters
function runSim(seed: number, mode: "single" | "dual" | "triple"): Float32Array[] {
  const populations: PopulationConfig[] =
    mode === "triple" ? [
      { color: [255, 80, 60], agentFraction: 0.33 },
      { color: [60, 200, 255], agentFraction: 0.34 },
      { color: [80, 255, 100], agentFraction: 0.33 },
    ] : mode === "dual" ? [
      { color: [255, 140, 40], agentFraction: 0.5 },
      { color: [40, 120, 255], agentFraction: 0.5 },
    ] : [
      { color: [255, 200, 100], agentFraction: 1.0 },
    ]

  const params: PhysarumParams = {
    seed,
    width: W,
    height: H,
    agentCount: 300_000,
    iterations: 600,
    sensorAngle: 0.45,
    sensorDistance: 15,
    turnAngle: 0.45,
    stepSize: 1.3,
    depositAmount: 18,
    decayFactor: 0.96,
    colormap: "viridis",
    populationCount: populations.length,
    populations,
    repulsionStrength: mode === "single" ? 0 : 0.4,
    foodWeight: 100,
    foodPlacement: "clusters",
    foodDensity: 0.6,
    foodClusterCount: 5,
  }

  // Create PRNG
  let prngState = seed | 0
  const rng = (): number => {
    prngState = (prngState + 0x6d2b79f5) | 0
    let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const food = generateFoodMap(rng, W, H, params.foodPlacement as any, params.foodDensity, params.foodClusterCount)
  console.log(`  simulating (${mode}, ${params.agentCount} agents, ${params.iterations} iters)...`)
  const result = simulate(params, food)
  console.log("  done")
  return result.trailMaps
}

// ---- Rendering approaches ----

// 1. INK WASH: inverted, warm paper background, trail as dark ink
function renderInkWash(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)
  const combined = new Float32Array(w * h)

  // Combine all population trails
  for (const trail of trails) {
    for (let i = 0; i < w * h; i++) {
      combined[i] = Math.max(combined[i], trail[i])
    }
  }

  for (let i = 0; i < w * h; i++) {
    const t = combined[i] // [0,1] - 0 = no trail, 1 = max trail

    // Inverted: strong trail = dark ink on warm paper
    // Paper color: warm off-white
    const paper_r = 248, paper_g = 242, paper_b = 230
    // Ink color: dark brown-black
    const ink_r = 25, ink_g = 20, ink_b = 18

    // Non-linear mapping for ink absorption feel
    const ink = Math.pow(t, 0.6) // softer transition than linear

    rgba[i * 4 + 0] = Math.round(paper_r - ink * (paper_r - ink_r))
    rgba[i * 4 + 1] = Math.round(paper_g - ink * (paper_g - ink_g))
    rgba[i * 4 + 2] = Math.round(paper_b - ink * (paper_b - ink_b))
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

// 2. RELIEF: gradient-based shading — trail field as a height map
function renderRelief(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)
  const combined = new Float32Array(w * h)

  for (const trail of trails) {
    for (let i = 0; i < w * h; i++) {
      combined[i] = Math.max(combined[i], trail[i])
    }
  }

  // Light direction: upper-left
  const lx = -0.7, ly = -0.7, lz = 0.7
  const len = Math.sqrt(lx * lx + ly * ly + lz * lz)
  const nlx = lx / len, nly = ly / len, nlz = lz / len

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x

      // Compute gradient (surface normal from height field)
      const xm = x > 0 ? combined[i - 1] : combined[i]
      const xp = x < w - 1 ? combined[i + 1] : combined[i]
      const ym = y > 0 ? combined[i - w] : combined[i]
      const yp = y < h - 1 ? combined[i + w] : combined[i]

      const dzdx = (xp - xm) * 8  // scale for more dramatic relief
      const dzdy = (yp - ym) * 8

      // Surface normal
      const nx = -dzdx, ny = -dzdy, nz = 1
      const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz)

      // Lambertian shading
      const dot = (nx * nlx + ny * nly + nz * nlz) / nLen
      const shade = Math.max(0.15, dot) // ambient floor

      // Warm clay palette modulated by height AND shading
      const height = combined[i]
      const base_r = 230 - height * 60
      const base_g = 218 - height * 65
      const base_b = 195 - height * 70

      rgba[i * 4 + 0] = Math.round(Math.min(255, base_r * shade + height * 30))
      rgba[i * 4 + 1] = Math.round(Math.min(255, base_g * shade + height * 15))
      rgba[i * 4 + 2] = Math.round(Math.min(255, base_b * shade))
      rgba[i * 4 + 3] = 255
    }
  }

  return rgba
}

// 3. CONTOUR: topographic contour lines extracted from trail field
function renderContour(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)
  const combined = new Float32Array(w * h)

  for (const trail of trails) {
    for (let i = 0; i < w * h; i++) {
      combined[i] = Math.max(combined[i], trail[i])
    }
  }

  const numContours = 12

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const val = combined[i]

      // Background: warm cream, darkened slightly by height
      const bg_r = 245 - val * 30
      const bg_g = 240 - val * 35
      const bg_b = 228 - val * 30

      // Check if this pixel is near a contour line
      let isContour = false
      let contourStrength = 0
      const scaled = val * numContours
      const frac = scaled - Math.floor(scaled)
      // Close to an integer = close to a contour
      const dist = Math.min(frac, 1 - frac)
      if (dist < 0.06) {
        isContour = true
        contourStrength = 1 - dist / 0.06
      }

      if (isContour) {
        // Contour line: dark sepia
        const c = contourStrength * 0.8
        rgba[i * 4 + 0] = Math.round(bg_r * (1 - c) + 35 * c)
        rgba[i * 4 + 1] = Math.round(bg_g * (1 - c) + 30 * c)
        rgba[i * 4 + 2] = Math.round(bg_b * (1 - c) + 25 * c)
      } else {
        rgba[i * 4 + 0] = Math.round(bg_r)
        rgba[i * 4 + 1] = Math.round(bg_g)
        rgba[i * 4 + 2] = Math.round(bg_b)
      }
      rgba[i * 4 + 3] = 255
    }
  }

  return rgba
}

// 4. MULTI-POP WARM: multiple populations with warm tones instead of neon
function renderWarmPop(trails: Float32Array[], w: number, h: number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4)

  // Warm population colors (earth tones instead of neon)
  const popColors = [
    [180, 90, 40],   // terracotta
    [50, 100, 120],  // slate blue
    [100, 130, 60],  // moss green
  ]

  // Background: warm cream
  const bgR = 245, bgG = 240, bgB = 228

  for (let i = 0; i < w * h; i++) {
    let r = bgR, g = bgG, b = bgB

    for (let p = 0; p < trails.length; p++) {
      const t = Math.pow(trails[p][i], 0.7) // gamma for softer blend
      const color = popColors[p % popColors.length]
      // Subtractive-ish: trail darkens the paper with its color
      r -= t * (bgR - color[0]) * 0.8
      g -= t * (bgG - color[1]) * 0.8
      b -= t * (bgB - color[2]) * 0.8
    }

    rgba[i * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
    rgba[i * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
    rgba[i * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
    rgba[i * 4 + 3] = 255
  }

  return rgba
}

async function main() {
  const seed = 68000 + Math.floor(Math.random() * 10000)

  // Single population — for ink, relief, contour
  console.log("\n=== Single population ===")
  const single = runSim(seed, "single")

  const renderers = [
    { name: "ink", fn: renderInkWash },
    { name: "relief", fn: renderRelief },
    { name: "contour", fn: renderContour },
  ]

  for (const { name, fn } of renderers) {
    const rgba = fn(single, W, H)
    const canvas = createCanvas(W, H)
    const ctx = canvas.getContext("2d")
    const imageData = ctx.createImageData(W, H)
    imageData.data.set(rgba)
    ctx.putImageData(imageData, 0, 0)
    const filename = `output/physarum-${name}.png`
    writeFileSync(filename, canvas.toBuffer("image/png"))
    console.log(`  → ${filename}`)
  }

  // Triple population — for warm pop rendering
  console.log("\n=== Triple population ===")
  const triple = runSim(seed + 1, "triple")
  const rgba = renderWarmPop(triple, W, H)
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)
  writeFileSync("output/physarum-warmpop.png", canvas.toBuffer("image/png"))
  console.log("  → output/physarum-warmpop.png")
}

main()
