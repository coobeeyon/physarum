/**
 * SADNESS v15 — SINKING EMBER (refined)
 *
 * v14 had the right form (vertical, sinking) but the tendrils were
 * zigzaggy/mechanical — noise-based wander at per-pixel scale creates
 * a recognizably algorithmic zigzag.
 *
 * This version:
 * - Tendrils use PARTICLE SIMULATION: particles drift upward, decelerate,
 *   and stop. Their paths are smooth curves, not zigzags.
 * - The warm core is slightly brighter/larger — needs to read on phone screens
 * - Drips use smooth curves too (particles falling under gravity)
 * - The form has a gentle asymmetry — weighted slightly left
 * - Ghost trace is dimmer, more distant
 *
 * The viewer should feel: something warm is being pulled down and away.
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

// Simulate a particle drifting upward (tendril) or falling down (drip)
// Returns smooth path as array of {x, y, width, warmth}
interface PathPoint {
  x: number
  y: number
  width: number
  warmth: number
}

function simulateTendril(
  startX: number, startY: number,
  baseWidth: number, baseWarmth: number,
  flowNoise: (x: number, y: number) => number,
  rand: () => number,
): PathPoint[] {
  const points: PathPoint[] = []
  let x = startX, y = startY
  let vy = -(1.5 + rand() * 2.0)  // upward drift
  let vx = (rand() - 0.5) * 0.8
  let width = baseWidth
  let warmth = baseWarmth

  for (let step = 0; step < 600; step++) {
    points.push({ x, y, width, warmth })

    // Deceleration — the tendril is losing energy
    vy *= 0.993
    vx *= 0.99

    // Gentle flow-field drift (smooth, not zigzag)
    const flowAngle = flowNoise(x * 0.3, y * 0.3) * Math.PI * 2
    vx += Math.cos(flowAngle) * 0.08
    vy += Math.sin(flowAngle) * 0.04

    // Very gentle random drift
    vx += (rand() - 0.5) * 0.15
    vy += (rand() - 0.5) * 0.05

    x += vx
    y += vy

    // Width and warmth fade
    width *= 0.996
    warmth *= 0.995

    // Stop when barely visible
    if (width < 1.0 || warmth < 0.01) break
    if (Math.abs(vy) < 0.1 && Math.abs(vx) < 0.1) break
  }
  return points
}

function simulateDrip(
  startX: number, startY: number,
  baseWidth: number, baseWarmth: number,
  flowNoise: (x: number, y: number) => number,
  rand: () => number,
): PathPoint[] {
  const points: PathPoint[] = []
  let x = startX, y = startY
  let vy = 0.5 + rand() * 0.5  // starts slow
  let vx = (rand() - 0.5) * 0.3
  let width = baseWidth
  let warmth = baseWarmth

  for (let step = 0; step < 500; step++) {
    points.push({ x, y, width, warmth })

    // Gravity — pulls down gently
    vy += 0.015
    vy *= 0.995  // slight drag

    // Flow drift
    const flowAngle = flowNoise(x * 0.5, y * 0.5) * Math.PI
    vx += Math.cos(flowAngle) * 0.05
    vx *= 0.98

    x += vx
    y += vy

    // Width narrows, warmth fades
    width *= 0.995
    warmth *= 0.994

    if (width < 0.8 || warmth < 0.01) break
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 55601, b: 55602, c: 55603 }
  const seed = seeds[variant] ?? 55601
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v15 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const edgeN1 = makeNoise(seed + 200, 70)
  const edgeN2 = makeNoise(seed + 210, 30)
  const edgeN3 = makeNoise(seed + 220, 150)
  const bgN1 = makeNoise(seed + 100, 400)
  const bgN2 = makeNoise(seed + 110, 150)
  const bgN3 = makeNoise(seed + 120, 50)
  const flowN = makeNoise(seed + 400, 200)  // for particle drift

  // Form center — lower-left, slightly off-center
  const formX = W * (0.36 + rand() * 0.06)
  const formY = H * (0.58 + rand() * 0.06)
  const formRx = W * 0.20
  const formRy = W * 0.26

  // Ghost — upper right, barely visible
  const ghostX = W * (0.72 + rand() * 0.10)
  const ghostY = H * (0.20 + rand() * 0.10)
  const ghostR = W * 0.035

  // === Simulate tendrils (particles drifting upward) ===
  const tendrilPaths: PathPoint[][] = []
  const tendrilCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < tendrilCount; i++) {
    const sx = formX + (rand() - 0.5) * formRx * 1.0
    const sy = formY - formRy * (0.4 + rand() * 0.4)
    const w = W * (0.012 + rand() * 0.018)
    const warmth = 0.25 + rand() * 0.30
    tendrilPaths.push(simulateTendril(sx, sy, w, warmth, flowN, rand))
  }

  // === Simulate drips (particles falling under gravity) ===
  const dripPaths: PathPoint[][] = []
  const dripCount = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < dripCount; i++) {
    const sx = formX + (rand() - 0.5) * formRx * 0.6
    const sy = formY + formRy * (0.4 + rand() * 0.3)
    const w = W * (0.006 + rand() * 0.010)
    const warmth = 0.15 + rand() * 0.20
    dripPaths.push(simulateDrip(sx, sy, w, warmth, flowN, rand))
  }

  console.log(`  ${tendrilPaths.length} tendrils, ${dripPaths.length} drips`)

  // === Pre-render tendril/drip masks into a buffer for efficiency ===
  // For each pixel, find closest distance to any path segment
  const pathMask = new Float32Array(W * H)
  const pathWarmth = new Float32Array(W * H)

  const allPaths = [...tendrilPaths, ...dripPaths]
  for (const path of allPaths) {
    for (let i = 1; i < path.length; i++) {
      const p0 = path[i - 1]
      const p1 = path[i]
      const avgWidth = (p0.width + p1.width) / 2
      const avgWarmth = (p0.warmth + p1.warmth) / 2

      const margin = avgWidth * 2
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

          const localWidth = p0.width + t * (p1.width - p0.width)
          const localWarmth = p0.warmth + t * (p1.warmth - p0.warmth)

          if (dist < localWidth) {
            const fade = 1.0 - dist / localWidth
            const val = fade * fade * 0.7
            const idx = py * W + px
            if (val > pathMask[idx]) {
              pathMask[idx] = val
              pathWarmth[idx] = localWarmth
            }
          }
        }
      }
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bn3 = bgN3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.45 + bn2 * 0.35 + bn3 * 0.20

      const topWeight = yNorm * yNorm
      let bgR = 60 + bn * 14 + topWeight * 20
      let bgG = 56 + bn * 11 + topWeight * 10
      let bgB = 54 + bn * 8 + topWeight * 3

      const atm = n5(x, y) * 0.5 + 0.5
      bgR += (atm - 0.5) * 14
      bgG += (atm - 0.5) * 11
      bgB += (atm - 0.5) * 8

      // === Main form mask ===
      const dx = (x - formX) / formRx
      const dy = (y - formY) / formRy
      const ellDist = Math.sqrt(dx * dx + dy * dy)

      const edgeNoise = edgeN3(x, y) * 0.20 + edgeN1(x, y) * 0.45 + edgeN2(x, y) * 0.35
      const effectiveEdge = 1.0 + edgeNoise * 0.9

      let formMask = 0
      if (ellDist < effectiveEdge) {
        const t = ellDist / effectiveEdge
        formMask = t < 0.08 ? 1.0 : Math.pow(1.0 - (t - 0.08) / 0.92, 2.8)
      }

      // === Ghost mask ===
      const gdx = x - ghostX
      const gdy = y - ghostY
      const gDist = Math.sqrt(gdx * gdx + gdy * gdy)
      const gEffR = ghostR * (1.0 + edgeN1(x, y) * 0.8)
      let ghostMask = 0
      if (gDist < gEffR) {
        ghostMask = Math.pow(1.0 - gDist / gEffR, 2.5) * 0.12
      }

      // === Path (tendril/drip) mask ===
      const pm = pathMask[idx]
      const pw = pathWarmth[idx]

      // Combined
      const totalMask = Math.min(1.0, formMask + ghostMask + pm)

      if (totalMask > 0.01) {
        // Organic texture
        const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
        const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
        const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
        const tex1 = n2(x, y) * 0.5 + 0.5

        const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + tex1 * 0.20
        const texClamped = Math.max(0, Math.min(1, texture))
        const textureVisible = texClamped * totalMask * 0.85

        // Warmth
        const formWarmth = formMask * formMask * 0.90
        const warmth = Math.max(formWarmth, pw * pm, ghostMask * 0.1)

        const liftAmount = textureVisible * 0.60
        const warmthColor = warmth * textureVisible

        let r = bgR + liftAmount * 125 + warmthColor * 60
        let g = bgG + liftAmount * 62 + warmthColor * 15
        let b = bgB + liftAmount * 18 - warmthColor * 18

        // Veins
        if (texClamped > 0.48 && totalMask > 0.15) {
          const veinStrength = (texClamped - 0.48) / 0.52 * totalMask * warmth
          r += veinStrength * 38
          g += veinStrength * 10
          b -= veinStrength * 6
        }

        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      } else {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
      }
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-v15-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
