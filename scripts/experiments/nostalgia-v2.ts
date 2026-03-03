/**
 * NOSTALGIA v2 — WROUGHT IRON CLOSE-UP
 *
 * Closer view: just the balcony railing filling most of the frame.
 * Behind it, a weathered pastel wall glowing in golden light.
 * The iron scrollwork is large and detailed — the visual signature of New Orleans.
 *
 * Using canvas 2D context for the iron curves (smooth, anti-aliased)
 * with pixel-level weathering noise on the wall behind.
 *
 * Think: sitting on a stoop across a narrow French Quarter street,
 * looking up at a balcony in late afternoon light.
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

// Draw a single scroll (spiral that starts large and curls in)
function drawScroll(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  startAngle: number, direction: 1 | -1,
  outerRadius: number, turns: number
) {
  ctx.beginPath()
  const steps = 80
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = startAngle + direction * t * turns * Math.PI * 2
    const r = outerRadius * (1 - t * 0.75)  // Spiral inward
    const x = cx + Math.cos(angle) * r
    const y = cy + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// Draw an S-scroll (two connected spirals)
function drawSScroll(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  height: number, width: number,
  flip: boolean
) {
  const dir = flip ? -1 : 1
  const r = Math.min(height * 0.3, width * 0.4)

  ctx.beginPath()
  const steps = 100
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    let px: number, py: number

    if (t < 0.5) {
      // Upper scroll (curls outward then in)
      const st = t * 2  // 0 to 1 for upper half
      const angle = Math.PI * 0.5 + st * Math.PI * 2.5 * dir
      const radius = r * (1 - st * 0.7)
      px = x + dir * (width * 0.15) + Math.cos(angle) * radius
      py = y - height * 0.25 + Math.sin(angle) * radius
    } else {
      // Lower scroll (mirror)
      const st = (t - 0.5) * 2
      const angle = -Math.PI * 0.5 - st * Math.PI * 2.5 * dir
      const radius = r * (1 - st * 0.7)
      px = x - dir * (width * 0.15) + Math.cos(angle) * radius
      py = y + height * 0.25 + Math.sin(angle) * radius
    }

    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.stroke()
}

// Draw a heart/lyre motif (common in New Orleans ironwork)
function drawLyre(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  w: number, h: number
) {
  // Two curves meeting at bottom point, opening at top
  ctx.beginPath()
  // Left curve
  ctx.moveTo(cx, cy + h * 0.45) // bottom point
  ctx.bezierCurveTo(
    cx - w * 0.5, cy + h * 0.1,   // control 1
    cx - w * 0.5, cy - h * 0.4,   // control 2
    cx - w * 0.1, cy - h * 0.45   // end (top left, curling in)
  )
  ctx.stroke()

  ctx.beginPath()
  // Right curve (mirror)
  ctx.moveTo(cx, cy + h * 0.45)
  ctx.bezierCurveTo(
    cx + w * 0.5, cy + h * 0.1,
    cx + w * 0.5, cy - h * 0.4,
    cx + w * 0.1, cy - h * 0.45
  )
  ctx.stroke()

  // Small scroll at each top end
  drawScroll(ctx, cx - w * 0.1, cy - h * 0.45, Math.PI, 1, w * 0.12, 1.2)
  drawScroll(ctx, cx + w * 0.1, cy - h * 0.45, 0, -1, w * 0.12, 1.2)

  // Center vertical stem (partial)
  ctx.beginPath()
  ctx.moveTo(cx, cy + h * 0.45)
  ctx.lineTo(cx, cy + h * 0.15)
  ctx.stroke()
}

// Draw a C-scroll
function drawCScroll(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number,
  startAngle: number,
  sweepAngle: number,
  innerTurns: number
) {
  // Main arc
  ctx.beginPath()
  const arcSteps = 50
  for (let i = 0; i <= arcSteps; i++) {
    const t = i / arcSteps
    const angle = startAngle + t * sweepAngle
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Inner spiral at each end
  const endAngle1 = startAngle
  const endAngle2 = startAngle + sweepAngle

  const ex1 = cx + Math.cos(endAngle1) * radius
  const ey1 = cy + Math.sin(endAngle1) * radius
  drawScroll(ctx, ex1, ey1, endAngle1 + Math.PI, 1, radius * 0.3, innerTurns)

  const ex2 = cx + Math.cos(endAngle2) * radius
  const ey2 = cy + Math.sin(endAngle2) * radius
  drawScroll(ctx, ex2, ey2, endAngle2, -1, radius * 0.3, innerTurns)
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 82001, b: 82002, c: 82003, d: 82004 }
  const seed = seeds[variant] ?? 82001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v2 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === STEP 1: Weathered wall background ===
  // Render at pixel level for fine weathering texture
  const stuccoFBM = makeFBM(seed + 100, 300, 5)
  const stainFBM = makeFBM(seed + 200, 400, 4)
  const peelFBM = makeFBM(seed + 300, 120, 4)
  const colorVar = makeNoise(seed + 400, 200)
  const microTex = makeNoise(seed + 500, 4)
  const crackNoise = makeNoise(seed + 600, 6)
  const streakNoise = makeNoise(seed + 700, 15)

  // Wall color: faded coral/salmon
  const baseR = 210 + rand() * 15
  const baseG = 165 + rand() * 15
  const baseB = 142 + rand() * 10

  // Under-layer (older mint/cream paint)
  const underR = 190 + rand() * 15
  const underG = 200 + rand() * 12
  const underB = 180 + rand() * 10

  console.log("  Rendering weathered wall...")
  const wallData = ctx.createImageData(W, H)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4

      const stucco = stuccoFBM(x, y) * 0.5 + 0.5
      const stain = stainFBM(x, y) * 0.5 + 0.5
      const peel = peelFBM(x, y) * 0.5 + 0.5
      const cvar = colorVar(x, y) * 0.5 + 0.5
      const micro = microTex(x, y) * 0.5 + 0.5
      const crack = crackNoise(x, y) * 0.5 + 0.5
      const streak = streakNoise(x, y) * 0.5 + 0.5

      // Base wall color with stucco texture
      let r = baseR + (stucco - 0.5) * 20 + (micro - 0.5) * 6
      let g = baseG + (stucco - 0.5) * 16 + (micro - 0.5) * 5
      let b = baseB + (stucco - 0.5) * 12 + (micro - 0.5) * 4

      // Hue variation across wall (makes it feel hand-painted)
      r += (cvar - 0.5) * 18
      g += (cvar - 0.5) * 10
      b += (cvar - 0.5) * 8

      // Paint peeling reveals older layer
      if (peel > 0.58) {
        const pa = Math.min(1, (peel - 0.58) / 0.18)
        r = r * (1 - pa) + underR * pa
        g = g * (1 - pa) + underG * pa
        b = b * (1 - pa) + underB * pa

        // Peeling edges are darker (shadow under lifted paint)
        if (peel > 0.58 && peel < 0.64) {
          const edgeAmt = 1 - (peel - 0.58) / 0.06
          r *= (1 - edgeAmt * 0.2)
          g *= (1 - edgeAmt * 0.2)
          b *= (1 - edgeAmt * 0.2)
        }
      }

      // Water stains (vertical streaks, darker)
      const verticalBias = 0.5 + (y / H) * 0.5  // worse at bottom
      const stainStrength = stain * verticalBias
      if (stainStrength > 0.55) {
        // Add vertical streak pattern
        const streakStr = streak > 0.4 ? (streak - 0.4) / 0.6 : 0
        const sa = Math.min(0.45, (stainStrength - 0.55) / 0.3) * (0.5 + streakStr * 0.5)
        r = r * (1 - sa) + 115 * sa
        g = g * (1 - sa) + 100 * sa
        b = b * (1 - sa) + 82 * sa
      }

      // Fine cracks (dark thin lines)
      if (crack > 0.48 && crack < 0.52) {
        const crackAmt = 1 - Math.abs(crack - 0.50) / 0.02
        r -= crackAmt * 30
        g -= crackAmt * 25
        b -= crackAmt * 20
      }

      // === GOLDEN AFTERNOON LIGHT ===
      // Strong warm wash from upper-left
      const lightGrad = Math.max(0, Math.min(1,
        (1 - x / W) * 0.5 + (1 - y / H) * 0.3 + 0.25
      ))
      // Square the gradient for more dramatic falloff
      const lightStr = lightGrad * lightGrad * 0.25
      r = r * (1 - lightStr) + 255 * lightStr
      g = g * (1 - lightStr) + 215 * lightStr
      b = b * (1 - lightStr) + 155 * lightStr

      // Overall warm tone shift
      r *= 1.03
      g *= 0.98
      b *= 0.92

      // Subtle vignette
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vig = 1.0 - (cx * cx + cy * cy) * 0.3
      r *= vig
      g *= vig
      b *= vig

      wallData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      wallData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      wallData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      wallData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(wallData, 0, 0)

  // === STEP 2: Draw wrought iron with canvas 2D ===
  console.log("  Drawing wrought iron...")

  // Layout: railing fills middle 60% of image
  const railTop = H * 0.22
  const railBottom = H * 0.78
  const railHeight = railBottom - railTop

  // Iron style
  ctx.strokeStyle = "rgba(25, 22, 18, 0.92)"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  // Top and bottom rails (thick horizontal bars)
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.moveTo(-20, railTop)
  ctx.lineTo(W + 20, railTop)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-20, railBottom)
  ctx.lineTo(W + 20, railBottom)
  ctx.stroke()

  // Secondary inner rails (thinner)
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.moveTo(-20, railTop + 25)
  ctx.lineTo(W + 20, railTop + 25)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-20, railBottom - 25)
  ctx.lineTo(W + 20, railBottom - 25)
  ctx.stroke()

  // Vertical balusters
  const numBars = 5
  const barSpacing = W / numBars
  ctx.lineWidth = 10

  for (let i = 0; i <= numBars; i++) {
    const bx = i * barSpacing
    ctx.beginPath()
    ctx.moveTo(bx, railTop)
    ctx.lineTo(bx, railBottom)
    ctx.stroke()
  }

  // === Scrollwork panels between balusters ===
  const panelInnerTop = railTop + 35
  const panelInnerBottom = railBottom - 35
  const panelHeight = panelInnerBottom - panelInnerTop

  ctx.lineWidth = 6

  for (let i = 0; i < numBars; i++) {
    const panelLeft = i * barSpacing + 15
    const panelRight = (i + 1) * barSpacing - 15
    const panelWidth = panelRight - panelLeft
    const panelCenterX = (panelLeft + panelRight) / 2
    const panelCenterY = (panelInnerTop + panelInnerBottom) / 2

    // Large central lyre/heart motif
    drawLyre(ctx, panelCenterX, panelCenterY, panelWidth * 0.7, panelHeight * 0.7)

    // C-scrolls filling corners
    const cornerR = panelWidth * 0.18

    // Top-left
    drawCScroll(ctx,
      panelLeft + cornerR + 5, panelInnerTop + cornerR + 5,
      cornerR, Math.PI, Math.PI * 0.8, 1.0)

    // Top-right
    drawCScroll(ctx,
      panelRight - cornerR - 5, panelInnerTop + cornerR + 5,
      cornerR, 0, -Math.PI * 0.8, 1.0)

    // Bottom-left
    drawCScroll(ctx,
      panelLeft + cornerR + 5, panelInnerBottom - cornerR - 5,
      cornerR, Math.PI, -Math.PI * 0.8, 1.0)

    // Bottom-right
    drawCScroll(ctx,
      panelRight - cornerR - 5, panelInnerBottom - cornerR - 5,
      cornerR, 0, Math.PI * 0.8, 1.0)

    // Small connecting curves between corners and central motif
    ctx.lineWidth = 4

    // Upper connecting curves
    ctx.beginPath()
    ctx.moveTo(panelLeft + panelWidth * 0.15, panelInnerTop + panelHeight * 0.2)
    ctx.quadraticCurveTo(
      panelCenterX, panelInnerTop + panelHeight * 0.15,
      panelRight - panelWidth * 0.15, panelInnerTop + panelHeight * 0.2
    )
    ctx.stroke()

    // Lower connecting curves
    ctx.beginPath()
    ctx.moveTo(panelLeft + panelWidth * 0.15, panelInnerBottom - panelHeight * 0.2)
    ctx.quadraticCurveTo(
      panelCenterX, panelInnerBottom - panelHeight * 0.15,
      panelRight - panelWidth * 0.15, panelInnerBottom - panelHeight * 0.2
    )
    ctx.stroke()

    ctx.lineWidth = 6
  }

  // === STEP 3: Add iron texture/rust overlay ===
  console.log("  Adding iron texture...")
  const ironRust = makeFBM(seed + 800, 60, 4)
  const ironPit = makeNoise(seed + 900, 5)

  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2]

      // Detect iron pixels (dark, low saturation)
      const brightness = (r + g + b) / 3
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)

      if (brightness < 60 && (maxC - minC) < 25) {
        // This is an iron pixel — add rust and texture
        const rust = ironRust(x, y) * 0.5 + 0.5
        const pit = ironPit(x, y) * 0.5 + 0.5

        let ir = r, ig = g, ib = b

        // Rust spots
        if (rust > 0.55) {
          const rustAmt = (rust - 0.55) / 0.45 * 0.35
          ir = ir * (1 - rustAmt) + 85 * rustAmt
          ig = ig * (1 - rustAmt) + 42 * rustAmt
          ib = ib * (1 - rustAmt) + 18 * rustAmt
        }

        // Pitting texture
        if (pit > 0.45 && pit < 0.55) {
          ir = Math.max(0, ir - 8)
          ig = Math.max(0, ig - 6)
          ib = Math.max(0, ib - 5)
        }

        // Slight highlight on upper edges (light catch)
        const aboveIdx = ((y - 1) * W + x) * 4
        if (y > 0 && pixels[aboveIdx] > 80) {
          ir = Math.min(60, ir + 12)
          ig = Math.min(55, ig + 10)
          ib = Math.min(50, ib + 8)
        }

        pixels[idx] = ir
        pixels[idx + 1] = ig
        pixels[idx + 2] = ib
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // === STEP 4: Subtle warm haze overlay (humidity/atmosphere) ===
  console.log("  Adding atmosphere...")
  ctx.globalCompositeOperation = "screen"
  const hazeGrad = ctx.createLinearGradient(0, 0, W, H)
  hazeGrad.addColorStop(0, "rgba(255, 210, 140, 0.08)")
  hazeGrad.addColorStop(0.5, "rgba(255, 200, 130, 0.04)")
  hazeGrad.addColorStop(1, "rgba(200, 170, 140, 0.02)")
  ctx.fillStyle = hazeGrad
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = "source-over"

  const filename = `output/nostalgia-v2-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
