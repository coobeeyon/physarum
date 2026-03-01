/**
 * ANGER
 *
 * Communicates: violence, force, impact, fracture, pressure breaking through.
 *
 * Approach: An explosion of jagged cracks radiating from an impact point.
 * Not a pattern — a surface that was struck and shattered.
 *
 * Visual language:
 * - Off-center impact point (compositional tension, asymmetry)
 * - Jagged branching cracks (violence, not organic smoothness)
 * - Hot center → cold edges (energy dissipating from point of violence)
 * - Red/crimson/black palette (blood, fire, darkness)
 * - Background texture: stressed, turbulent, ready to break
 *
 * The viewer should feel: something was hit. Hard.
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

// ---- Noise for background texture ----
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

// ---- Crack simulation ----
interface CrackTip {
  x: number
  y: number
  angle: number
  width: number
  energy: number // decreases with distance from impact
  depth: number
}

function simulateCracks(
  impactX: number,
  impactY: number,
  rand: () => number,
): Array<{ x1: number; y1: number; x2: number; y2: number; width: number; energy: number }> {
  const segments: Array<{
    x1: number; y1: number; x2: number; y2: number; width: number; energy: number
  }> = []

  const tips: CrackTip[] = []

  // Initial crack directions from impact point — not evenly spaced, slightly irregular
  const initialCount = 12 + Math.floor(rand() * 6)
  for (let i = 0; i < initialCount; i++) {
    const baseAngle = (i / initialCount) * Math.PI * 2
    const jitter = (rand() - 0.5) * 0.4
    tips.push({
      x: impactX,
      y: impactY,
      angle: baseAngle + jitter,
      width: 8 + rand() * 12,
      energy: 1.0,
      depth: 0,
    })
  }

  // Process all tips (BFS to avoid stack overflow)
  while (tips.length > 0) {
    const tip = tips.shift()!
    if (tip.energy < 0.02 || tip.depth > 300) continue
    if (tip.x < -100 || tip.x > W + 100 || tip.y < -100 || tip.y > H + 100) continue

    // Segment length — shorter near impact (more detail), longer far away
    const len = tip.depth < 30 ? 3 + rand() * 6 : 6 + rand() * 14

    // Jagged angle deviation — MORE jagged than smooth
    const jagAmount = tip.depth < 20 ? 0.7 : 0.4
    const jag = (rand() - 0.5) * jagAmount
    const newAngle = tip.angle + jag

    const x2 = tip.x + Math.cos(newAngle) * len
    const y2 = tip.y + Math.sin(newAngle) * len

    segments.push({
      x1: tip.x,
      y1: tip.y,
      x2,
      y2,
      width: tip.width,
      energy: tip.energy,
    })

    // Energy decay
    const decay = 0.985 + rand() * 0.01
    const newEnergy = tip.energy * decay
    const newWidth = tip.width * (0.993 + rand() * 0.005)

    // Continue main crack
    tips.push({
      x: x2,
      y: y2,
      angle: newAngle,
      width: Math.max(0.3, newWidth),
      energy: newEnergy,
      depth: tip.depth + 1,
    })

    // Branch with some probability
    const branchProb = tip.depth < 15 ? 0.12 : tip.depth < 40 ? 0.06 : 0.025
    if (rand() < branchProb) {
      const branchDir = rand() > 0.5 ? 1 : -1
      const branchAngle = newAngle + branchDir * (0.4 + rand() * 0.9)
      tips.push({
        x: x2,
        y: y2,
        angle: branchAngle,
        width: tip.width * (0.4 + rand() * 0.3),
        energy: tip.energy * (0.6 + rand() * 0.2),
        depth: tip.depth + 1,
      })
    }

    // Occasional secondary branch (creates denser fracture near impact)
    if (tip.depth < 25 && rand() < 0.04) {
      const branchDir = rand() > 0.5 ? 1 : -1
      const branchAngle = newAngle + branchDir * (0.8 + rand() * 1.2)
      tips.push({
        x: x2,
        y: y2,
        angle: branchAngle,
        width: tip.width * (0.3 + rand() * 0.2),
        energy: tip.energy * (0.4 + rand() * 0.2),
        depth: tip.depth + 5,
      })
    }
  }

  return segments
}

// ---- Rendering ----

function render(
  impactX: number,
  impactY: number,
  segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number; energy: number }>,
  seed: number,
): Uint8ClampedArray {
  const N = W * H
  const energyField = new Float32Array(N)
  const distField = new Float32Array(N)

  // Compute distance from impact for every pixel
  const maxDist = Math.sqrt(W * W + H * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - impactX
      const dy = y - impactY
      distField[y * W + x] = Math.sqrt(dx * dx + dy * dy) / maxDist
    }
  }

  // Deposit crack energy into the field
  // For each segment, deposit energy into nearby pixels
  for (const seg of segments) {
    const dx = seg.x2 - seg.x1
    const dy = seg.y2 - seg.y1
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 0.1) continue

    const steps = Math.ceil(len * 2)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const px = seg.x1 + dx * t
      const py = seg.y1 + dy * t

      // Deposit in a radius proportional to width
      const radius = Math.ceil(seg.width * 1.5)
      for (let ry = -radius; ry <= radius; ry++) {
        for (let rx = -radius; rx <= radius; rx++) {
          const ix = Math.floor(px + rx)
          const iy = Math.floor(py + ry)
          if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue

          const d = Math.sqrt(rx * rx + ry * ry)
          if (d > radius) continue

          // Falloff from crack center — sharp core, soft glow
          const falloff = d < seg.width * 0.4
            ? 1.0
            : Math.max(0, 1.0 - (d - seg.width * 0.4) / (radius - seg.width * 0.4))

          const deposit = seg.energy * falloff * falloff
          const idx = iy * W + ix
          energyField[idx] = Math.max(energyField[idx], deposit)
        }
      }
    }
  }

  // Add impact glow — bright hot spot at point of impact
  const glowRadius = Math.min(W, H) * 0.12
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - impactX
      const dy = y - impactY
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < glowRadius) {
        const t = 1.0 - d / glowRadius
        const glow = t * t * t // cubic falloff
        const idx = y * W + x
        energyField[idx] = Math.max(energyField[idx], glow * 1.2)
      }
    }
  }

  // Background noise texture — stressed surface
  const noise1 = makeNoise(seed, 200)
  const noise2 = makeNoise(seed + 1000, 80)
  const noise3 = makeNoise(seed + 2000, 30)

  // Render to RGBA
  const rgba = new Uint8ClampedArray(N * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const e = Math.min(1.0, energyField[idx])
      const dist = distField[idx]

      // Background: near-black with dark red undertone, modulated by noise
      const n = noise1(x, y) * 0.3 + noise2(x, y) * 0.2 + noise3(x, y) * 0.1
      const bgR = Math.max(0, Math.min(255, 18 + n * 25))
      const bgG = Math.max(0, Math.min(255, 5 + n * 8))
      const bgB = Math.max(0, Math.min(255, 5 + n * 5))

      let r: number, g: number, b: number

      if (e > 0.01) {
        // Crack color: distance from impact determines the "temperature"
        // Near impact: white-hot → yellow → orange
        // Far from impact: red → crimson → dark red
        const heat = Math.max(0, 1.0 - dist * 2.5)
        const intensity = e

        // White-hot core (very near impact, high energy)
        const whiteHot = Math.max(0, heat - 0.6) * 2.5 * intensity
        // Orange-yellow (medium distance)
        const hotOrange = Math.max(0, Math.min(1, heat * 1.5)) * intensity
        // Red (base crack color)
        const red = intensity

        // Blend layers
        r = Math.min(255, bgR + red * 220 + hotOrange * 35 + whiteHot * 50)
        g = Math.min(255, bgG + hotOrange * 80 + whiteHot * 120)
        b = Math.min(255, bgB + whiteHot * 80)
      } else {
        r = bgR
        g = bgG
        b = bgB
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }
  }

  return rgba
}

// ---- Main ----

async function main() {
  const variant = process.argv[2] || "v1"

  // Different impact positions and seeds for iteration
  const variants: Record<string, { impactX: number; impactY: number; seed: number }> = {
    v1: { impactX: W * 0.38, impactY: H * 0.55, seed: 66601 },    // lower-left
    v2: { impactX: W * 0.62, impactY: H * 0.42, seed: 66602 },    // upper-right
    v3: { impactX: W * 0.45, impactY: H * 0.5, seed: 66603 },     // near center
    v4: { impactX: W * 0.3, impactY: H * 0.65, seed: 66604 },     // bottom-left
  }

  const config = variants[variant] ?? variants.v1
  const rand = makePRNG(config.seed)

  console.log(`=== ANGER ${variant} (impact: ${config.impactX}, ${config.impactY}) ===`)

  console.log("  Simulating fractures...")
  const segments = simulateCracks(config.impactX, config.impactY, rand)
  console.log(`  ${segments.length} segments generated`)

  console.log("  Rendering...")
  const rgba = render(config.impactX, config.impactY, segments, config.seed)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
