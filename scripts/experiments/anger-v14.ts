/**
 * ANGER v14 — DESTROYED BEAUTY
 *
 * The problem with v13: marks on a blank cream surface read as "abstract
 * expressionist exercise." Someone sees gestural painting, not anger.
 *
 * New concept: start with something BEAUTIFUL. A warm, rich, organic
 * watercolor-like wash — amber, rose, gold tones blending gently.
 * Something that has life and tenderness. THEN destroy it with
 * dense, overlapping gestural violence. Black and red marks that
 * obliterate the beauty underneath.
 *
 * The viewer sees simultaneously what was there and what happened to it.
 * The anger is in the contrast — beauty ruined. Not marks on nothing,
 * but marks that killed something.
 *
 * Technical changes from v13:
 * - Warm multi-layer watercolor ground (not plain cream)
 * - Much denser fury zone — individual strokes merge into dark mass
 * - More marks total (6-8 major + returns + stabs)
 * - Marks bleed off canvas edges (not contained)
 * - Ground color shows through in gaps between marks — the beauty peeks through
 * - Splatter is more directional (radiates from fury center)
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
  const maxSpeed = 20 + intensity * 35
  const totalSteps = steps ?? (100 + Math.floor(rand() * 90))
  const strikePoint = 0.10 + rand() * 0.10

  for (let i = 0; i < totalSteps; i++) {
    const t = i / totalSteps
    let speed: number
    if (t < strikePoint) {
      const rampT = t / strikePoint
      speed = maxSpeed * 0.1 + maxSpeed * 0.9 * rampT * rampT
    } else {
      const decayT = (t - strikePoint) / (1.0 - strikePoint)
      speed = maxSpeed * Math.pow(1.0 - decayT, 0.5)
      // Angry speed surges — the arm pulls BACK through
      if (rand() < 0.10 * intensity) speed = Math.max(speed, maxSpeed * 0.75)
    }

    let pressure: number
    if (t < strikePoint + 0.05 && t > strikePoint - 0.05) {
      pressure = 0.88 + rand() * 0.12
    } else {
      pressure = Math.max(0.10, 0.72 - speed / maxSpeed * 0.5 + rand() * 0.15)
    }

    // Violent direction changes
    if (rand() < 0.12 * intensity) {
      angle += (rand() - 0.5) * 2.2 * intensity
    }
    angle += (rand() - 0.5) * 0.20

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
      const count = 2 + Math.floor(rand() * 7)
      for (let j = 0; j < count; j++) {
        const dist = 15 + rand() * 160 + p.velocity * 5
        const a = perpAngle + (rand() - 0.5) * 1.4
        splatters.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          size: 1.5 + rand() * 12 * p.pressure,
          opacity: 0.4 + rand() * 0.55,
        })
      }
    }
    // Forward spray
    if (p.velocity > 14 && rand() < 0.25 * multiplier) {
      const count = 1 + Math.floor(rand() * 4)
      for (let j = 0; j < count; j++) {
        const dist = p.velocity * (1 + rand() * 4) + rand() * 100
        const a = p.angle + (rand() - 0.5) * 0.6
        splatters.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          size: 1 + rand() * 7,
          opacity: 0.2 + rand() * 0.45,
        })
      }
    }
  }
  return splatters
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 14001, b: 14002, c: 14003, d: 14004, e: 14005, f: 14006 }
  const seed = seeds[variant] ?? 14001
  const rand = makePRNG(seed)

  console.log(`=== ANGER v14 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 150)
  const bgNoise3 = makeNoise(seed + 120, 50)
  const bgNoise4 = makeNoise(seed + 130, 250)
  const edgeNoise = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 25)

  // Watercolor wash layers — soft organic color
  const wash1 = makeNoise(seed + 300, 300)  // large warm amber blobs
  const wash2 = makeNoise(seed + 310, 180)  // medium rose patches
  const wash3 = makeNoise(seed + 320, 120)  // smaller gold veins
  const wash4 = makeNoise(seed + 330, 400)  // very large gentle gradient

  // Fury center
  const furyX = W * (0.38 + rand() * 0.24)
  const furyY = H * (0.32 + rand() * 0.36)
  console.log(`  Fury center: (${Math.round(furyX)}, ${Math.round(furyY)})`)

  // === Generate gestures ===
  interface Gesture {
    points: GesturePoint[]
    isRed: boolean
  }
  const allGestures: Gesture[] = []

  // 6-8 major crossing gestures — more than v13, denser overlap
  const majorCount = 6 + Math.floor(rand() * 3)
  for (let i = 0; i < majorCount; i++) {
    // Some start from OFF CANVAS — bleeding in from edges
    const fromEdge = rand() < 0.35
    let sx: number, sy: number
    if (fromEdge) {
      const edge = Math.floor(rand() * 4)
      if (edge === 0) { sx = -100 - rand() * 200; sy = rand() * H } // left
      else if (edge === 1) { sx = W + 100 + rand() * 200; sy = rand() * H } // right
      else if (edge === 2) { sx = rand() * W; sy = -100 - rand() * 200 } // top
      else { sx = rand() * W; sy = H + 100 + rand() * 200 } // bottom
    } else {
      const edgeDist = 80 + rand() * 250
      const approachAngle = rand() * Math.PI * 2
      sx = furyX - Math.cos(approachAngle) * (W * 0.45 + edgeDist)
      sy = furyY - Math.sin(approachAngle) * (H * 0.35 + edgeDist)
    }

    const toFuryAngle = Math.atan2(furyY - sy, furyX - sx) + (rand() - 0.5) * 0.5
    const intensity = 0.75 + rand() * 0.25

    allGestures.push({
      points: simulateGesture(sx, sy, toFuryAngle, intensity, rand),
      isRed: rand() < 0.30,
    })
  }

  // 3-4 return strokes — the arm swings BACK
  const returnCount = 3 + Math.floor(rand() * 2)
  for (let i = 0; i < returnCount; i++) {
    const baseGesture = allGestures[Math.floor(rand() * Math.min(allGestures.length, majorCount))]
    const lastPt = baseGesture.points[baseGesture.points.length - 1]
    const returnAngle = lastPt.angle + Math.PI + (rand() - 0.5) * 1.0
    allGestures.push({
      points: simulateGesture(lastPt.x, lastPt.y, returnAngle, 0.6 + rand() * 0.35, rand, 55 + Math.floor(rand() * 45)),
      isRed: rand() < 0.25,
    })
  }

  // 8-14 stabs — short violent thrusts concentrated in fury zone
  const stabCount = 8 + Math.floor(rand() * 7)
  for (let i = 0; i < stabCount; i++) {
    const spread = W * 0.22
    const sx = furyX + (rand() - 0.5) * spread
    const sy = furyY + (rand() - 0.5) * spread
    const ta = rand() * Math.PI * 2
    allGestures.push({
      points: simulateGesture(sx, sy, ta, 0.95, rand, 6 + Math.floor(rand() * 18)),
      isRed: rand() < 0.45,
    })
  }

  // 2-3 WIDE obliterating strokes — thicker, slower, meant to smear/cover
  const obliterateCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < obliterateCount; i++) {
    const sx = furyX + (rand() - 0.5) * W * 0.3
    const sy = furyY + (rand() - 0.5) * H * 0.3
    const ta = rand() * Math.PI * 2
    const pts = simulateGesture(sx, sy, ta, 0.5, rand, 30 + Math.floor(rand() * 25))
    // Double the pressure for wide marks
    for (const p of pts) p.pressure = Math.min(1.0, p.pressure * 1.8)
    allGestures.push({ points: pts, isRed: false })
  }

  console.log(`  ${allGestures.length} gestures (${majorCount} major, ${returnCount} returns, ${stabCount} stabs, ${obliterateCount} obliterating)`)

  // === Compute ink maps ===
  const inkBlack = new Float32Array(W * H)
  const inkRed = new Float32Array(W * H)
  const inkSpeed = new Float32Array(W * H)

  for (const gesture of allGestures) {
    const inkTarget = gesture.isRed ? inkRed : inkBlack
    for (let i = 1; i < gesture.points.length; i++) {
      const p0 = gesture.points[i - 1], p1 = gesture.points[i]
      // Wider strokes for obliterating feel
      const baseWidth = 12 + p1.pressure * 55
      const speedThin = Math.max(0.20, 1.0 - p1.velocity / 55 * 0.55)
      const strokeWidth = baseWidth * speedThin

      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.2))

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

  // === Splatter ===
  const allSplatters: Array<{ x: number; y: number; size: number; opacity: number; isRed: boolean }> = []
  for (const gesture of allGestures) {
    const splatters = generateSplatter(gesture.points, rand, 1.8)
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

      // === Beautiful warm ground ===
      // Layer 1: base cream with warmth variation
      const n1 = bgNoise1(x, y) * 0.5 + 0.5
      const n2 = bgNoise2(x, y) * 0.5 + 0.5
      const n3 = bgNoise3(x, y) * 0.5 + 0.5

      // Layer 2: watercolor washes — soft organic color patches
      const w1 = wash1(x, y) * 0.5 + 0.5  // 0-1
      const w2 = wash2(x, y) * 0.5 + 0.5
      const w3 = wash3(x, y) * 0.5 + 0.5
      const w4 = wash4(x, y) * 0.5 + 0.5

      // Warm amber base
      let bgR = 225 + n1 * 18
      let bgG = 200 + n1 * 12
      let bgB = 165 + n1 * 10

      // Rose wash — adds pink in some areas
      const roseAmount = Math.max(0, w2 - 0.35) * 2.0
      bgR += roseAmount * 20
      bgG -= roseAmount * 15
      bgB -= roseAmount * 5

      // Gold vein wash — warm highlights
      const goldAmount = Math.max(0, w3 - 0.4) * 2.5
      bgR += goldAmount * 15
      bgG += goldAmount * 10
      bgB -= goldAmount * 8

      // Deeper amber in some regions
      const deepAmount = Math.max(0, w1 - 0.5) * 2.0
      bgR -= deepAmount * 10
      bgG -= deepAmount * 18
      bgB -= deepAmount * 15

      // Subtle paper texture
      bgR += n3 * 6 - 3
      bgG += n3 * 4 - 2
      bgB += n3 * 3 - 1.5

      // Large gentle gradient (tilt toward warm)
      bgR += (w4 - 0.5) * 8
      bgG += (w4 - 0.5) * 4

      // Clamp background
      bgR = Math.max(180, Math.min(255, bgR))
      bgG = Math.max(155, Math.min(235, bgG))
      bgB = Math.max(130, Math.min(200, bgB))

      if (totalInk < 0.01) {
        rgba[idx * 4 + 0] = Math.round(bgR)
        rgba[idx * 4 + 1] = Math.round(bgG)
        rgba[idx * 4 + 2] = Math.round(bgB)
        rgba[idx * 4 + 3] = 255
        continue
      }

      // === Ink rendering ===
      const redRatio = totalInk > 0 ? red / totalInk : 0
      const speedFactor = Math.min(1.0, speed / 40)

      // Black ink: deep near-black
      const bR = 16 + (1 - black) * 10
      const bG = 12 + (1 - black) * 6
      const bB = 16 + (1 - black) * 6

      // Red ink: deep visceral red (darker and more blood-like)
      const rR = 90 + (1 - red) * 25 - speedFactor * 25
      const rG = 8 + (1 - red) * 6
      const rB = 5 + (1 - red) * 4

      const inkR = bR * (1 - redRatio) + rR * redRatio
      const inkG = bG * (1 - redRatio) + rG * redRatio
      const inkB = bB * (1 - redRatio) + rB * redRatio

      // Blend onto the beautiful ground
      const opacity = Math.min(1.0, totalInk * 1.6)
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

  const filename = `output/anger-v14-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
