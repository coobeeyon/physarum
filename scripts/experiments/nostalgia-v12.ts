/**
 * NOSTALGIA v12 — DENSE SCROLLWORK
 *
 * Refined from v11: the ironwork needs to be DENSER and more organic.
 * Real New Orleans iron fills every space with flowing curves that
 * grow into each other. The pattern should feel like a vine, not
 * isolated geometric shapes.
 *
 * Approach: recursive scroll growth from a central stem. Each panel
 * gets a slightly different seed for variation.
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
 * Draw a thick curve defined as a chain of sample points.
 * Thickness can taper along the curve.
 */
function drawThickCurve(
  sil: Float32Array, w: number, h: number,
  points: Array<{ x: number, y: number }>,
  thicknessStart: number,
  thicknessEnd: number,
) {
  for (let i = 0; i < points.length; i++) {
    const t = points.length > 1 ? i / (points.length - 1) : 0
    const thickness = thicknessStart + (thicknessEnd - thicknessStart) * t
    const halfW = thickness / 2
    const p = points[i]
    const margin = halfW + 2

    const minX = Math.max(0, Math.floor(p.x - margin))
    const maxX = Math.min(w - 1, Math.ceil(p.x + margin))
    const minY = Math.max(0, Math.floor(p.y - margin))
    const maxY = Math.min(h - 1, Math.ceil(p.y + margin))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2)
        if (d < halfW) {
          sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
        } else if (d < halfW + 1.5) {
          sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - halfW) / 1.5)
        }
      }
    }
  }
}

function sampleBezier3(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  steps: number
): Array<{ x: number, y: number }> {
  const pts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    pts.push({
      x: u * u * p0x + 2 * u * t * p1x + t * t * p2x,
      y: u * u * p0y + 2 * u * t * p1y + t * t * p2y,
    })
  }
  return pts
}

function sampleBezier4(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  steps: number
): Array<{ x: number, y: number }> {
  const pts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    pts.push({
      x: u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x,
      y: u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y,
    })
  }
  return pts
}

function drawCircle(sil: Float32Array, w: number, h: number, cx: number, cy: number, r: number) {
  for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(h - 1, Math.ceil(cy + r + 2)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(w - 1, Math.ceil(cx + r + 2)); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < r) sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
      else if (d < r + 1.5) sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - r) / 1.5)
    }
  }
}

function drawBar(sil: Float32Array, w: number, h: number, x1: number, y1: number, x2: number, y2: number, thickness: number) {
  const halfT = thickness / 2
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return
  const steps = Math.ceil(len)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x1 + dx * t, py = y1 + dy * t
    const margin = halfT + 2
    for (let y = Math.max(0, Math.floor(py - margin)); y <= Math.min(h - 1, Math.ceil(py + margin)); y++) {
      for (let x = Math.max(0, Math.floor(px - margin)); x <= Math.min(w - 1, Math.ceil(px + margin)); x++) {
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
        if (d < halfT) sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
        else if (d < halfT + 1.5) sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - halfT) / 1.5)
      }
    }
  }
}

/**
 * Draw a volute (tight spiral ending in a dot) — the signature element of ironwork
 */
function drawVolute(
  sil: Float32Array, w: number, h: number,
  cx: number, cy: number,
  startR: number, direction: number, // 1 or -1
  thickness: number, turns: number
) {
  const pts: Array<{ x: number, y: number }> = []
  const steps = Math.ceil(turns * 80)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * turns * Math.PI * 2
    const r = startR * (1 - t * 0.85)
    pts.push({
      x: cx + Math.cos(angle * direction) * r,
      y: cy + Math.sin(angle * direction) * r,
    })
  }
  drawThickCurve(sil, w, h, pts, thickness, thickness * 0.4)
  // Center dot
  drawCircle(sil, w, h, cx, cy, thickness * 0.9)
}

/**
 * Dense ornate panel — flowing scrollwork that fills the space
 */
