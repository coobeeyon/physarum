/**
 * SADNESS v24 — FRAGMENTING WARMTH
 *
 * v23's problem: the elliptical blob reads as a stain, not as something
 * that was once alive. It has no internal structure, no complexity,
 * nothing that suggests it was ever whole.
 *
 * New approach: build the form from many overlapping warm organic shapes —
 * a CLUSTER that reads as a complex living thing. Internal veins created
 * by ridge noise (abs of Perlin). The form occupies the upper portion
 * of the canvas, large enough to feel like a real presence.
 *
 * The dissolution: the cluster starts intact at the top and comes apart
 * toward the bottom. Individual shapes detach and fall. They carry warmth
 * from the original — amber fading to grey as they descend. The falling
 * pieces get smaller, colder, more transparent. Drips trail behind them.
 *
 * The bottom half of the canvas is vast warm-grey emptiness.
 * What's already gone is invisible. What's still falling is faint.
 * Only the core still holds.
 *
 * Composition: slightly off-center (not centered — dead center reads as
 * a logo, not as something that exists). The core drifts left of center,
 * fragments scatter rightward as they fall (wind, entropy).
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

interface Blob {
  x: number; y: number
  rx: number; ry: number
  warmth: number
  opacity: number
  attached: boolean // still part of the main form
  fallOffset: number // how far it has fallen from its original position
  driftX: number // horizontal drift while falling
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 24001, b: 24002, c: 24003, d: 24004 }
  const seed = seeds[variant] ?? 24001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v24 variant ${variant} (seed: ${seed}) ===`)

  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)

  // Vein structure (ridge noise = abs of Perlin)
  const veinNoise1 = makeNoise(seed + 200, 35)
  const veinNoise2 = makeNoise(seed + 210, 18)
  const veinNoise3 = makeNoise(seed + 220, 60)

  // Edge distortion
  const edgeNoise = makeNoise(seed + 300, 15)
  const edgeNoise2 = makeNoise(seed + 310, 40)

  // Dissolution pattern
  const dissolveNoise = makeNoise(seed + 400, 50)

  // === Form parameters ===
  // Core cluster position — left of center, in upper third
  const coreX = W * (0.38 + rand() * 0.08)
  const coreY = H * (0.20 + rand() * 0.06)

  console.log(`  Core center: (${Math.round(coreX)}, ${Math.round(coreY)})`)

  // === Generate blobs that form the cluster ===
  const blobs: Blob[] = []

  // Core blobs: large, warm, tightly clustered
  const coreCount = 8 + Math.floor(rand() * 4)
  for (let i = 0; i < coreCount; i++) {
    const angle = rand() * Math.PI * 2
    const dist = rand() * W * 0.12
    blobs.push({
      x: coreX + Math.cos(angle) * dist,
      y: coreY + Math.sin(angle) * dist * 0.7, // slightly flattened
      rx: W * (0.06 + rand() * 0.06),
      ry: H * (0.04 + rand() * 0.05),
      warmth: 0.85 + rand() * 0.15,
      opacity: 0.5 + rand() * 0.35,
      attached: true,
      fallOffset: 0,
      driftX: 0,
    })
  }

  // Peripheral blobs: medium, slightly cooler, spread wider
  const periCount = 6 + Math.floor(rand() * 4)
  for (let i = 0; i < periCount; i++) {
    const angle = rand() * Math.PI * 2
    const dist = W * (0.10 + rand() * 0.12)
    blobs.push({
      x: coreX + Math.cos(angle) * dist,
      y: coreY + Math.sin(angle) * dist * 0.8,
      rx: W * (0.03 + rand() * 0.04),
      ry: H * (0.025 + rand() * 0.035),
      warmth: 0.55 + rand() * 0.25,
      opacity: 0.3 + rand() * 0.25,
      attached: true,
      fallOffset: 0,
      driftX: 0,
    })
  }

  // Detaching blobs: below the core, falling
  // These are the pieces that have already separated
  const detachCount = 8 + Math.floor(rand() * 5)
  for (let i = 0; i < detachCount; i++) {
    const progress = (i + 1) / detachCount // 0 = just detached, 1 = far gone
    const originAngle = (rand() * 0.8 + 0.1) * Math.PI // mostly downward (π/2 ± range)
    const originDist = W * (0.05 + rand() * 0.12)
    const baseX = coreX + Math.cos(originAngle) * originDist
    const baseY = coreY + Math.sin(originAngle) * originDist

    // Fall distance increases with progress
    const fallDist = progress * H * (0.20 + rand() * 0.15)
    // Drift rightward slightly (entropy, asymmetry)
    const drift = progress * W * (0.02 + rand() * 0.06) * (rand() > 0.3 ? 1 : -0.5)

    // Size decreases with distance
    const sizeFactor = Math.max(0.15, 1.0 - progress * 0.7)
    // Warmth drains
    const warmthFactor = Math.max(0, 0.7 - progress * 0.65)
    // Opacity fades
    const opacityFactor = Math.max(0.06, 0.45 - progress * 0.35)

    blobs.push({
      x: baseX,
      y: baseY,
      rx: W * (0.02 + rand() * 0.025) * sizeFactor,
      ry: H * (0.015 + rand() * 0.02) * sizeFactor,
      warmth: warmthFactor,
      opacity: opacityFactor,
      attached: false,
      fallOffset: fallDist,
      driftX: drift,
    })
  }

  console.log(`  Blobs: ${coreCount} core, ${periCount} peripheral, ${detachCount} detaching`)

  // === Build ink map ===
  const inkMap = new Float32Array(W * H)
  const warmthMap = new Float32Array(W * H)

  for (const blob of blobs) {
    // Actual position (including fall offset for detached pieces)
    const bx = blob.x + blob.driftX
    const by = blob.y + blob.fallOffset

    const margin = Math.max(blob.rx, blob.ry) * 2.5
    const minX = Math.max(0, Math.floor(bx - margin))
    const maxX = Math.min(W - 1, Math.ceil(bx + margin))
    const minY = Math.max(0, Math.floor(by - margin))
    const maxY = Math.min(H - 1, Math.ceil(by + margin))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        // Elliptical distance with edge distortion
        const dx = (x - bx) / blob.rx
        const dy = (y - by) / blob.ry
        let dist = Math.sqrt(dx * dx + dy * dy)

        // Organic edge distortion
        dist += edgeNoise(x, y) * 0.15 + edgeNoise2(x, y) * 0.10

        if (dist > 1.2) continue

        // Soft falloff
        const falloff = Math.max(0, 1.0 - dist)
        let ink = falloff * falloff * blob.opacity

        // Dissolution: attached blobs dissolve at their bottom edges
        if (blob.attached) {
          const blobBottomDist = (y - by) / blob.ry // positive = below center
          if (blobBottomDist > 0.3) {
            const dissT = (blobBottomDist - 0.3) / 0.7
            const dissNoise = dissolveNoise(x, y) * 0.5 + 0.5
            if (dissNoise < dissT * 0.8) {
              ink *= 0.1 // mostly dissolved
            }
          }
        }

        if (ink < 0.002) continue

        const idx = y * W + x

        // Vein structure: ridge noise creates internal veins
        const v1 = Math.abs(veinNoise1(x, y)) // ridge = abs(noise)
        const v2 = Math.abs(veinNoise2(x, y))
        const v3 = Math.abs(veinNoise3(x, y))
        const vein = v1 * 0.4 + v2 * 0.3 + v3 * 0.3

        // Veins are darker (more ink) and slightly warmer
        const veinBoost = Math.max(0, 1.0 - vein * 3.0) // vein at ridges (where noise ≈ 0)
        const veinInk = ink * (1.0 + veinBoost * 0.8)

        // Warmth: warm at core, cooling at edges
        const warmth = blob.warmth * falloff * (1.0 + veinBoost * 0.15)

        // Accumulate (max blending for warmth, additive for ink)
        inkMap[idx] = Math.min(1.0, inkMap[idx] + veinInk * 0.5)
        warmthMap[idx] = Math.max(warmthMap[idx], warmth)
      }
    }
  }

  // === Drip trails from detaching blobs ===
  const dripNoise = makeNoise(seed + 500, 18)
  let dripCount = 0

  for (const blob of blobs) {
    if (blob.attached || blob.fallOffset < H * 0.03) continue
    if (rand() > 0.6) continue // not all detaching pieces leave drips

    dripCount++
    const startX = blob.x + blob.driftX
    const startY = blob.y // start from original position
    const endY = blob.y + blob.fallOffset
    const dripWidth = 1.5 + rand() * 2.5
    const dripOpacity = 0.08 + rand() * 0.12

    let dx = startX
    const steps = Math.ceil((endY - startY) / 2)
    for (let i = 0; i < steps; i++) {
      const t = i / steps
      const dy = startY + t * (endY - startY)
      dx += dripNoise(dx, dy) * 0.8
      // Drift toward blob's final position
      dx += (blob.x + blob.driftX - dx) * 0.001

      const w = dripWidth * (0.3 + (1 - t) * 0.7)
      const opacity = dripOpacity * (1.0 - t * t * 0.7)

      if (w < 0.3 || opacity < 0.005) break

      const margin = Math.ceil(w + 1)
      for (let py = Math.max(0, Math.floor(dy - margin)); py < Math.min(H, Math.ceil(dy + margin)); py++) {
        for (let px = Math.max(0, Math.floor(dx - margin)); px < Math.min(W, Math.ceil(dx + margin)); px++) {
          const dd = Math.sqrt((px - dx) ** 2 + (py - dy) ** 2)
          if (dd < w) {
            const falloff = 1.0 - dd / w
            const ink = falloff * opacity
            const idx = py * W + px
            inkMap[idx] = Math.min(1.0, inkMap[idx] + ink * 0.3)
            if (ink > 0.005 && warmthMap[idx] < 0.08) warmthMap[idx] = 0.08
          }
        }
      }
    }
  }

  console.log(`  ${dripCount} drip trails`)
  console.log("  Rendering pixels...")

  // === Render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkMap[idx]
      const warmth = warmthMap[idx]

      // Background: warm cream, cooling slightly toward bottom
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5
      const vertFade = y / H

      let bgR = 232 + bn * 8 - vertFade * 10
      let bgG = 224 + bn * 6 - vertFade * 14
      let bgB = 216 + bn * 5 - vertFade * 8

      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Warm amber ink → cold grey-brown
      const warmR = 155, warmG = 78, warmB = 35    // deep warm amber
      const coldR = 115, coldG = 108, coldB = 105  // cool grey
      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.4)
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

  const filename = `output/sadness-v24-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
