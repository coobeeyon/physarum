/**
 * SADNESS v14 — SINKING EMBER
 *
 * v13 was close but too round/symmetric. This version breaks the symmetry:
 * - The form has tendrils reaching upward that dissolve before connecting
 *   to anything. Reaching and failing.
 * - Warm traces drip/flow downward from the form — gravity pulling
 *   what's left of the warmth down. The warm thing is sinking.
 * - The form is elongated vertically, not round. Weight pulling it down.
 * - Slightly off-center low — not at the geometric center of the lower half.
 *
 * The viewer should feel: something that was warm is being pulled down.
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
  const seeds: Record<string, number> = { a: 55501, b: 55502, c: 55503 }
  const seed = seeds[variant] ?? 55501
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v14 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)  // atmospheric
  const edgeN1 = makeNoise(seed + 200, 70)
  const edgeN2 = makeNoise(seed + 210, 30)
  const edgeN3 = makeNoise(seed + 220, 150)
  const bgN1 = makeNoise(seed + 100, 400)
  const bgN2 = makeNoise(seed + 110, 150)
  const bgN3 = makeNoise(seed + 120, 50)
  const dripNoise = makeNoise(seed + 300, 25)  // for drip tendrils
  const dripNoise2 = makeNoise(seed + 310, 60)

  // Form center — lower-left, slightly off-center
  const formX = W * (0.36 + rand() * 0.06)
  const formY = H * (0.60 + rand() * 0.06)
  const formRx = W * 0.22   // horizontal radius
  const formRy = W * 0.28   // vertical radius (elongated — pulled down by gravity)

  // Ghost — upper right, barely visible
  const ghostX = W * (0.70 + rand() * 0.10)
  const ghostY = H * (0.22 + rand() * 0.10)
  const ghostR = W * 0.04

  // Generate some tendril paths — warm traces reaching upward that fail
  interface Tendril {
    baseX: number
    baseY: number
    length: number  // how far up it reaches
    width: number   // base width
    warmth: number  // 0-1
  }

  const tendrils: Tendril[] = []
  const tendrilCount = 2 + Math.floor(rand() * 2)
  for (let i = 0; i < tendrilCount; i++) {
    tendrils.push({
      baseX: formX + (rand() - 0.5) * formRx * 1.2,
      baseY: formY - formRy * (0.3 + rand() * 0.5),
      length: H * (0.10 + rand() * 0.15),
      width: W * (0.015 + rand() * 0.020),
      warmth: 0.2 + rand() * 0.3,
    })
  }

  // Generate drip paths — warm traces flowing downward
  interface Drip {
    startX: number
    startY: number
    length: number
    width: number
    warmth: number
  }

  const drips: Drip[] = []
  const dripCount = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < dripCount; i++) {
    drips.push({
      startX: formX + (rand() - 0.5) * formRx * 0.8,
      startY: formY + formRy * (0.3 + rand() * 0.4),
      length: H * (0.05 + rand() * 0.12),
      width: W * (0.008 + rand() * 0.012),
      warmth: 0.15 + rand() * 0.25,
    })
  }

  console.log("  Rendering...")

  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    const yNorm = y / H
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Background noise
      const bn1 = bgN1(x, y) * 0.5 + 0.5
      const bn2 = bgN2(x, y) * 0.5 + 0.5
      const bn3 = bgN3(x, y) * 0.5 + 0.5
      const bn = bn1 * 0.45 + bn2 * 0.35 + bn3 * 0.20

      // Background: heavy dark warm grey
      const topWeight = yNorm * yNorm
      let bgR = 62 + bn * 14 + topWeight * 20
      let bgG = 58 + bn * 11 + topWeight * 10
      let bgB = 56 + bn * 8 + topWeight * 3

      // Atmospheric variation
      const atm = n5(x, y) * 0.5 + 0.5
      bgR += (atm - 0.5) * 14
      bgG += (atm - 0.5) * 11
      bgB += (atm - 0.5) * 8

      // === Main form mask (elliptical, elongated vertically) ===
      const dx = (x - formX) / formRx
      const dy = (y - formY) / formRy
      const ellDist = Math.sqrt(dx * dx + dy * dy)

      const edgeNoise = edgeN3(x, y) * 0.20 + edgeN1(x, y) * 0.45 + edgeN2(x, y) * 0.35
      const effectiveEdge = 1.0 + edgeNoise * 0.9

      let formMask = 0
      if (ellDist < effectiveEdge) {
        const t = ellDist / effectiveEdge
        formMask = t < 0.08 ? 1.0 : Math.pow(1.0 - (t - 0.08) / 0.92, 2.8)
      }

      // === Tendril masks (reaching upward, dissolving) ===
      let tendrilMask = 0
      let tendrilWarmth = 0
      for (const tendril of tendrils) {
        const tdx = x - tendril.baseX
        const tdy = y - tendril.baseY
        if (tdy > 10) continue  // only above the base
        if (tdy < -tendril.length) continue

        // How far along the tendril (0 = base, 1 = tip)
        const along = -tdy / tendril.length
        if (along < 0 || along > 1) continue

        // Width narrows toward tip
        const currentWidth = tendril.width * (1.0 - along * along)
        // Wander sideways with noise
        const wander = dripNoise(tendril.baseX, y) * currentWidth * 3
        const lateralDist = Math.abs(tdx - wander)

        if (lateralDist < currentWidth) {
          const lateralFade = 1.0 - lateralDist / currentWidth
          const alongFade = 1.0 - along  // fades toward tip
          const tm = lateralFade * lateralFade * alongFade * alongFade * 0.6
          if (tm > tendrilMask) {
            tendrilMask = tm
            tendrilWarmth = tendril.warmth * alongFade
          }
        }
      }

      // === Drip masks (flowing downward, gravity) ===
      let dripMask = 0
      let dripWarmth = 0
      for (const drip of drips) {
        const ddx = x - drip.startX
        const ddy = y - drip.startY
        if (ddy < -5) continue  // only below the start
        if (ddy > drip.length) continue

        const along = ddy / drip.length
        if (along < 0 || along > 1) continue

        // Width narrows toward bottom
        const currentWidth = drip.width * (1.0 - along * 0.7)
        // Slight wander
        const wander = dripNoise2(drip.startX, y) * currentWidth * 2
        const lateralDist = Math.abs(ddx - wander)

        if (lateralDist < currentWidth) {
          const lateralFade = 1.0 - lateralDist / currentWidth
          const alongFade = 1.0 - along * along  // fades toward bottom
          const dm = lateralFade * lateralFade * alongFade * 0.45
          if (dm > dripMask) {
            dripMask = dm
            dripWarmth = drip.warmth * alongFade
          }
        }
      }

      // === Ghost mask ===
      const gdx = x - ghostX
      const gdy = y - ghostY
      const gDist = Math.sqrt(gdx * gdx + gdy * gdy)
      const gEffR = ghostR * (1.0 + edgeN1(x, y) * 0.8)
      let ghostMask = 0
      if (gDist < gEffR) {
        ghostMask = Math.pow(1.0 - gDist / gEffR, 2.5) * 0.15
      }

      // Combined mask
      const totalMask = Math.min(1.0, formMask + tendrilMask + dripMask + ghostMask)

      if (totalMask > 0.01) {
        // Organic texture (ridge noise for veins)
        const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
        const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
        const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
        const tex1 = n2(x, y) * 0.5 + 0.5

        const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + tex1 * 0.20
        const texClamped = Math.max(0, Math.min(1, texture))
        const textureVisible = texClamped * totalMask * 0.80

        // Warmth: peaks at form center, dies at edges and in tendrils/drips
        const formWarmth = formMask * formMask * 0.85
        const warmth = Math.max(formWarmth, tendrilWarmth, dripWarmth, ghostMask * 0.1)

        const liftAmount = textureVisible * 0.55
        const warmthColor = warmth * textureVisible

        let r = bgR + liftAmount * 120 + warmthColor * 55
        let g = bgG + liftAmount * 60 + warmthColor * 14
        let b = bgB + liftAmount * 18 - warmthColor * 16

        // Veins: brighter/warmer at core
        if (texClamped > 0.48 && totalMask > 0.15) {
          const veinStrength = (texClamped - 0.48) / 0.52 * totalMask * warmth
          r += veinStrength * 35
          g += veinStrength * 10
          b -= veinStrength * 6
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

  const filename = `output/sadness-v14-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