function drawDensePanel(
  sil: Float32Array, w: number, h: number,
  left: number, top: number,
  width: number, height: number,
  rand: () => number
) {
  const cx = left + width / 2
  const cy = top + height / 2
  const iron = 7

  // === Central vertical stem ===
  drawBar(sil, w, h, cx, top + height * 0.02, cx, top + height * 0.98, iron * 0.9)

  // === Major C-scrolls — two on each side, mirrored ===
  for (const mirrorX of [-1, 1]) {
    // Upper large C-scroll
    const uStartX = cx
    const uStartY = top + height * 0.15
    const uEndX = cx + mirrorX * width * 0.38
    const uEndY = top + height * 0.38

    const uCurve = sampleBezier4(
      uStartX, uStartY,
      uStartX + mirrorX * width * 0.35, uStartY - height * 0.08,
      uEndX + mirrorX * width * 0.05, uEndY - height * 0.20,
      uEndX, uEndY,
      100
    )
    drawThickCurve(sil, w, h, uCurve, iron * 1.1, iron * 0.7)

    // Volute at the end
    drawVolute(sil, w, h, uEndX, uEndY + 10, 22, mirrorX, iron * 0.65, 1.3)

    // Lower large C-scroll (mirrored vertically too)
    const lStartX = cx
    const lStartY = top + height * 0.85
    const lEndX = cx + mirrorX * width * 0.38
    const lEndY = top + height * 0.62

    const lCurve = sampleBezier4(
      lStartX, lStartY,
      lStartX + mirrorX * width * 0.35, lStartY + height * 0.08,
      lEndX + mirrorX * width * 0.05, lEndY + height * 0.20,
      lEndX, lEndY,
      100
    )
    drawThickCurve(sil, w, h, lCurve, iron * 1.1, iron * 0.7)

    // Volute at the end
    drawVolute(sil, w, h, lEndX, lEndY - 10, 22, -mirrorX, iron * 0.65, 1.3)

    // === Secondary scrolls between the main C-scrolls ===
    // These fill the space between the upper and lower C-curves
    const midY = cy
    const secX = cx + mirrorX * width * 0.18

    // Outward-facing S-curve
    const sCurve = sampleBezier4(
      cx, midY - height * 0.08,
      secX, midY - height * 0.15,
      secX + mirrorX * width * 0.12, midY + height * 0.05,
      cx + mirrorX * width * 0.28, midY,
      80
    )
    drawThickCurve(sil, w, h, sCurve, iron * 0.8, iron * 0.5)

    const sCurve2 = sampleBezier4(
      cx, midY + height * 0.08,
      secX, midY + height * 0.15,
      secX + mirrorX * width * 0.12, midY - height * 0.05,
      cx + mirrorX * width * 0.28, midY,
      80
    )
    drawThickCurve(sil, w, h, sCurve2, iron * 0.8, iron * 0.5)

    // Small volutes at the S-curve ends
    drawVolute(sil, w, h,
      cx + mirrorX * width * 0.28, midY,
      14, mirrorX, iron * 0.5, 1.1)

    // === Thin tendril fills ===
    // Upper corner fill
    const cornerCurve = sampleBezier3(
      cx + mirrorX * width * 0.08, top + height * 0.04,
      cx + mirrorX * width * 0.32, top + height * 0.02,
      cx + mirrorX * width * 0.40, top + height * 0.15,
      60
    )
    drawThickCurve(sil, w, h, cornerCurve, iron * 0.55, iron * 0.3)

    // Lower corner fill
    const lCornerCurve = sampleBezier3(
      cx + mirrorX * width * 0.08, top + height * 0.96,
      cx + mirrorX * width * 0.32, top + height * 0.98,
      cx + mirrorX * width * 0.40, top + height * 0.85,
      60
    )
    drawThickCurve(sil, w, h, lCornerCurve, iron * 0.55, iron * 0.3)

    // Mid-fill between C-scroll and frame edge
    const midFill = sampleBezier3(
      cx + mirrorX * width * 0.40, top + height * 0.25,
      cx + mirrorX * width * 0.45, cy,
      cx + mirrorX * width * 0.40, top + height * 0.75,
      60
    )
    drawThickCurve(sil, w, h, midFill, iron * 0.5, iron * 0.5)

    // Small leaf shapes near the stem
    for (const yOff of [0.25, 0.45, 0.55, 0.75]) {
      const leafCurve = sampleBezier3(
        cx, top + height * yOff,
        cx + mirrorX * width * 0.06, top + height * (yOff - 0.04),
        cx + mirrorX * width * 0.10, top + height * yOff,
        30
      )
      drawThickCurve(sil, w, h, leafCurve, iron * 0.45, iron * 0.25)
    }
  }

  // === Central rosette at intersection ===
  drawCircle(sil, w, h, cx, cy, iron * 2.2)
  // Ring around it
  const ringPts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= 100; i++) {
    const angle = (i / 100) * Math.PI * 2
    ringPts.push({ x: cx + Math.cos(angle) * iron * 3.5, y: cy + Math.sin(angle) * iron * 3.5 })
  }
  drawThickCurve(sil, w, h, ringPts, iron * 0.5, iron * 0.5)

  // Small dots at cardinal points around the ring
  for (let a = 0; a < 4; a++) {
    const angle = a * Math.PI / 2 + Math.PI / 4
    drawCircle(sil, w, h,
      cx + Math.cos(angle) * iron * 5,
      cy + Math.sin(angle) * iron * 5,
      iron * 0.55)
  }

  // Top and bottom rosettes
  drawCircle(sil, w, h, cx, top + height * 0.06, iron * 1.2)
  drawCircle(sil, w, h, cx, top + height * 0.94, iron * 1.2)
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 12001, b: 12002, c: 12003, d: 12004 }
  const seed = seeds[variant] ?? 12001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v12 variant ${variant} (seed: ${seed}) ===`)

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

      if (t < 0.12) {
        const st = t / 0.12
        r = 145 + st * 55; g = 65 + st * 42; b = 30 + st * 22
      } else if (t < 0.30) {
        const st = (t - 0.12) / 0.18
        r = 200 + st * 42; g = 107 + st * 52; b = 52 + st * 38
      } else if (t < 0.55) {
        // Peak gold — the bright band behind the railing
        const st = (t - 0.30) / 0.25
        r = 242 + st * 10; g = 159 + st * 52; b = 90 + st * 38
      } else if (t < 0.75) {
        const st = (t - 0.55) / 0.20
        r = 252 - st * 20; g = 211 - st * 35; b = 128 - st * 25
      } else {
        const st = (t - 0.75) / 0.25
        r = 232 - st * 75; g = 176 - st * 65; b = 103 - st * 40
      }

      if (cn > 0.44) {
        const ca = Math.min(0.28, (cn - 0.44) / 0.35)
        const glow = Math.max(0, 1 - Math.abs(t - 0.42) * 2.5)
        r += ca * (22 + glow * 18); g += ca * (16 + glow * 14); b += ca * (8 + glow * 8)
      }

      r += (sn - 0.5) * 9; g += (sn - 0.5) * 7; b += (sn - 0.5) * 4

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

  const railTop = H * 0.28
  const railBot = H * 0.74
  const railH = railBot - railTop
  const ironW = 7

  // Top rail
  drawBar(ironSil, W, H, -10, railTop, W + 10, railTop, ironW * 2.5)
  // Bottom rail
  drawBar(ironSil, W, H, -10, railBot, W + 10, railBot, ironW * 2.5)

  // Panels
  const numPanels = 4
  const panelW = W / numPanels

  // Vertical dividers
  for (let i = 0; i <= numPanels; i++) {
    const px = i * panelW
    drawBar(ironSil, W, H, px, railTop - 8, px, railBot + 8, ironW * 1.6)
  }

  // Ornate scrollwork in each panel
  console.log("  Drawing scrollwork...")
  for (let i = 0; i < numPanels; i++) {
    const pLeft = i * panelW + ironW * 3
    const pRight = (i + 1) * panelW - ironW * 3
    const pW = pRight - pLeft
    const pRand = makePRNG(seed + 1000 + i * 77)

    drawDensePanel(ironSil, W, H,
      pLeft, railTop + ironW * 4,
      pW, railH - ironW * 8,
      () => pRand())
  }

  // Finials
  for (let i = 0; i <= numPanels; i++) {
    const fx = i * panelW
    drawBar(ironSil, W, H, fx, railTop - 45, fx, railTop, ironW)
    // Spearhead
    for (let dy = -18; dy <= 0; dy++) {
      const progress = -dy / 18
      const halfW2 = (1 - progress) * 10 + progress * 2
      for (let dx = -Math.ceil(halfW2); dx <= Math.ceil(halfW2); dx++) {
        const px = Math.round(fx + dx), py = Math.round(railTop - 45 + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          ironSil[py * W + px] = Math.max(ironSil[py * W + px], 1.0)
        }
      }
    }
    drawCircle(ironSil, W, H, fx, railTop - 45, ironW * 0.7)
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
        // Warm dark iron — not pure black
        const ironR = 35, ironG = 26, ironB = 30
        const a = Math.min(1, iron)
        r = r * (1 - a) + ironR * a
        g = g * (1 - a) + ironG * a
        b = b * (1 - a) + ironB * a

        // Subtle warm edge glow where iron meets bright sky
        if (iron > 0.3 && iron < 0.95) {
          const edgeGlow = (1 - Math.abs(iron - 0.6) / 0.35) * 0.15
          r += edgeGlow * 40; g += edgeGlow * 25; b += edgeGlow * 10
        }
      }

      // Film grain
      const grain = grainNoise(x, y) * 7
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx2 = x / W - 0.5
      const cy2 = y / H - 0.45
      const vig = 1.0 - (cx2 * cx2 * 0.8 + cy2 * cy2 * 1.3) * 0.38
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v12-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
