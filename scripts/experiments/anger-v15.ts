/**
 * ANGER v15 — GOUGED WARMTH
 *
 * The problem with v14: gestural marks ON TOP of warm surface reads
 * as "abstract expressionist exercise." The marks look like art-making,
 * not like violence.
 *
 * New approach: the warm surface is DAMAGED. Not marks added on top,
 * but the warmth itself has been torn/gouged/scratched away.
 *
 * 1. Beautiful warm textured ground (same as v14 — amber, rose, gold washes)
 * 2. GOUGES: gestural paths where the warmth is removed, revealing cold
 *    dark void beneath. The edges are RAGGED (torn, not cut).
 * 3. SCRATCHES: thin sharp scores through the surface.
 * 4. Debris: fragments of the warm surface displaced near the gouges.
 * 5. A fury zone where gouges concentrate — the warm surface is mostly
 *    destroyed there, revealing large areas of cold void.
 *
 * The anger is: something beautiful existed. Now it's been clawed apart.
 * The viewer sees both the beauty that remains AND the violence of the removal.
 *
 * Conceptual difference from v14:
 * v14: warm ground + dark marks ON TOP = "painting"
 * v15: warm ground MINUS torn sections = "damage"
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
  const maxSpeed = 18 + intensity * 30
  const totalSteps = steps ?? (80 + Math.floor(rand() * 80))
  const strikePoint = 0.10 + rand() * 0.10

  for (let i = 0; i < totalSteps; i++) {
    const t = i / totalSteps
    let speed: number
    if (t < strikePoint) {
      speed = maxSpeed * 0.1 + maxSpeed * 0.9 * (t / strikePoint) ** 2
    } else {
      const decayT = (t - strikePoint) / (1.0 - strikePoint)
      speed = maxSpeed * (1.0 - decayT) ** 0.5
      if (rand() < 0.08 * intensity) speed = Math.max(speed, maxSpeed * 0.7)
    }

    let pressure = t < strikePoint + 0.05 && t > strikePoint - 0.05
      ? 0.85 + rand() * 0.15
      : Math.max(0.12, 0.70 - speed / maxSpeed * 0.4 + rand() * 0.15)

    if (rand() < 0.10 * intensity) angle += (rand() - 0.5) * 2.0 * intensity
    angle += (rand() - 0.5) * 0.18

    x += Math.cos(angle) * speed
    y += Math.sin(angle) * speed
    points.push({ x, y, pressure, velocity: speed, angle })
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 15001, b: 15002, c: 15003, d: 15004 }
  const seed = seeds[variant] ?? 15001
  const rand = makePRNG(seed)

  console.log(`=== ANGER v15 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators for warm ground
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 150)
  const bgNoise3 = makeNoise(seed + 120, 50)
  const wash1 = makeNoise(seed + 300, 300)
  const wash2 = makeNoise(seed + 310, 180)
  const wash3 = makeNoise(seed + 320, 120)
  const wash4 = makeNoise(seed + 330, 400)

  // Noise for gouge edges
  const gougeEdge1 = makeNoise(seed + 200, 8)
  const gougeEdge2 = makeNoise(seed + 210, 22)

  // Noise for scratches
  const scratchEdge = makeNoise(seed + 250, 5)

  // Fury center
  const furyX = W * (0.35 + rand() * 0.30)
  const furyY = H * (0.30 + rand() * 0.40)
  console.log(`  Fury center: (${Math.round(furyX)}, ${Math.round(furyY)})`)

  // === Generate gouges (wide destructive paths) ===
  interface Gouge { points: GesturePoint[]; width: number; depth: number }
  const gouges: Gouge[] = []

  // 5-7 major gouges aimed at/through fury zone
  const majorCount = 5 + Math.floor(rand() * 3)
  for (let i = 0; i < majorCount; i++) {
    const fromEdge = rand() < 0.4
    let sx: number, sy: number
    if (fromEdge) {
      const edge = Math.floor(rand() * 4)
      if (edge === 0) { sx = -100 - rand() * 200; sy = rand() * H }
      else if (edge === 1) { sx = W + 100 + rand() * 200; sy = rand() * H }
      else if (edge === 2) { sx = rand() * W; sy = -100 - rand() * 200 }
      else { sx = rand() * W; sy = H + 100 + rand() * 200 }
    } else {
      const approachAngle = rand() * Math.PI * 2
      sx = furyX + Math.cos(approachAngle) * (W * 0.5 + 100)
      sy = furyY + Math.sin(approachAngle) * (H * 0.4 + 100)
    }

    const toFuryAngle = Math.atan2(furyY - sy, furyX - sx) + (rand() - 0.5) * 0.5
    gouges.push({
      points: simulateGesture(sx, sy, toFuryAngle, 0.7 + rand() * 0.3, rand),
      width: 35 + rand() * 50,  // wide gouges
      depth: 0.7 + rand() * 0.3,
    })
  }

  // 2-3 return gouges
  const returnCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < returnCount; i++) {
    const base = gouges[Math.floor(rand() * Math.min(gouges.length, majorCount))]
    const lastPt = base.points[base.points.length - 1]
    gouges.push({
      points: simulateGesture(lastPt.x, lastPt.y, lastPt.angle + Math.PI + (rand() - 0.5) * 1.0, 0.5 + rand() * 0.4, rand, 40 + Math.floor(rand() * 40)),
      width: 25 + rand() * 35,
      depth: 0.5 + rand() * 0.3,
    })
  }

  // 6-10 stab gouges in fury zone (short, deep)
  const stabCount = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < stabCount; i++) {
    const spread = W * 0.20
    const sx = furyX + (rand() - 0.5) * spread
    const sy = furyY + (rand() - 0.5) * spread
    gouges.push({
      points: simulateGesture(sx, sy, rand() * Math.PI * 2, 0.9, rand, 6 + Math.floor(rand() * 15)),
      width: 15 + rand() * 30,
      depth: 0.85 + rand() * 0.15,
    })
  }

  console.log(`  ${gouges.length} gouges (${majorCount} major, ${returnCount} returns, ${stabCount} stabs)`)

  // === Generate scratches (thin, sharp) ===
  interface Scratch { points: GesturePoint[] }
  const scratches: Scratch[] = []
  const scratchCount = 8 + Math.floor(rand() * 8)
  for (let i = 0; i < scratchCount; i++) {
    const sx = furyX + (rand() - 0.5) * W * 0.5
    const sy = furyY + (rand() - 0.5) * H * 0.4
    const angle = rand() * Math.PI * 2
    scratches.push({
      points: simulateGesture(sx, sy, angle, 0.4 + rand() * 0.5, rand, 20 + Math.floor(rand() * 50)),
    })
  }
  console.log(`  ${scratchCount} scratches`)

  // === Compute damage map ===
  // gougeMap: 0 = undamaged, 1 = fully gouged through to void
  const gougeMap = new Float32Array(W * H)

  // Render gouges into damage map
  for (const gouge of gouges) {
    for (let i = 1; i < gouge.points.length; i++) {
      const p0 = gouge.points[i - 1], p1 = gouge.points[i]
      const baseWidth = gouge.width * (0.8 + p1.pressure * 0.4)
      const speedThin = Math.max(0.3, 1.0 - p1.velocity / 45 * 0.4)
      const strokeWidth = baseWidth * speedThin

      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const cP = p0.pressure * (1 - t) + p1.pressure * t
        const cW = strokeWidth * (0.9 + t * 0.1)

        const margin = Math.ceil(cW * 1.8)
        const minX = Math.max(0, Math.floor(cx - margin))
        const maxX = Math.min(W - 1, Math.ceil(cx + margin))
        const minY = Math.max(0, Math.floor(cy - margin))
        const maxY = Math.min(H - 1, Math.ceil(cy + margin))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx, ddy = py - cy
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)

            // Ragged edge distortion
            const en1 = gougeEdge1(px, py) * 0.5
            const en2 = gougeEdge2(px, py) * 0.3
            const effWidth = cW * (1.0 + en1 + en2)

            if (dist < effWidth) {
              const nd = dist / effWidth
              // Sharp-edged gouge — not smooth falloff
              let damage: number
              if (nd < 0.6) {
                damage = gouge.depth * cP  // full damage in core
              } else {
                // Ragged edge — noise-based threshold
                const edgeRand = gougeEdge1(px * 3, py * 3) * 0.5 + 0.5
                damage = edgeRand > (nd - 0.6) / 0.4 ? gouge.depth * cP * 0.7 : 0
              }

              const idx = py * W + px
              gougeMap[idx] = Math.min(1.0, gougeMap[idx] + damage)
            }
          }
        }
      }
    }
  }

  // Render scratches — thin, sharp
  for (const scratch of scratches) {
    for (let i = 1; i < scratch.points.length; i++) {
      const p0 = scratch.points[i - 1], p1 = scratch.points[i]
      const scratchWidth = 2 + p1.pressure * 5  // thin

      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(segDist / 1.0))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = p0.x + dx * t, cy = p0.y + dy * t
        const cP = p0.pressure * (1 - t) + p1.pressure * t
        const cW = scratchWidth

        const margin = Math.ceil(cW * 2)
        const minX = Math.max(0, Math.floor(cx - margin))
        const maxX = Math.min(W - 1, Math.ceil(cx + margin))
        const minY = Math.max(0, Math.floor(cy - margin))
        const maxY = Math.min(H - 1, Math.ceil(cy + margin))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx, ddy = py - cy
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)
            const en = scratchEdge(px, py) * 0.25
            if (dist < cW * (1 + en)) {
              const idx = py * W + px
              gougeMap[idx] = Math.min(1.0, gougeMap[idx] + 0.6 * cP)
            }
          }
        }
      }
    }
  }

  // === Generate debris (displaced warm fragments near gouges) ===
  interface Debris { x: number; y: number; size: number; warmth: number }
  const debris: Debris[] = []
  const numDebris = 40 + Math.floor(rand() * 30)
  for (let i = 0; i < numDebris; i++) {
    // Debris near gouges
    const gouge = gouges[Math.floor(rand() * gouges.length)]
    const ptIdx = Math.floor(rand() * gouge.points.length)
    const pt = gouge.points[ptIdx]

    const perpAngle = pt.angle + (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2)
    const flingDist = gouge.width * (0.8 + rand() * 2.5) + rand() * 60
    const dx = pt.x + Math.cos(perpAngle) * flingDist + (rand() - 0.5) * 40
    const dy = pt.y + Math.sin(perpAngle) * flingDist + (rand() - 0.5) * 40

    if (dx < 0 || dx >= W || dy < 0 || dy >= H) continue

    debris.push({
      x: dx, y: dy,
      size: 3 + rand() * 15,
      warmth: 0.4 + rand() * 0.4,
    })
  }
  console.log(`  ${debris.length} debris pieces`)

  // === Splatter (from gouge violence) ===
  interface Splat { x: number; y: number; size: number }
  const splatters: Splat[] = []
  for (const gouge of gouges) {
    for (let i = 1; i < gouge.points.length; i++) {
      const p = gouge.points[i]
      if (p.velocity > 12 && rand() < 0.3) {
        const count = 1 + Math.floor(rand() * 5)
        for (let j = 0; j < count; j++) {
          const dist = 20 + rand() * 120 + p.velocity * 3
          const a = p.angle + (rand() - 0.5) * 2.0
          splatters.push({
            x: p.x + Math.cos(a) * dist,
            y: p.y + Math.sin(a) * dist,
            size: 1 + rand() * 6,
          })
        }
      }
    }
  }

  // Render splatter as tiny gouges
  for (const sp of splatters) {
    if (sp.x < 0 || sp.x >= W || sp.y < 0 || sp.y >= H) continue
    const ir = Math.ceil(sp.size)
    for (let py = Math.max(0, Math.floor(sp.y - ir)); py < Math.min(H, Math.ceil(sp.y + ir)); py++) {
      for (let px = Math.max(0, Math.floor(sp.x - ir)); px < Math.min(W, Math.ceil(sp.x + ir)); px++) {
        const d = Math.sqrt((px - sp.x) ** 2 + (py - sp.y) ** 2)
        if (d < sp.size) {
          const idx = py * W + px
          gougeMap[idx] = Math.min(1.0, gougeMap[idx] + (1 - d / sp.size) * 0.7)
        }
      }
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const damage = gougeMap[idx]

      // === Beautiful warm ground (same as v14) ===
      const n1 = bgNoise1(x, y) * 0.5 + 0.5
      const n3 = bgNoise3(x, y) * 0.5 + 0.5
      const w1 = wash1(x, y) * 0.5 + 0.5
      const w2 = wash2(x, y) * 0.5 + 0.5
      const w3 = wash3(x, y) * 0.5 + 0.5
      const w4 = wash4(x, y) * 0.5 + 0.5

      let warmR = 225 + n1 * 18
      let warmG = 200 + n1 * 12
      let warmB = 165 + n1 * 10

      const roseAmount = Math.max(0, w2 - 0.35) * 2.0
      warmR += roseAmount * 20
      warmG -= roseAmount * 15
      warmB -= roseAmount * 5

      const goldAmount = Math.max(0, w3 - 0.4) * 2.5
      warmR += goldAmount * 15
      warmG += goldAmount * 10
      warmB -= goldAmount * 8

      const deepAmount = Math.max(0, w1 - 0.5) * 2.0
      warmR -= deepAmount * 10
      warmG -= deepAmount * 18
      warmB -= deepAmount * 15

      warmR += n3 * 6 - 3
      warmG += n3 * 4 - 2
      warmB += n3 * 3 - 1.5

      warmR += (w4 - 0.5) * 8
      warmG += (w4 - 0.5) * 4

      warmR = Math.max(180, Math.min(255, warmR))
      warmG = Math.max(155, Math.min(235, warmG))
      warmB = Math.max(130, Math.min(200, warmB))

      if (damage < 0.01) {
        // Check debris
        let hasDebris = false
        for (const d of debris) {
          const dd = Math.sqrt((x - d.x) ** 2 + (y - d.y) ** 2)
          if (dd < d.size) {
            // Debris is a displaced warm fragment on top of ground
            const falloff = 1 - dd / d.size
            const debrisOp = falloff * falloff * 0.6
            // Slightly darker/different warm tone (displaced)
            const dR = warmR * 0.85 + 20
            const dG = warmG * 0.80
            const dB = warmB * 0.75
            rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, warmR * (1 - debrisOp) + dR * debrisOp)))
            rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, warmG * (1 - debrisOp) + dG * debrisOp)))
            rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, warmB * (1 - debrisOp) + dB * debrisOp)))
            rgba[idx * 4 + 3] = 255
            hasDebris = true
            break
          }
        }
        if (!hasDebris) {
          rgba[idx * 4 + 0] = Math.round(warmR)
          rgba[idx * 4 + 1] = Math.round(warmG)
          rgba[idx * 4 + 2] = Math.round(warmB)
          rgba[idx * 4 + 3] = 255
        }
        continue
      }

      // === Void beneath (cold, dark) ===
      // The void is NOT black — it's a cold dark grey-blue
      // This creates the temperature contrast (warm amber vs cold void)
      const voidR = 38 + n3 * 8
      const voidG = 36 + n3 * 6
      const voidB = 42 + n3 * 10  // slightly blue-cold

      // Damage determines how much void shows through
      const voidAmount = Math.min(1.0, damage * 1.3)

      // At edges of gouges, the warm surface curls/darkens
      // (like torn paper — the edge is darker than either surface)
      let edgeDarken = 0
      if (damage > 0.15 && damage < 0.65) {
        edgeDarken = (1.0 - Math.abs(damage - 0.4) / 0.25) * 0.3
      }

      // Blend warm ground → void
      let r = warmR * (1 - voidAmount) + voidR * voidAmount
      let g = warmG * (1 - voidAmount) + voidG * voidAmount
      let b = warmB * (1 - voidAmount) + voidB * voidAmount

      // Edge darkening
      r *= (1 - edgeDarken)
      g *= (1 - edgeDarken)
      b *= (1 - edgeDarken)

      // Add slight redness at gouge edges (like blood/raw surface)
      if (damage > 0.2 && damage < 0.7) {
        const redAmount = (1.0 - Math.abs(damage - 0.45) / 0.25) * 0.15
        r += redAmount * 60
        g -= redAmount * 20
        b -= redAmount * 15
      }

      // Check debris overlay
      for (const d of debris) {
        const dd = Math.sqrt((x - d.x) ** 2 + (y - d.y) ** 2)
        if (dd < d.size) {
          const falloff = 1 - dd / d.size
          const debrisOp = falloff * falloff * 0.5
          r = r * (1 - debrisOp) + (warmR * 0.85 + 20) * debrisOp
          g = g * (1 - debrisOp) + warmG * 0.80 * debrisOp
          b = b * (1 - debrisOp) + warmB * 0.75 * debrisOp
          break
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

  const filename = `output/anger-v15-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
