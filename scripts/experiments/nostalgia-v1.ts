/**
 * NOSTALGIA v1 — NEW ORLEANS BALCONY
 *
 * The most iconic New Orleans image: wrought iron balcony railing
 * against a weathered pastel facade in late afternoon light.
 *
 * Elements:
 * - Weathered stucco wall in faded pastel (coral/salmon/mint)
 * - Wrought iron scrollwork railing (mathematical curves)
 * - Golden afternoon light washing across from one side
 * - Peeling paint / water stains / age (multi-octave noise)
 * - Shuttered window partially visible
 * - The sense of looking UP at a balcony from a narrow street
 *
 * The warmth comes from the palette and light.
 * The nostalgia comes from the weathering — nothing is new, everything is layered.
 * The place comes from the iron and architecture.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2560  // Portrait — looking up at a balcony

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

// Fractal Brownian Motion — layered noise for organic weathering
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

// ---- Wrought iron scrollwork generation ----

// Evaluate distance to a spiral scroll (used in iron patterns)
function spiralDist(px: number, py: number, cx: number, cy: number,
  startAngle: number, turns: number, startRadius: number, endRadius: number): number {
  const dx = px - cx, dy = py - cy
  const dist = Math.sqrt(dx * dx + dy * dy)
  const angle = Math.atan2(dy, dx)

  let minDist = Infinity
  // Check multiple winds of the spiral
  for (let w = -1; w <= Math.ceil(turns) + 1; w++) {
    const targetAngle = startAngle + w * Math.PI * 2
    const t = (targetAngle - startAngle) / (turns * Math.PI * 2)
    if (t < -0.1 || t > 1.1) continue
    const tc = Math.max(0, Math.min(1, t))
    const r = startRadius + (endRadius - startRadius) * tc
    const spiralX = cx + Math.cos(targetAngle) * r
    const spiralY = cy + Math.sin(targetAngle) * r
    const d = Math.sqrt((px - spiralX) ** 2 + (py - spiralY) ** 2)
    minDist = Math.min(minDist, d)

    // Also check nearby angle equivalences
    for (const off of [-Math.PI * 2, Math.PI * 2]) {
      const a2 = targetAngle + off
      const t2 = (a2 - startAngle) / (turns * Math.PI * 2)
      if (t2 < -0.1 || t2 > 1.1) continue
      const tc2 = Math.max(0, Math.min(1, t2))
      const r2 = startRadius + (endRadius - startRadius) * tc2
      const sx2 = cx + Math.cos(a2) * r2
      const sy2 = cy + Math.sin(a2) * r2
      const d2 = Math.sqrt((px - sx2) ** 2 + (py - sy2) ** 2)
      minDist = Math.min(minDist, d2)
    }
  }
  return minDist
}

// Distance to a smooth curve (quadratic bezier)
function bezierDist(px: number, py: number,
  x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): number {
  let minD = Infinity
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1
    const by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
    const d = Math.sqrt((px - bx) ** 2 + (py - by) ** 2)
    minD = Math.min(minD, d)
  }
  return minD
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 80001, b: 80002, c: 80003, d: 80004 }
  const seed = seeds[variant] ?? 80001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v1 variant ${variant} (seed: ${seed}) ===`)

  // Noise for weathering
  const stuccoFBM = makeFBM(seed + 100, 300, 5)
  const stainFBM = makeFBM(seed + 200, 500, 4)
  const crackNoise = makeNoise(seed + 300, 8)
  const peelNoise = makeFBM(seed + 400, 100, 4)
  const colorVar = makeNoise(seed + 500, 250)
  const microTex = makeNoise(seed + 600, 3)

  // === Color palette ===
  // Base wall color: faded coral/salmon (warm but aged)
  const wallR = 205 + rand() * 15
  const wallG = 160 + rand() * 15
  const wallB = 140 + rand() * 10

  // Secondary (older paint showing through)
  const underR = 185 + rand() * 20
  const underG = 195 + rand() * 15
  const underB = 175 + rand() * 15

  // Stain/weathering colors
  const stainR = 120
  const stainG = 105
  const stainB = 85

  // Iron color
  const ironR = 30
  const ironG = 28
  const ironB = 25

  // Golden light direction (from upper-left)
  const lightAngle = -0.4 + rand() * 0.3
  const lightX = Math.cos(lightAngle)
  const lightY = Math.sin(lightAngle)

  // === Architectural layout ===
  // Balcony rail runs horizontally across the image
  const railY = H * 0.55  // Balcony rail position (lower portion = looking up)
  const railHeight = 12   // Rail bar thickness
  const balconyTop = railY - H * 0.28  // Top of balcony railing
  const balconyBottom = railY + railHeight

  // Vertical bars (balusters) positions
  const numBars = 7
  const barSpacing = W / (numBars + 1)
  const barWidth = 8

  // Window (partially visible above balcony)
  const winLeft = W * 0.25
  const winRight = W * 0.75
  const winTop = H * 0.05
  const winBottom = balconyTop - H * 0.02
  const shutterWidth = (winRight - winLeft) * 0.25
  const shutterSlats = 14

  // === Generate iron scrollwork pattern ===
  // Between each pair of balusters, place scrollwork
  interface ScrollPanel {
    left: number
    right: number
    top: number
    bottom: number
    // Each panel has mirrored S-scrolls
    scrollCenterY: number
  }

  const panels: ScrollPanel[] = []
  for (let i = 0; i <= numBars; i++) {
    const left = i === 0 ? 0 : i * barSpacing
    const right = (i + 1) * barSpacing
    panels.push({
      left, right,
      top: balconyTop,
      bottom: railY,
      scrollCenterY: (balconyTop + railY) / 2,
    })
  }

  // Pre-compute distance field for iron elements
  console.log("  Computing iron distance field...")

  function ironDistance(px: number, py: number): number {
    let minDist = Infinity

    // Top rail
    const dTopRail = Math.abs(py - balconyTop)
    if (dTopRail < 10) minDist = Math.min(minDist, dTopRail)

    // Bottom rail
    const dBotRail = Math.abs(py - railY)
    if (dBotRail < 10) minDist = Math.min(minDist, dBotRail)

    // Vertical balusters
    for (let i = 1; i <= numBars; i++) {
      const bx = i * barSpacing
      if (py >= balconyTop - 5 && py <= railY + 5) {
        const d = Math.abs(px - bx)
        minDist = Math.min(minDist, d)
      }
    }

    // Scrollwork in each panel
    for (const panel of panels) {
      const panelW = panel.right - panel.left
      const panelH = panel.bottom - panel.top
      const centerX = (panel.left + panel.right) / 2
      const centerY = panel.scrollCenterY

      // Two mirrored C-scrolls (one curving up, one curving down)
      const scrollRadius = Math.min(panelW, panelH) * 0.30
      const smallRadius = scrollRadius * 0.35

      // Upper scroll (C opening downward)
      const upperCx = centerX
      const upperCy = centerY - scrollRadius * 0.4
      const dUpper = spiralDist(px, py, upperCx, upperCy,
        Math.PI * 0.5, 1.2, scrollRadius, smallRadius)
      minDist = Math.min(minDist, dUpper)

      // Lower scroll (C opening upward) — mirror
      const lowerCx = centerX
      const lowerCy = centerY + scrollRadius * 0.4
      const dLower = spiralDist(px, py, lowerCx, lowerCy,
        -Math.PI * 0.5, 1.2, scrollRadius, smallRadius)
      minDist = Math.min(minDist, dLower)

      // Connecting vertical stem
      const stemX = centerX
      if (Math.abs(px - stemX) < 4) {
        if (py >= upperCy - smallRadius && py <= lowerCy + smallRadius) {
          minDist = Math.min(minDist, Math.abs(px - stemX))
        }
      }

      // Small decorative leaves/teardrops at scroll ends
      const leafSize = smallRadius * 0.8
      // Upper leaf
      const ulx = upperCx + Math.cos(Math.PI * 0.5 + 1.2 * Math.PI * 2) * smallRadius
      const uly = upperCy + Math.sin(Math.PI * 0.5 + 1.2 * Math.PI * 2) * smallRadius
      const dLeafU = Math.sqrt((px - ulx) ** 2 + (py - uly) ** 2)
      if (dLeafU < leafSize) minDist = Math.min(minDist, dLeafU * 0.7)
      // Lower leaf
      const llx = lowerCx + Math.cos(-Math.PI * 0.5 + 1.2 * Math.PI * 2) * smallRadius
      const lly = lowerCy + Math.sin(-Math.PI * 0.5 + 1.2 * Math.PI * 2) * smallRadius
      const dLeafL = Math.sqrt((px - llx) ** 2 + (py - lly) ** 2)
      if (dLeafL < leafSize) minDist = Math.min(minDist, dLeafL * 0.7)

      // Side bezier flourishes connecting scrolls to balusters
      const sideMargin = panelW * 0.12
      // Left side
      const dBezL = bezierDist(px, py,
        panel.left + sideMargin, centerY - scrollRadius * 0.6,
        panel.left + sideMargin + panelW * 0.1, centerY,
        panel.left + sideMargin, centerY + scrollRadius * 0.6)
      minDist = Math.min(minDist, dBezL)
      // Right side
      const dBezR = bezierDist(px, py,
        panel.right - sideMargin, centerY - scrollRadius * 0.6,
        panel.right - sideMargin - panelW * 0.1, centerY,
        panel.right - sideMargin, centerY + scrollRadius * 0.6)
      minDist = Math.min(minDist, dBezR)
    }

    return minDist
  }

  // === Render ===
  console.log("  Rendering...")
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // --- Base wall ---
      const stucco = stuccoFBM(x, y) * 0.5 + 0.5  // 0-1
      const stain = stainFBM(x, y) * 0.5 + 0.5
      const peel = peelNoise(x, y) * 0.5 + 0.5
      const cvar = colorVar(x, y) * 0.5 + 0.5
      const micro = microTex(x, y) * 0.5 + 0.5

      // Stucco texture variation
      let r = wallR + stucco * 12 - 6 + micro * 4 - 2
      let g = wallG + stucco * 10 - 5 + micro * 3 - 1.5
      let b = wallB + stucco * 8 - 4 + micro * 2 - 1

      // Older paint showing through in patches
      if (peel > 0.62) {
        const peelAmount = Math.min(1, (peel - 0.62) / 0.15)
        r = r * (1 - peelAmount) + underR * peelAmount
        g = g * (1 - peelAmount) + underG * peelAmount
        b = b * (1 - peelAmount) + underB * peelAmount
      }

      // Water stains (darker, vertical streaks)
      if (stain > 0.55) {
        const stainAmount = Math.min(0.5, (stain - 0.55) / 0.3)
        // Vertical bias — stains run downward
        const vertBias = Math.max(0, (y / H - 0.3)) * 0.3
        const sa = stainAmount * (1 + vertBias)
        r = r * (1 - sa) + stainR * sa
        g = g * (1 - sa) + stainG * sa
        b = b * (1 - sa) + stainB * sa
      }

      // Color variation (slight hue shifts across the wall)
      r += (cvar - 0.5) * 15
      g += (cvar - 0.5) * 8
      b += (cvar - 0.5) * 6

      // === Golden afternoon light ===
      // Light comes from upper-left, stronger on left side and upper portion
      const lightFactor = Math.max(0, (1 - x / W) * 0.4 + (1 - y / H) * 0.2 + 0.4)
      const goldR = 255
      const goldG = 220
      const goldB = 160
      const goldAmount = lightFactor * 0.15
      r = r * (1 - goldAmount) + goldR * goldAmount
      g = g * (1 - goldAmount) + goldG * goldAmount
      b = b * (1 - goldAmount) + goldB * goldAmount

      // Shadow from balcony rail — everything below the rail is slightly darker
      if (y > railY + 20) {
        const shadowDepth = Math.min(0.15, (y - railY - 20) / 400 * 0.15)
        r *= (1 - shadowDepth)
        g *= (1 - shadowDepth)
        b *= (1 - shadowDepth)
      }

      // === Window ===
      const inWindow = x > winLeft && x < winRight && y > winTop && y < winBottom
      const inLeftShutter = x > winLeft - shutterWidth - 10 && x < winLeft - 10 &&
        y > winTop - 5 && y < winBottom + 5
      const inRightShutter = x > winRight + 10 && x < winRight + shutterWidth + 10 &&
        y > winTop - 5 && y < winBottom + 5

      if (inWindow) {
        // Dark interior visible through window
        const interiorR = 35 + stucco * 10
        const interiorG = 30 + stucco * 8
        const interiorB = 28 + stucco * 6
        // Slight warm reflection on glass
        const reflAmount = Math.max(0, 0.15 - (x - winLeft) / (winRight - winLeft) * 0.1)
        r = interiorR + reflAmount * 40
        g = interiorG + reflAmount * 30
        b = interiorB + reflAmount * 15

        // Window frame
        const frameW = 8
        if (x < winLeft + frameW || x > winRight - frameW ||
          y < winTop + frameW || y > winBottom - frameW) {
          r = 190 + stucco * 10
          g = 175 + stucco * 8
          b = 155 + stucco * 6
        }
        // Center mullion
        if (Math.abs(x - (winLeft + winRight) / 2) < frameW / 2) {
          r = 190 + stucco * 10
          g = 175 + stucco * 8
          b = 155 + stucco * 6
        }
      }

      // Shutters (louvered)
      if (inLeftShutter || inRightShutter) {
        const shutterBaseR = 95 + cvar * 20
        const shutterBaseG = 120 + cvar * 15
        const shutterBaseB = 100 + cvar * 12

        // Louver slats
        const shutterH = winBottom - winTop + 10
        const slatH = shutterH / shutterSlats
        const localY = y - (winTop - 5)
        const slatPos = (localY % slatH) / slatH

        // Each slat has a light edge and shadow
        let slatShade = 1.0
        if (slatPos < 0.15) slatShade = 0.7  // shadow under slat above
        else if (slatPos > 0.85) slatShade = 1.1  // light edge

        r = shutterBaseR * slatShade + micro * 5
        g = shutterBaseG * slatShade + micro * 4
        b = shutterBaseB * slatShade + micro * 3

        // Weathering on shutters too
        if (peel > 0.65) {
          const pa = Math.min(0.4, (peel - 0.65) / 0.2)
          r = r * (1 - pa) + 140 * pa
          g = g * (1 - pa) + 130 * pa
          b = b * (1 - pa) + 120 * pa
        }

        // Shutter frame
        const sx0 = inLeftShutter ? winLeft - shutterWidth - 10 : winRight + 10
        const sx1 = inLeftShutter ? winLeft - 10 : winRight + shutterWidth + 10
        const framePad = 6
        if (x < sx0 + framePad || x > sx1 - framePad ||
          y < winTop - 5 + framePad || y > winBottom + 5 - framePad) {
          r = shutterBaseR * 0.85
          g = shutterBaseG * 0.85
          b = shutterBaseB * 0.85
        }
      }

      // === Wrought iron ===
      if (y >= balconyTop - 15 && y <= railY + 25) {
        const d = ironDistance(x, y)
        const ironThickness = 5.0

        if (d < ironThickness) {
          // Iron with slight texture
          const ironMicro = micro * 0.3
          const ironShade = 1.0 - (d / ironThickness) * 0.15  // slight rounding
          r = (ironR + ironMicro * 15) * ironShade
          g = (ironG + ironMicro * 12) * ironShade
          b = (ironB + ironMicro * 10) * ironShade

          // Slight rust on some areas
          const rustNoise = stuccoFBM(x + 5000, y + 5000) * 0.5 + 0.5
          if (rustNoise > 0.6) {
            const rustAmt = (rustNoise - 0.6) / 0.4 * 0.3
            r = r * (1 - rustAmt) + 90 * rustAmt
            g = g * (1 - rustAmt) + 45 * rustAmt
            b = b * (1 - rustAmt) + 20 * rustAmt
          }
        } else if (d < ironThickness + 3) {
          // Anti-aliasing edge
          const aa = 1.0 - (d - ironThickness) / 3
          const irR = (ironR + micro * 5)
          const irG = (ironG + micro * 4)
          const irB = (ironB + micro * 3)
          r = r * (1 - aa) + irR * aa
          g = g * (1 - aa) + irG * aa
          b = b * (1 - aa) + irB * aa
        }
      }

      // === Balcony floor (visible at bottom of railing) ===
      if (y > railY + railHeight && y < railY + railHeight + 30) {
        // Concrete/stone balcony floor edge
        const floorShade = 0.85 + stucco * 0.1
        r = 170 * floorShade + micro * 5
        g = 162 * floorShade + micro * 4
        b = 150 * floorShade + micro * 3
      }

      // === Overall warm tone shift ===
      // Everything slightly warm/amber — the color of memory
      r = r * 1.02
      g = g * 0.98
      b = b * 0.93

      // === Vignette (subtle, warm) ===
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vignette = 1.0 - (cx * cx + cy * cy) * 0.4
      r *= vignette
      g *= vignette
      b *= vignette

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

  const filename = `output/nostalgia-v1-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
