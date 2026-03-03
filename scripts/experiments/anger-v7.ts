/**
 * ANGER v7 — TORN WARMTH
 *
 * Previous anger pieces destroyed a BLANK surface — cream with cuts.
 * You can't feel loss from damaging nothing.
 *
 * This version destroys something BEAUTIFUL. Start with a warm, living
 * organic texture (like the sadness ember but filling the canvas), then
 * tear it apart. Rip chunks out. Leave ragged dark voids.
 *
 * The anger is visible because you can see what WAS there — warmth,
 * structure, life — and it's been ruined. The traces of beauty
 * make the destruction feel like a violation.
 *
 * Pairs with the sadness piece:
 * - Sadness: warmth fading gently into darkness
 * - Anger: warmth torn apart violently
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

// Generate tear/rip paths — violent removal of material
interface Tear {
  points: Array<{ x: number; y: number }>
  width: number
  depth: number  // 0-1, how completely the warmth is destroyed
}

function simulateTear(
  startX: number, startY: number,
  angle: number, length: number,
  width: number, fury: number,
  rand: () => number,
): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  let x = startX, y = startY
  let vx = Math.cos(angle) * 8
  let vy = Math.sin(angle) * 8

  const steps = Math.ceil(length / 3)
  for (let i = 0; i < steps; i++) {
    points.push({ x, y })

    // Jagged direction changes — tears aren't smooth
    if (rand() < fury * 0.25) {
      const jerk = rand() * Math.PI * 2
      vx += Math.cos(jerk) * (5 + rand() * 15)
      vy += Math.sin(jerk) * (5 + rand() * 15)
    }

    vx += (rand() - 0.5) * fury * 8
    vy += (rand() - 0.5) * fury * 8
    vx *= 0.90
    vy *= 0.90

    x += vx
    y += vy
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 77701, b: 77702, c: 77703 }
  const seed = seeds[variant] ?? 77701
  const rand = makePRNG(seed)

  console.log(`=== ANGER v7 variant ${variant} (seed: ${seed}) ===`)

  // === First: create the beautiful warm layer (what will be destroyed) ===
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const tearEdge1 = makeNoise(seed + 300, 25)
  const tearEdge2 = makeNoise(seed + 310, 10)
  const tearEdge3 = makeNoise(seed + 320, 50)

  // Warm texture layer — ridge noise for organic veins
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

  // === Generate tears — paths of destruction ===
  const tears: Tear[] = []

  // Fury center — where destruction concentrates
  const furyX = W * (0.40 + rand() * 0.20)
  const furyY = H * (0.35 + rand() * 0.25)

  // Major tears: 3-5 wide rips through the material
  const majorCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < majorCount; i++) {
    const angle = (i / majorCount) * Math.PI + (rand() - 0.5) * 0.8
    const startX = furyX - Math.cos(angle) * W * 0.3 + (rand() - 0.5) * 200
    const startY = furyY - Math.sin(angle) * H * 0.25 + (rand() - 0.5) * 200
    const length = 600 + rand() * 800

    tears.push({
      points: simulateTear(startX, startY, angle, length, 0, 0.6 + rand() * 0.3, rand),
      width: 60 + rand() * 80,
      depth: 0.85 + rand() * 0.15,
    })
  }

  // Frantic tears: 6-10 short violent rips near fury zone
  const franticCount = 6 + Math.floor(rand() * 5)
  for (let i = 0; i < franticCount; i++) {
    const cx = furyX + (rand() - 0.5) * 600
    const cy = furyY + (rand() - 0.5) * 500
    const angle = rand() * Math.PI * 2
    const length = 150 + rand() * 350

    tears.push({
      points: simulateTear(cx, cy, angle, length, 0, 0.7 + rand() * 0.3, rand),
      width: 30 + rand() * 50,
      depth: 0.70 + rand() * 0.30,
    })
  }

  // Long scratches: 3-5 thin lines across the whole surface
  const scratchCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < scratchCount; i++) {
    const startX = rand() * W
    const startY = rand() * H
    const angle = rand() * Math.PI
    const length = 800 + rand() * 1200

    tears.push({
      points: simulateTear(startX, startY, angle, length, 0, 0.3, rand),
      width: 6 + rand() * 10,
      depth: 0.50 + rand() * 0.35,
    })
  }

  console.log(`  ${tears.length} tears generated`)

  // === Compute destruction mask ===
  const destructionMap = new Float32Array(W * H)
  const edgeStress = new Float32Array(W * H)  // stress at tear edges

  for (const tear of tears) {
    for (let i = 0; i < tear.points.length; i++) {
      const pt = tear.points[i]
      const prevPt = i > 0 ? tear.points[i - 1] : pt

      const dx = pt.x - prevPt.x
      const dy = pt.y - prevPt.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(dist / 2))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = prevPt.x + dx * t
        const cy = prevPt.y + dy * t

        const ir = Math.ceil(tear.width * 2)
        const minX = Math.max(0, Math.floor(cx - ir))
        const maxX = Math.min(W - 1, Math.ceil(cx + ir))
        const minY = Math.max(0, Math.floor(cy - ir))
        const maxY = Math.min(H - 1, Math.ceil(cy + ir))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx
            const ddy = py - cy
            const d = Math.sqrt(ddx * ddx + ddy * ddy)

            // Ragged edges
            const en = tearEdge1(px, py) * 0.5 + tearEdge2(px, py) * 0.3 + tearEdge3(px, py) * 0.2
            const effectiveWidth = tear.width * (1.0 + en * 1.0)

            const idx = py * W + px

            if (d < effectiveWidth * 0.7) {
              // Core of tear — full destruction
              const falloff = 1.0 - d / (effectiveWidth * 0.7)
              destructionMap[idx] = Math.min(1.0, destructionMap[idx] + falloff * tear.depth)
            }

            // Edge stress zone
            if (d >= effectiveWidth * 0.5 && d < effectiveWidth * 2.0) {
              const stressPos = (d - effectiveWidth * 0.5) / (effectiveWidth * 1.5)
              const stressVal = (1.0 - stressPos) * tear.depth * 0.5
              edgeStress[idx] = Math.min(1.0, edgeStress[idx] + stressVal * stressVal)
            }
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

      // === The warm, beautiful layer ===
      // What the surface WOULD look like undamaged
      // Warm ochre-amber tones with organic vein texture
      const atm = n5(x, y) * 0.5 + 0.5
      let warmR = 165 + warmth * 60 + atm * 15
      let warmG = 125 + warmth * 30 + atm * 10
      let warmB = 80 + warmth * 15 + atm * 5

      // Veins: brighter warm
      if (warmth > 0.55) {
        const veinT = (warmth - 0.55) / 0.45
        warmR += veinT * 35
        warmG += veinT * 15
        warmB -= veinT * 5
      }

      // === Apply stress (damaged edges — darkened, reddened) ===
      if (stress > 0.02) {
        const st = Math.min(1.0, stress * 1.8)
        warmR -= st * 35
        warmG -= st * 50
        warmB -= st * 55  // reddens the stressed areas
        // Char at high stress
        if (st > 0.5) {
          const charT = (st - 0.5) * 2
          warmR -= charT * 40
          warmG -= charT * 30
          warmB -= charT * 20
        }
      }

      // === Apply destruction (the void where warmth was torn away) ===
      if (destruction > 0.05) {
        const dt = Math.min(1.0, destruction * 1.5)
        const dtCurve = dt * dt  // sharp transition

        // The void: not black — dark cold grey. The absence of warmth.
        // Cold blue-grey where warm amber used to be = the temperature contrast IS the anger
        const voidR = 25 + (1 - dtCurve) * 15
        const voidG = 28 + (1 - dtCurve) * 12
        const voidB = 35 + (1 - dtCurve) * 10  // slightly bluer than warm = cold

        warmR = warmR * (1 - dtCurve) + voidR * dtCurve
        warmG = warmG * (1 - dtCurve) + voidG * dtCurve
        warmB = warmB * (1 - dtCurve) + voidB * dtCurve
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, warmR)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, warmG)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, warmB)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-v7-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
