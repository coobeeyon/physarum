/**
 * SADNESS v25 — WORLD DISSOLVING
 *
 * v23/v24 failed because the form was too small. A tiny dissolving blob
 * in a big canvas reads as a stain, not as loss. Real sadness art
 * (Rothko, late Monet) creates overwhelming fields that the viewer is
 * enveloped in — then the dissolution happens to EVERYTHING, not to
 * a small object.
 *
 * New concept: the warm color FILLS most of the upper canvas. Rich,
 * veined, organic, alive — like looking at a warm body of water or
 * a living membrane. Then, below a ragged dissolution edge that
 * crosses the canvas roughly horizontally, the warmth is disintegrating.
 * Fragments break off. Color drains from warm amber to cold grey.
 * The bottom of the canvas is empty.
 *
 * The viewer is inside the warm field — and then it starts to end.
 *
 * The dissolution edge isn't a clean line. It's ragged, organic —
 * peninsulas of warmth reaching down, bays of emptiness cutting up.
 * Some fragments have already detached and are falling.
 *
 * The warm area has internal texture: veins (ridge noise), warmth
 * variation, subtle color shifts. It's complex and alive. The
 * dissolution strips this away — the grey fragments below have
 * lost their internal structure.
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

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 25001, b: 25002, c: 25003, d: 25004 }
  const seed = seeds[variant] ?? 25001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v25 variant ${variant} (seed: ${seed}) ===`)

  // Background texture
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)

  // Vein structure inside the warm body
  const veinNoise1 = makeNoise(seed + 200, 30)
  const veinNoise2 = makeNoise(seed + 210, 15)
  const veinNoise3 = makeNoise(seed + 220, 55)

  // Warmth variation within the body
  const warmVar1 = makeNoise(seed + 250, 200)
  const warmVar2 = makeNoise(seed + 260, 80)

  // Dissolution edge shape (large-scale warp)
  const edgeShape1 = makeNoise(seed + 300, 250)
  const edgeShape2 = makeNoise(seed + 310, 100)
  const edgeShape3 = makeNoise(seed + 320, 45)

  // Small-scale dissolution noise
  const dissNoise1 = makeNoise(seed + 400, 40)
  const dissNoise2 = makeNoise(seed + 410, 16)

  // Fragment noise
  const fragNoise = makeNoise(seed + 500, 25)

  // === Dissolution edge: where intact body meets dissolution ===
  // Base line roughly at 45% down the canvas, warped by noise
  const baseEdgeY = H * (0.40 + rand() * 0.08)
  console.log(`  Dissolution edge at ~${Math.round(baseEdgeY)}`)

  // === Build pixel data ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  // Pre-compute the dissolution edge for each column
  // This is where the warm body ends and dissolution begins
  const edgeY = new Float32Array(W)
  for (let x = 0; x < W; x++) {
    // Large warp creates peninsulas and bays
    const warp1 = edgeShape1(x, baseEdgeY) * H * 0.12
    const warp2 = edgeShape2(x, baseEdgeY) * H * 0.06
    const warp3 = edgeShape3(x, baseEdgeY) * H * 0.03
    edgeY[x] = baseEdgeY + warp1 + warp2 + warp3
  }

  // Pre-compute falling fragments
  // These are blobs that exist below the dissolution edge
  interface Fragment {
    x: number; y: number
    size: number
    warmth: number
    opacity: number
  }
  const fragments: Fragment[] = []
  const numFragments = 12 + Math.floor(rand() * 8)

  for (let i = 0; i < numFragments; i++) {
    const fx = rand() * W
    const localEdge = edgeY[Math.min(W - 1, Math.max(0, Math.round(fx)))]
    // Fragments below the edge, scattered downward
    const fallProgress = rand()
    const fy = localEdge + H * 0.04 + fallProgress * H * 0.35
    // Smaller and fainter as they fall further
    const sizeFactor = Math.max(0.1, 1.0 - fallProgress * 0.8)
    const size = (15 + rand() * 40) * sizeFactor
    const warmth = Math.max(0, 0.6 - fallProgress * 0.7)
    const opacity = Math.max(0.03, 0.35 - fallProgress * 0.3)

    fragments.push({ x: fx, y: fy, size, warmth, opacity })
  }

  // Drip trails
  interface Drip { x: number; startY: number; endY: number; width: number; opacity: number }
  const drips: Drip[] = []
  const numDrips = 5 + Math.floor(rand() * 5)
  for (let i = 0; i < numDrips; i++) {
    const dx = W * (0.1 + rand() * 0.8)
    const localEdge = edgeY[Math.min(W - 1, Math.max(0, Math.round(dx)))]
    drips.push({
      x: dx,
      startY: localEdge - H * 0.02,
      endY: localEdge + H * (0.05 + rand() * 0.20),
      width: 1.2 + rand() * 2.5,
      opacity: 0.06 + rand() * 0.10
    })
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips`)
  console.log("  Rendering...")

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background paper texture
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5

      // Background color: warm cream that cools toward bottom
      const vertFade = y / H
      let bgR = 235 + bn * 6 - vertFade * 12
      let bgG = 227 + bn * 5 - vertFade * 16
      let bgB = 218 + bn * 4 - vertFade * 10

      // Get the dissolution edge for this x position
      const localEdge = edgeY[x]

      // How far above/below the dissolution edge (positive = below = dissolving)
      const edgeDist = (y - localEdge) / H

      // === Determine what's here ===
      let ink = 0
      let warmth = 0

      if (edgeDist < -0.02) {
        // === ABOVE the edge: intact warm body ===
        // How far above the edge (0 = at edge, large = deep in body)
        const depth = Math.min(1.0, -edgeDist * 8)

        // Base ink density — thick in the body
        ink = 0.4 + depth * 0.35

        // Vein structure: ridge noise (abs of Perlin) creates veins
        const v1 = Math.abs(veinNoise1(x, y))
        const v2 = Math.abs(veinNoise2(x, y))
        const v3 = Math.abs(veinNoise3(x, y))
        const vein = v1 * 0.4 + v2 * 0.35 + v3 * 0.25

        // At ridges (where noise ≈ 0), veins are dark and warm
        const veinStrength = Math.max(0, 1.0 - vein * 3.5)
        ink += veinStrength * 0.25
        ink = Math.min(1.0, ink)

        // Warmth: deep body is warm, veins are warmer
        const wv1 = warmVar1(x, y) * 0.5 + 0.5
        const wv2 = warmVar2(x, y) * 0.5 + 0.5
        warmth = 0.65 + depth * 0.2 + wv1 * 0.08 + wv2 * 0.05
        warmth += veinStrength * 0.1
        warmth = Math.min(1.0, warmth)

        // Near the edge: warmth starts to drain, ink gets patchy
        if (depth < 0.3) {
          const edgeProximity = 1.0 - depth / 0.3
          warmth *= 1.0 - edgeProximity * 0.4
          // Dissolution starts eating at the edge
          const dn1 = dissNoise1(x, y) * 0.5 + 0.5
          const dn2 = dissNoise2(x, y) * 0.5 + 0.5
          const dissStrength = edgeProximity * (dn1 * 0.6 + dn2 * 0.4)
          if (dissStrength > 0.5) {
            ink *= Math.max(0.05, 1.0 - (dissStrength - 0.5) * 2.5)
            warmth *= Math.max(0, 1.0 - (dissStrength - 0.5) * 3.0)
          }
        }

      } else if (edgeDist < 0.08) {
        // === AT the dissolution edge: ragged transition ===
        const transT = edgeDist / 0.08 // 0 = at edge, 1 = into void

        // Dissolution noise determines what survives
        const dn1 = dissNoise1(x, y) * 0.5 + 0.5
        const dn2 = dissNoise2(x, y) * 0.5 + 0.5
        const survivalNoise = dn1 * 0.6 + dn2 * 0.4

        // Some areas survive further than others (creating ragged edge)
        if (survivalNoise > transT * 1.2) {
          ink = 0.2 + (1.0 - transT) * 0.3
          warmth = Math.max(0, 0.4 * (1.0 - transT * 1.5))

          // Veins visible but fading
          const v1 = Math.abs(veinNoise1(x, y))
          const veinStrength = Math.max(0, 1.0 - v1 * 4.0)
          ink += veinStrength * 0.1 * (1.0 - transT)
        }

      } else {
        // === BELOW the edge: fragments and emptiness ===
        // Check if we're inside any fragment
        for (const frag of fragments) {
          const fdx = x - frag.x, fdy = y - frag.y
          const fdist = Math.sqrt(fdx * fdx + fdy * fdy)
          // Fragment shape distortion
          const fn = fragNoise(x, y) * 0.3
          const effDist = fdist / frag.size + fn

          if (effDist < 1.0) {
            const falloff = 1.0 - effDist
            const fragInk = falloff * falloff * frag.opacity
            const fragWarmth = frag.warmth * falloff

            if (fragInk > ink) {
              ink = fragInk
              warmth = fragWarmth
            }
          }
        }

        // Check drips
        for (const drip of drips) {
          if (y < drip.startY || y > drip.endY) continue
          const dripT = (y - drip.startY) / (drip.endY - drip.startY)
          // Drip wanders slightly
          const dripWander = makeNoise(seed + Math.floor(drip.x * 7), 18)(drip.x, y) * 3
          const dripDx = Math.abs(x - drip.x - dripWander)
          const dripW = drip.width * (1.0 - dripT * 0.6)

          if (dripDx < dripW) {
            const dripInk = (1.0 - dripDx / dripW) * drip.opacity * (1.0 - dripT * dripT)
            ink = Math.min(1.0, ink + dripInk * 0.3)
            // Drips are cold
          }
        }
      }

      // === Final color ===
      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Warm amber → cold grey
      const warmR = 160, warmG = 82, warmB = 38
      const coldR = 118, coldG = 112, coldB = 108
      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.3)
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

  const filename = `output/sadness-v25-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
