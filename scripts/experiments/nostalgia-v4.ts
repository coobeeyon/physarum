/**
 * NOSTALGIA v4 — IRON SHADOW (refined)
 *
 * Single panel of wrought iron shadow on a warm stucco wall.
 * The shadow is sharp enough to see the scroll pattern but soft at edges.
 * Strong golden light contrast.
 *
 * The railing shadow falls across the image diagonally.
 * One large panel of ornate scrollwork is visible, not a repeating grid.
 * The lit areas glow warm gold. The shadow areas are cooler.
 *
 * Thinking about what a child sees: the pattern on the wall that moves
 * as the sun crosses. The warm glow on one side, the cool pattern on the other.
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

function drawScrollwork(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = "black"
  ctx.fillStyle = "black"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  // One large railing section: two horizontal bars with 3 panels between
  // The railing is positioned so it crosses the image diagonally
  // (sun from upper-right, shadow projects down-left)

  // Apply shadow projection transform
  ctx.save()
  // Shadow stretches down and to the left from a railing that's above-right
  ctx.translate(W * 0.55, -H * 0.15)
  ctx.transform(1, 0.35, -0.25, 1.4, 0, 0)

  const railTop = 0
  const railBottom = 600
  const panelWidth = 500

  // Top rail
  ctx.lineWidth = 22
  ctx.beginPath()
  ctx.moveTo(-200, railTop)
  ctx.lineTo(panelWidth * 3 + 200, railTop)
  ctx.stroke()

  // Bottom rail
  ctx.beginPath()
  ctx.moveTo(-200, railBottom)
  ctx.lineTo(panelWidth * 3 + 200, railBottom)
  ctx.stroke()

  // Inner rails
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.moveTo(-200, railTop + 35)
  ctx.lineTo(panelWidth * 3 + 200, railTop + 35)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-200, railBottom - 35)
  ctx.lineTo(panelWidth * 3 + 200, railBottom - 35)
  ctx.stroke()

  // Balusters
  ctx.lineWidth = 14
  for (let i = 0; i <= 3; i++) {
    const x = i * panelWidth
    ctx.beginPath()
    ctx.moveTo(x, railTop)
    ctx.lineTo(x, railBottom)
    ctx.stroke()
  }

  // Scrollwork in each of 3 panels
  ctx.lineWidth = 9
  for (let i = 0; i < 3; i++) {
    const pl = i * panelWidth + 25
    const pr = (i + 1) * panelWidth - 25
    const pt = railTop + 50
    const pb = railBottom - 50
    const pcx = (pl + pr) / 2
    const pcy = (pt + pb) / 2
    const pw = pr - pl
    const ph = pb - pt

    // Large central scroll pair — two arcs facing each other
    const scrollR = Math.min(pw * 0.38, ph * 0.32)

    // Upper arc (opening downward)
    ctx.beginPath()
    ctx.arc(pcx, pcy - scrollR * 0.25, scrollR, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()

    // Lower arc (opening upward)
    ctx.beginPath()
    ctx.arc(pcx, pcy + scrollR * 0.25, scrollR, -Math.PI * 0.85, -Math.PI * 0.15)
    ctx.stroke()

    // Scroll ends — small spirals at the tips of the arcs
    const spiralR = scrollR * 0.22
    const spiralSteps = 40

    // Top-left spiral
    for (const [angle, cx, cy, dir] of [
      [Math.PI * 0.15, pcx + Math.cos(Math.PI * 0.15) * scrollR, pcy - scrollR * 0.25 + Math.sin(Math.PI * 0.15) * scrollR, 1],
      [Math.PI * 0.85, pcx + Math.cos(Math.PI * 0.85) * scrollR, pcy - scrollR * 0.25 + Math.sin(Math.PI * 0.85) * scrollR, -1],
      [-Math.PI * 0.15, pcx + Math.cos(-Math.PI * 0.15) * scrollR, pcy + scrollR * 0.25 + Math.sin(-Math.PI * 0.15) * scrollR, -1],
      [-Math.PI * 0.85, pcx + Math.cos(-Math.PI * 0.85) * scrollR, pcy + scrollR * 0.25 + Math.sin(-Math.PI * 0.85) * scrollR, 1],
    ] as [number, number, number, number][]) {
      ctx.beginPath()
      for (let s = 0; s <= spiralSteps; s++) {
        const t = s / spiralSteps
        const a = angle + dir * t * Math.PI * 2.5
        const r = spiralR * (1 - t * 0.8)
        const sx = cx + Math.cos(a) * r
        const sy = cy + Math.sin(a) * r
        if (s === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.stroke()
    }

    // Center stem
    ctx.lineWidth = 7
    ctx.beginPath()
    ctx.moveTo(pcx, pt + ph * 0.08)
    ctx.lineTo(pcx, pb - ph * 0.08)
    ctx.stroke()
    ctx.lineWidth = 9

    // Diamond/leaf accents at top and bottom
    const accentSize = pw * 0.06
    for (const ay of [pt + ph * 0.06, pb - ph * 0.06]) {
      ctx.beginPath()
      ctx.moveTo(pcx, ay - accentSize)
      ctx.lineTo(pcx + accentSize * 0.6, ay)
      ctx.lineTo(pcx, ay + accentSize)
      ctx.lineTo(pcx - accentSize * 0.6, ay)
      ctx.closePath()
      ctx.fill()
    }

    // Side connecting curves
    ctx.lineWidth = 6
    // Left side: curve from upper-left area down to lower-left
    ctx.beginPath()
    ctx.moveTo(pl + pw * 0.08, pt + ph * 0.12)
    ctx.bezierCurveTo(
      pl + pw * 0.02, pt + ph * 0.35,
      pl + pw * 0.02, pb - ph * 0.35,
      pl + pw * 0.08, pb - ph * 0.12
    )
    ctx.stroke()

    // Right side
    ctx.beginPath()
    ctx.moveTo(pr - pw * 0.08, pt + ph * 0.12)
    ctx.bezierCurveTo(
      pr - pw * 0.02, pt + ph * 0.35,
      pr - pw * 0.02, pb - ph * 0.35,
      pr - pw * 0.08, pb - ph * 0.12
    )
    ctx.stroke()
    ctx.lineWidth = 9
  }

  ctx.restore()
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 84001, b: 84002, c: 84003, d: 84004 }
  const seed = seeds[variant] ?? 84001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v4 variant ${variant} (seed: ${seed}) ===`)

  // === Iron shadow mask ===
  console.log("  Generating iron shadow pattern...")
  const shadowCanvas = createCanvas(W, H)
  const shadowCtx = shadowCanvas.getContext("2d")
  drawScrollwork(shadowCtx, W, H)

  // Extract and blur
  const shadowData = shadowCtx.getImageData(0, 0, W, H)
  const sharp = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    sharp[i] = shadowData.data[i * 4] / 255
  }
  console.log("  Blurring shadow edges...")
  const shadowMask = gaussianBlur(sharp, W, H, 8)

  // === Weathered wall ===
  const stuccoFBM = makeFBM(seed + 100, 280, 5)
  const stainFBM = makeFBM(seed + 200, 350, 4)
  const peelFBM = makeFBM(seed + 300, 130, 4)
  const colorVar = makeNoise(seed + 400, 220)
  const microTex = makeNoise(seed + 500, 4)

  // Faded coral/salmon
  const baseR = 218
  const baseG = 175
  const baseB = 152

  // Under-layer
  const underR = 198
  const underG = 204
  const underB = 188

  console.log("  Rendering...")
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      const stucco = stuccoFBM(x, y) * 0.5 + 0.5
      const stain = stainFBM(x, y) * 0.5 + 0.5
      const peel = peelFBM(x, y) * 0.5 + 0.5
      const cvar = colorVar(x, y) * 0.5 + 0.5
      const micro = microTex(x, y) * 0.5 + 0.5

      // Base wall
      let r = baseR + (stucco - 0.5) * 18 + (micro - 0.5) * 5
      let g = baseG + (stucco - 0.5) * 14 + (micro - 0.5) * 4
      let b = baseB + (stucco - 0.5) * 10 + (micro - 0.5) * 3

      r += (cvar - 0.5) * 14
      g += (cvar - 0.5) * 8
      b += (cvar - 0.5) * 6

      // Paint peeling
      if (peel > 0.60) {
        const pa = Math.min(0.6, (peel - 0.60) / 0.22)
        const soft = pa * pa
        r = r * (1 - soft) + underR * soft
        g = g * (1 - soft) + underG * soft
        b = b * (1 - soft) + underB * soft
      }

      // Water stains
      if (stain > 0.56) {
        const vertBias = 0.4 + (y / H) * 0.4
        const sa = Math.min(0.30, (stain - 0.56) / 0.35) * vertBias
        r = r * (1 - sa) + 128 * sa
        g = g * (1 - sa) + 115 * sa
        b = b * (1 - sa) + 95 * sa
      }

      // === SHADOW from iron ===
      const light = shadowMask[idx]

      // Golden light in lit areas
      const goldStr = light * light * 0.22  // Squared for more dramatic effect
      r += goldStr * (255 - r) * 0.35
      g += goldStr * (220 - g) * 0.25
      b += goldStr * (160 - b) * 0.15

      // Shadow darkening + cool shift
      const shadow = 1 - light
      const shadowStr = shadow * 0.40
      r *= (1 - shadowStr)
      g *= (1 - shadowStr * 0.85)
      b *= (1 - shadowStr * 0.65)

      // Warm overall
      r *= 1.03
      b *= 0.93

      // Vignette
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vig = 1.0 - (cx * cx + cy * cy) * 0.22
      r *= vig
      g *= vig
      b *= vig

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

  const filename = `output/nostalgia-v4-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
