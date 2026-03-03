/**
 * SADNESS v16 — MELTING DOWN
 *
 * v15's tendrils were too elegant — smoke from incense, not grief.
 * Sadness has WEIGHT. Everything should be pulled DOWN.
 *
 * This version:
 * - NO upward tendrils. Remove elegance entirely.
 * - The form is MELTING — warm material running downward under gravity
 * - Multiple heavy drips below the form, some reaching the bottom edge
 * - The form itself is collapsing — wider at bottom, narrower at top
 *   (like a candle that's burned halfway down)
 * - The top of the form dissolves into the background — material leaving
 * - The warm core is substantial but clearly LOSING material
 * - One or two thinner trails that separate from the main drips
 *   and peter out (the last remnants)
 *
 * The image should make the viewer feel WEIGHT — heaviness, sinking, loss.
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

// Simulate a drip falling under gravity
interface DripPoint {
  x: number
  y: number
  width: number
  warmth: number
}

function simulateDrip(
  startX: number, startY: number,
  baseWidth: number, baseWarmth: number,
  flowNoise: (x: number, y: number) => number,
  rand: () => number,
  heavy: boolean,  // heavy drips are wider, slower to narrow
): DripPoint[] {
  const points: DripPoint[] = []
  let x = startX, y = startY
  let vy = 0.3 + rand() * 0.5
  let vx = (rand() - 0.5) * 0.4
  let width = baseWidth
  let warmth = baseWarmth

  const narrowRate = heavy ? 0.9985 : 0.994
  const warmthRate = heavy ? 0.9975 : 0.993

  for (let step = 0; step < 800; step++) {
    points.push({ x, y, width, warmth })

    // Gravity — relentless
    vy += heavy ? 0.025 : 0.02
    vy *= 0.996

    // Gentle sideways drift from flow field
    const flowAngle = flowNoise(x * 0.3, y * 0.3) * Math.PI * 0.5
    vx += Math.cos(flowAngle) * 0.03
    vx *= 0.98

    x += vx
    y += vy

    width *= narrowRate
    warmth *= warmthRate

    // Stop conditions
    if (y > H + 10) break  // ran off bottom
    if (width < 0.5) break
    if (warmth < 0.005) break
  }
  return points
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 55701, b: 55702, c: 55703 }
  const seed = seeds[variant] ?? 55701
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v16 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const edgeN1 = makeNoise(seed + 200, 70)
  const edgeN2 = makeNoise(seed + 210, 30)
  const edgeN3 = makeNoise(seed + 220, 150)
  const bgN1 = makeNoise(seed + 100, 400)
  const bgN2 = makeNoise(seed + 110, 150)
  const bgN3 = makeNoise(seed + 120, 50)
  const flowN = makeNoise(seed + 400, 180)

  // Form center — upper-center area. The form is ABOVE center
  // because it's MELTING DOWN. What's below is its residue.
  const formX = W * (0.38 + rand() * 0.08)
  const formY = H * (0.32 + rand() * 0.06)

  // Form shape: wider at bottom (heavy, settling), narrower at top (dissolving)
  // Asymmetric — the left/right widths differ
  const formTopRx = W * 0.10    // narrow at top — dissolving away
  const formTopRy = W * 0.12
  const formBotRx = W * 0.18    // wider at bottom — heavy, settling
  const formBotRy = W * 0.20

  // Ghost — far upper right, barely there
  const ghostX = W * (0.75 + rand() * 0.10)
  const ghostY = H * (0.12 + rand() * 0.08)
  const ghostR = W * 0.025

  // === Simulate drips: warm material running down ===
  const dripPaths: DripPoint[][] = []

  // 3-4 heavy drips — wide, substantial, reaching far down
  const heavyCount = 3 + Math.floor(rand() * 2)
  for (let i = 0; i < heavyCount; i++) {
    const sx = formX + (rand() - 0.5) * formBotRx * 0.9
    const sy = formY + formBotRy * (0.6 + rand() * 0.3)
    const w = W * (0.015 + rand() * 0.025)
    const warmth = 0.30 + rand() * 0.35
    dripPaths.push(simulateDrip(sx, sy, w, warmth, flowN, rand, true))
  }

  // 3-5 thin drips — narrower, peter out sooner
  const thinCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < thinCount; i++) {
    const sx = formX + (rand() - 0.5) * formBotRx * 1.1
    const sy = formY + formBotRy * (0.5 + rand() * 0.5)
    const w = W * (0.005 + rand() * 0.010)
    const warmth = 0.12 + rand() * 0.20
    dripPaths.push(simulateDrip(sx, sy, w, warmth, flowN, rand, false))
  }

  console.log(`  ${dripPaths.length} drips`)

  // === Pre-render drip masks ===
  const dripMask = new Float32Array(W * H)
  const dripWarmthMap = new Float32Array(W * H)

  for (const path of dripPaths) {
    for (let i = 1; i < path.length; i++) {
      const p0 = path[i - 1]
      const p1 = path[i]
      const avgWidth = (p0.width + p1.width) / 2
      const avgWarmth = (p0.warmth + p1.warmth) / 2

      const margin = avgWidth * 2.5
      const minX = Math.max(0, Math.floor(Math.min(p0.x, p1.x) - margin))
      const maxX = Math.min(W - 1, Math.ceil(Math.max(p0.x, p1.x) + margin))
      const minY = Math.max(0, Math.floor(Math.min(p0.y, p1.y) - margin))
      const maxY = Math.min(H - 1, Math.ceil(Math.max(p0.y, p1.y) + margin))

      const segDx = p1.x - p0.x
      const segDy = p1.y - p0.y
      const segLen2 = segDx * segDx + segDy * segDy
      if (segLen2 < 0.01) continue

      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const apx = px - p0.x
          const apy = py - p0.y
          let t = (apx * segDx + apy * segDy) / segLen2
          t = Math.max(0, Math.min(1, t))
          const cx = p0.x + t * segDx
          const cy = p0.y + t * segDy
          const dx = px - cx
          const dy = py - cy
          const dist = Math.sqrt(dx * dx + dy * dy)

          const localWidth = p0.width + t * (p1.width - p0.width)
          const localWarmth = p0.warmth + t * (p1.warmth - p0.warmth)

          if (dist < localWidth) {
            const fade = 1.0 - dist / localWidth
            const val = fade * fade * 0.8
            const idx = py * W + px
            if (val > dripMask[idx]) {
              dripMask[idx] = val
              dripWarmthMap[idx] = localWarmth
            }
          }
        }
      }
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background: dark warm grey, heavier at top
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bn3 = bgN3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.45 + bn2 * 0.35 + bn3 * 0.20

      // Gradient: darker at top (pressing down), slightly lighter at bottom
      const topWeight = (1 - yNorm) * (1 - yNorm) * 0.15
      let bgR = 58 + bn * 14 - topWeight * 10
      let bgG = 54 + bn * 11 - topWeight * 8
      let bgB = 52 + bn * 8 - topWeight * 5

      const atm = n5(x, y) * 0.5 + 0.5
      bgR += (atm - 0.5) * 12
      bgG += (atm - 0.5) * 9
      bgB += (atm - 0.5) * 7

      // === Main form mask — asymmetric, wider at bottom ===
      const fdx = x - formX
      const fdy = y - formY

      // Different radii for above vs below center
      let formMask = 0
      if (fdy <= 0) {
        // Above center — narrower, dissolving
        const nx = fdx / formTopRx
        const ny = fdy / formTopRy
        const ellDist = Math.sqrt(nx * nx + ny * ny)
        const edgeNoise = edgeN3(x, y) * 0.20 + edgeN1(x, y) * 0.45 + edgeN2(x, y) * 0.35
        const effectiveEdge = 1.0 + edgeNoise * 1.2  // MORE noise = more dissolved at top
        if (ellDist < effectiveEdge) {
          const t = ellDist / effectiveEdge
          // Top dissolves more gradually
          formMask = t < 0.15 ? 0.85 : Math.pow(1.0 - (t - 0.15) / 0.85, 3.5) * 0.85
        }
      } else {
        // Below center — wider, heavier, more defined
        const nx = fdx / formBotRx
        const ny = fdy / formBotRy
        const ellDist = Math.sqrt(nx * nx + ny * ny)
        const edgeNoise = edgeN3(x, y) * 0.15 + edgeN1(x, y) * 0.40 + edgeN2(x, y) * 0.45
        const effectiveEdge = 1.0 + edgeNoise * 0.7  // Less noise = more defined edges
        if (ellDist < effectiveEdge) {
          const t = ellDist / effectiveEdge
          formMask = t < 0.10 ? 1.0 : Math.pow(1.0 - (t - 0.10) / 0.90, 2.5)
        }
      }

      // === Ghost mask ===
      const gdx = x - ghostX
      const gdy = y - ghostY
      const gDist = Math.sqrt(gdx * gdx + gdy * gdy)
      const gEffR = ghostR * (1.0 + edgeN1(x, y) * 0.8)
      let ghostMask = 0
      if (gDist < gEffR) {
        ghostMask = Math.pow(1.0 - gDist / gEffR, 2.5) * 0.10
      }

      // === Drip mask ===
      const dm = dripMask[idx]
      const dw = dripWarmthMap[idx]

      // Combined
      const totalMask = Math.min(1.0, formMask + ghostMask + dm)

      if (totalMask > 0.008) {
        // Organic texture
        const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
        const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
        const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
        const tex1 = n2(x, y) * 0.5 + 0.5
        const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + tex1 * 0.20
        const texClamped = Math.max(0, Math.min(1, texture))
        const textureVisible = texClamped * totalMask * 0.85

        // Warmth: peak at the form's lower core (where material collects)
        // Diminished at top (dissolving), diminished in drips (losing heat)
        let warmth = 0
        if (formMask > 0) {
          // Warmth peaks in the lower portion of the form
          const yInForm = (y - formY) / formBotRy  // negative = above, positive = below
          const warmthPeak = 0.3  // peak below center
          const warmthDist = Math.abs(yInForm - warmthPeak) / 1.5
          const posWarmth = Math.max(0, 1.0 - warmthDist)
          warmth = formMask * formMask * posWarmth * 0.95
        }
        warmth = Math.max(warmth, dw * dm * 0.7, ghostMask * 0.08)

        const liftAmount = textureVisible * 0.55
        const warmthColor = warmth * textureVisible

        let r = bgR + liftAmount * 120 + warmthColor * 65
        let g = bgG + liftAmount * 58 + warmthColor * 16
        let b = bgB + liftAmount * 15 - warmthColor * 20

        // Veins
        if (texClamped > 0.48 && totalMask > 0.12) {
          const veinStrength = (texClamped - 0.48) / 0.52 * totalMask * warmth
          r += veinStrength * 35
          g += veinStrength * 10
          b -= veinStrength * 8
        }

        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      } else {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
      }
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-v16-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
