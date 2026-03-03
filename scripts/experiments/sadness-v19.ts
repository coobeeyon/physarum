/**
 * SADNESS v19 — FADING FIELD
 *
 * v17: too small, too faint (invisible blob on dark)
 * v18: reads as fire (warm below cold = energy, not loss)
 *
 * New approach: REVERSED gradient + FULL COMPOSITION.
 *
 * The whole canvas starts as warm organic texture. But the warmth is
 * LEAVING — draining from bottom to top. What remains:
 *
 * - Top 30%: still warm, still textured, but you can feel it won't last.
 *   The last reservoir. Bright amber, beautiful. Precious because it's
 *   the only warmth left.
 *
 * - Middle 40%: the transition. The same texture but DESATURATED.
 *   Color bleeding away. Amber going grey. The structure is still visible
 *   but the life is draining out. This is where the sadness lives.
 *   You can see what it WAS because the texture persists. The ghost of
 *   warmth.
 *
 * - Bottom 30%: cold grey. The texture is barely visible — faint
 *   impressions of the warm structure. Like a faded photograph.
 *   The warmth has fully left this zone. Only traces remain.
 *
 * The overall feeling: watching color leave a face. Everything getting
 * colder. The warmth retreating upward, concentrating, diminishing.
 *
 * Not a blob. Not a fire. A FIELD that's losing itself.
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
  const seeds: Record<string, number> = { a: 77701, b: 77702, c: 77703, d: 77704 }
  const seed = seeds[variant] ?? 77701
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v19 variant ${variant} (seed: ${seed}) ===`)

  // Texture noise
  const n1 = makeNoise(seed, 250)
  const n2 = makeNoise(seed + 10, 100)
  const n3 = makeNoise(seed + 20, 45)
  const n4 = makeNoise(seed + 30, 18)
  const n5 = makeNoise(seed + 40, 600)  // atmosphere

  // Drainage boundary noise — where the color-loss happens
  const drainN1 = makeNoise(seed + 100, 180)
  const drainN2 = makeNoise(seed + 110, 70)
  const drainN3 = makeNoise(seed + 120, 30)
  const drainN4 = makeNoise(seed + 130, 250)

  // Ghost trace noise — for the bottom area
  const ghostN1 = makeNoise(seed + 200, 60)
  const ghostN2 = makeNoise(seed + 210, 25)

  console.log("  Computing warmth texture...")

  // Full warm texture (what the WHOLE canvas would look like if still alive)
  const warmTexture = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
      const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
      const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
      const base = n1(x, y) * 0.5 + 0.5
      const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + base * 0.20
      warmTexture[y * W + x] = Math.max(0, Math.min(1, texture))
    }
  }

  console.log("  Computing drainage field...")

  // === Drainage field: how much color/warmth remains at each point ===
  // 1.0 = full warmth. 0.0 = completely drained (cold grey)
  // Gradient: warm at top, cold at bottom, with noise-modulated boundary
  const drainageField = new Float32Array(W * H)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H  // 0=top, 1=bottom

    for (let x = 0; x < W; x++) {
      const xNorm = x / W

      // The drainage boundary: WHERE the warmth stops
      // Noise-modulated — not a straight line
      const boundaryNoise =
        drainN1(x, y) * 0.15 +
        drainN2(x, y) * 0.10 +
        drainN3(x, y) * 0.05 +
        drainN4(x, y) * 0.08

      // Base boundary position: around 30-40% from top
      // Warmth concentrates in upper region
      const boundaryY = 0.32 + boundaryNoise

      // The transition is VERY gradual — this creates the sad middle zone
      // where you can see the color leaving
      const transitionWidth = 0.35 + drainN4(x, y) * 0.08

      let warmthRemaining: number
      if (yNorm < boundaryY) {
        // Above the boundary: warm zone
        // Even here, warmth isn't at 100% — it's slightly diminished
        // The edges of the warm zone are starting to fade
        const distFromBoundary = (boundaryY - yNorm) / boundaryY
        warmthRemaining = 0.70 + distFromBoundary * 0.30
        // Slight variations
        warmthRemaining += drainN2(x, y) * 0.05
      } else if (yNorm < boundaryY + transitionWidth) {
        // Transition zone: THE SADNESS ZONE
        // Color is visibly draining
        const transT = (yNorm - boundaryY) / transitionWidth
        // Sigmoid-like falloff — not linear
        warmthRemaining = 0.70 * (1.0 - transT * transT)
        // More noise in the transition — the boundary is ragged
        warmthRemaining += drainN2(x, y) * 0.08 * (1.0 - transT)
        warmthRemaining += drainN3(x, y) * 0.06 * (1.0 - transT)
      } else {
        // Below the transition: the drained zone
        // Mostly cold, but with ghost traces of warmth
        const drainedT = (yNorm - boundaryY - transitionWidth) / (1.0 - boundaryY - transitionWidth)
        // Ghost traces: faint impressions of the warm texture
        const ghostStrength = Math.max(0, 0.12 * (1.0 - drainedT * 1.5))
        const ghostDetail = ghostN1(x, y) * 0.6 + ghostN2(x, y) * 0.4
        warmthRemaining = ghostStrength * (0.5 + ghostDetail * 0.5)
      }

      // Edge behavior: warmth retreats from edges slightly
      const edgeFade = Math.min(
        xNorm / 0.06, (1.0 - xNorm) / 0.06,
        yNorm / 0.04, // very slight fade at top edge
        1.0
      )
      warmthRemaining *= Math.min(1.0, edgeFade)

      drainageField[y * W + x] = Math.max(0, Math.min(1.0, warmthRemaining))
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const warmth = warmTexture[idx]
      const drain = drainageField[idx]

      const atm = n5(x, y) * 0.5 + 0.5

      // === Full warm color (what this pixel WOULD be) ===
      let warmR = 178 + warmth * 50 + atm * 10
      let warmG = 120 + warmth * 25 + atm * 6
      let warmB = 58 + warmth * 12 + atm * 3

      // Veins
      if (warmth > 0.50) {
        const veinT = (warmth - 0.50) / 0.50
        warmR += veinT * 35
        warmG += veinT * 12
        warmB -= veinT * 8
      }

      // === Cold color (what this pixel becomes when drained) ===
      // Not blank grey — it shows the GHOST of the texture
      // The structure is still there, just desaturated and cold
      const ghostTex = warmth * 0.3  // faint echo of the warm texture
      let coldR = 72 + ghostTex * 20 + atm * 4
      let coldG = 70 + ghostTex * 16 + atm * 3
      let coldB = 78 + ghostTex * 10 + atm * 2  // slightly blue

      // Deeper cold at the very bottom
      const bottomCold = Math.max(0, (yNorm - 0.7) / 0.3)
      coldR -= bottomCold * 10
      coldG -= bottomCold * 8
      coldB += bottomCold * 3  // bluer as it gets colder

      // === Intermediate: the desaturation zone ===
      // This is where sadness lives — the color LEAVING
      // Not a simple blend. The warm tones shift through muted amber → grey-amber → grey
      let r, g, b: number

      if (drain > 0.65) {
        // Still warm, but AWARE it won't last
        // Slightly muted compared to full warmth
        const muteT = (1.0 - drain) / 0.35  // 0 at drain=1, 1 at drain=0.65
        r = warmR - muteT * 15
        g = warmG - muteT * 8
        b = warmB + muteT * 5  // slightly cooler
      } else if (drain > 0.15) {
        // THE TRANSITION: warm → cold
        // The saturation drops. The amber goes grey. The texture fades.
        const transT = (0.65 - drain) / 0.50  // 0 at drain=0.65, 1 at drain=0.15

        // Desaturation: warm tones lose their color
        // This is the key visual: you can SEE the warmth leaving
        const desatR = warmR * 0.6 + coldR * 0.4
        const desatG = warmG * 0.5 + coldG * 0.5
        const desatB = warmB * 0.3 + coldB * 0.7

        r = warmR * (1 - transT) + desatR * transT * 0.6 + coldR * transT * 0.4
        g = warmG * (1 - transT) + desatG * transT * 0.6 + coldG * transT * 0.4
        b = warmB * (1 - transT) + desatB * transT * 0.6 + coldB * transT * 0.4

        // The transition zone has less texture visibility
        // Structure dissolves as warmth leaves
        const texFade = transT * 0.4
        r = r * (1 - texFade) + coldR * texFade
        g = g * (1 - texFade) + coldG * texFade
        b = b * (1 - texFade) + coldB * texFade
      } else {
        // Drained: cold with ghost traces
        r = coldR
        g = coldG
        b = coldB

        // Ghost traces: very faint warm echoes where texture was strong
        if (drain > 0.02 && warmth > 0.5) {
          const ghostGlow = drain / 0.15 * (warmth - 0.5) * 0.3
          r += ghostGlow * 30
          g += ghostGlow * 10
          b -= ghostGlow * 5
        }
      }

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

  const filename = `output/sadness-v19-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
