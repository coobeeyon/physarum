/**
 * ANGER v12 — GESTURE
 *
 * Everything before this was DIAGRAMMATIC. Destruction maps, noise-shaped
 * tears, crater geometry. They show WHERE damage is, not the ENERGY that
 * caused it. Anger is an action, not a state. The marks need to carry force.
 *
 * New approach: simulate ARM PHYSICS.
 * - Start with a calm, pale surface (near-white cream with subtle texture)
 * - Generate 2-4 gestural strokes with simulated physics:
 *   - Sudden acceleration (the impulse)
 *   - Peak velocity (the swing)
 *   - Deceleration and followthrough
 *   - Width varies with pressure (thick at impact, thin in flight)
 * - Dark red-black ink from the strokes
 * - Splatter: droplets thrown off by centrifugal force at direction changes
 * - The calm background makes the violence VISIBLE
 *
 * Reference: Cy Twombly's Bacchus series, Fontana's slashed canvases,
 * Franz Kline's black gestures on white.
 *
 * The mark IS the anger. The surface is what was peaceful.
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
  x: number
  y: number
  pressure: number  // 0-1, affects width
  velocity: number  // speed at this point
  angle: number     // direction of travel
}

/**
 * Simulate an arm gesture — sudden violent motion with physics.
 * Returns a path of points with pressure and velocity.
 */
function simulateGesture(
  startX: number, startY: number,
  targetAngle: number,  // general direction
  intensity: number,    // 0-1, how violent
  rand: () => number,
): GesturePoint[] {
  const points: GesturePoint[] = []

  let x = startX
  let y = startY
  let angle = targetAngle

  // Velocity profile: slow start → explosive acceleration → peak → deceleration
  // Like swinging an arm: wind up, strike, follow through
  const maxSpeed = 15 + intensity * 25
  const totalSteps = 80 + Math.floor(rand() * 60)
  const strikePoint = 0.15 + rand() * 0.10  // when peak velocity hits

  for (let i = 0; i < totalSteps; i++) {
    const t = i / totalSteps

    // Velocity envelope: ramp up to strike, then gradual decay
    let speed: number
    if (t < strikePoint) {
      // Wind-up: accelerating
      const rampT = t / strikePoint
      speed = maxSpeed * 0.1 + maxSpeed * 0.9 * rampT * rampT
    } else {
      // Follow-through: decelerating with occasional surges
      const decayT = (t - strikePoint) / (1.0 - strikePoint)
      speed = maxSpeed * Math.pow(1.0 - decayT, 0.7)
      // Random surges — the arm jerks, re-engages
      if (rand() < 0.06 * intensity) {
        speed = Math.max(speed, maxSpeed * 0.6)
      }
    }

    // Pressure: inverse of speed (pressing hard = slow, fast = light)
    // But at the strike moment, both pressure and speed are high briefly
    let pressure: number
    if (t < strikePoint + 0.05 && t > strikePoint - 0.05) {
      // The strike: high pressure AND high speed (the moment of impact)
      pressure = 0.8 + rand() * 0.2
    } else {
      pressure = Math.max(0.05, 0.6 - speed / maxSpeed * 0.5 + rand() * 0.15)
    }

    // Direction: mostly straight but with angry jerks
    // Real anger gestures aren't smooth — they have sudden direction changes
    if (rand() < 0.08 * intensity) {
      // Sudden jerk — anger is erratic
      angle += (rand() - 0.5) * 1.5 * intensity
    }
    // Slow drift
    angle += (rand() - 0.5) * 0.15

    // Move
    x += Math.cos(angle) * speed
    y += Math.sin(angle) * speed

    points.push({ x, y, pressure, velocity: speed, angle })
  }

  return points
}

/**
 * Generate splatter droplets from a gesture point.
 * Splatter happens at direction changes and high-velocity moments.
 */
