/**
 * ANGER v10 — DENSE DESTRUCTION
 *
 * Previous anger pieces had too few marks. Real rage isn't a few
 * elegant slashes — it's OVERWHELMING. Dense, layered, suffocating.
 *
 * This version:
 * - Many MORE marks (40-60), densely overlapping
 * - A central fury zone where damage ACCUMULATES to total destruction
 * - The warm surface is BRIGHT (more orange/saturated) so the contrast
 *   with the dark voids is visceral
 * - Edges are extremely ragged (multi-scale noise)
 * - The marks vary from thin scratches to wide gouges — mixed violence
 * - Some areas have so many overlapping cuts that the warm surface
 *   is completely churned — a devastated zone
 * - The undamaged areas feel PRECIOUS by contrast
 *
 * Reference energy: Cy Twombly's blackboard paintings but with destruction
 * instead of writing. The density IS the anger.
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
    if (rand() < fury * 0.20) {
      // More frequent jerks — anger is erratic
      const jerkAngle = angle + (rand() - 0.5) * 2.2
      vx += Math.cos(jerkAngle) * (4 + rand() * 14)
      vy += Math.sin(jerkAngle) * (4 + rand() * 14)
    }
    const perpAngle = angle + Math.PI / 2
    vx += Math.cos(perpAngle) * (rand() - 0.5) * fury * 9
    vy += Math.sin(perpAngle) * (rand() - 0.5) * fury * 9
    vx = vx * 0.90 + Math.cos(angle) * speed * 0.10
    vy = vy * 0.90 + Math.sin(angle) * speed * 0.10
    x += vx
    y += vy
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 10001, b: 10002, c: 10003 }
  const seed = seeds[variant] ?? 10001
  const rand = makePRNG(seed)

  console.log(`=== ANGER v10 variant ${variant} (seed: ${seed}) ===`)

  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const ragN1 = makeNoise(seed + 300, 5)
  const ragN2 = makeNoise(seed + 310, 12)
  const ragN3 = makeNoise(seed + 320, 35)
  const voidTex = makeNoise(seed + 400, 4)

  // Warm texture — BRIGHTER, more saturated than previous versions
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

  // === DENSE slash generation ===
  interface Slash {
    points: Array<{ x: number; y: number }>
    width: number
    depth: number
  }
  const slashes: Slash[] = []

  // Fury center
  const furyX = W * (0.35 + rand() * 0.30)
  const furyY = H * (0.30 + rand() * 0.30)

  // 4-6 main slashes: wide, crossing canvas
  const mainCount = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < mainCount; i++) {
    // All slashes are biased to pass through or near the fury zone
    const angle = rand() * Math.PI - Math.PI / 2
    const startX = furyX + Math.cos(angle + Math.PI) * (W * 0.5 + rand() * W * 0.3)
    const startY = furyY + Math.sin(angle + Math.PI) * (H * 0.4 + rand() * H * 0.3)
    const length = 1000 + rand() * 1500

    slashes.push({
      points: simulateSlash(startX, startY, angle, 10, 0.5 + rand() * 0.3, length, rand),
      width: 20 + rand() * 35,
      depth: 0.80 + rand() * 0.20,
    })
  }

  // 8-12 secondary slashes: shorter, varied angles
  const secCount = 8 + Math.floor(rand() * 5)
  for (let i = 0; i < secCount; i++) {
    const distFromFury = rand() * W * 0.5
    const angleToFury = rand() * Math.PI * 2
    const cx = furyX + Math.cos(angleToFury) * distFromFury
    const cy = furyY + Math.sin(angleToFury) * distFromFury
    const angle = rand() * Math.PI
    const length = 200 + rand() * 600

    slashes.push({
      points: simulateSlash(cx, cy, angle, 8, 0.5 + rand() * 0.4, length, rand),
      width: 10 + rand() * 22,
      depth: 0.65 + rand() * 0.30,
    })
  }

  // 15-25 stabs: concentrated near fury zone
  const stabCount = 15 + Math.floor(rand() * 11)
  for (let i = 0; i < stabCount; i++) {
    const spread = 150 + rand() * 250
    const cx = furyX + (rand() - 0.5) * spread * 2
    const cy = furyY + (rand() - 0.5) * spread * 2
    const angle = rand() * Math.PI * 2
    const length = 20 + rand() * 100

    slashes.push({
      points: simulateSlash(cx, cy, angle, 5, 0.8 + rand() * 0.2, length, rand),
      width: 4 + rand() * 12,
      depth: 0.50 + rand() * 0.45,
    })
  }

  // 6-10 thin scratches across the whole surface
  const scratchCount = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < scratchCount; i++) {
    const angle = rand() * Math.PI
    const startX = rand() * W
    const startY = rand() * H
    const length = 400 + rand() * 1600

    slashes.push({
      points: simulateSlash(startX, startY, angle, 14, 0.15, length, rand),
      width: 1.5 + rand() * 3.5,
      depth: 0.30 + rand() * 0.30,
    })
  }

  console.log(`  ${slashes.length} marks (dense mode)`)

  // === Compute destruction map ===
  const destructionMap = new Float32Array(W * H)

  for (const slash of slashes) {
    for (let i = 1; i < slash.points.length; i++) {
      const p0 = slash.points[i - 1]
      const p1 = slash.points[i]

      const margin = slash.width * 3
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

          // Extremely ragged edges
          const rag = ragN1(px, py) * 0.40 + ragN2(px, py) * 0.35 + ragN3(px, py) * 0.25
          const effectiveWidth = slash.width * (0.3 + Math.abs(rag) * 1.8)

          if (dist < effectiveWidth) {
            const falloff = 1.0 - (dist / effectiveWidth)
            const contribution = falloff * falloff * slash.depth
            const idx = py * W + px
            destructionMap[idx] = Math.min(1.0, destructionMap[idx] + contribution)
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

      // === Warm surface — BRIGHTER, more orange-amber ===
      const atm = n5(x, y) * 0.5 + 0.5
      let r = 180 + warmth * 55 + atm * 12
      let g = 128 + warmth * 28 + atm * 8
      let b = 65 + warmth * 12 + atm * 4

      if (warmth > 0.50) {
        const veinT = (warmth - 0.50) / 0.50
        r += veinT * 30
        g += veinT * 12
        b -= veinT * 8
      }

      // === Destruction ===
      if (destruction > 0.02) {
        const dt = Math.min(1.0, destruction)

        // Transition zone: warm → stressed → void
        // WIDER stress zone — the damage is visible AROUND the cuts
        if (dt < 0.5) {
          // Stressed zone: darkened, reddened — WIDER and more intense
          const st = dt / 0.5
          r -= st * 50
          g -= st * 70
          b -= st * 60
        } else {
          // Full void territory — dark with granular texture
          const voidFade = (dt - 0.5) / 0.5
          const voidCurve = voidFade * voidFade

          const vt = voidTex(x, y) * 0.5 + 0.5
          const baseR = r - 40
          const baseG = g - 60
          const baseB = b - 55

          const darkR = 12 + vt * 15
          const darkG = 14 + vt * 12
          const darkB = 18 + vt * 8

          r = baseR * (1 - voidCurve) + darkR * voidCurve
          g = baseG * (1 - voidCurve) + darkG * voidCurve
          b = baseB * (1 - voidCurve) + darkB * voidCurve
        }
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

  const filename = `output/anger-v10-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
