/**
 * ANGER v13 — DENSE GESTURE
 *
 * v12 was the right direction (gestural marks on calm surface) but too
 * sparse. 2 strokes and 3 stabs on an empty canvas reads as "gestural
 * abstraction," not anger. Anger is OVERWHELMING.
 *
 * Changes from v12:
 * - 4-6 major gestures that CROSS each other, creating tangles
 * - 8-12 stabs, larger and more numerous
 * - RED-black ink: some strokes are deep blood red, others black.
 *   The red carries heat. The mixing carries chaos.
 * - MUCH more splatter (higher probability, wider throw)
 * - Gestures concentrate in a fury zone — not spread evenly
 * - The gestures are FASTER (longer travel, more momentum)
 * - Some strokes RETURN — the arm swings back through the same area
 *
 * The canvas should feel VIOLATED. Not "marked" — ATTACKED.
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

interface GesturePoint {
  x: number; y: number
  pressure: number; velocity: number; angle: number
}

function simulateGesture(
  startX: number, startY: number,
  targetAngle: number, intensity: number,
  rand: () => number,
  steps?: number,
): GesturePoint[] {
  const points: GesturePoint[] = []
  let x = startX, y = startY, angle = targetAngle
  const maxSpeed = 18 + intensity * 30
  const totalSteps = steps ?? (90 + Math.floor(rand() * 80))
  const strikePoint = 0.12 + rand() * 0.10

  for (let i = 0; i < totalSteps; i++) {
    const t = i / totalSteps
    let speed: number
    if (t < strikePoint) {
      const rampT = t / strikePoint
      speed = maxSpeed * 0.1 + maxSpeed * 0.9 * rampT * rampT
    } else {
      const decayT = (t - strikePoint) / (1.0 - strikePoint)
      speed = maxSpeed * Math.pow(1.0 - decayT, 0.6)
      if (rand() < 0.08 * intensity) speed = Math.max(speed, maxSpeed * 0.7)
    }

    let pressure: number
    if (t < strikePoint + 0.05 && t > strikePoint - 0.05) {
      pressure = 0.85 + rand() * 0.15
    } else {
      pressure = Math.max(0.08, 0.7 - speed / maxSpeed * 0.5 + rand() * 0.15)
    }

    // Angry direction changes — MORE FREQUENT and LARGER
    if (rand() < 0.10 * intensity) {
      angle += (rand() - 0.5) * 2.0 * intensity
    }
    angle += (rand() - 0.5) * 0.18

    x += Math.cos(angle) * speed
    y += Math.sin(angle) * speed
    points.push({ x, y, pressure, velocity: speed, angle })
  }
  return points
}

function generateSplatter(
  points: GesturePoint[], rand: () => number, multiplier: number,
): Array<{ x: number; y: number; size: number; opacity: number }> {
  const splatters: Array<{ x: number; y: number; size: number; opacity: number }> = []
  for (let i = 1; i < points.length; i++) {
    const p = points[i], prev = points[i - 1]
    let angleDiff = p.angle - prev.angle
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2
    const splatProb = (p.velocity / 30) * (Math.abs(angleDiff) * 3 + 0.2) * p.pressure * multiplier
    if (rand() < splatProb) {
      const perpAngle = p.angle + (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2)
      const count = 2 + Math.floor(rand() * 6)
      for (let j = 0; j < count; j++) {
        const dist = 15 + rand() * 140 + p.velocity * 4
        const a = perpAngle + (rand() - 0.5) * 1.2
        splatters.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          size: 1.5 + rand() * 10 * p.pressure,
          opacity: 0.35 + rand() * 0.55,
        })
      }
    }
    // Forward spray at high speed
    if (p.velocity > 15 && rand() < 0.2 * multiplier) {
      const count = 1 + Math.floor(rand() * 3)
      for (let j = 0; j < count; j++) {
        const dist = p.velocity * (1 + rand() * 3) + rand() * 80
        const a = p.angle + (rand() - 0.5) * 0.5
        splatters.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          size: 1 + rand() * 6,
          opacity: 0.2 + rand() * 0.4,
        })
      }
    }
  }
  return splatters
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 13301, b: 13302, c: 13303, d: 13304, e: 13305 }
  const seed = seeds[variant] ?? 13301
  const rand = makePRNG(seed)

  console.log(`=== ANGER v13 variant ${variant} (seed: ${seed}) ===`)

  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)
  const edgeNoise = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 25)

  // Fury center — where the most marks concentrate
  const furyX = W * (0.35 + rand() * 0.30)
  const furyY = H * (0.30 + rand() * 0.35)

  // === Generate all gestures ===
  interface Gesture {
    points: GesturePoint[]
    isRed: boolean  // red or black ink
  }
  const allGestures: Gesture[] = []

  // 4-6 major crossing gestures — each one passes through or near the fury zone
  const majorCount = 4 + Math.floor(rand() * 3)
  for (let i = 0; i < majorCount; i++) {
    // Start from edges or near-edges, aimed toward fury zone
    const edgeDist = 100 + rand() * 200
    const approachAngle = rand() * Math.PI * 2
    const sx = furyX - Math.cos(approachAngle) * (W * 0.5 + edgeDist)
    const sy = furyY - Math.sin(approachAngle) * (H * 0.4 + edgeDist)

    // Aim roughly toward fury center with some scatter
    const toFuryAngle = Math.atan2(furyY - sy, furyX - sx) + (rand() - 0.5) * 0.6
    const intensity = 0.7 + rand() * 0.3

    allGestures.push({
      points: simulateGesture(sx, sy, toFuryAngle, intensity, rand),
      isRed: rand() < 0.35,  // ~35% are red
    })
  }

  // 2-3 return strokes — the arm comes BACK through the same area
  const returnCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < returnCount; i++) {
    const baseGesture = allGestures[Math.floor(rand() * Math.min(allGestures.length, majorCount))]
    const lastPt = baseGesture.points[baseGesture.points.length - 1]
    // Return: start near end of a previous gesture, swing back
    const returnAngle = lastPt.angle + Math.PI + (rand() - 0.5) * 1.2
    allGestures.push({
      points: simulateGesture(lastPt.x, lastPt.y, returnAngle, 0.6 + rand() * 0.3, rand, 50 + Math.floor(rand() * 40)),
      isRed: rand() < 0.3,
    })
  }

  // 6-10 stabs — short, violent, concentrated near fury zone
  const stabCount = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < stabCount; i++) {
    const spread = W * 0.25
    const sx = furyX + (rand() - 0.5) * spread
    const sy = furyY + (rand() - 0.5) * spread
    const ta = rand() * Math.PI * 2
    const stabPoints = simulateGesture(sx, sy, ta, 0.95, rand, 8 + Math.floor(rand() * 20))
    allGestures.push({
      points: stabPoints,
      isRed: rand() < 0.4,
    })
  }

  console.log(`  ${allGestures.length} gestures (${majorCount} major, ${returnCount} returns, ${stabCount} stabs)`)

  // === Compute ink maps (separate R and K channels for red/black) ===
  const inkBlack = new Float32Array(W * H)
  const inkRed = new Float32Array(W * H)
  const inkSpeed = new Float32Array(W * H)

  for (const gesture of allGestures) {
    const inkTarget = gesture.isRed ? inkRed : inkBlack
    for (let i = 1; i < gesture.points.length; i++) {
      const p0 = gesture.points[i - 1], p1 = gesture.points[i]
      const baseWidth = 10 + p1.pressure * 50
      const speedThin = Math.max(0.25, 1.0 - p1.velocity / 50 * 0.55)
      const strokeWidth = baseWidth * speedThin

      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const cP = p0.pressure * (1 - t) + p1.pressure * t
        const cV = p0.velocity * (1 - t) + p1.velocity * t
        const cW = strokeWidth * (0.9 + t * 0.1)

        const margin = Math.ceil(cW * 2)
        const minX = Math.max(0, Math.floor(cx - margin))
        const maxX = Math.min(W - 1, Math.ceil(cx + margin))
        const minY = Math.max(0, Math.floor(cy - margin))
        const maxY = Math.min(H - 1, Math.ceil(cy + margin))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx, ddy = py - cy
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)
            const en = edgeNoise(px, py) * 0.4 + edgeNoise2(px, py) * 0.3
            const effWidth = cW * (1.0 + en * 0.8)
            if (dist < effWidth) {
              const falloff = 1.0 - dist / effWidth
              const inkAmount = falloff * falloff * cP
              const idx = py * W + px
              inkTarget[idx] = Math.min(1.0, inkTarget[idx] + inkAmount)
              inkSpeed[idx] = Math.max(inkSpeed[idx], cV)
            }
          }
        }
      }
    }
  }

  // === Splatter (more aggressive) ===
  const allSplatters: Array<{ x: number; y: number; size: number; opacity: number; isRed: boolean }> = []
  for (const gesture of allGestures) {
    const splatters = generateSplatter(gesture.points, rand, 1.5)  // higher multiplier
    for (const sp of splatters) {
      allSplatters.push({ ...sp, isRed: gesture.isRed })
    }
  }
  console.log(`  ${allSplatters.length} splatter droplets`)

  for (const sp of allSplatters) {
    if (sp.x < 0 || sp.x >= W || sp.y < 0 || sp.y >= H) continue
    const target = sp.isRed ? inkRed : inkBlack
    const ir = Math.ceil(sp.size)
    for (let py = Math.max(0, Math.floor(sp.y - ir)); py < Math.min(H, Math.ceil(sp.y + ir)); py++) {
      for (let px = Math.max(0, Math.floor(sp.x - ir)); px < Math.min(W, Math.ceil(sp.x + ir)); px++) {
        const ddx = px - sp.x, ddy = py - sp.y
        const d = Math.sqrt(ddx * ddx + ddy * ddy)
        if (d < sp.size) {
          const idx = py * W + px
          target[idx] = Math.min(1.0, target[idx] + (1.0 - d / sp.size) * sp.opacity)
        }
      }
    }
  }

  console.log("  Rendering...")
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const black = inkBlack[idx]
      const red = inkRed[idx]
      const speed = inkSpeed[idx]
      const totalInk = Math.min(1.0, black + red)

      // Background
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5
      let bgR = 232 + bn * 10
      let bgG = 225 + bn * 8
      let bgB = 212 + bn * 6

      if (totalInk < 0.01) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Ink color mixing: black and red combine
      const redRatio = totalInk > 0 ? red / totalInk : 0
      const speedFactor = Math.min(1.0, speed / 35)

      // Black ink: deep near-black
      const bR = 18 + (1 - black) * 12
      const bG = 14 + (1 - black) * 8
      const bB = 18 + (1 - black) * 8

      // Red ink: deep blood red
      const rR = 100 + (1 - red) * 30 - speedFactor * 30
      const rG = 12 + (1 - red) * 8
      const rB = 8 + (1 - red) * 6

      // Mix based on ratio
      const inkR = bR * (1 - redRatio) + rR * redRatio
      const inkG = bG * (1 - redRatio) + rG * redRatio
      const inkB = bB * (1 - redRatio) + rB * redRatio

      // Blend onto background
      const opacity = Math.min(1.0, totalInk * 1.5)
      const r = bgR * (1 - opacity) + inkR * opacity
      const g = bgG * (1 - opacity) + inkG * opacity
      const b = bgB * (1 - opacity) + inkB * opacity

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

  const filename = `output/anger-v13-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
