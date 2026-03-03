/**
 * NOSTALGIA v3 — IRON SHADOWS
 *
 * The shadow of wrought iron cast on a weathered stucco wall
 * by late afternoon golden light.
 *
 * This is what you remember: not the iron itself, but how the shadow
 * fell on the warm wall. The pattern stretched by low sun. The way
 * everything turned golden for an hour before dusk.
 *
 * Concept: warm wall fills the frame. Iron shadow pattern lies across it
 * diagonally (low sun stretches shadows). The shadow has soft edges
 * (the iron is far from the wall). Where the shadow falls, the wall
 * is cooler. Where the light hits, it's golden-warm.
 *
 * The shadow pattern should be recognizable as wrought iron scrollwork
 * but stretched and softened — the way a memory softens detail.
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

/**
 * Generate the iron shadow mask.
 * Returns a 2D float array where 0 = full shadow, 1 = full light.
 * The shadow is soft-edged (blurred) because the iron is far from the wall.
 *
 * We render a high-res "iron" mask first, then blur it to create soft shadows.
 * The shadow is projected diagonally (low afternoon sun from the right).
 */
function generateIronShadow(
  w: number, h: number, rand: () => number, seed: number
): Float32Array {
  // Create an offscreen canvas for the iron pattern
  const { createCanvas: cc } = require("canvas")
  const ironCanvas = cc(w, h) as ReturnType<typeof createCanvas>
  const ctx = ironCanvas.getContext("2d") as CanvasRenderingContext2D

  // White = light, Black = iron (shadow)
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, w, h)

  ctx.strokeStyle = "black"
  ctx.fillStyle = "black"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  // Shadow projection: iron railing is to the right, sun behind-left.
  // Shadows project leftward and downward, stretched by low sun angle.
  // The shadow of a horizontal railing becomes diagonal stripes.

  // We'll draw the iron pattern in "iron space" (as if looking at the railing head-on)
  // then the shadow projection stretches it.

  // But simpler approach: draw the shadow pattern directly as it would appear on the wall.
  // Low sun from the right means shadows lean to the left and are stretched vertically.

  const shearX = -0.4  // Shadow leans left
  const stretchY = 1.8  // Low sun stretches shadows vertically

  // Transform: for each wall pixel (wx, wy), what iron pixel would cast shadow here?
  // iron_x = wx - shearX * wy
  // iron_y = wy / stretchY

  // Draw the iron pattern in its own coordinate space
  // Horizontal rails
  const railSpacing = 320  // Spacing between horizontal rails in iron space
  const numRails = Math.ceil(h / stretchY / railSpacing) + 4
  const railWidth = 18

  // Vertical balusters
  const balusterSpacing = 380
  const numBalusters = Math.ceil(w / balusterSpacing) + 6
  const balusterWidth = 12

  // Apply transform
  ctx.save()
  // We need the inverse: drawing in wall space, so we shear the drawing
  ctx.setTransform(1, 0, shearX, stretchY, w * 0.3, -h * 0.2)

  // Horizontal rails
  ctx.lineWidth = railWidth
  for (let i = -2; i < numRails; i++) {
    const y = i * railSpacing
    ctx.beginPath()
    ctx.moveTo(-w, y)
    ctx.lineTo(w * 2, y)
    ctx.stroke()

    // Thinner inner rail
    ctx.lineWidth = railWidth * 0.5
    ctx.beginPath()
    ctx.moveTo(-w, y + 30)
    ctx.lineTo(w * 2, y + 30)
    ctx.stroke()
    ctx.lineWidth = railWidth
  }

  // Vertical balusters
  ctx.lineWidth = balusterWidth
  for (let i = -4; i < numBalusters; i++) {
    const x = i * balusterSpacing
    for (let j = -2; j < numRails; j++) {
      const y0 = j * railSpacing
      const y1 = (j + 1) * railSpacing
      ctx.beginPath()
      ctx.moveTo(x, y0)
      ctx.lineTo(x, y1)
      ctx.stroke()
    }
  }

  // Scrollwork in each panel
  ctx.lineWidth = 8
  for (let i = -4; i < numBalusters - 1; i++) {
    for (let j = -2; j < numRails - 1; j++) {
      const panelLeft = i * balusterSpacing + 20
      const panelRight = (i + 1) * balusterSpacing - 20
      const panelTop = j * railSpacing + 45
      const panelBottom = (j + 1) * railSpacing - 15
      const pcx = (panelLeft + panelRight) / 2
      const pcy = (panelTop + panelBottom) / 2
      const pw = panelRight - panelLeft
      const ph = panelBottom - panelTop

      // Central S-scroll
      const scrollR = Math.min(pw, ph) * 0.28

      // Upper C-curve
      ctx.beginPath()
      ctx.arc(pcx, pcy - scrollR * 0.6, scrollR, Math.PI * 0.3, Math.PI * 1.7, false)
      ctx.stroke()

      // Lower C-curve (mirror)
      ctx.beginPath()
      ctx.arc(pcx, pcy + scrollR * 0.6, scrollR, -Math.PI * 0.7, Math.PI * 0.7, false)
      ctx.stroke()

      // Center stem
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(pcx, pcy - scrollR * 1.3)
      ctx.lineTo(pcx, pcy + scrollR * 1.3)
      ctx.stroke()

      // Small scrolls at corners (circles)
      const smallR = scrollR * 0.25
      ctx.lineWidth = 5
      for (const [sx, sy] of [
        [panelLeft + pw * 0.15, panelTop + ph * 0.15],
        [panelRight - pw * 0.15, panelTop + ph * 0.15],
        [panelLeft + pw * 0.15, panelBottom - ph * 0.15],
        [panelRight - pw * 0.15, panelBottom - ph * 0.15],
      ] as const) {
        ctx.beginPath()
        ctx.arc(sx, sy, smallR, 0, Math.PI * 1.8)
        ctx.stroke()
      }

      // Side bezier curves connecting corners to center
      ctx.lineWidth = 5
      // Left side
      ctx.beginPath()
      ctx.moveTo(panelLeft + pw * 0.15, panelTop + ph * 0.15 + smallR)
      ctx.quadraticCurveTo(panelLeft + pw * 0.08, pcy, panelLeft + pw * 0.15, panelBottom - ph * 0.15 - smallR)
      ctx.stroke()
      // Right side
      ctx.beginPath()
      ctx.moveTo(panelRight - pw * 0.15, panelTop + ph * 0.15 + smallR)
      ctx.quadraticCurveTo(panelRight - pw * 0.08, pcy, panelRight - pw * 0.15, panelBottom - ph * 0.15 - smallR)
      ctx.stroke()

      ctx.lineWidth = 8
    }
  }

  ctx.restore()

  // Extract to float array and blur for soft shadow edges
  const ironData = ctx.getImageData(0, 0, w, h)
  const sharp = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    sharp[i] = ironData.data[i * 4] / 255  // 0=shadow, 1=light
  }

  // Gaussian blur for soft shadow (shadow is far from wall)
  console.log("  Blurring shadow edges...")
  const blurRadius = 18
  const blurred = gaussianBlur(sharp, w, h, blurRadius)

  return blurred
}

function gaussianBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  // Two-pass box blur (3 passes approximates Gaussian)
  let current = new Float32Array(src)
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(w * h)
    // Horizontal
    for (let y = 0; y < h; y++) {
      let sum = 0, count = 0
      for (let x = 0; x < Math.min(radius, w); x++) {
        sum += current[y * w + x]
        count++
      }
      for (let x = 0; x < w; x++) {
        if (x + radius < w) { sum += current[y * w + x + radius]; count++ }
        if (x - radius - 1 >= 0) { sum -= current[y * w + x - radius - 1]; count-- }
        next[y * w + x] = sum / count
      }
    }
    // Vertical
    const next2 = new Float32Array(w * h)
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let y = 0; y < Math.min(radius, h); y++) {
        sum += next[y * w + x]
        count++
      }
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

import type { CanvasRenderingContext2D } from "canvas"

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 83001, b: 83002, c: 83003, d: 83004 }
  const seed = seeds[variant] ?? 83001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v3 variant ${variant} (seed: ${seed}) ===`)

  // === Weathered wall ===
  const stuccoFBM = makeFBM(seed + 100, 300, 5)
  const stainFBM = makeFBM(seed + 200, 400, 4)
  const peelFBM = makeFBM(seed + 300, 150, 4)
  const colorVar = makeNoise(seed + 400, 250)
  const microTex = makeNoise(seed + 500, 4)
  const streakNoise = makeNoise(seed + 700, 12)

  // Faded coral wall
  const baseR = 215 + rand() * 10
  const baseG = 172 + rand() * 10
  const baseB = 148 + rand() * 8

  // Under-layer (older cream/mint)
  const underR = 195 + rand() * 10
  const underG = 200 + rand() * 10
  const underB = 185 + rand() * 8

  // === Shadow mask ===
  const shadowMask = generateIronShadow(W, H, rand, seed)

  // === Render ===
  console.log("  Rendering wall with shadow...")
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      const stucco = stuccoFBM(x, y) * 0.5 + 0.5
      const stain = stainFBM(x, y) * 0.5 + 0.5
      const peel = peelFBM(x, y) * 0.5 + 0.5
      const cvar = colorVar(x, y) * 0.5 + 0.5
      const micro = microTex(x, y) * 0.5 + 0.5
      const streak = streakNoise(x, y) * 0.5 + 0.5

      // Base wall
      let r = baseR + (stucco - 0.5) * 16 + (micro - 0.5) * 5
      let g = baseG + (stucco - 0.5) * 12 + (micro - 0.5) * 4
      let b = baseB + (stucco - 0.5) * 10 + (micro - 0.5) * 3

      // Hue variation
      r += (cvar - 0.5) * 14
      g += (cvar - 0.5) * 8
      b += (cvar - 0.5) * 6

      // Paint peeling (gentle)
      if (peel > 0.62) {
        const pa = Math.min(0.7, (peel - 0.62) / 0.20)
        // Soft transition
        const softPa = pa * pa  // quadratic easing for softer edges
        r = r * (1 - softPa) + underR * softPa
        g = g * (1 - softPa) + underG * softPa
        b = b * (1 - softPa) + underB * softPa
      }

      // Water stains (subtle vertical streaks)
      const vertBias = (y / H) * 0.4
      if (stain > 0.58) {
        const sa = Math.min(0.25, (stain - 0.58) / 0.35) * (0.6 + vertBias)
        r = r * (1 - sa) + 130 * sa
        g = g * (1 - sa) + 118 * sa
        b = b * (1 - sa) + 100 * sa
      }

      // === SHADOW ===
      const light = shadowMask[idx]  // 0=full shadow, 1=full light

      // In light: warm golden wash (afternoon sun)
      // In shadow: cooler, slightly blue-shifted

      // Golden light boost in lit areas
      const goldAmount = light * 0.20  // Strong gold in lit areas
      r = r * (1 - goldAmount) + 255 * goldAmount
      g = g * (1 - goldAmount * 0.8) + 218 * goldAmount * 0.8
      b = b * (1 - goldAmount * 0.5) + 155 * goldAmount * 0.5

      // Shadow darkening + cooling
      const shadowAmount = (1 - light) * 0.35  // Shadow darkening
      r *= (1 - shadowAmount * 0.7)
      g *= (1 - shadowAmount * 0.6)
      b *= (1 - shadowAmount * 0.4)  // Less blue reduction = cooler shadows

      // Overall warm tone
      r *= 1.02
      g *= 0.99
      b *= 0.94

      // Subtle vignette (warm)
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vig = 1.0 - (cx * cx + cy * cy) * 0.25
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

  const filename = `output/nostalgia-v3-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
