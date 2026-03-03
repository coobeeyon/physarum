/**
 * ANGER v8 — SLASHED WARMTH
 *
 * v7 had the right concept (destroy something beautiful) but the tears
 * merged into one massive void. Reads as a map, not violence.
 *
 * This version:
 * - Tears are THINNER and more LINEAR — slashes, not erosion
 * - They CROSS the surface directionally, not radiate from a center
 * - Some cross each other at angles (= fury)
 * - The warm surface stays 70-80% intact — the anger is in the cuts,
 *   not in how much is destroyed
 * - Short stabs/gouges scattered near the main slashes
 * - The thin scratches from v7 (the strongest element) are kept
 *
 * The image should read: something warm and alive was attacked.
 * You can see the beauty that's left. You can see the damage.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

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

// A slash: starts at one edge region, crosses the canvas
interface Slash {
  points: Array<{ x: number; y: number }>
  width: number
  depth: number
}

function simulateSlash(
  startX: number, startY: number,
  angle: number, speed: number,
  fury: number, length: number,
  rand: () => number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = startX, y = startY
  let vx = Math.cos(angle) * speed
  let vy = Math.sin(angle) * speed

  const steps = Math.ceil(length / 4)
  for (let i = 0; i < steps; i++) {
    points.push({ x, y })

    // Occasional sharp jerk — the hand slips
    if (rand() < fury * 0.08) {
      const jerkAngle = angle + (rand() - 0.5) * 1.2  // mostly along the slash direction
      vx += Math.cos(jerkAngle) * (3 + rand() * 8)
      vy += Math.sin(jerkAngle) * (3 + rand() * 8)
    }

    // Continuous small tremor
    const perpAngle = angle + Math.PI / 2
    vx += Math.cos(perpAngle) * (rand() - 0.5) * fury * 3
    vy += Math.sin(perpAngle) * (rand() - 0.5) * fury * 3

    // Strong directional momentum — slashes are FAST
    vx = vx * 0.95 + Math.cos(angle) * speed * 0.05
    vy = vy * 0.95 + Math.sin(angle) * speed * 0.05

    x += vx
    y += vy
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 88801, b: 88802, c: 88803 }
  const seed = seeds[variant] ?? 88801
  const rand = makePRNG(seed)

  console.log(`=== ANGER v8 variant ${variant} (seed: ${seed}) ===`)

  // === Build the warm surface ===
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const tearEdge1 = makeNoise(seed + 300, 20)
  const tearEdge2 = makeNoise(seed + 310, 8)

  // Warm texture
  const warmLayer = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
      const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
      const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
      const base = n1(x, y) * 0.5 + 0.5
      const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + base * 0.20
      warmLayer[y * W + x] = Math.max(0, Math.min(1, texture))
    }
  }

  // === Generate slashes — linear, directional, CROSSING the surface ===
  const slashes: Slash[] = []

  // 3-5 main slashes: long, crossing from one area to another
  const mainCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < mainCount; i++) {
    // Each slash has a strong angle — they should cross, not all be parallel
    const angle = (rand() - 0.5) * Math.PI * 0.8 + (i % 2 === 0 ? -0.3 : 0.3)
    // Start from various positions, biased toward one side
    const startX = rand() * W * 0.3 + (rand() < 0.5 ? 0 : W * 0.7)
    const startY = rand() * H
    const length = 800 + rand() * 1200

    slashes.push({
      points: simulateSlash(startX, startY, angle, 10, 0.5 + rand() * 0.3, length, rand),
      width: 18 + rand() * 25,  // MUCH thinner than v7's 60-80
      depth: 0.85 + rand() * 0.15,
    })
  }

  // 4-7 secondary slashes: shorter, still directional, around the main slash area
  const secCount = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < secCount; i++) {
    const angle = rand() * Math.PI - Math.PI / 2
    const startX = W * (0.15 + rand() * 0.7)
    const startY = H * (0.15 + rand() * 0.7)
    const length = 300 + rand() * 600

    slashes.push({
      points: simulateSlash(startX, startY, angle, 8, 0.4 + rand() * 0.3, length, rand),
      width: 10 + rand() * 18,
      depth: 0.70 + rand() * 0.25,
    })
  }

  // 8-12 stab marks: very short, concentrated near a fury zone
  const furyX = W * (0.3 + rand() * 0.4)
  const furyY = H * (0.3 + rand() * 0.4)
  const stabCount = 8 + Math.floor(rand() * 5)
  for (let i = 0; i < stabCount; i++) {
    const cx = furyX + (rand() - 0.5) * 400
    const cy = furyY + (rand() - 0.5) * 400
    const angle = rand() * Math.PI * 2
    const length = 40 + rand() * 120

    slashes.push({
      points: simulateSlash(cx, cy, angle, 6, 0.8, length, rand),
      width: 5 + rand() * 12,
      depth: 0.60 + rand() * 0.35,
    })
  }

  // 5-8 long thin scratches: very narrow, long, spanning the canvas
  const scratchCount = 5 + Math.floor(rand() * 4)
  for (let i = 0; i < scratchCount; i++) {
    const angle = rand() * Math.PI
    const startX = rand() * W
    const startY = rand() * H
    const length = 600 + rand() * 1400

    slashes.push({
      points: simulateSlash(startX, startY, angle, 12, 0.2, length, rand),
      width: 2 + rand() * 5,
      depth: 0.40 + rand() * 0.30,
    })
  }

  console.log(`  ${slashes.length} slashes generated`)

  // === Compute destruction mask ===
  // Using a more efficient segment-distance approach
  const destructionMap = new Float32Array(W * H)
  const edgeStress = new Float32Array(W * H)

  for (const slash of slashes) {
    for (let i = 1; i < slash.points.length; i++) {
      const p0 = slash.points[i - 1]
      const p1 = slash.points[i]

      // Bounding box of this segment with margin
      const margin = slash.width * 3
      const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x) - margin))
      const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x) + margin))
      const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y) - margin))
      const maxY = Math.min(H - 1, Math.ceil(Math.max(p0.y, p1.y) + margin))

      const segDx = p1.x - p0.x
      const segDy = p1.y - p0.y
      const segLen2 = segDx * segDx + segDy * segDy
      const segLen = Math.sqrt(segLen2)
      if (segLen < 0.1) continue

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          // Distance from point to line segment
          const apx = px - p0.x
          const apy = py - p0.y
          let t = (apx * segDx + apy * segDy) / segLen2
          t = Math.max(0, Math.min(1, t))
          const closestX = p0.x + t * segDx
          const closestY = p0.y + t * segDy
          const dx = px - closestX
          const dy = py - closestY
          const dist = Math.sqrt(dx * dx + dy * dy)

          // Ragged edges via noise
          const en = tearEdge1(px, py) * 0.6 + tearEdge2(px, py) * 0.4
          const effectiveWidth = slash.width * (1.0 + en * 0.8)

          const idx = py * W + px

          if (dist < effectiveWidth) {
            // Core destruction
            const falloff = 1.0 - (dist / effectiveWidth)
            const contribution = falloff * falloff * slash.depth
            destructionMap[idx] = Math.min(1.0, destructionMap[idx] + contribution)
          }

          // Edge stress zone — slightly wider than the cut itself
          if (dist >= effectiveWidth * 0.6 && dist < effectiveWidth * 2.5) {
            const stressPos = (dist - effectiveWidth * 0.6) / (effectiveWidth * 1.9)
            const stressVal = (1.0 - stressPos) * slash.depth * 0.4
            edgeStress[idx] = Math.min(1.0, edgeStress[idx] + stressVal * stressVal)
          }
        }
      }
    }
  }

  console.log("  Rendering...")

  // === Render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const warmth = warmLayer[idx]
      const destruction = destructionMap[idx]
      const stress = edgeStress[idx]

      // === The warm surface ===
      const atm = n5(x, y) * 0.5 + 0.5
      let r = 165 + warmth * 60 + atm * 15
      let g = 125 + warmth * 30 + atm * 10
      let b = 80 + warmth * 15 + atm * 5

      // Veins: brighter warm
      if (warmth > 0.55) {
        const veinT = (warmth - 0.55) / 0.45
        r += veinT * 35
        g += veinT * 15
        b -= veinT * 5
      }

      // === Edge stress (darkened, reddened around cuts) ===
      if (stress > 0.01) {
        const st = Math.min(1.0, stress * 2.0)
        r -= st * 30
        g -= st * 50
        b -= st * 55
        if (st > 0.4) {
          const charT = (st - 0.4) / 0.6
          r -= charT * 45
          g -= charT * 35
          b -= charT * 25
        }
      }

      // === Destruction (the void) ===
      if (destruction > 0.03) {
        const dt = Math.min(1.0, destruction * 1.8)
        const dtCurve = dt * dt

        // Cold dark void — darker than v7, more neutral
        const voidR = 18 + (1 - dtCurve) * 10
        const voidG = 20 + (1 - dtCurve) * 8
        const voidB = 24 + (1 - dtCurve) * 6

        r = r * (1 - dtCurve) + voidR * dtCurve
        g = g * (1 - dtCurve) + voidG * dtCurve
        b = b * (1 - dtCurve) + voidB * dtCurve
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-v8-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
