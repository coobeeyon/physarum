/**
 * SADNESS v22 — TREMBLING TRAIL
 *
 * v21 was the right CONCEPT (a single mark trailing off into nothing)
 * but too PERFECT. It reads as calligraphy, not emotion.
 *
 * What v21 was missing:
 * - Tremor: the hand shakes. Not smooth noise — micro-trembling,
 *   like someone trying to hold steady and failing.
 * - Hesitation: the stroke PAUSES. Pressure builds up (pooling),
 *   then continues weakly. Like someone stopping to breathe.
 * - Pressure interruptions: the stroke breaks. Picks up a few pixels
 *   later. The pen lifted involuntarily.
 * - Uneven ending: real dying strokes don't taper to a perfect point.
 *   They puddle, stutter, leave erratic dots as the ink gives out.
 *
 * The ghost stroke should start closer to the main stroke's beginning —
 * it's trying to RETRACE the original gesture but fails after a few
 * centimeters. The proximity to the main stroke's start makes it clear
 * this was a second attempt at the same thing.
 *
 * Same warm cream background. Same rose-brown ink. But the mark itself
 * should look like it was made by a HUMAN hand that was shaking.
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

interface StrokePoint {
  x: number; y: number
  width: number
  opacity: number
  saturation: number
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 10101, b: 10102, c: 10103, d: 10104 }
  const seed = seeds[variant] ?? 10101
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v22 variant ${variant} (seed: ${seed}) ===`)

  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const bgNoise3 = makeNoise(seed + 120, 40)
  const edgeNoise = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 25)
  const tremorNoise1 = makeNoise(seed + 300, 8)   // tremor component 1
  const tremorNoise2 = makeNoise(seed + 310, 14)  // tremor component 2 (different freq)
  const tremorNoise3 = makeNoise(seed + 320, 22)  // slower drift

  // === Main stroke: fading with tremor and hesitation ===
  const strokePoints: StrokePoint[] = []

  const startX = W * 0.08
  const startY = H * (0.36 + rand() * 0.08)
  const endX = W * (0.78 + rand() * 0.10)
  const totalLength = endX - startX

  // Pre-compute hesitation points: 2-3 places where the stroke pauses
  const numHesitations = 2 + (rand() > 0.5 ? 1 : 0)
  const hesitations: { t: number; duration: number; strength: number }[] = []
  for (let i = 0; i < numHesitations; i++) {
    hesitations.push({
      t: 0.25 + rand() * 0.45,  // where in the stroke (25-70%)
      duration: 0.02 + rand() * 0.02,  // how long the pause lasts
      strength: 0.5 + rand() * 0.4  // how much it affects the stroke
    })
  }
  hesitations.sort((a, b) => a.t - b.t)

  // Pre-compute break points: 1-2 places where the stroke lifts entirely
  const numBreaks = 1 + (rand() > 0.6 ? 1 : 0)
  const breaks: { t: number; gap: number }[] = []
  for (let i = 0; i < numBreaks; i++) {
    breaks.push({
      t: 0.45 + rand() * 0.35,  // breaks happen in the second half
      gap: 0.008 + rand() * 0.012  // tiny gap
    })
  }
  breaks.sort((a, b) => a.t - b.t)

  const steps = Math.ceil(totalLength / 1.5)

  // Accumulate a slight downward drift (gravity + fatigue)
  let cumulativeDropY = 0

  for (let i = 0; i <= steps; i++) {
    const t = i / steps

    // Check if we're in a break gap
    let inBreak = false
    for (const brk of breaks) {
      if (t >= brk.t && t < brk.t + brk.gap) {
        inBreak = true
        break
      }
    }
    if (inBreak) continue  // skip — pen is lifted

    const x = startX + t * totalLength

    // === Y position: gentle arc + tremor + drift ===
    // Gentle downward arc
    const arcDepth = H * (0.05 + rand() * 0.02)
    const arc = arcDepth * 4 * t * (1 - t * 0.25)

    // TREMOR: irregular wavering that increases with fatigue
    // Combine multiple frequencies so it doesn't look periodic/seismographic
    const tremorGrow = Math.pow(t, 1.5)  // grows nonlinearly
    const t1 = tremorNoise1(x * 1.8, startY) * 6 * tremorGrow
    const t2 = tremorNoise2(x * 1.2, startY + 300) * 10 * tremorGrow
    const t3 = tremorNoise3(x * 0.7, startY + 600) * 8 * tremorGrow
    // Random jolts: sudden displacements at unpredictable points
    const jolt = (rand() < 0.03 + t * 0.06) ? (rand() - 0.5) * 25 * t : 0
    const tremor = t1 + t2 + t3 + jolt

    // Slower wavering (the arm getting heavy)
    const waver = edgeNoise2(x * 0.4, startY) * 12 * t

    // Cumulative downward drift (fatigue — the hand sinks)
    cumulativeDropY += (0.015 + t * 0.12) * (0.8 + rand() * 0.4)

    const y = startY + arc + tremor + waver + cumulativeDropY

    // === Width ===
    let width: number
    if (t < 0.10) {
      // Opening: ramp up
      width = 20 + t / 0.10 * 25
    } else if (t < 0.40) {
      // Strong section: thick but with pressure variation
      const pressureVar = Math.sin(t * 25) * 4 + tremorNoise1(x, y + 1000) * 6
      width = 45 + pressureVar
    } else if (t < 0.65) {
      // Thinning
      const thinT = (t - 0.40) / 0.25
      width = 45 - thinT * 22
    } else {
      // Trailing: irregular thinning with stutters
      const fadeT = (t - 0.65) / 0.35
      width = 23 * Math.pow(1.0 - fadeT, 1.5)
      // Stuttering: occasional widening (ink pooling as the pen slows)
      if (rand() < 0.08) {
        width *= 1.5 + rand() * 0.8
      }
    }

    // Hesitation: at pause points, width increases (pooling) then drops
    for (const hes of hesitations) {
      const dt = Math.abs(t - hes.t)
      if (dt < hes.duration * 2) {
        const hesT = 1.0 - dt / (hes.duration * 2)
        // Pooling: width increases at the hesitation point
        width *= 1.0 + hesT * hesT * 0.6 * hes.strength
      }
    }

    // Edge noise for organic edges
    width *= (0.82 + edgeNoise(x, y) * 0.28)
    width = Math.max(1.5, width)

    // === Opacity ===
    let opacity: number
    if (t < 0.25) {
      opacity = 0.88 + rand() * 0.06
    } else if (t < 0.55) {
      const fadeT = (t - 0.25) / 0.30
      opacity = 0.88 - fadeT * 0.25
      // Hesitation bumps: ink darkens where the pen pauses
      for (const hes of hesitations) {
        const dt = Math.abs(t - hes.t)
        if (dt < hes.duration * 1.5) {
          opacity += 0.08 * hes.strength
        }
      }
    } else {
      const fadeT = (t - 0.55) / 0.45
      opacity = 0.63 * Math.pow(1.0 - fadeT, 1.8)
      // Sporadic ink return — the pen catches briefly
      if (rand() < 0.04 && fadeT < 0.7) {
        opacity += 0.15 + rand() * 0.10
      }
    }

    // === Saturation ===
    let saturation: number
    if (t < 0.35) {
      saturation = 0.92 + rand() * 0.05
    } else {
      const desatT = (t - 0.35) / 0.65
      saturation = 0.92 * (1.0 - desatT * 0.80)
    }

    strokePoints.push({ x, y, width, opacity, saturation })
  }

  // === Ending: scatter dots where the ink gives out ===
  // Not a clean taper — erratic dots as the pen stutters to nothing
  const lastPoint = strokePoints[strokePoints.length - 1]
  const scatterCount = 4 + Math.floor(rand() * 5)
  let scatterX = lastPoint.x
  let scatterY = lastPoint.y

  for (let i = 0; i < scatterCount; i++) {
    scatterX += 8 + rand() * 20
    scatterY += (rand() - 0.4) * 6 + 1.5  // slightly downward
    const dotWidth = 2 + rand() * 5
    const dotOpacity = 0.08 + rand() * 0.18
    strokePoints.push({
      x: scatterX, y: scatterY,
      width: dotWidth, opacity: dotOpacity,
      saturation: 0.15 + rand() * 0.15
    })
  }

  // === Ghost stroke: retrace attempt ===
  // Starts near where the main stroke began, slightly below
  // Tries to follow the same path but fails after a short distance
  // BIGGER than v21/v22a — needs to be visible at phone size
  const ghostPoints: StrokePoint[] = []
  const ghostStartX = startX + totalLength * (0.01 + rand() * 0.04)
  const ghostStartY = startY + H * (0.09 + rand() * 0.04)
  const ghostLength = totalLength * (0.12 + rand() * 0.08)  // longer than before
  const ghostSteps = Math.ceil(ghostLength / 2)

  for (let i = 0; i <= ghostSteps; i++) {
    const t = i / ghostSteps
    const x = ghostStartX + t * ghostLength

    // Ghost trembles more — combining noise for organic feel
    const gt1 = tremorNoise1(x * 2, ghostStartY + 500) * (3 + t * 8)
    const gt2 = tremorNoise2(x * 1.5, ghostStartY + 700) * (2 + t * 6)
    const y = ghostStartY + t * 10 + gt1 + gt2

    // Starts with some presence, then fades quickly
    let width = (10 + (1 - t) * 16) * (0.7 + edgeNoise(x, y) * 0.35)
    const opacity = 0.35 * Math.pow(1.0 - t, 1.3)  // more visible at start
    const saturation = 0.45 * (1.0 - t * 0.6)

    // Ghost hesitates early — a pool where it almost stopped
    if (t > 0.20 && t < 0.35) {
      width *= 1.4
    }

    ghostPoints.push({ x, y, width, opacity, saturation })
  }

  // Maybe a third attempt? Even fainter, even shorter
  const thirdAttempt: StrokePoint[] = []
  if (rand() > 0.35) {
    const thirdStartX = ghostStartX + ghostLength * (0.3 + rand() * 0.4)
    const thirdStartY = ghostStartY + H * (0.06 + rand() * 0.03)
    const thirdLength = totalLength * (0.02 + rand() * 0.02)
    const thirdSteps = Math.ceil(thirdLength / 3)

    for (let i = 0; i <= thirdSteps; i++) {
      const t = i / thirdSteps
      const x = thirdStartX + t * thirdLength
      const y = thirdStartY + t * 3 + tremorNoise1(x * 4, thirdStartY + 1000) * 6
      const width = (4 + (1 - t) * 4) * (0.6 + edgeNoise(x, y) * 0.3)
      const opacity = 0.12 * (1.0 - t * t)
      const saturation = 0.20

      thirdAttempt.push({ x, y, width, opacity, saturation })
    }
  }

  console.log(`  Main: ${strokePoints.length} pts, ghost: ${ghostPoints.length} pts, third: ${thirdAttempt.length} pts`)

  // === Render ===
  const inkMap = new Float32Array(W * H)
  const satMap = new Float32Array(W * H)

  function depositStroke(points: StrokePoint[]) {
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1], p1 = points[i]
      const dx = p1.x - p0.x, dy = p1.y - p0.y
      const segDist = Math.sqrt(dx * dx + dy * dy)

      // If segment is very long (scattered dots), just deposit the point itself
      if (segDist > 60) {
        depositPoint(p1)
        continue
      }

      const subSteps = Math.max(1, Math.ceil(segDist / 1.2))

      for (let s = 0; s <= subSteps; s++) {
        const t = s / subSteps
        const cx = p0.x + dx * t
        const cy = p0.y + dy * t
        const cW = p0.width * (1 - t) + p1.width * t
        const cO = p0.opacity * (1 - t) + p1.opacity * t
        const cS = p0.saturation * (1 - t) + p1.saturation * t

        depositAt(cx, cy, cW, cO, cS)
      }
    }
    // Also deposit the first point
    if (points.length > 0) {
      depositPoint(points[0])
    }
  }

  function depositPoint(p: StrokePoint) {
    depositAt(p.x, p.y, p.width, p.opacity, p.saturation)
  }

  function depositAt(cx: number, cy: number, cW: number, cO: number, cS: number) {
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
        const effWidth = cW * (1.0 + en * 0.5)

        if (dist < effWidth) {
          const falloff = 1.0 - dist / effWidth
          // Sharper falloff for more defined edges (less blurry)
          const inkAmount = falloff * falloff * falloff * cO
          const idx = py * W + px
          if (inkAmount > inkMap[idx] * 0.8) {
            satMap[idx] = cS
          }
          inkMap[idx] = Math.min(1.0, inkMap[idx] + inkAmount * 0.45)
        }
      }
    }
  }

  depositStroke(strokePoints)
  depositStroke(ghostPoints)
  if (thirdAttempt.length > 0) depositStroke(thirdAttempt)

  console.log("  Rendering pixels...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkMap[idx]
      const sat = satMap[idx]

      // Background: warm cream
      const bn = bgNoise1(x, y) * 0.5 + bgNoise2(x, y) * 0.3 + bgNoise3(x, y) * 0.2 + 0.5
      let bgR = 232 + bn * 10
      let bgG = 225 + bn * 8
      let bgB = 215 + bn * 6

      if (ink < 0.004) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Ink: dark rose-brown (saturated) → warm grey (desaturated)
      const fullR = 75, fullG = 32, fullB = 28
      const greyVal = 100
      const greyR = greyVal + 6, greyG = greyVal, greyB = greyVal - 4

      const inkR = fullR * sat + greyR * (1 - sat)
      const inkG = fullG * sat + greyG * (1 - sat)
      const inkB = fullB * sat + greyB * (1 - sat)

      const opacity = Math.min(1.0, ink * 1.4)
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

  const filename = `output/sadness-v22-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
