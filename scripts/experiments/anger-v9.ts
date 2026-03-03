/**
 * ANGER v9 — ROUGH DESTRUCTION
 *
 * v8's slashes read as calligraphy — too clean. Real violence is MESSY.
 *
 * Key changes:
 * 1. Slash edges are extremely ragged — multi-scale noise makes them
 *    look torn, not cut
 * 2. "Displaced material" at slash edges — warm texture pushed outward
 *    by the force of the cut, creating ridges/mounds at the edges
 *    (like wounded flesh pushed to the sides)
 * 3. Void has debris/texture — not clean dark, but granular/rough
 * 4. The fury zone has OVERLAPPING damage — multiple passes create
 *    a churned area where the surface is destroyed to different degrees
 * 5. Splash: some warm material scattered AWAY from the cuts
 *    (like debris thrown from the impact)
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

  const steps = Math.ceil(length / 3)
  for (let i = 0; i < steps; i++) {
    points.push({ x, y })

    // Sharp jerks
    if (rand() < fury * 0.12) {
      const jerkAngle = angle + (rand() - 0.5) * 1.5
      vx += Math.cos(jerkAngle) * (4 + rand() * 12)
      vy += Math.sin(jerkAngle) * (4 + rand() * 12)
    }

    // Perpendicular tremor
    const perpAngle = angle + Math.PI / 2
    vx += Math.cos(perpAngle) * (rand() - 0.5) * fury * 5
    vy += Math.sin(perpAngle) * (rand() - 0.5) * fury * 5

    // Directional momentum
    vx = vx * 0.93 + Math.cos(angle) * speed * 0.07
    vy = vy * 0.93 + Math.sin(angle) * speed * 0.07

    x += vx
    y += vy
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 99901, b: 99902, c: 99903 }
  const seed = seeds[variant] ?? 99901
  const rand = makePRNG(seed)

  console.log(`=== ANGER v9 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)

  // Edge raggedness at multiple scales — the key to "rough" vs "clean"
  const ragN1 = makeNoise(seed + 300, 6)    // very fine raggedness
  const ragN2 = makeNoise(seed + 310, 15)   // medium raggedness
  const ragN3 = makeNoise(seed + 320, 40)   // large undulations
  const ragN4 = makeNoise(seed + 330, 3)    // micro-texture in void

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

  // === Generate slashes ===
  const slashes: Slash[] = []

  // Main slashes: 3-4 crossing the canvas
  const mainCount = 3 + Math.floor(rand() * 2)
  for (let i = 0; i < mainCount; i++) {
    const angle = (rand() - 0.5) * Math.PI * 0.7 + (i % 2 === 0 ? -0.2 : 0.4)
    const startX = rand() * W * 0.3 + (rand() < 0.5 ? 0 : W * 0.7)
    const startY = rand() * H
    const length = 900 + rand() * 1100

    slashes.push({
      points: simulateSlash(startX, startY, angle, 10, 0.5 + rand() * 0.3, length, rand),
      width: 22 + rand() * 30,
      depth: 0.85 + rand() * 0.15,
    })
  }

  // Secondary: 3-5 shorter
  const secCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < secCount; i++) {
    const angle = rand() * Math.PI - Math.PI / 2
    const startX = W * (0.15 + rand() * 0.7)
    const startY = H * (0.15 + rand() * 0.7)
    const length = 250 + rand() * 500

    slashes.push({
      points: simulateSlash(startX, startY, angle, 8, 0.5 + rand() * 0.3, length, rand),
      width: 14 + rand() * 20,
      depth: 0.70 + rand() * 0.25,
    })
  }

  // Stabs: 10-15 concentrated
  const furyX = W * (0.3 + rand() * 0.4)
  const furyY = H * (0.3 + rand() * 0.4)
  const stabCount = 10 + Math.floor(rand() * 6)
  for (let i = 0; i < stabCount; i++) {
    const cx = furyX + (rand() - 0.5) * 350
    const cy = furyY + (rand() - 0.5) * 350
    const angle = rand() * Math.PI * 2
    const length = 30 + rand() * 100

    slashes.push({
      points: simulateSlash(cx, cy, angle, 5, 0.9, length, rand),
      width: 6 + rand() * 14,
      depth: 0.55 + rand() * 0.40,
    })
  }

  // Thin scratches
  const scratchCount = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < scratchCount; i++) {
    const angle = rand() * Math.PI
    const startX = rand() * W
    const startY = rand() * H
    const length = 500 + rand() * 1200

    slashes.push({
      points: simulateSlash(startX, startY, angle, 12, 0.15, length, rand),
      width: 2 + rand() * 4,
      depth: 0.35 + rand() * 0.30,
    })
  }

  console.log(`  ${slashes.length} slashes generated`)

  // === Compute destruction, displacement, and debris maps ===
  const destructionMap = new Float32Array(W * H)
  const displacementMap = new Float32Array(W * H)  // material pushed to edges
  const debrisMap = new Float32Array(W * H)  // scattered fragments

  for (const slash of slashes) {
    for (let i = 1; i < slash.points.length; i++) {
      const p0 = slash.points[i - 1]
      const p1 = slash.points[i]

      const margin = slash.width * 4
      const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x) - margin))
      const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x) + margin))
      const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y) - margin))
      const maxY = Math.min(H - 1, Math.ceil(Math.max(p0.y, p1.y) + margin))

      const segDx = p1.x - p0.x
      const segDy = p1.y - p0.y
      const segLen2 = segDx * segDx + segDy * segDy
      if (segLen2 < 0.01) continue

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const apx = px - p0.x
          const apy = py - p0.y
          let t = (apx * segDx + apy * segDy) / segLen2
          t = Math.max(0, Math.min(1, t))
          const cx = p0.x + t * segDx
          const cy = p0.y + t * segDy
          const dx = px - cx
          const dy = py - cy
          const dist = Math.sqrt(dx * dx + dy * dy)

          // EXTREMELY ragged edges — multiple noise scales
          const rag = ragN1(px, py) * 0.35 + ragN2(px, py) * 0.35 + ragN3(px, py) * 0.30
          // Raggedness makes the effective width vary wildly at fine scale
          const effectiveWidth = slash.width * (0.4 + Math.abs(rag) * 1.6)

          const idx = py * W + px

          // Core destruction
          if (dist < effectiveWidth) {
            const falloff = 1.0 - (dist / effectiveWidth)
            const contribution = falloff * slash.depth
            destructionMap[idx] = Math.min(1.0, destructionMap[idx] + contribution)
          }

          // Displaced material at edges — mounded up outside the cut
          if (dist >= effectiveWidth * 0.7 && dist < effectiveWidth * 2.0) {
            const edgePos = (dist - effectiveWidth * 0.7) / (effectiveWidth * 1.3)
            // Displacement peaks just outside the cut edge
            const dispCurve = Math.exp(-edgePos * 3.0) * slash.depth * 0.6
            displacementMap[idx] = Math.min(1.0, displacementMap[idx] + dispCurve)
          }

          // Debris: scattered fragments further from the cut
          if (dist >= effectiveWidth * 1.5 && dist < effectiveWidth * 3.5) {
            const debrisPos = (dist - effectiveWidth * 1.5) / (effectiveWidth * 2.0)
            // Only some pixels get debris (use noise as threshold)
            const debrisNoise = ragN4(px, py) * 0.5 + 0.5
            if (debrisNoise > 0.6 + debrisPos * 0.3) {
              const debrisVal = (1.0 - debrisPos) * slash.depth * 0.3 * (debrisNoise - 0.6) * 3
              debrisMap[idx] = Math.min(1.0, debrisMap[idx] + debrisVal)
            }
          }
        }
      }
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const warmth = warmLayer[idx]
      const destruction = destructionMap[idx]
      const displacement = displacementMap[idx]
      const debris = debrisMap[idx]

      // === Base warm surface ===
      const atm = n5(x, y) * 0.5 + 0.5
      let r = 165 + warmth * 60 + atm * 15
      let g = 125 + warmth * 30 + atm * 10
      let b = 80 + warmth * 15 + atm * 5

      if (warmth > 0.55) {
        const veinT = (warmth - 0.55) / 0.45
        r += veinT * 35
        g += veinT * 15
        b -= veinT * 5
      }

      // === Displaced material: brighter/mounded at cut edges ===
      if (displacement > 0.02) {
        const dp = Math.min(1.0, displacement * 2.0)
        // Material pushed up — brighter, rougher
        r += dp * 30
        g += dp * 15
        b += dp * 5
        // Also darker underneath (shadow of the ridge)
        const shadow = ragN2(x, y) * 0.5 + 0.5
        if (shadow < 0.4) {
          r -= dp * 25 * (1 - shadow / 0.4)
          g -= dp * 25 * (1 - shadow / 0.4)
          b -= dp * 20 * (1 - shadow / 0.4)
        }
      }

      // === Debris: small bright/dark specks scattered from cuts ===
      if (debris > 0.02) {
        const db = Math.min(1.0, debris * 3.0)
        // Some debris is bright (thrown warm material), some is dark (void showing through)
        const debrisType = ragN1(x * 2, y * 2)
        if (debrisType > 0) {
          r += db * 40
          g += db * 15
          b -= db * 5
        } else {
          r -= db * 50
          g -= db * 45
          b -= db * 35
        }
      }

      // === Destruction (the rough void) ===
      if (destruction > 0.03) {
        const dt = Math.min(1.0, destruction * 1.5)
        const dtCurve = dt * dt

        // Void is not clean — has granular texture
        const voidTex = ragN4(x, y) * 0.5 + 0.5
        const voidR = 15 + voidTex * 18
        const voidG = 17 + voidTex * 14
        const voidB = 22 + voidTex * 10

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

  const filename = `output/anger-v9-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
