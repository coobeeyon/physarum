/**
 * SADNESS v20 — FADED PHOTOGRAPH
 *
 * Every previous sadness attempt had the wrong palette.
 * Orange-amber reads as fire/rust — a physical material, not emotion.
 *
 * New approach: a warm texture fills the canvas but it's DESATURATED.
 * Like a faded photograph. The colors that should be vivid are washed
 * out to grey-rose, grey-gold. The whole image whispers "this used to
 * be more."
 *
 * Except: one small area still holds its color. Not bright — just
 * noticeably more vivid than everything around it. The last holdout.
 * The juxtaposition between "what it should be" and "what it's becoming"
 * IS the sadness.
 *
 * The viewer sees: everything fading. One spot holding on.
 *
 * Color palette:
 * - Base warmth: muted rose-gold (not aggressive orange)
 * - Faded state: grey with rose undertone (not cold blue)
 * - The fading is WARM grey, not cold — you can still feel what was there
 * - The holdout area: slightly more saturated rose-gold
 *
 * Composition:
 * - Full canvas texture — no isolated blob, no blank areas
 * - The holdout is in the lower-left third (offset, not centered)
 * - The fading is strongest at the edges and top-right
 * - The texture is the same everywhere — only the saturation changes
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
  const seeds: Record<string, number> = { a: 88801, b: 88802, c: 88803, d: 88804 }
  const seed = seeds[variant] ?? 88801
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v20 variant ${variant} (seed: ${seed}) ===`)

  // Texture noise
  const n1 = makeNoise(seed, 250)
  const n2 = makeNoise(seed + 10, 100)
  const n3 = makeNoise(seed + 20, 45)
  const n4 = makeNoise(seed + 30, 18)
  const n5 = makeNoise(seed + 40, 600)

  // Saturation field noise — where the fading happens
  const fadeN1 = makeNoise(seed + 100, 300)
  const fadeN2 = makeNoise(seed + 110, 130)
  const fadeN3 = makeNoise(seed + 120, 55)

  // Holdout: where the last color survives
  const holdoutX = W * (0.28 + rand() * 0.12)
  const holdoutY = H * (0.58 + rand() * 0.12)
  const holdoutRx = W * (0.12 + rand() * 0.06)
  const holdoutRy = H * (0.14 + rand() * 0.06)

  console.log("  Computing texture and saturation field...")

  // Base texture: organic, full-canvas
  const warmTexture = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
      const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
      const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
      const base = n1(x, y) * 0.5 + 0.5
      const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + base * 0.20
      warmTexture[y * W + x] = Math.max(0, Math.min(1, texture))
    }
  }

  // Saturation field: 0 = fully faded (grey), 1 = full color
  const satField = new Float32Array(W * H)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const xNorm = x / W

      // Distance from holdout center (elliptical)
      const hdx = (x - holdoutX) / holdoutRx
      const hdy = (y - holdoutY) / holdoutRy
      const holdoutDist = Math.sqrt(hdx * hdx + hdy * hdy)

      // Noise modulation for organic fading pattern
      const fadeNoise =
        fadeN1(x, y) * 0.35 +
        fadeN2(x, y) * 0.35 +
        fadeN3(x, y) * 0.30

      // Base saturation: mostly low (faded), with holdout region higher
      let saturation: number

      if (holdoutDist < 1.0) {
        // Inside holdout: reasonable saturation (not FULL — even the holdout is fading)
        const coreness = 1.0 - holdoutDist
        saturation = 0.45 + coreness * 0.40 + fadeNoise * 0.10
      } else if (holdoutDist < 2.5) {
        // Transition: fading from holdout into the grey
        const transT = (holdoutDist - 1.0) / 1.5
        const baseVal = 0.45 * (1.0 - transT * transT)
        saturation = baseVal + fadeNoise * 0.08
      } else {
        // Far from holdout: mostly faded but with noise variation
        // Some areas slightly more saturated than others (uneven fading)
        saturation = 0.06 + Math.max(0, fadeNoise * 0.10 + 0.02)
      }

      // Edges fade more (the photograph curls and fades at edges)
      const edgeFade = Math.min(
        xNorm / 0.10, (1.0 - xNorm) / 0.10,
        yNorm / 0.08, (1.0 - yNorm) / 0.08,
        1.0
      )
      saturation *= edgeFade

      // Top-right fades the most (directional, like light damage)
      const cornerDist = Math.sqrt(
        Math.pow(Math.max(0, xNorm - 0.5) * 2, 2) +
        Math.pow(Math.max(0, 0.5 - yNorm) * 2, 2)
      )
      if (cornerDist > 0.3) {
        saturation *= Math.max(0.3, 1.0 - (cornerDist - 0.3) * 0.8)
      }

      satField[y * W + x] = Math.max(0, Math.min(1.0, saturation))
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const warmth = warmTexture[idx]
      const sat = satField[idx]
      const atm = n5(x, y) * 0.5 + 0.5

      // === Full-color version: muted rose-gold ===
      // NOT aggressive orange — softer, more emotional
      let fullR = 175 + warmth * 40 + atm * 8
      let fullG = 120 + warmth * 20 + atm * 5
      let fullB = 95 + warmth * 10 + atm * 3  // more blue than before = rose, not orange

      // Subtle veins
      if (warmth > 0.50) {
        const veinT = (warmth - 0.50) / 0.50
        fullR += veinT * 25
        fullG += veinT * 8
        fullB += veinT * 3  // veins are warmer but still rose-tinted
      }

      // === Faded version: warm grey with rose undertone ===
      // NOT cold blue-grey — warm grey, you can feel what was there
      const greyBase = 118 + warmth * 18 + atm * 5
      let fadedR = greyBase + 8   // slightly rosier than neutral
      let fadedG = greyBase - 2   // slightly less green
      let fadedB = greyBase + 2   // barely cool

      // The faded version still shows the texture — it's not blank
      // But the texture is muted, ghostly
      if (warmth > 0.55) {
        const ghostVein = (warmth - 0.55) / 0.45
        fadedR += ghostVein * 8
        fadedG += ghostVein * 3
      }

      // === Blend based on saturation field ===
      // sat = 0: fully faded. sat = 1: full color
      // The blend should feel like desaturation, not a curtain being drawn

      // Approach: blend between full-color and faded versions
      // But use a curve so the transition emphasizes the "losing color" zone
      const blendT = sat * sat  // quadratic: most of the image is in the low-sat zone

      const r = fadedR * (1 - blendT) + fullR * blendT
      const g = fadedG * (1 - blendT) + fullG * blendT
      const b = fadedB * (1 - blendT) + fullB * blendT

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

  const filename = `output/sadness-v20-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
