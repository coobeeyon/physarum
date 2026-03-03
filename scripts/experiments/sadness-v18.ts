/**
 * SADNESS v18 — WEIGHT / SINKING
 *
 * v17's problem: too small, too faint, reads as "low quality" not "sadness."
 * A small blob on darkness is not bold enough.
 *
 * New approach: the warmth fills MOST of the image but is clearly LOSING.
 * Gravity is pulling everything down. The top is going cold. The bottom
 * pools with the last warmth, but even that is breaking apart.
 *
 * The viewer sees: something that WAS warm and full, now succumbing.
 * The whole composition is about downward pull.
 *
 * Key visual:
 * - Top third: cold grey-blue. Almost empty. The warmth has left.
 * - Middle third: the transition. Warmth thinning, fragmenting, failing.
 *   Warm wisps reaching upward but not connecting. Gaps appearing.
 * - Bottom third: pooled warmth, but it's not solid — broken into
 *   rivulets, puddles, dissolving edges. Even the refuge is failing.
 *
 * No isolated blob. No darkness-with-a-dot. FULL COMPOSITION.
 * The image itself is heavy — you feel the gravity.
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
  const seeds: Record<string, number> = { a: 66601, b: 66602, c: 66603, d: 66604 }
  const seed = seeds[variant] ?? 66601
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v18 variant ${variant} (seed: ${seed}) ===`)

  // Many noise layers for organic structure
  const n1 = makeNoise(seed, 250)
  const n2 = makeNoise(seed + 10, 100)
  const n3 = makeNoise(seed + 20, 45)
  const n4 = makeNoise(seed + 30, 18)
  const n5 = makeNoise(seed + 40, 600)  // atmospheric
  const n6 = makeNoise(seed + 50, 8)    // micro
  const n7 = makeNoise(seed + 60, 350)  // large structure

  // Dissolution/fragmentation noise
  const dissolveN1 = makeNoise(seed + 100, 120)
  const dissolveN2 = makeNoise(seed + 110, 50)
  const dissolveN3 = makeNoise(seed + 120, 25)
  const dissolveN4 = makeNoise(seed + 130, 80)

  // Wisp noise — for upward-reaching fragments
  const wispN1 = makeNoise(seed + 200, 30)
  const wispN2 = makeNoise(seed + 210, 15)
  const wispN3 = makeNoise(seed + 220, 60)

  // Background atmosphere
  const bgN1 = makeNoise(seed + 300, 500)
  const bgN2 = makeNoise(seed + 310, 180)

  console.log("  Computing warmth field...")

  // === The warmth field: what would be warm if gravity weren't pulling it down ===
  // This is the full warm texture — organic, veined, beautiful
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

  console.log("  Computing gravity mask...")

  // === The gravity mask: determines how much warmth survives at each point ===
  // This creates the "sinking" effect — the main compositional tool
  const gravityMask = new Float32Array(W * H)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H  // 0 at top, 1 at bottom

    for (let x = 0; x < W; x++) {
      const xNorm = x / W

      // Base gravity gradient: bottom is warm, top is cold
      // Using a sigmoid-like curve for the transition
      // The transition zone sits around 40-65% of the height
      const transitionCenter = 0.48 + dissolveN4(x, y) * 0.12
      const transitionWidth = 0.25 + dissolveN1(x, y) * 0.08
      const gravityBase = 1.0 / (1.0 + Math.exp(-(yNorm - transitionCenter) / (transitionWidth * 0.15)))

      // Dissolution: noise-based gaps in the warmth
      // More gaps higher up, fewer at the bottom (warmth pools there)
      const dissolveThreshold = 0.3 + (1.0 - yNorm) * 0.5  // harder to survive higher up
      const dissolveValue =
        dissolveN1(x, y) * 0.35 +
        dissolveN2(x, y) * 0.35 +
        dissolveN3(x, y) * 0.30

      // The warmth "breaks apart" where dissolve exceeds threshold
      let dissolution = 0
      if (dissolveValue > dissolveThreshold - 0.15) {
        dissolution = Math.min(1.0, (dissolveValue - (dissolveThreshold - 0.15)) / 0.3)
      }

      // Combine: gravity pulls warmth down, dissolution creates gaps
      let mask = gravityBase * (1.0 - dissolution * (1.0 - yNorm * 0.5))

      // === Wisps: fragments of warmth reaching upward from the mass below ===
      // These are the saddest part — warmth trying to rise but failing
      if (yNorm < transitionCenter + 0.15 && yNorm > transitionCenter - 0.25) {
        const wispField =
          wispN1(x, y * 0.6) * 0.5 +  // squashed vertically for upward feel
          wispN2(x, y * 0.7) * 0.3 +
          wispN3(x, y * 0.5) * 0.2

        // Wisps exist where noise creates thin high-value channels
        if (wispField > 0.28) {
          const wispStrength = (wispField - 0.28) / 0.3
          // Wisps are thin and fragile — dissolve quickly as they rise
          const heightPenalty = Math.max(0, 1.0 - (transitionCenter - yNorm) / 0.15)
          mask = Math.max(mask, wispStrength * heightPenalty * 0.5)
        }
      }

      // === Bottom pooling: warmth is thicker at the bottom but still fragmented ===
      if (yNorm > 0.75) {
        const poolBoost = (yNorm - 0.75) / 0.25
        // Even the pool isn't solid — it has gaps and thin areas
        const poolNoise = dissolveN2(x, y) * 0.4 + dissolveN3(x, y) * 0.3
        mask = Math.min(1.0, mask + poolBoost * 0.3 * (1.0 - poolNoise * 0.4))
      }

      // Edge fade: warmth doesn't reach the very edges of the canvas
      const edgeFadeX = Math.min(xNorm / 0.08, (1.0 - xNorm) / 0.08, 1.0)
      const edgeFadeY = Math.min(1.0, (1.0 - yNorm) / 0.05)  // fade at very bottom edge
      mask *= Math.min(edgeFadeX, edgeFadeY)

      gravityMask[y * W + x] = Math.max(0, Math.min(1.0, mask))
    }
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const warmth = warmTexture[idx]
      const mask = gravityMask[idx]

      // === Cold background: where the warmth has left ===
      // Cold blue-grey, subtly textured
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bgTex = bn1 * 0.6 + bn2 * 0.4

      // Background gets slightly warmer near surviving warmth (residual heat)
      const residualWarmth = mask * mask * 0.06
      let bgR = 62 + bgTex * 12 + residualWarmth * 40
      let bgG = 60 + bgTex * 10 + residualWarmth * 15
      let bgB = 68 + bgTex * 8 - residualWarmth * 5

      // Subtle vertical gradient: coldest at top
      bgR -= (1.0 - yNorm) * 8
      bgG -= (1.0 - yNorm) * 5
      bgB += (1.0 - yNorm) * 4  // bluer at top

      if (mask < 0.005) {
        // Pure background
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // === Warm layer color ===
      const atm = n5(x, y) * 0.5 + 0.5

      // The warm color: amber-orange with organic texture
      let warmR = 170 + warmth * 55 + atm * 10
      let warmG = 115 + warmth * 25 + atm * 6
      let warmB = 55 + warmth * 10 + atm * 3

      // Veins in the warm areas
      if (warmth > 0.48 && mask > 0.1) {
        const veinT = (warmth - 0.48) / 0.52 * mask
        warmR += veinT * 35
        warmG += veinT * 12
        warmB -= veinT * 8
      }

      // === Temperature gradient within the warm areas ===
      // Warmth "cools" as it approaches the dissolution boundary
      // The edge of warmth should feel like it's losing heat
      if (mask < 0.4) {
        const coolT = 1.0 - mask / 0.4
        // Shift warm tones toward grey-blue as mask thins
        warmR -= coolT * 50
        warmG -= coolT * 25
        warmB += coolT * 10  // slightly more blue
      }

      // === Blend warm and cold ===
      // Mask determines how much warmth vs cold background
      const blendMask = mask * mask  // quadratic for more visible transition
      let r = bgR * (1 - blendMask) + warmR * blendMask
      let g = bgG * (1 - blendMask) + warmG * blendMask
      let b = bgB * (1 - blendMask) + warmB * blendMask

      // === Micro detail: at dissolution boundaries ===
      if (mask > 0.05 && mask < 0.5) {
        const mn = n6(x, y) * 0.5 + 0.5
        // Granular dissolution — the warmth breaks into particles at its edges
        r += (mn - 0.5) * mask * 20
        g += (mn - 0.5) * mask * 10
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

  const filename = `output/sadness-v18-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
