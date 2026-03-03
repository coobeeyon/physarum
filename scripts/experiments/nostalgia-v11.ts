/**
 * NOSTALGIA v11 — WROUGHT IRON AGAINST GOLDEN SKY
 *
 * Just one thing: ornate New Orleans wrought iron railing,
 * silhouetted against a warm golden/amber sky. Looking up
 * from the street at a balcony. The iron pattern IS New Orleans.
 * The golden light IS warmth. The upward angle IS childhood.
 *
 * The ironwork should be genuinely ornate — symmetric scrollwork
 * within rectangular panels, C-curves, S-curves, rosettes,
 * connecting tendrils. Not geometric bars.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 1536

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
  const noises = Array.from({ length: octaves }, (_, i) => makeNoise(seed + i * 100, baseScale / (1 << i)))
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
 * Draw a thick iron curve defined by control points.
 * Uses a distance field approach for smooth anti-aliased rendering.
 */
function drawIronCurve(
  sil: Float32Array, w: number, h: number,
  points: Array<{ x: number, y: number }>,
  thickness: number,
  offsetX: number, offsetY: number,
) {
  // Sample the curve densely
  const samples: Array<{ x: number, y: number }> = []
  for (let t = 0; t <= 1; t += 0.002) {
    const p = evalCubicBezier(points, t)
    samples.push({ x: p.x + offsetX, y: p.y + offsetY })
  }

  // For each pixel near the curve, compute distance
  const halfW = thickness / 2
  const margin = halfW + 3
  for (const s of samples) {
    const minX = Math.max(0, Math.floor(s.x - margin))
    const maxX = Math.min(w - 1, Math.ceil(s.x + margin))
    const minY = Math.max(0, Math.floor(s.y - margin))
    const maxY = Math.min(h - 1, Math.ceil(s.y + margin))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.sqrt((x - s.x) ** 2 + (y - s.y) ** 2)
        if (d < halfW) {
          sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
        } else if (d < halfW + 2) {
          const aa = 1.0 - (d - halfW) / 2
          sil[y * w + x] = Math.max(sil[y * w + x], aa)
        }
      }
    }
  }
}

function evalCubicBezier(
  pts: Array<{ x: number, y: number }>,
  t: number
): { x: number, y: number } {
  if (pts.length === 4) {
    const u = 1 - t
    return {
      x: u*u*u*pts[0].x + 3*u*u*t*pts[1].x + 3*u*t*t*pts[2].x + t*t*t*pts[3].x,
      y: u*u*u*pts[0].y + 3*u*u*t*pts[1].y + 3*u*t*t*pts[2].y + t*t*t*pts[3].y,
    }
  }
  // For 2 points, linear
  return {
    x: pts[0].x + (pts[pts.length-1].x - pts[0].x) * t,
    y: pts[0].y + (pts[pts.length-1].y - pts[0].y) * t,
  }
}

/**
 * Draw a filled circle (for rosettes, finials)
 */
function drawCircle(
  sil: Float32Array, w: number, h: number,
  cx: number, cy: number, r: number
) {
  const margin = r + 2
  for (let y = Math.max(0, Math.floor(cy - margin)); y <= Math.min(h - 1, Math.ceil(cy + margin)); y++) {
    for (let x = Math.max(0, Math.floor(cx - margin)); x <= Math.min(w - 1, Math.ceil(cx + margin)); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < r) {
        sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
      } else if (d < r + 1.5) {
        sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - r) / 1.5)
      }
    }
  }
}

/**
 * Draw a horizontal or vertical bar
 */
function drawBar(
  sil: Float32Array, w: number, h: number,
  x1: number, y1: number, x2: number, y2: number,
  thickness: number
) {
  const halfT = thickness / 2
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - halfT))
  const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2) + halfT))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - halfT))
  const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2) + halfT))

  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return
  const nx = -dy / len, ny = dx / len

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      // Distance from point to line segment
      const px = x - x1, py = y - y1
      let t = (px * dx + py * dy) / (len * len)
      t = Math.max(0, Math.min(1, t))
      const closestX = x1 + t * dx, closestY = y1 + t * dy
      const d = Math.sqrt((x - closestX) ** 2 + (y - closestY) ** 2)
      if (d < halfT) {
        sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
      } else if (d < halfT + 1.5) {
        sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - halfT) / 1.5)
      }
    }
  }
}

/**
 * Generate one ornate panel of wrought iron scrollwork.
 * Draws into the silhouette buffer at the given position.
 */