function generateSplatter(
  points: GesturePoint[],
  rand: () => number,
): Array<{ x: number; y: number; size: number; opacity: number }> {
  const splatters: Array<{ x: number; y: number; size: number; opacity: number }> = []

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const prev = points[i - 1]

    // Angular change
    let angleDiff = p.angle - prev.angle
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2

    // Splatter probability increases with speed and direction change
    const splatProb = (p.velocity / 40) * (Math.abs(angleDiff) * 2 + 0.1) * p.pressure
    if (rand() < splatProb * 0.7) {
      // Throw droplets perpendicular to travel direction
      const perpAngle = p.angle + (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2)
      const throwDist = 20 + rand() * 100 + p.velocity * 3
      const throwAngle = perpAngle + (rand() - 0.5) * 1.0

      // Multiple small droplets
      const count = 1 + Math.floor(rand() * 4)
      for (let j = 0; j < count; j++) {
        const dist = throwDist * (0.3 + rand() * 0.7)
        const a = throwAngle + (rand() - 0.5) * 0.8
        splatters.push({
          x: p.x + Math.cos(a) * dist,
          y: p.y + Math.sin(a) * dist,
          size: 2 + rand() * 8 * p.pressure,
          opacity: 0.3 + rand() * 0.5,
        })
      }
    }

    // Forward splatter at high velocity
    if (p.velocity > 20 && rand() < 0.15) {
      const dist = p.velocity * 2 + rand() * 60
      const a = p.angle + (rand() - 0.5) * 0.4
      splatters.push({
        x: p.x + Math.cos(a) * dist,
        y: p.y + Math.sin(a) * dist,
        size: 1 + rand() * 5,
        opacity: 0.2 + rand() * 0.4,
      })
    }
  }

  return splatters
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 12201, b: 12202, c: 12203, d: 12204, e: 12205 }
  const seed = seeds[variant] ?? 12201
  const rand = makePRNG(seed)

  console.log(`=== ANGER v12 variant ${variant} (seed: ${seed}) ===`)

  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)
  const edgeNoise = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 25)

  // === Generate gestures ===
  // 1 primary explosive gesture + 1-2 secondary, + 0-1 short stabs
  const allGestures: GesturePoint[][] = []

  // Primary gesture: crosses most of the canvas
  {
    const side = Math.floor(rand() * 4) // which edge to start from
    let sx: number, sy: number, ta: number
    if (side === 0) { // left
      sx = -50; sy = H * (0.3 + rand() * 0.4); ta = (rand() - 0.3) * 0.8
    } else if (side === 1) { // top
      sx = W * (0.2 + rand() * 0.5); sy = -50; ta = Math.PI / 2 + (rand() - 0.5) * 0.7
    } else if (side === 2) { // right
      sx = W + 50; sy = H * (0.3 + rand() * 0.4); ta = Math.PI + (rand() - 0.5) * 0.6
    } else { // bottom
      sx = W * (0.3 + rand() * 0.4); sy = H + 50; ta = -Math.PI / 2 + (rand() - 0.5) * 0.6
    }
    allGestures.push(simulateGesture(sx, sy, ta, 0.9 + rand() * 0.1, rand))
  }

  // Secondary gesture: different direction, crossing the first
  {
    const sx = W * rand()
    const sy = H * rand()
    const ta = rand() * Math.PI * 2
    allGestures.push(simulateGesture(sx, sy, ta, 0.6 + rand() * 0.3, rand))
  }

  // Optional third gesture
  if (rand() < 0.6) {
    const sx = W * (0.2 + rand() * 0.6)
    const sy = H * (0.2 + rand() * 0.6)
    const ta = rand() * Math.PI * 2
    allGestures.push(simulateGesture(sx, sy, ta, 0.4 + rand() * 0.3, rand))
  }

  // Short violent stabs — 2-4 of them
  const stabCount = 2 + Math.floor(rand() * 3)
  for (let s = 0; s < stabCount; s++) {
    const sx = W * (0.1 + rand() * 0.8)
    const sy = H * (0.1 + rand() * 0.8)
    const ta = rand() * Math.PI * 2
    const stabPoints = simulateGesture(sx, sy, ta, 0.95, rand)
    allGestures.push(stabPoints.slice(0, 15 + Math.floor(rand() * 15))) // short
  }

  console.log(`  ${allGestures.length} gestures (${stabCount} stabs)`)

  // === Compute ink map ===
  const inkMap = new Float32Array(W * H)     // ink density
  const inkSpeed = new Float32Array(W * H)   // velocity at deposit (for color variation)

  for (const gesture of allGestures) {
    for (let i = 1; i < gesture.length; i++) {
      const p0 = gesture[i - 1]
      const p1 = gesture[i]

      // Width from pressure: high pressure = wide stroke
      const baseWidth = 8 + p1.pressure * 45
      // Speed affects width: fast strokes are thinner (ink stretches)
      const speedThin = Math.max(0.3, 1.0 - p1.velocity / 50 * 0.5)
      const strokeWidth = baseWidth * speedThin

      // Interpolate between consecutive points
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t
        const cy = p0.y + dy * t
        const cPressure = p0.pressure * (1 - t) + p1.pressure * t
        const cVelocity = p0.velocity * (1 - t) + p1.velocity * t
        const cWidth = strokeWidth * (0.9 + t * 0.1)

        const margin = Math.ceil(cWidth * 2)
        const minX = Math.max(0, Math.floor(cx - margin))
        const maxX = Math.min(W - 1, Math.ceil(cx + margin))
        const minY = Math.max(0, Math.floor(cy - margin))
        const maxY = Math.min(H - 1, Math.ceil(cy + margin))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx
            const ddy = py - cy
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)

            // Ragged edges — the stroke isn't clean
            const en = edgeNoise(px, py) * 0.4 + edgeNoise2(px, py) * 0.3
            const effWidth = cWidth * (1.0 + en * 0.8)

            if (dist < effWidth) {
              const falloff = 1.0 - dist / effWidth
              // Ink is denser at center, fades at edges
              const inkAmount = falloff * falloff * cPressure
              const idx = py * W + px
              inkMap[idx] = Math.min(1.0, inkMap[idx] + inkAmount)
              inkSpeed[idx] = Math.max(inkSpeed[idx], cVelocity)
            }
          }
        }
      }
    }
  }

  // === Splatter ===
  const allSplatters: Array<{ x: number; y: number; size: number; opacity: number }> = []
  for (const gesture of allGestures) {
    allSplatters.push(...generateSplatter(gesture, rand))
  }
  console.log(`  ${allSplatters.length} splatter droplets`)

  for (const sp of allSplatters) {
    if (sp.x < 0 || sp.x >= W || sp.y < 0 || sp.y >= H) continue
    const ir = Math.ceil(sp.size)
    for (let py = Math.max(0, Math.floor(sp.y - ir)); py < Math.min(H, Math.ceil(sp.y + ir)); py++) {
      for (let px = Math.max(0, Math.floor(sp.x - ir)); px < Math.min(W, Math.ceil(sp.x + ir)); px++) {
        const ddx = px - sp.x
        const ddy = py - sp.y
        const d = Math.sqrt(ddx * ddx + ddy * ddy)
        if (d < sp.size) {
          const idx = py * W + px
          const falloff = 1.0 - d / sp.size
          inkMap[idx] = Math.min(1.0, inkMap[idx] + falloff * sp.opacity)
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
      const ink = inkMap[idx]
      const speed = inkSpeed[idx]

      // === Background: calm, pale, nearly white ===
      // Very subtle warm texture — you can barely see it
      const bn1 = bgNoise1(x, y) * 0.5 + 0.5
      const bn2 = bgNoise2(x, y) * 0.5 + 0.5
      const bn3 = bgNoise3(x, y) * 0.5 + 0.5
      const bgTex = bn1 * 0.5 + bn2 * 0.3 + bn3 * 0.2

      // Cream-white with barely visible texture
      let bgR = 232 + bgTex * 10
      let bgG = 225 + bgTex * 8
      let bgB = 212 + bgTex * 6

      if (ink < 0.01) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // === Ink color: dark red-black ===
      // Fast strokes are blacker (thin, concentrated)
      // Slow/heavy strokes are more red-brown (ink pools)
      const speedFactor = Math.min(1.0, speed / 30)

      // Deep end: dark red-brown (pooled ink)
      const poolR = 55 + (1 - ink) * 25
      const poolG = 12 + (1 - ink) * 10
      const poolB = 8 + (1 - ink) * 8

      // Fast end: near-black (stretched ink)
      const fastR = 18 + (1 - ink) * 10
      const fastG = 14 + (1 - ink) * 8
      const fastB = 18 + (1 - ink) * 6

      const inkR = poolR * (1 - speedFactor) + fastR * speedFactor
      const inkG = poolG * (1 - speedFactor) + fastG * speedFactor
      const inkB = poolB * (1 - speedFactor) + fastB * speedFactor

      // === Blend ink onto background ===
      const inkOpacity = Math.min(1.0, ink * 1.5)  // ink builds up
      const r = bgR * (1 - inkOpacity) + inkR * inkOpacity
      const g = bgG * (1 - inkOpacity) + inkG * inkOpacity
      const b = bgB * (1 - inkOpacity) + inkB * inkOpacity

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

  const filename = `output/anger-v12-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
