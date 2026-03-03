/**
 * SADNESS v17 — SIMPLE DISSOLUTION
 *
 * Everything complex (tendrils, particles, drips) added visual interest
 * but subtracted emotional clarity. Rothko works because it's SIMPLE.
 *
 * This version:
 * - ONE warm form. No tendrils. No drips. No particles.
 * - The form sits in the lower third, slightly left of center
 * - EXTREMELY gradual dissolution boundary — the form fades into
 *   the dark background so slowly that you can't tell where it ends
 * - The warm core is BRIGHT enough to be unmistakable on a phone
 * - The boundary uses multi-scale noise so it's organic, not geometric
 * - Vast dark space above and around — the emptiness IS the sadness
 * - One ghost trace far away — a memory
 * - The background has very subtle warm-to-cold gradient (warmer near
 *   the form, as if the form's presence once heated the space around it)
 *
 * The viewer should feel: something alive, alone, fading.
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
  const seeds: Record<string, number> = { a: 55801, b: 55802, c: 55803 }
  const seed = seeds[variant] ?? 55801
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v17 variant ${variant} (seed: ${seed}) ===`)

  // Noise at many scales for the dissolution boundary
  const n1 = makeNoise(seed, 250)      // large flow
  const n2 = makeNoise(seed + 10, 100) // medium structure
  const n3 = makeNoise(seed + 20, 45)  // detail
  const n4 = makeNoise(seed + 30, 18)  // fine detail
  const n5 = makeNoise(seed + 40, 600) // atmospheric
  const n6 = makeNoise(seed + 50, 8)   // micro texture

  // Background noise
  const bgN1 = makeNoise(seed + 100, 500)
  const bgN2 = makeNoise(seed + 110, 180)
  const bgN3 = makeNoise(seed + 120, 60)

  // Edge dissolution noise — the key to organic boundaries
  const edgeN1 = makeNoise(seed + 200, 80)
  const edgeN2 = makeNoise(seed + 210, 35)
  const edgeN3 = makeNoise(seed + 220, 180)
  const edgeN4 = makeNoise(seed + 230, 12)  // very fine edge detail

  // Form: lower-left area, vertically elongated
  const formX = W * (0.36 + rand() * 0.06)
  const formY = H * (0.62 + rand() * 0.05)
  const formRx = W * 0.16   // horizontal
  const formRy = W * 0.22   // vertical (elongated, pulled down)

  // Ghost: upper right, barely visible
  const ghostX = W * (0.73 + rand() * 0.10)
  const ghostY = H * (0.18 + rand() * 0.08)
  const ghostR = W * 0.03

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Distance from main form
      const fdx = (x - formX) / formRx
      const fdy = (y - formY) / formRy
      // Weight downward — the form sinks
      const yAdjust = fdy > 0 ? fdy * 0.85 : fdy * 1.1
      const formDist = Math.sqrt(fdx * fdx + yAdjust * yAdjust)

      // === Background ===
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bn3 = bgN3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.45 + bn2 * 0.35 + bn3 * 0.20

      // Background gets VERY subtly warmer near the form — as if the form
      // once heated the space around it (memory of warmth)
      const distToForm = Math.sqrt((x - formX) ** 2 + (y - formY) ** 2)
      const proximityWarmth = Math.max(0, 1.0 - distToForm / (W * 0.5))
      const warmInfluence = proximityWarmth * proximityWarmth * 0.08  // very subtle

      const topWeight = yNorm * yNorm
      let bgR = 55 + bn * 14 + topWeight * 18 + warmInfluence * 30
      let bgG = 51 + bn * 11 + topWeight * 8 + warmInfluence * 15
      let bgB = 50 + bn * 8 + topWeight * 2

      const atm = n5(x, y) * 0.5 + 0.5
      bgR += (atm - 0.5) * 10
      bgG += (atm - 0.5) * 8
      bgB += (atm - 0.5) * 6

      // === Form mask — EXTREMELY gradual dissolution ===
      // Multi-scale noise creates organic, irregular boundary
      const edgeNoise =
        edgeN3(x, y) * 0.22 +
        edgeN1(x, y) * 0.38 +
        edgeN2(x, y) * 0.28 +
        edgeN4(x, y) * 0.12

      // The effective boundary varies dramatically with noise
      const effectiveEdge = 1.0 + edgeNoise * 1.3

      let formMask = 0
      if (formDist < effectiveEdge * 2.0) {
        if (formDist < effectiveEdge * 0.3) {
          // Deep core — nearly full
          formMask = 0.95 + edgeN4(x, y) * 0.05
        } else if (formDist < effectiveEdge * 0.6) {
          // Inner zone — strong but starting to vary
          const t = (formDist - effectiveEdge * 0.3) / (effectiveEdge * 0.3)
          formMask = 0.95 * Math.pow(1.0 - t, 1.5) + 0.40 * t * (1 - t) * 4
        } else if (formDist < effectiveEdge) {
          // Outer zone — fading
          const t = (formDist - effectiveEdge * 0.6) / (effectiveEdge * 0.4)
          formMask = 0.40 * Math.pow(1.0 - t, 2.5)
        } else {
          // Beyond edge — wisps and traces
          const t = (formDist - effectiveEdge) / (effectiveEdge * 1.0)
          formMask = 0.08 * Math.pow(Math.max(0, 1.0 - t), 3.0)
        }
      }

      // === Ghost mask ===
      const gdx = x - ghostX
      const gdy = y - ghostY
      const gDist = Math.sqrt(gdx * gdx + gdy * gdy)
      const gEffR = ghostR * (1.0 + edgeN1(x, y) * 0.8)
      let ghostMask = 0
      if (gDist < gEffR) {
        ghostMask = Math.pow(1.0 - gDist / gEffR, 2.5) * 0.10
      }

      const totalMask = Math.min(1.0, formMask + ghostMask)

      if (totalMask > 0.005) {
        // Organic texture within the form
        const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
        const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
        const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
        const tex1 = n2(x, y) * 0.5 + 0.5

        const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + tex1 * 0.20
        const texClamped = Math.max(0, Math.min(1, texture))

        // Texture visibility scales with mask — invisible at edges
        const textureVisible = texClamped * totalMask * 0.90

        // Warmth: peaks at core, dies at edges
        // The warmth IS the life that's fading
        const warmth = formMask * formMask * 0.95  // quadratic = concentrates at core

        const liftAmount = textureVisible * 0.72
        const warmthColor = warmth * textureVisible

        let r = bgR + liftAmount * 140 + warmthColor * 70
        let g = bgG + liftAmount * 65 + warmthColor * 18
        let b = bgB + liftAmount * 16 - warmthColor * 25

        // Veins at core
        if (texClamped > 0.48 && totalMask > 0.15) {
          const veinStrength = (texClamped - 0.48) / 0.52 * totalMask * warmth
          r += veinStrength * 40
          g += veinStrength * 10
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

  const filename = `output/sadness-v17-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