function drawOrnatePanel(
  sil: Float32Array, w: number, h: number,
  panelLeft: number, panelTop: number,
  panelWidth: number, panelHeight: number,
  rand: () => number
) {
  const cx = panelLeft + panelWidth / 2
  const cy = panelTop + panelHeight / 2
  const ironW = 6  // base iron bar thickness

  // === Central motif — large symmetric scrollwork ===
  // Two large C-scrolls facing each other (mirror symmetry)
  const scrollH = panelHeight * 0.35
  const scrollW = panelWidth * 0.28

  for (const mirror of [-1, 1]) {
    // Large C-scroll
    const sx = cx + mirror * panelWidth * 0.02
    const sy = cy - scrollH * 0.1
    drawIronCurve(sil, w, h, [
      { x: 0, y: -scrollH * 0.5 },
      { x: mirror * scrollW * 0.9, y: -scrollH * 0.5 },
      { x: mirror * scrollW, y: scrollH * 0.3 },
      { x: mirror * scrollW * 0.15, y: scrollH * 0.45 },
    ], ironW, sx, sy)

    // Inner spiral at the bottom of the C
    drawIronCurve(sil, w, h, [
      { x: mirror * scrollW * 0.15, y: scrollH * 0.45 },
      { x: mirror * scrollW * 0.45, y: scrollH * 0.55 },
      { x: mirror * scrollW * 0.38, y: scrollH * 0.25 },
      { x: mirror * scrollW * 0.18, y: scrollH * 0.30 },
    ], ironW * 0.75, sx, sy)

    // Small rosette at spiral center
    drawCircle(sil, w, h,
      sx + mirror * scrollW * 0.22, sy + scrollH * 0.32, ironW * 1.2)

    // Upper tight curl
    drawIronCurve(sil, w, h, [
      { x: 0, y: -scrollH * 0.5 },
      { x: mirror * scrollW * -0.15, y: -scrollH * 0.65 },
      { x: mirror * scrollW * 0.25, y: -scrollH * 0.72 },
      { x: mirror * scrollW * 0.20, y: -scrollH * 0.50 },
    ], ironW * 0.65, sx, sy)

    // Small finial dot at the top curl
    drawCircle(sil, w, h,
      sx + mirror * scrollW * 0.20, sy - scrollH * 0.52, ironW * 0.8)
  }

  // === Central vertical accent ===
  drawBar(sil, w, h, cx, cy - scrollH * 0.65, cx, cy + scrollH * 0.55, ironW * 0.8)

  // Central rosette (where the two C-scrolls meet)
  drawCircle(sil, w, h, cx, cy - scrollH * 0.1, ironW * 1.8)

  // === Outer S-curves connecting to frame ===
  for (const mirror of [-1, 1]) {
    const outerX = panelLeft + (mirror === -1 ? panelWidth * 0.08 : panelWidth * 0.92)

    // S-curve from top rail down to the scroll
    drawIronCurve(sil, w, h, [
      { x: outerX, y: panelTop + panelHeight * 0.05 },
      { x: outerX + mirror * panelWidth * 0.08, y: panelTop + panelHeight * 0.25 },
      { x: outerX - mirror * panelWidth * 0.05, y: panelTop + panelHeight * 0.50 },
      { x: outerX, y: panelTop + panelHeight * 0.70 },
    ], ironW * 0.7, 0, 0)

    // Bottom tendril
    drawIronCurve(sil, w, h, [
      { x: outerX, y: panelTop + panelHeight * 0.70 },
      { x: outerX + mirror * panelWidth * 0.06, y: panelTop + panelHeight * 0.85 },
      { x: outerX + mirror * panelWidth * 0.02, y: panelTop + panelHeight * 0.92 },
      { x: outerX, y: panelTop + panelHeight * 0.95 },
    ], ironW * 0.6, 0, 0)

    // Small circles at S-curve inflection points
    drawCircle(sil, w, h, outerX, panelTop + panelHeight * 0.35, ironW * 0.6)
    drawCircle(sil, w, h, outerX, panelTop + panelHeight * 0.70, ironW * 0.6)
  }

  // === Fill tendrils (thin curves to fill empty space) ===
  for (const mirror of [-1, 1]) {
    // Diagonal fill from corners
    const startX = cx + mirror * panelWidth * 0.35
    drawIronCurve(sil, w, h, [
      { x: startX, y: panelTop + panelHeight * 0.15 },
      { x: startX + mirror * panelWidth * 0.05, y: panelTop + panelHeight * 0.30 },
      { x: cx + mirror * panelWidth * 0.15, y: panelTop + panelHeight * 0.25 },
      { x: cx + mirror * panelWidth * 0.08, y: panelTop + panelHeight * 0.15 },
    ], ironW * 0.5, 0, 0)

    // Lower fill
    drawIronCurve(sil, w, h, [
      { x: startX, y: panelTop + panelHeight * 0.80 },
      { x: startX - mirror * panelWidth * 0.08, y: panelTop + panelHeight * 0.65 },
      { x: cx + mirror * panelWidth * 0.12, y: panelTop + panelHeight * 0.72 },
      { x: cx + mirror * panelWidth * 0.05, y: panelTop + panelHeight * 0.80 },
    ], ironW * 0.5, 0, 0)
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 11001, b: 11002, c: 11003, d: 11004 }
  const seed = seeds[variant] ?? 11001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v11 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Golden sky ===
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed + 100, 500, 4)
  const cloudFBM = makeFBM(seed + 200, 250, 3)

  const skyData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H
      const sn = skyFBM(x, y) * 0.5 + 0.5
      const cn = cloudFBM(x, y) * 0.5 + 0.5

      let r: number, g: number, b: number

      // Sky gradient: deep warm at top → intense gold at horizon area → slightly cooler below
      if (t < 0.15) {
        // Upper sky: deep amber-rose
        const st = t / 0.15
        r = 155 + st * 50; g = 72 + st * 40; b = 35 + st * 20
      } else if (t < 0.35) {
        // Mid upper: warming
        const st = (t - 0.15) / 0.20
        r = 205 + st * 40; g = 112 + st * 55; b = 55 + st * 35
      } else if (t < 0.55) {
        // Peak gold band (where the railing sits)
        const st = (t - 0.35) / 0.20
        r = 245 + st * 8; g = 167 + st * 45; b = 90 + st * 35
      } else if (t < 0.75) {
        // Lower — golden warm
        const st = (t - 0.55) / 0.20
        r = 253 - st * 15; g = 212 - st * 30; b = 125 - st * 20
      } else {
        // Bottom — slightly cooler, darker (below the railing = deeper sky / buildings below)
        const st = (t - 0.75) / 0.25
        r = 238 - st * 80; g = 182 - st * 70; b = 105 - st * 45
      }

      // Cloud wisps
      if (cn > 0.45) {
        const ca = Math.min(0.25, (cn - 0.45) / 0.4)
        const glow = Math.max(0, 1 - Math.abs(t - 0.45) * 3)
        r += ca * (20 + glow * 15)
        g += ca * (15 + glow * 12)
        b += ca * (8 + glow * 6)
      }

      // Atmospheric texture
      r += (sn - 0.5) * 8; g += (sn - 0.5) * 6; b += (sn - 0.5) * 4

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Iron railing ===
  console.log("  Drawing wrought iron...")
  const ironSil = new Float32Array(W * H)
  const ironW = 6

  // The railing band spans roughly the middle third of the image, shifted slightly up
  const railTop = H * 0.30
  const railBot = H * 0.72
  const railH = railBot - railTop

  // Top rail (thick)
  drawBar(ironSil, W, H, -10, railTop, W + 10, railTop, ironW * 2.2)
  // Bottom rail (thick)
  drawBar(ironSil, W, H, -10, railBot, W + 10, railBot, ironW * 2.2)
  // Mid-rail (thinner)
  drawBar(ironSil, W, H, -10, railTop + railH * 0.48, W + 10, railTop + railH * 0.48, ironW * 1.0)

  // Panel dividers — vertical bars splitting the railing into panels
  const numPanels = 5
  const panelW = W / numPanels

  for (let i = 0; i <= numPanels; i++) {
    const px = i * panelW
    drawBar(ironSil, W, H, px, railTop - 10, px, railBot + 10, ironW * 1.4)
  }

  // Ornate scrollwork in each panel
  console.log("  Drawing scrollwork...")
  for (let i = 0; i < numPanels; i++) {
    const pLeft = i * panelW + ironW * 2
    const pRight = (i + 1) * panelW - ironW * 2
    const pWidth = pRight - pLeft

    drawOrnatePanel(ironSil, W, H,
      pLeft, railTop + ironW * 3,
      pWidth, railH - ironW * 6,
      rand)
  }

  // === Finials along the top ===
  for (let i = 0; i <= numPanels; i++) {
    const fx = i * panelW
    // Spear/fleur-de-lis finial above each vertical
    drawBar(ironSil, W, H, fx, railTop - 35, fx, railTop, ironW * 0.9)
    // Diamond shape at top
    const fy = railTop - 35
    for (let dy = -12; dy <= 12; dy++) {
      const halfW = (1 - Math.abs(dy) / 12) * 8
      for (let dx = -Math.ceil(halfW); dx <= Math.ceil(halfW); dx++) {
        const px = Math.round(fx + dx), py = Math.round(fy + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          ironSil[py * W + px] = Math.max(ironSil[py * W + px], 1.0)
        }
      }
    }
  }

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 800, 2.5)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const iron = ironSil[y * W + x]

      let r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]

      if (iron > 0.01) {
        // Iron color: very dark warm brown, not pure black
        const ironR = 32, ironG = 24, ironB = 28
        const a = Math.min(1, iron)
        r = r * (1 - a) + ironR * a
        g = g * (1 - a) + ironG * a
        b = b * (1 - a) + ironB * a
      }

      // Film grain
      const grain = grainNoise(x, y) * 7
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx2 = x / W - 0.5
      const cy2 = y / H - 0.45
      const vig = 1.0 - (cx2 * cx2 * 0.8 + cy2 * cy2 * 1.2) * 0.35
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v11-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
