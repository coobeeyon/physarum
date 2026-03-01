/**
 * ANGER v5 — SLASHED CANVAS
 *
 * Not a diagram of fracture. A record of violence.
 *
 * A warm surface — like old plaster, aged canvas — slashed open.
 * The slashes are wide, deep, ragged. They reveal void beneath.
 * The edges are torn. Paint/plaster displaced by the blade.
 *
 * Reference: Lucio Fontana's "Concetto spaziale" — canvas slashed to reveal
 * the void behind. Maximum violence with minimum gesture.
 *
 * The viewer should feel: someone did this. Something broke.
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

// ---- Noise (multi-octave) ----
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

// ---- Slash definition ----
interface SlashPoint {
  x: number
  y: number
}

interface Slash {
  points: SlashPoint[]   // control points defining the path
  width: number          // base width at center
  depth: number          // 0-1, how deep/dark the slash is
  taper: number          // how quickly it tapers at ends
}

// Sample a point along a cubic bezier defined by 4 points
function bezierPoint(pts: SlashPoint[], t: number): SlashPoint {
  if (pts.length === 2) {
    return {
      x: pts[0].x + t * (pts[1].x - pts[0].x),
      y: pts[0].y + t * (pts[1].y - pts[0].y),
    }
  }
  if (pts.length === 3) {
    const u = 1 - t
    return {
      x: u * u * pts[0].x + 2 * u * t * pts[1].x + t * t * pts[2].x,
      y: u * u * pts[0].y + 2 * u * t * pts[1].y + t * t * pts[2].y,
    }
  }
  // Cubic
  const u = 1 - t
  return {
    x: u*u*u*pts[0].x + 3*u*u*t*pts[1].x + 3*u*t*t*pts[2].x + t*t*t*pts[3].x,
    y: u*u*u*pts[0].y + 3*u*u*t*pts[1].y + 3*u*t*t*pts[2].y + t*t*t*pts[3].y,
  }
}

// Get the normal direction at parameter t
function bezierNormal(pts: SlashPoint[], t: number): { nx: number; ny: number } {
  const dt = 0.001
  const p1 = bezierPoint(pts, Math.max(0, t - dt))
  const p2 = bezierPoint(pts, Math.min(1, t + dt))
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  // Normal is perpendicular to tangent
  return { nx: -dy / len, ny: dx / len }
}

// Minimum distance from point to slash path, plus parameter t and width at that t
function distToSlash(
  px: number, py: number,
  slash: Slash,
  noiseAtPoint: number,
): { dist: number; t: number; widthAtT: number; side: number } {
  // Sample the bezier at intervals to find closest point
  let bestDist = Infinity
  let bestT = 0
  const steps = 80
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const p = bezierPoint(slash.points, t)
    const dx = px - p.x
    const dy = py - p.y
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      bestT = t
    }
  }

  // Refine with finer search around best t
  const step2 = 1 / steps
  for (let i = -10; i <= 10; i++) {
    const t = Math.max(0, Math.min(1, bestT + i * step2 / 10))
    const p = bezierPoint(slash.points, t)
    const dx = px - p.x
    const dy = py - p.y
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      bestT = t
    }
  }

  bestDist = Math.sqrt(bestDist)

  // Width varies along slash: full at center, tapering at ends
  // Also modulated by noise for ragged edges
  const centeredness = 1.0 - 2.0 * Math.abs(bestT - 0.5) // 1 at center, 0 at ends
  const taperCurve = Math.pow(centeredness, slash.taper)
  const noiseModulation = 1.0 + noiseAtPoint * 0.9 // very ragged edges
  const widthAtT = slash.width * taperCurve * noiseModulation

  // Determine which side of the slash the point is on
  const norm = bezierNormal(slash.points, bestT)
  const p = bezierPoint(slash.points, bestT)
  const side = (px - p.x) * norm.nx + (py - p.y) * norm.ny

  return { dist: bestDist, t: bestT, widthAtT, side }
}

// ---- Generate slashes ----
function generateSlashes(rand: () => number): Slash[] {
  const slashes: Slash[] = []

  // Fury zone — where the violence concentrates
  // Off-center: anger isn't symmetric
  const furyX = W * (0.35 + rand() * 0.25)
  const furyY = H * (0.30 + rand() * 0.30)

  // 2-3 major slashes: long, decisive cuts through the surface
  const majorCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < majorCount; i++) {
    // Start and end near edges, passing through or near fury zone
    const angle = (rand() * 0.6 + 0.2) * Math.PI // mostly diagonal
    const offset = (rand() - 0.5) * 200

    const startX = furyX - Math.cos(angle) * W * 0.5 + offset
    const startY = furyY - Math.sin(angle) * H * 0.4 + offset
    const endX = furyX + Math.cos(angle) * W * 0.5 + offset * 0.5
    const endY = furyY + Math.sin(angle) * H * 0.4 + offset * 0.5

    // Control point adds curve — slashes aren't perfectly straight
    const ctrlX = furyX + (rand() - 0.5) * 300
    const ctrlY = furyY + (rand() - 0.5) * 300

    slashes.push({
      points: [
        { x: startX, y: startY },
        { x: ctrlX, y: ctrlY },
        { x: endX, y: endY },
      ],
      width: 70 + rand() * 60,  // GAPING cuts — unmistakable gashes
      depth: 0.9 + rand() * 0.1,
      taper: 0.35 + rand() * 0.2, // less taper = stays wide longer
    })
  }

  // 4-7 short frantic slashes in the fury zone — loss of control
  const franticCount = 4 + Math.floor(rand() * 4)
  for (let i = 0; i < franticCount; i++) {
    const cx = furyX + (rand() - 0.5) * 500
    const cy = furyY + (rand() - 0.5) * 400
    const angle = rand() * Math.PI
    const len = 200 + rand() * 350

    slashes.push({
      points: [
        { x: cx - Math.cos(angle) * len / 2, y: cy - Math.sin(angle) * len / 2 },
        { x: cx + (rand() - 0.5) * 120, y: cy + (rand() - 0.5) * 120 },
        { x: cx + Math.cos(angle) * len / 2, y: cy + Math.sin(angle) * len / 2 },
      ],
      width: 35 + rand() * 45,
      depth: 0.75 + rand() * 0.25,
      taper: 0.4 + rand() * 0.4,
    })
  }

  // 2-3 long scratches — thin, sharp, trailing across the surface
  // Like fingernails dragging — contrasts with the deep gashes
  const scratchCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < scratchCount; i++) {
    const startX = rand() * W
    const startY = rand() * H * 0.4
    const endX = startX + (rand() - 0.3) * W * 0.8
    const endY = startY + rand() * H * 0.6

    slashes.push({
      points: [
        { x: startX, y: startY },
        { x: (startX + endX) / 2 + (rand() - 0.5) * 250, y: (startY + endY) / 2 },
        { x: endX, y: endY },
      ],
      width: 8 + rand() * 14,
      depth: 0.55 + rand() * 0.3,
      taper: 0.5 + rand() * 0.3,
    })
  }

  return slashes
}

// ---- Render ----
function render(slashes: Slash[], seed: number): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)

  // Noise layers for surface texture and slash edge raggedness
  const surfNoise1 = makeNoise(seed, 400)       // large-scale surface variation
  const surfNoise2 = makeNoise(seed + 100, 120)  // medium texture
  const surfNoise3 = makeNoise(seed + 200, 40)   // fine grain
  const edgeNoise1 = makeNoise(seed + 300, 30)   // slash edge raggedness
  const edgeNoise2 = makeNoise(seed + 400, 12)   // fine edge detail
  const stressNoise = makeNoise(seed + 500, 60)  // stress/damage radiating from slashes

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Surface texture: warm off-white plaster
      const sn1 = surfNoise1(x, y) * 0.5 + 0.5
      const sn2 = surfNoise2(x, y) * 0.5 + 0.5
      const sn3 = surfNoise3(x, y) * 0.5 + 0.5
      const surfaceVal = sn1 * 0.5 + sn2 * 0.3 + sn3 * 0.2

      // Base color: warm cream to pale ochre
      let r = 215 + surfaceVal * 25
      let g = 200 + surfaceVal * 20
      let b = 180 + surfaceVal * 15

      // Edge noise for ragged slash boundaries
      const edgeN = edgeNoise1(x, y) * 0.6 + edgeNoise2(x, y) * 0.4

      // Check distance to all slashes
      let maxSlashEffect = 0  // 0 = no slash, 1 = full void
      let maxRidgeEffect = 0  // raised edge displacement
      let ridgeSide = 0
      let closestSlashDist = Infinity
      let closestDepth = 0

      for (const slash of slashes) {
        const { dist, t, widthAtT, side } = distToSlash(x, y, slash, edgeN)

        if (dist < closestSlashDist) {
          closestSlashDist = dist
          closestDepth = slash.depth
        }

        if (widthAtT <= 0) continue

        // Inside the slash core — the void
        if (dist < widthAtT * 0.6) {
          const coreness = 1.0 - dist / (widthAtT * 0.6)
          const effect = coreness * slash.depth
          if (effect > maxSlashEffect) {
            maxSlashEffect = effect
          }
        }

        // Ridge zone — displaced material at slash edges
        if (dist >= widthAtT * 0.4 && dist < widthAtT * 1.4) {
          const ridgePos = (dist - widthAtT * 0.4) / (widthAtT * 1.0)
          // Ridge peaks just outside the slash, fades outward
          const ridgePeak = ridgePos < 0.3 ? ridgePos / 0.3 : 1.0 - (ridgePos - 0.3) / 0.7
          const ridgeVal = ridgePeak * ridgePeak * slash.depth * 0.7
          if (ridgeVal > maxRidgeEffect) {
            maxRidgeEffect = ridgeVal
            ridgeSide = side > 0 ? 1 : -1
          }
        }

        // Stress zone — hairline cracks and discoloration radiating from slashes
        if (dist < widthAtT * 3.0 && dist >= widthAtT * 1.2) {
          const stressDist = (dist - widthAtT * 1.2) / (widthAtT * 1.8)
          const stressVal = (1.0 - stressDist) * 0.15 * slash.depth
          // Hairline stress cracks (noise-based)
          const sn = stressNoise(x, y)
          if (sn > 0.3) {
            const crackVal = stressVal * (sn - 0.3) / 0.7
            r -= crackVal * 40
            g -= crackVal * 35
            b -= crackVal * 30
          }
        }
      }

      // Apply slash void — truly black, like looking into a gash
      if (maxSlashEffect > 0) {
        const t = Math.min(1.0, maxSlashEffect * 1.5)
        // Pure black void — anger reveals nothing beneath
        const voidR = 5 + (1.0 - t) * 15
        const voidG = 2 + (1.0 - t) * 8
        const voidB = 2 + (1.0 - t) * 8
        r = r * (1 - t) + voidR * t
        g = g * (1 - t) + voidG * t
        b = b * (1 - t) + voidB * t
      }

      // Apply ridge (displaced/torn material at slash edges)
      if (maxRidgeEffect > 0 && maxSlashEffect < 0.2) {
        // Pronounced ridges: bright highlight on one side (light catches torn edge),
        // deep shadow on the other (the wall of the cut)
        if (ridgeSide > 0) {
          // Light side — torn material curling upward catches light
          const highlight = maxRidgeEffect * maxRidgeEffect
          r += highlight * 80
          g += highlight * 65
          b += highlight * 50
        } else {
          // Shadow side — looking into the cut wall
          const shadow = maxRidgeEffect * maxRidgeEffect
          r -= shadow * 90
          g -= shadow * 85
          b -= shadow * 75
        }
      }

      // Blood/residue bleeding from deep slashes — anger stains RED
      if (closestSlashDist < 180 && closestDepth > 0.6) {
        const bleedDist = closestSlashDist / 180
        const bleedT = (1.0 - bleedDist) * (1.0 - bleedDist) * closestDepth * 0.45
        // Visibly red — not subtle. The wound bleeds.
        r = r * (1 - bleedT) + 140 * bleedT
        g = g * (1 - bleedT) + 12 * bleedT
        b = b * (1 - bleedT) + 8 * bleedT
      }

      // Surface damage radiating from slashes — bruising, stress, heat
      if (closestSlashDist < 300 && closestSlashDist > 20) {
        const damageDist = (closestSlashDist - 20) / 280
        const damageVal = (1.0 - damageDist) * (1.0 - damageDist) * 0.12
        // Warm discoloration — the surface is no longer pristine, it's been hurt
        r += damageVal * 20  // redder
        g -= damageVal * 30
        b -= damageVal * 45  // much less blue = warmer = angrier
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 256 === 0) console.log(`  row ${y}/${H}`)
  }

  return rgba
}

// ---- Main ----
async function main() {
  const variant = process.argv[2] || "a"

  const variants: Record<string, number> = {
    a: 88801,
    b: 88802,
    c: 88803,
  }

  const seed = variants[variant] ?? 88801
  const rand = makePRNG(seed)

  console.log(`=== ANGER v5 variant ${variant} (seed: ${seed}) ===`)

  console.log("  Generating slashes...")
  const slashes = generateSlashes(rand)
  console.log(`  ${slashes.length} slashes`)

  console.log("  Rendering...")
  const rgba = render(slashes, seed)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-v5-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
