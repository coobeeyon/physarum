/**
 * SADNESS v13 — FADING EMBER
 *
 * v12's RD pattern was too recognizable as an algorithm.
 * This version uses layered noise to create organic texture
 * that reads as "something alive" without reading as "Gray-Scott simulation."
 *
 * The concept: an ember in ash. Something that was burning,
 * now barely glowing. Surrounded by what it will become.
 *
 * The texture comes from multi-octave noise shaped into
 * vein-like/organic forms through thresholding and layering.
 * The warmth gradient maps from amber (alive) to the background grey (gone).
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

// Multi-octave fractal noise
function fbm(x: number, y: number, noises: Array<(px: number, py: number) => number>, weights: number[]): number {
  let sum = 0
  for (let i = 0; i < noises.length; i++) {
    sum += noises[i](x, y) * weights[i]
  }
  return sum
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 44401, b: 44402, c: 44403 }
  const seed = seeds[variant] ?? 44401
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v13 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers for organic texture
  const n1 = makeNoise(seed, 200)      // large flow
  const n2 = makeNoise(seed + 10, 80)  // medium structure
  const n3 = makeNoise(seed + 20, 35)  // fine veins
  const n4 = makeNoise(seed + 30, 15)  // very fine detail
  const n5 = makeNoise(seed + 40, 500) // very large atmospheric
  const n6 = makeNoise(seed + 50, 120) // mask variation

  // Background noise
  const bgN1 = makeNoise(seed + 100, 400)
  const bgN2 = makeNoise(seed + 110, 150)
  const bgN3 = makeNoise(seed + 120, 50)

  // Island definition (same concept as v12 — one form, alone)
  const islandX = W * 0.38
  const islandY = H * 0.63
  const islandR = W * 0.26  // larger — needs to read on phone screens

  // Ghost position
  const ghostX = W * 0.74
  const ghostY = H * 0.28
  const ghostR = W * 0.05

  // Edge noise for organic island boundary
  const edgeN1 = makeNoise(seed + 200, 70)
  const edgeN2 = makeNoise(seed + 210, 30)
  const edgeN3 = makeNoise(seed + 220, 150)

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background noise
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bn3 = bgN3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.45 + bn2 * 0.35 + bn3 * 0.20

      // Background: heavy dark warm grey
      // Darker at top (weight), warmer at bottom (remnant)
      const topWeight = yNorm * yNorm
      let bgR = 65 + bn * 14 + topWeight * 18
      let bgG = 61 + bn * 11 + topWeight * 8
      let bgB = 58 + bn * 8 + topWeight * 2

      // Atmospheric variation — subtle lighter/darker patches
      const atm = n5(x, y) * 0.5 + 0.5
      bgR += (atm - 0.5) * 12
      bgG += (atm - 0.5) * 10
      bgB += (atm - 0.5) * 8

      // === Island mask ===
      const dx = x - islandX
      const dy = y - islandY
      // Elongate downward — sadness sinks
      const yWeight = dy > 0 ? 0.80 : 1.15
      const dist = Math.sqrt(dx * dx + (dy * yWeight) ** 2)

      // Multi-scale noise for organic boundary
      const edgeNoise = edgeN3(x, y) * 0.20 + edgeN1(x, y) * 0.45 + edgeN2(x, y) * 0.35
      const effectiveR = islandR * (1.0 + edgeNoise * 1.2)

      let islandMask = 0
      if (dist < effectiveR) {
        const t = dist / effectiveR
        // Smooth cubic fade
        if (t < 0.10) {
          islandMask = 1.0
        } else {
          islandMask = Math.pow(1.0 - (t - 0.10) / 0.90, 3.0)
        }
      }

      // Ghost mask (very faint)
      const gdx = x - ghostX
      const gdy = y - ghostY
      const gDist = Math.sqrt(gdx * gdx + gdy * gdy)
      const gEffR = ghostR * (1.0 + edgeN1(x, y) * 0.8)
      let ghostMask = 0
      if (gDist < gEffR) {
        const gt = gDist / gEffR
        ghostMask = Math.pow(1.0 - gt, 2.5) * 0.12
      }

      const mask = Math.min(1.0, islandMask + ghostMask)

      if (mask > 0.01) {
        // === Organic texture within the island ===
        // Layer multiple noise scales to create vein-like/organic patterns
        // NOT reaction-diffusion — just shaped noise

        // Base texture: medium-scale organic forms
        const tex1 = n2(x, y) * 0.5 + 0.5  // 0-1
        const tex2 = n3(x, y)               // -0.5 to 0.5
        const tex3 = n4(x, y)

        // Create vein-like patterns through ridge noise (abs of noise)
        const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
        const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
        const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0

        // Combined texture — veins plus smooth base
        const texture = (
          ridge1 * 0.35 +
          ridge2 * 0.30 +
          ridge3 * 0.15 +
          tex1 * 0.20
        )
        const texClamped = Math.max(0, Math.min(1, texture))

        // Warmth: peaks at island center, dies at edges
        const warmth = islandMask * islandMask  // quadratic falloff
        const textureVisible = texClamped * mask * 0.85

        // Color: background grey → warm amber
        // At the edges, the fragment is barely distinguishable
        // At the core, you see warm amber veins in darker amber matrix
        const liftAmount = textureVisible * 0.60   // brighter core
        const warmthColor = warmth * textureVisible

        let r = bgR + liftAmount * 130 + warmthColor * 60
        let g = bgG + liftAmount * 65 + warmthColor * 15
        let b = bgB + liftAmount * 20 - warmthColor * 18

        // The veins themselves: brighter and warmer
        if (texClamped > 0.50 && mask > 0.15) {
          const veinStrength = (texClamped - 0.50) / 0.50 * mask * warmth
          r += veinStrength * 40
          g += veinStrength * 12
          b -= veinStrength * 8
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

  const filename = `output/sadness-v13-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
