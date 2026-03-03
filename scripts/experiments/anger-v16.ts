/**
 * ANGER v16 — OVERWHELM
 *
 * v14 and v15 both read as "abstract painting" because the marks are
 * well-composed — centered fury zone with warm ground around the edges.
 * An artist would arrange marks like that. Anger wouldn't.
 *
 * This version pushes DENSITY to the breaking point:
 * - 70%+ of the canvas damaged/covered
 * - MULTIPLE LAYERS of attack (wide gouges + narrow slashes + splatter)
 * - Marks go off ALL edges — no contained composition
 * - Barely any warm ground visible — just glimpses through the chaos
 * - Red staining in the deepest damage areas
 * - The warm ground that IS visible reads as "what survived" not "background"
 *
 * The anger is in the overwhelming, claustrophobic density.
 * There's no breathing room. It's too much.
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
  x: number; y: number; pressure: number; velocity: number; angle: number
}

function simulateGesture(
  startX: number, startY: number,
  targetAngle: number, intensity: number,
  rand: () => number, steps?: number
): GesturePoint[] {
  const points: GesturePoint[] = []
  let x = startX, y = startY, angle = targetAngle
  const maxSpeed = 20 + intensity * 35
  const totalSteps = steps ?? (80 + Math.floor(rand() * 90))
  const strikePoint = 0.10 + rand() * 0.12

  for (let i = 0; i < totalSteps; i++) {
    const t = i / totalSteps
    let speed: number
    if (t < strikePoint) speed = maxSpeed * 0.1 + maxSpeed * 0.9 * (t / strikePoint) ** 2
    else {
      speed = maxSpeed * (1.0 - (t - strikePoint) / (1.0 - strikePoint)) ** 0.5
      if (rand() < 0.10 * intensity) speed = Math.max(speed, maxSpeed * 0.75)
    }

    const pressure = t < strikePoint + 0.05 && t > strikePoint - 0.05
      ? 0.88 + rand() * 0.12
      : Math.max(0.12, 0.72 - speed / maxSpeed * 0.5 + rand() * 0.15)

    if (rand() < 0.12 * intensity) angle += (rand() - 0.5) * 2.2 * intensity
    angle += (rand() - 0.5) * 0.22

    x += Math.cos(angle) * speed
    y += Math.sin(angle) * speed
    points.push({ x, y, pressure, velocity: speed, angle })
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 16001, b: 16002, c: 16003, d: 16004 }
  const seed = seeds[variant] ?? 16001
  const rand = makePRNG(seed)

  console.log(`=== ANGER v16 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 150)
  const bgNoise3 = makeNoise(seed + 120, 50)
  const wash1 = makeNoise(seed + 300, 300)
  const wash2 = makeNoise(seed + 310, 180)
  const wash3 = makeNoise(seed + 320, 120)
  const edgeNoise1 = makeNoise(seed + 200, 8)
  const edgeNoise2 = makeNoise(seed + 210, 22)

  // Ink + gouge buffers
  const inkBlack = new Float32Array(W * H)
  const inkRed = new Float32Array(W * H)
  const gougeMap = new Float32Array(W * H)  // void beneath

  // Multiple fury zones — not just one center, spread the chaos
  const numFury = 2 + Math.floor(rand() * 2)
  const furyZones: Array<{ x: number; y: number; radius: number }> = []
  for (let i = 0; i < numFury; i++) {
    furyZones.push({
      x: W * (0.20 + rand() * 0.60),
      y: H * (0.20 + rand() * 0.60),
      radius: W * (0.15 + rand() * 0.15),
    })
  }
  console.log(`  ${numFury} fury zones`)

  // === LAYER 1: Wide gouges (void beneath) ===
  const gougeCount = 10 + Math.floor(rand() * 6)
  for (let i = 0; i < gougeCount; i++) {
    // Most start from off-canvas
    const edge = Math.floor(rand() * 4)
    let sx: number, sy: number
    if (edge === 0) { sx = -200 - rand() * 300; sy = rand() * H }
    else if (edge === 1) { sx = W + 200 + rand() * 300; sy = rand() * H }
    else if (edge === 2) { sx = rand() * W; sy = -200 - rand() * 300 }
    else { sx = rand() * W; sy = H + 200 + rand() * 300 }

    // Aim at a random fury zone
    const fz = furyZones[Math.floor(rand() * furyZones.length)]
    const toAngle = Math.atan2(fz.y - sy, fz.x - sx) + (rand() - 0.5) * 0.6
    const gougeWidth = 40 + rand() * 70  // WIDE

    const points = simulateGesture(sx, sy, toAngle, 0.7 + rand() * 0.3, rand, 100 + Math.floor(rand() * 80))

    for (let j = 1; j < points.length; j++) {
      const p0 = points[j - 1], p1 = points[j]
      const w = gougeWidth * (0.8 + p1.pressure * 0.4) * Math.max(0.3, 1.0 - p1.velocity / 50 * 0.4)
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 2))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const margin = Math.ceil(w * 1.5)
        for (let py = Math.max(0, Math.floor(cy - margin)); py <= Math.min(H - 1, Math.ceil(cy + margin)); py++) {
          for (let px = Math.max(0, Math.floor(cx - margin)); px <= Math.min(W - 1, Math.ceil(cx + margin)); px++) {
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
            const en = edgeNoise1(px, py) * 0.5 + edgeNoise2(px, py) * 0.3
            const effW = w * (1.0 + en * 0.7)
            if (d < effW) {
              const nd = d / effW
              const damage = nd < 0.55 ? 0.9 * p1.pressure : (nd < 0.85 ? 0.5 * p1.pressure : 0)
              const idx = py * W + px
              gougeMap[idx] = Math.min(1.0, gougeMap[idx] + damage)
            }
          }
        }
      }
    }
  }

  // === LAYER 2: Gestural ink marks (dark, on surface) ===
  const inkMarkCount = 8 + Math.floor(rand() * 5)
  for (let i = 0; i < inkMarkCount; i++) {
    const edge = Math.floor(rand() * 4)
    let sx: number, sy: number
    if (edge === 0) { sx = -100; sy = rand() * H }
    else if (edge === 1) { sx = W + 100; sy = rand() * H }
    else if (edge === 2) { sx = rand() * W; sy = -100 }
    else { sx = rand() * W; sy = H + 100 }

    const fz = furyZones[Math.floor(rand() * furyZones.length)]
    const toAngle = Math.atan2(fz.y - sy, fz.x - sx) + (rand() - 0.5) * 0.7
    const isRed = rand() < 0.3
    const target = isRed ? inkRed : inkBlack

    const points = simulateGesture(sx, sy, toAngle, 0.7 + rand() * 0.3, rand)
    const strokeWidth = 10 + rand() * 40

    for (let j = 1; j < points.length; j++) {
      const p0 = points[j - 1], p1 = points[j]
      const w = strokeWidth * (0.7 + p1.pressure * 0.6) * Math.max(0.25, 1.0 - p1.velocity / 50 * 0.5)
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const margin = Math.ceil(w * 1.5)
        for (let py = Math.max(0, Math.floor(cy - margin)); py <= Math.min(H - 1, Math.ceil(cy + margin)); py++) {
          for (let px = Math.max(0, Math.floor(cx - margin)); px <= Math.min(W - 1, Math.ceil(cx + margin)); px++) {
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
            const en = edgeNoise1(px, py) * 0.35
            const effW = w * (1.0 + en * 0.6)
            if (d < effW) {
              const falloff = 1.0 - d / effW
              const idx = py * W + px
              target[idx] = Math.min(1.0, target[idx] + falloff * falloff * p1.pressure)
            }
          }
        }
      }
    }
  }

  // === LAYER 3: Stabs in fury zones ===
  const stabCount = 12 + Math.floor(rand() * 10)
  for (let i = 0; i < stabCount; i++) {
    const fz = furyZones[Math.floor(rand() * furyZones.length)]
    const sx = fz.x + (rand() - 0.5) * fz.radius
    const sy = fz.y + (rand() - 0.5) * fz.radius
    const angle = rand() * Math.PI * 2
    const isGouge = rand() < 0.5

    const points = simulateGesture(sx, sy, angle, 0.9, rand, 5 + Math.floor(rand() * 15))
    const sw = isGouge ? (15 + rand() * 35) : (8 + rand() * 25)

    for (let j = 1; j < points.length; j++) {
      const p0 = points[j - 1], p1 = points[j]
      const w = sw * p1.pressure
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const margin = Math.ceil(w * 1.5)
        for (let py = Math.max(0, Math.floor(cy - margin)); py <= Math.min(H - 1, Math.ceil(cy + margin)); py++) {
          for (let px = Math.max(0, Math.floor(cx - margin)); px <= Math.min(W - 1, Math.ceil(cx + margin)); px++) {
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
            if (d < w) {
              const idx = py * W + px
              if (isGouge) gougeMap[idx] = Math.min(1.0, gougeMap[idx] + 0.8)
              else inkBlack[idx] = Math.min(1.0, inkBlack[idx] + (1 - d / w) * 0.7)
            }
          }
        }
      }
    }
  }

  // === LAYER 4: Scratches everywhere ===
  const scratchCount = 15 + Math.floor(rand() * 10)
  for (let i = 0; i < scratchCount; i++) {
    const sx = rand() * W * 1.2 - W * 0.1
    const sy = rand() * H * 1.2 - H * 0.1
    const angle = rand() * Math.PI * 2
    const points = simulateGesture(sx, sy, angle, 0.3 + rand() * 0.5, rand, 30 + Math.floor(rand() * 60))

    for (let j = 1; j < points.length; j++) {
      const p0 = points[j - 1], p1 = points[j]
      const w = 1.5 + p1.pressure * 4
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const margin = Math.ceil(w * 2)
        for (let py = Math.max(0, Math.floor(cy - margin)); py <= Math.min(H - 1, Math.ceil(cy + margin)); py++) {
          for (let px = Math.max(0, Math.floor(cx - margin)); px <= Math.min(W - 1, Math.ceil(cx + margin)); px++) {
            const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
            if (d < w) {
              const idx = py * W + px
              gougeMap[idx] = Math.min(1.0, gougeMap[idx] + 0.5 * p1.pressure)
            }
          }
        }
      }
    }
  }

  // === LAYER 5: Massive splatter ===
  const splatCount = 2000 + Math.floor(rand() * 1500)
  for (let i = 0; i < splatCount; i++) {
    // Splatter concentrated around fury zones but spread everywhere
    const fz = furyZones[Math.floor(rand() * furyZones.length)]
    const dist = rand() * rand() * W * 0.7  // exponential distribution — dense near center
    const angle = rand() * Math.PI * 2
    const sx = fz.x + Math.cos(angle) * dist
    const sy = fz.y + Math.sin(angle) * dist

    if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue

    const size = 1 + rand() * 8
    const isRed = rand() < 0.2
    const isGouge = rand() < 0.3

    const ir = Math.ceil(size)
    for (let py = Math.max(0, Math.floor(sy - ir)); py < Math.min(H, Math.ceil(sy + ir)); py++) {
      for (let px = Math.max(0, Math.floor(sx - ir)); px < Math.min(W, Math.ceil(sx + ir)); px++) {
        const d = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2)
        if (d < size) {
          const idx = py * W + px
          const amount = (1 - d / size) * 0.6
          if (isGouge) gougeMap[idx] = Math.min(1.0, gougeMap[idx] + amount)
          else if (isRed) inkRed[idx] = Math.min(1.0, inkRed[idx] + amount)
          else inkBlack[idx] = Math.min(1.0, inkBlack[idx] + amount)
        }
      }
    }
  }

  console.log(`  ${gougeCount} wide gouges, ${inkMarkCount} ink marks, ${stabCount} stabs, ${scratchCount} scratches, ${splatCount} splatters`)
  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const gouge = gougeMap[idx]
      const black = inkBlack[idx]
      const red = inkRed[idx]
      const totalInk = Math.min(1.0, black + red)

      // Warm ground
      const n1 = bgNoise1(x, y) * 0.5 + 0.5
      const n3 = bgNoise3(x, y) * 0.5 + 0.5
      const w1 = wash1(x, y) * 0.5 + 0.5
      const w2 = wash2(x, y) * 0.5 + 0.5
      const w3 = wash3(x, y) * 0.5 + 0.5

      let warmR = 228 + n1 * 15
      let warmG = 202 + n1 * 10
      let warmB = 168 + n1 * 8

      warmR += Math.max(0, w2 - 0.35) * 2.0 * 18
      warmG -= Math.max(0, w2 - 0.35) * 2.0 * 12
      warmR -= Math.max(0, w1 - 0.5) * 2.0 * 8
      warmG -= Math.max(0, w1 - 0.5) * 2.0 * 16
      warmB -= Math.max(0, w1 - 0.5) * 2.0 * 12
      warmR += Math.max(0, w3 - 0.4) * 2.5 * 12
      warmG += Math.max(0, w3 - 0.4) * 2.5 * 8
      warmR += n3 * 5 - 2.5
      warmG += n3 * 3 - 1.5

      warmR = Math.max(180, Math.min(255, warmR))
      warmG = Math.max(155, Math.min(235, warmG))
      warmB = Math.max(130, Math.min(200, warmB))

      // Start with warm ground
      let r = warmR, g = warmG, b = warmB

      // Apply gouge (void beneath)
      if (gouge > 0.01) {
        const voidR = 35 + n3 * 8
        const voidG = 32 + n3 * 5
        const voidB = 40 + n3 * 10

        const gougeAmount = Math.min(1.0, gouge * 1.3)

        // Red staining at deep damage
        let stainR = 0, stainG = 0, stainB = 0
        if (gouge > 0.4) {
          const stainAmount = (gouge - 0.4) / 0.6 * 0.25
          stainR = 80 * stainAmount
          stainG = -10 * stainAmount
          stainB = -8 * stainAmount
        }

        r = r * (1 - gougeAmount) + voidR * gougeAmount + stainR
        g = g * (1 - gougeAmount) + voidG * gougeAmount + stainG
        b = b * (1 - gougeAmount) + voidB * gougeAmount + stainB
      }

      // Apply ink marks (on top)
      if (totalInk > 0.01) {
        const redRatio = totalInk > 0 ? red / totalInk : 0
        const bR = 18, bG = 14, bB = 18
        const rR = 85, rG = 8, rB = 5
        const iR = bR * (1 - redRatio) + rR * redRatio
        const iG = bG * (1 - redRatio) + rG * redRatio
        const iB = bB * (1 - redRatio) + rB * redRatio

        const opacity = Math.min(1.0, totalInk * 1.5)
        r = r * (1 - opacity) + iR * opacity
        g = g * (1 - opacity) + iG * opacity
        b = b * (1 - opacity) + iB * opacity
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

  const filename = `output/anger-v16-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
