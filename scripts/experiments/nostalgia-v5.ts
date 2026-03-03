/**
 * NOSTALGIA v5 — SHADOW CURVES
 *
 * Close-up: a warm stucco wall with the shadow of wrought iron curves
 * falling across it. Not a full railing — just enough curved shadow
 * to suggest iron scrollwork. The shadow bisects the wall diagonally,
 * with golden light on one side and cool shadow on the other.
 *
 * The image is mostly warm wall. The shadow curves are the event.
 * A few large flowing S-curves, stretches, spirals — the shadow
 * of something ornate you can't fully see.
 *
 * The warmth comes from the golden-lit wall.
 * The nostalgia comes from the softness of the shadow.
 * The place comes from the iron curve pattern.
 */

import { createCanvas, type CanvasRenderingContext2D } from "canvas"
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

function makeFBM(seed: number, baseScale: number, octaves: number) {
  const noises = Array.from({ length: octaves }, (_, i) =>
    makeNoise(seed + i * 77, baseScale / (2 ** i))
  )
  return (x: number, y: number): number => {
    let val = 0, amp = 1, totalAmp = 0
    for (let i = 0; i < octaves; i++) {
      val += noises[i](x, y) * amp
      totalAmp += amp
      amp *= 0.5
    }
    return val / totalAmp
  }
}

function gaussianBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  let current = new Float32Array(src)
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      let sum = 0, count = 0
      for (let x = 0; x < Math.min(radius, w); x++) { sum += current[y * w + x]; count++ }
      for (let x = 0; x < w; x++) {
        if (x + radius < w) { sum += current[y * w + x + radius]; count++ }
        if (x - radius - 1 >= 0) { sum -= current[y * w + x - radius - 1]; count-- }
        next[y * w + x] = sum / count
      }
    }
    const next2 = new Float32Array(w * h)
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let y = 0; y < Math.min(radius, h); y++) { sum += next[y * w + x]; count++ }
      for (let y = 0; y < h; y++) {
        if (y + radius < h) { sum += next[(y + radius) * w + x]; count++ }
        if (y - radius - 1 >= 0) { sum -= next[(y - radius - 1) * w + x]; count-- }
        next2[y * w + x] = sum / count
      }
    }
    current = next2
  }
  return current
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 85001, b: 85002, c: 85003, d: 85004 }
  const seed = seeds[variant] ?? 85001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v5 variant ${variant} (seed: ${seed}) ===`)

  // === Generate shadow mask ===
  console.log("  Drawing iron shadow curves...")
  const shadowCanvas = createCanvas(W, H)
  const sctx = shadowCanvas.getContext("2d")

  // White = light
  sctx.fillStyle = "white"
  sctx.fillRect(0, 0, W, H)

  sctx.strokeStyle = "black"
  sctx.lineCap = "round"
  sctx.lineJoin = "round"

  // The shadow falls from upper-right to lower-left
  // Two thick horizontal rail shadows crossing diagonally
  sctx.save()

  // Slight rotation for the diagonal shadow angle
  const shadowAngle = -0.12  // Slight tilt
  sctx.translate(W * 0.5, H * 0.5)
  sctx.rotate(shadowAngle)
  sctx.translate(-W * 0.5, -H * 0.5)

  // Two horizontal rail shadows
  const rail1Y = H * 0.28
  const rail2Y = H * 0.72
  const railThickness = 28

  sctx.lineWidth = railThickness
  sctx.beginPath()
  sctx.moveTo(-100, rail1Y)
  sctx.lineTo(W + 100, rail1Y)
  sctx.stroke()

  sctx.beginPath()
  sctx.moveTo(-100, rail2Y)
  sctx.lineTo(W + 100, rail2Y)
  sctx.stroke()

  // Thinner inner rails
  sctx.lineWidth = 14
  sctx.beginPath()
  sctx.moveTo(-100, rail1Y + 40)
  sctx.lineTo(W + 100, rail1Y + 40)
  sctx.stroke()

  sctx.beginPath()
  sctx.moveTo(-100, rail2Y - 40)
  sctx.lineTo(W + 100, rail2Y - 40)
  sctx.stroke()

  // Vertical baluster shadows
  const numBars = 4
  const spacing = W / (numBars - 1)
  sctx.lineWidth = 16
  for (let i = 0; i < numBars; i++) {
    const x = spacing * i
    sctx.beginPath()
    sctx.moveTo(x, rail1Y - 10)
    sctx.lineTo(x, rail2Y + 10)
    sctx.stroke()
  }

  // === Large flowing scrollwork shadows ===
  // Each panel gets ornate curves — these are the main visual event
  sctx.lineWidth = 10

  const panelTop = rail1Y + 55
  const panelBottom = rail2Y - 55
  const panelH = panelBottom - panelTop
  const panelMid = (panelTop + panelBottom) / 2

  for (let i = 0; i < numBars - 1; i++) {
    const pl = i * spacing + 30
    const pr = (i + 1) * spacing - 30
    const pcx = (pl + pr) / 2
    const pw = pr - pl

    // Large C-scroll — upper (opening down-right)
    const bigR = pw * 0.35

    // Draw as bezier curves for flowing shapes
    sctx.lineWidth = 10

    // Upper S-curve: starts at top-center, sweeps right and down, curls back
    sctx.beginPath()
    sctx.moveTo(pcx - pw * 0.05, panelTop + panelH * 0.05)
    sctx.bezierCurveTo(
      pcx + pw * 0.35, panelTop + panelH * 0.05,  // right
      pcx + pw * 0.40, panelTop + panelH * 0.35,  // curving down
      pcx + pw * 0.15, panelTop + panelH * 0.40   // curling back
    )
    // Continue into spiral
    sctx.bezierCurveTo(
      pcx - pw * 0.05, panelTop + panelH * 0.42,
      pcx + pw * 0.00, panelTop + panelH * 0.32,
      pcx + pw * 0.08, panelTop + panelH * 0.30
    )
    sctx.stroke()

    // Lower S-curve (mirror): starts at bottom-center, sweeps left and up
    sctx.beginPath()
    sctx.moveTo(pcx + pw * 0.05, panelBottom - panelH * 0.05)
    sctx.bezierCurveTo(
      pcx - pw * 0.35, panelBottom - panelH * 0.05,
      pcx - pw * 0.40, panelBottom - panelH * 0.35,
      pcx - pw * 0.15, panelBottom - panelH * 0.40
    )
    sctx.bezierCurveTo(
      pcx + pw * 0.05, panelBottom - panelH * 0.42,
      pcx - pw * 0.00, panelBottom - panelH * 0.32,
      pcx - pw * 0.08, panelBottom - panelH * 0.30
    )
    sctx.stroke()

    // Center vertical stem connecting the two S-curves
    sctx.lineWidth = 8
    sctx.beginPath()
    sctx.moveTo(pcx, panelTop + panelH * 0.08)
    sctx.lineTo(pcx, panelBottom - panelH * 0.08)
    sctx.stroke()

    // Small leaf/teardrop accents at stem top and bottom
    sctx.lineWidth = 7
    for (const [ly, dir] of [[panelTop + panelH * 0.08, -1], [panelBottom - panelH * 0.08, 1]] as const) {
      // Small leaves spreading from stem
      sctx.beginPath()
      sctx.moveTo(pcx, ly)
      sctx.bezierCurveTo(
        pcx - pw * 0.10, ly + dir * panelH * 0.04,
        pcx - pw * 0.12, ly + dir * panelH * 0.10,
        pcx - pw * 0.05, ly + dir * panelH * 0.12
      )
      sctx.stroke()

      sctx.beginPath()
      sctx.moveTo(pcx, ly)
      sctx.bezierCurveTo(
        pcx + pw * 0.10, ly + dir * panelH * 0.04,
        pcx + pw * 0.12, ly + dir * panelH * 0.10,
        pcx + pw * 0.05, ly + dir * panelH * 0.12
      )
      sctx.stroke()
    }

    // Corner spirals
    sctx.lineWidth = 6
    const cornerR = pw * 0.08
    const spiralSteps = 35
    for (const [cx, cy] of [
      [pl + pw * 0.12, panelTop + panelH * 0.10],
      [pr - pw * 0.12, panelTop + panelH * 0.10],
      [pl + pw * 0.12, panelBottom - panelH * 0.10],
      [pr - pw * 0.12, panelBottom - panelH * 0.10],
    ] as const) {
      sctx.beginPath()
      for (let s = 0; s <= spiralSteps; s++) {
        const t = s / spiralSteps
        const angle = t * Math.PI * 3.0
        const r = cornerR * (1 - t * 0.75)
        const sx = cx + Math.cos(angle) * r
        const sy = cy + Math.sin(angle) * r
        if (s === 0) sctx.moveTo(sx, sy)
        else sctx.lineTo(sx, sy)
      }
      sctx.stroke()
    }

    sctx.lineWidth = 10
  }

  sctx.restore()

  // Extract and blur
  const shData = sctx.getImageData(0, 0, W, H)
  const sharp = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    sharp[i] = shData.data[i * 4] / 255
  }

  console.log("  Blurring shadow edges...")
  const shadowMask = gaussianBlur(sharp, W, H, 10)

  // === Weathered wall ===
  const stuccoFBM = makeFBM(seed + 100, 280, 5)
  const stainFBM = makeFBM(seed + 200, 400, 4)
  const peelFBM = makeFBM(seed + 300, 140, 4)
  const colorVar = makeNoise(seed + 400, 240)
  const microTex = makeNoise(seed + 500, 4)

  const baseR = 218, baseG = 175, baseB = 150
  const underR = 200, underG = 205, underB = 190

  console.log("  Rendering final image...")
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const stucco = stuccoFBM(x, y) * 0.5 + 0.5
      const stain = stainFBM(x, y) * 0.5 + 0.5
      const peel = peelFBM(x, y) * 0.5 + 0.5
      const cvar = colorVar(x, y) * 0.5 + 0.5
      const micro = microTex(x, y) * 0.5 + 0.5

      let r = baseR + (stucco - 0.5) * 18 + (micro - 0.5) * 5 + (cvar - 0.5) * 14
      let g = baseG + (stucco - 0.5) * 14 + (micro - 0.5) * 4 + (cvar - 0.5) * 8
      let b = baseB + (stucco - 0.5) * 10 + (micro - 0.5) * 3 + (cvar - 0.5) * 6

      // Paint peeling
      if (peel > 0.60) {
        const soft = Math.min(0.6, (peel - 0.60) / 0.22) ** 2
        r = r * (1 - soft) + underR * soft
        g = g * (1 - soft) + underG * soft
        b = b * (1 - soft) + underB * soft
      }

      // Water stains
      if (stain > 0.56) {
        const sa = Math.min(0.28, (stain - 0.56) / 0.35) * (0.4 + (y / H) * 0.4)
        r = r * (1 - sa) + 128 * sa
        g = g * (1 - sa) + 115 * sa
        b = b * (1 - sa) + 95 * sa
      }

      // Shadow
      const light = shadowMask[idx]

      // STRONG golden light in lit areas
      const goldStr = light * light * 0.28
      r += goldStr * (255 - r) * 0.4
      g += goldStr * (225 - g) * 0.3
      b += goldStr * (165 - b) * 0.2

      // Shadow darkening
      const shadow = (1 - light)
      r *= (1 - shadow * 0.38)
      g *= (1 - shadow * 0.32)
      b *= (1 - shadow * 0.22)

      // Warm shift
      r *= 1.03
      b *= 0.92

      // Vignette
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vig = 1.0 - (cx * cx + cy * cy) * 0.20
      r *= vig; g *= vig; b *= vig

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v5-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
