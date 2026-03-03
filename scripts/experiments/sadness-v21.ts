/**
 * SADNESS v21 — TRAILING OFF
 *
 * Stop looking for the right noise function. Think about what GESTURE
 * communicates sadness.
 *
 * The saddest abstract image: a single mark that starts strong and
 * trails off into nothing. Like a voice going quiet. Like the last
 * heartbeat. Like a sentence that was never finished.
 *
 * Implementation:
 * - Warm cream background (same calm base as anger v12)
 * - One horizontal mark, slightly arcing downward
 * - Left side: thick, confident, warm dark rose-brown
 * - Crossing the canvas, it gradually:
 *   - Thins (the pressure is lifting)
 *   - Lightens (the ink is running out)
 *   - Desaturates (the color is leaving)
 *   - Sinks slightly (gravity)
 * - Right side: barely there. A whisper. Then gone.
 * - Below the main stroke: the faintest ghost of a second attempt.
 *   Started, gave up after a few inches. The FAILURE to continue.
 *
 * Rothko-simple. One element. The fading IS the emotion.
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
  const seeds: Record<string, number> = { a: 99901, b: 99902, c: 99903, d: 99904 }
  const seed = seeds[variant] ?? 99901
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v21 variant ${variant} (seed: ${seed}) ===`)

  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)
  const edgeNoise = makeNoise(seed + 200, 12)
  const edgeNoise2 = makeNoise(seed + 210, 30)

  // === Generate the main fading stroke ===
  // A gentle arc from left to right, starting strong, trailing off
  interface StrokePoint {
    x: number; y: number
    width: number     // stroke width at this point
    opacity: number   // ink density (fading)
    saturation: number // color saturation (desaturating)
  }

  const strokePoints: StrokePoint[] = []

  // Start position: left side, slightly above center
  const startX = W * 0.06
  const startY = H * (0.38 + rand() * 0.06)
  const endX = W * (0.82 + rand() * 0.12)

  // The stroke travels mostly horizontally with a slight downward arc
  const arcDepth = H * (0.04 + rand() * 0.04)  // gentle sag
  const totalLength = endX - startX
  const steps = Math.ceil(totalLength / 2)

  for (let i = 0; i <= steps; i++) {
    const t = i / steps  // 0 at start, 1 at end

    const x = startX + t * totalLength
    // Gentle downward arc: parabolic sag
    const arc = arcDepth * 4 * t * (1 - t * 0.3)  // sags more toward the end
    // Slight wavering
    const waver = edgeNoise2(x * 0.5, startY) * 12 * t  // more wavering as it fades

    const y = startY + arc + waver

    // === Width: starts thick, gradually thins ===
    // Not linear — holds width for a while, then drops off
    let width: number
    if (t < 0.15) {
      // Opening: full width, slight ramp-up
      width = 28 + t / 0.15 * 12
    } else if (t < 0.5) {
      // Mid: gradually thinning
      const thinT = (t - 0.15) / 0.35
      width = 40 - thinT * 15
    } else {
      // Trailing off: accelerating thinning
      const fadeT = (t - 0.5) / 0.5
      width = 25 * Math.pow(1.0 - fadeT, 1.8)
    }
    // Noise variation
    width *= (0.85 + edgeNoise(x, y) * 0.25)
    width = Math.max(1, width)

    // === Opacity: full → fading ===
    let opacity: number
    if (t < 0.3) {
      opacity = 0.90 + rand() * 0.05
    } else if (t < 0.6) {
      const fadeT = (t - 0.3) / 0.3
      opacity = 0.90 - fadeT * 0.30
    } else {
      const fadeT = (t - 0.6) / 0.4
      opacity = 0.60 * Math.pow(1.0 - fadeT, 2.0)
    }

    // === Saturation: full color → desaturated ===
    let saturation: number
    if (t < 0.4) {
      saturation = 0.95
    } else {
      const desatT = (t - 0.4) / 0.6
      saturation = 0.95 * (1.0 - desatT * 0.85)
    }

    strokePoints.push({ x, y, width, opacity, saturation })
  }

  // === Ghost stroke: a second attempt that gives up ===
  const ghostPoints: StrokePoint[] = []
  const ghostStartX = startX + totalLength * (0.15 + rand() * 0.10)
  const ghostStartY = startY + H * (0.12 + rand() * 0.04)
  const ghostLength = totalLength * (0.08 + rand() * 0.06)
  const ghostSteps = Math.ceil(ghostLength / 3)

  for (let i = 0; i <= ghostSteps; i++) {
    const t = i / ghostSteps
    const x = ghostStartX + t * ghostLength
    const y = ghostStartY + t * 6 + edgeNoise2(x, ghostStartY) * 4

    // Ghost is always thin and faint
    const width = (8 + (1 - t) * 8) * (0.8 + edgeNoise(x, y) * 0.3)
    const opacity = 0.25 * (1.0 - t * t)  // fades quickly
    const saturation = 0.4 * (1.0 - t * 0.6)  // barely saturated

    ghostPoints.push({ x, y, width, opacity, saturation })
  }

  console.log(`  Main stroke: ${strokePoints.length} points, ghost: ${ghostPoints.length} points`)

  // === Compute ink map ===
  const inkMap = new Float32Array(W * H)
  const satMap = new Float32Array(W * H)  // saturation at each inked pixel

  function depositStroke(points: StrokePoint[]) {
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1], p1 = points[i]
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)
      const subSteps = Math.max(1, Math.ceil(segDist / 1.5))

      for (let s = 0; s <= subSteps; s++) {
        const t = s / subSteps
        const cx = p0.x + dx * t
        const cy = p0.y + dy * t
        const cW = p0.width * (1 - t) + p1.width * t
        const cO = p0.opacity * (1 - t) + p1.opacity * t
        const cS = p0.saturation * (1 - t) + p1.saturation * t

        const margin = Math.ceil(cW * 2)
        const minX = Math.max(0, Math.floor(cx - margin))
        const maxX = Math.min(W - 1, Math.ceil(cx + margin))
        const minY = Math.max(0, Math.floor(cy - margin))
        const maxY = Math.min(H - 1, Math.ceil(cy + margin))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx, ddy = py - cy
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)

            const en = edgeNoise(px, py) * 0.35 + edgeNoise2(px, py) * 0.2
            const effWidth = cW * (1.0 + en * 0.6)

            if (dist < effWidth) {
              const falloff = 1.0 - dist / effWidth
              const inkAmount = falloff * falloff * cO
              const idx = py * W + px
              if (inkAmount > inkMap[idx]) {
                // Track highest saturation at each point
                satMap[idx] = cS
              }
              inkMap[idx] = Math.min(1.0, inkMap[idx] + inkAmount * 0.5)
            }
          }
        }
      }
    }
  }

  depositStroke(strokePoints)
  depositStroke(ghostPoints)

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkMap[idx]
      const sat = satMap[idx]

      // Background: warm cream (same as anger v12)
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5
      let bgR = 232 + bn * 10
      let bgG = 225 + bn * 8
      let bgB = 215 + bn * 6

      if (ink < 0.005) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Ink color: dark warm rose-brown when saturated, grey when desaturated
      // Full saturation: deep rose-brown (warm, alive)
      const fullR = 80
      const fullG = 35
      const fullB = 30

      // Desaturated: warm grey (the color leaving)
      const greyVal = 95
      const greyR = greyVal + 5
      const greyG = greyVal
      const greyB = greyVal - 3

      // Blend based on saturation
      const inkR = fullR * sat + greyR * (1 - sat)
      const inkG = fullG * sat + greyG * (1 - sat)
      const inkB = fullB * sat + greyB * (1 - sat)

      // Apply ink to background
      const opacity = Math.min(1.0, ink * 1.3)
      const r = bgR * (1 - opacity) + inkR * opacity
      const g = bgG * (1 - opacity) + inkG * opacity
      const b = bgB * (1 - opacity) + inkB * opacity

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

  const filename = `output/sadness-v21-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
