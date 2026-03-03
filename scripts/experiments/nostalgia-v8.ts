/**
 * NOSTALGIA v8 — GOLDEN HOUR (atmospheric, intimate)
 *
 * Intimate composition: one building on the left with balcony,
 * one large live oak on the right, golden sky between them.
 * Power lines crossing. A second layer of distant buildings
 * visible as hazy silhouettes.
 *
 * Everything is slightly soft — not sharp vector art but the
 * blurred quality of a faded photograph or a memory.
 *
 * Depth through atmospheric perspective:
 * - Background buildings: light, hazy, barely there
 * - Foreground building: darker but still warm
 * - Tree: darkest, most detailed
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

function gaussianBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  let current = new Float32Array(src)
  for (let pass = 0; pass < 3; pass++) {
    const next = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      let sum = 0, count = 0
      for (let x = 0; x < Math.min(radius, w); x++) { sum += current[y * w + x]; count++ }
      for (let x = 0; x < w; x++) {
        if (x + radius < w) { sum += current[y * w + x + radius]; count++ }
        if (x - radius - 1 >= 0) { sum -= current[y * w + x - radius - 1]; count-- }
        next[y * w + x] = sum / count
      }
    }
    const next2 = new Float32Array(w * h)
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0
      for (let y = 0; y < Math.min(radius, h); y++) { sum += next[y * w + x]; count++ }
      for (let y = 0; y < h; y++) {
        if (y + radius < h) { sum += next[(y + radius) * w + x]; count++ }
        if (y - radius - 1 >= 0) { sum -= next[(y - radius - 1) * w + x]; count-- }
        next2[y * w + x] = sum / count
      }
    }
    current = next2
  }
  return current
}

function drawLiveOak(
  sil: Float32Array, w: number, h: number,
  cx: number, groundY: number,
  canopyWidth: number, canopyHeight: number,
  rand: () => number, seed: number
) {
  const edgeNoise = makeNoise(seed + 10, 30)
  const innerNoise = makeNoise(seed + 20, 12)
  const mossNoise = makeNoise(seed + 30, 8)
  const gapNoise = makeNoise(seed + 40, 20)

  const canopyCenter = groundY - canopyHeight * 0.55
  const trunkWidth = canopyWidth * 0.07

  // Trunk (with slight curve)
  const trunkCurve = (rand() - 0.5) * 40
  for (let y = Math.floor(groundY + 10); y > Math.floor(canopyCenter + canopyHeight * 0.1); y--) {
    const t = (groundY - y) / (groundY - canopyCenter)
    const tx = cx + trunkCurve * t * t
    const tw = trunkWidth * (1.2 - t * 0.4)
    for (let x = Math.floor(tx - tw); x <= Math.ceil(tx + tw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) sil[y * w + x] = 1.0
    }
  }

  // Major branches (visible through canopy as structure)
  const numBranches = 4 + Math.floor(rand() * 3)
  for (let b = 0; b < numBranches; b++) {
    const angle = -Math.PI * 0.5 + (b - numBranches / 2) * 0.5 + (rand() - 0.5) * 0.3
    const len = canopyWidth * (0.3 + rand() * 0.2)
    const bw = trunkWidth * (0.5 - b * 0.06)
    const startY = canopyCenter + canopyHeight * 0.15

    for (let s = 0; s < 40; s++) {
      const t = s / 40
      const bx = cx + trunkCurve * 0.5 + Math.cos(angle) * len * t
      const by = startY + Math.sin(angle) * len * t
      const w2 = Math.max(2, bw * (1 - t * 0.7))
      for (let dx = -Math.ceil(w2); dx <= Math.ceil(w2); dx++) {
        for (let dy = -Math.ceil(w2); dy <= Math.ceil(w2); dy++) {
          const px = Math.round(bx + dx), py = Math.round(by + dy)
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d <= w2) sil[py * w + px] = Math.max(sil[py * w + px], 0.9)
          }
        }
      }
    }
  }

  // Dense canopy
  for (let y = Math.floor(canopyCenter - canopyHeight * 0.55); y < Math.floor(groundY - canopyHeight * 0.05); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(cx - canopyWidth * 0.62); x <= Math.ceil(cx + canopyWidth * 0.62); x++) {
      if (x < 0 || x >= w) continue

      const dx = (x - cx) / (canopyWidth * 0.55)
      const dy = (y - canopyCenter) / (canopyHeight * 0.48)
      // Slightly flattened bottom (live oaks spread wide)
      const dyAdj = dy > 0 ? dy * 0.85 : dy
      const baseDist = dx * dx + dyAdj * dyAdj

      const en = edgeNoise(x, y) * 0.30
      const in2 = innerNoise(x, y) * 0.18
      const effectiveDist = baseDist + en + in2

      if (effectiveDist < 1.0) {
        const edgeFade = effectiveDist > 0.82 ? (1 - effectiveDist) / 0.18 : 1.0
        // Gaps in canopy (sky visible through leaves)
        const gn = gapNoise(x, y) * 0.5 + 0.5
        const gapThreshold = 0.68 + effectiveDist * 0.15  // more gaps near edges
        const alpha = gn > gapThreshold ? edgeFade * 0.15 : edgeFade
        sil[y * w + x] = Math.max(sil[y * w + x], alpha)
      }
    }
  }

  // Spanish moss
  const numStrands = 35 + Math.floor(rand() * 25)
  for (let i = 0; i < numStrands; i++) {
    const mossStartX = cx + (rand() - 0.5) * canopyWidth * 0.95
    const startY = canopyCenter + canopyHeight * (0.05 + rand() * 0.3)
    // Only hang moss where there IS canopy above
    const dx = (mossStartX - cx) / (canopyWidth * 0.55)
    const dy = (startY - canopyCenter) / (canopyHeight * 0.48)
    if (dx * dx + dy * dy > 0.85) continue

    const mossLen = 30 + rand() * 80
    const mossWidth = 1.5 + rand() * 2.5

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossStartX + i * 77, startY + my) * 12 * t
      const mx = mossStartX + sway
      const myy = startY + my
      const mw = mossWidth * (1 - t * 0.5)
      const opacity = (1 - t * t) * 0.75

      if (myy < 0 || myy >= h) continue
      for (let ddx = -Math.ceil(mw); ddx <= Math.ceil(mw); ddx++) {
        const px = Math.round(mx + ddx)
        if (px < 0 || px >= w) continue
        const d = Math.abs(ddx) / mw
        if (d < 1) {
          const py = Math.round(myy)
          if (py >= 0 && py < h) {
            sil[py * w + px] = Math.max(sil[py * w + px], (1 - d) * opacity)
          }
        }
      }
    }
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 88001, b: 88002, c: 88003, d: 88004, e: 88005 }
  const seed = seeds[variant] ?? 88001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v8 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Sky ===
  console.log("  Painting sky...")
  const skyNoise = makeNoise(seed + 100, 500)
  const cloudNoise = makeNoise(seed + 200, 200)
  const cloudNoise2 = makeNoise(seed + 210, 100)

  const skyData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H
      const sn = skyNoise(x, y) * 0.5 + 0.5
      const cn = (cloudNoise(x, y) * 0.6 + cloudNoise2(x, y) * 0.4) * 0.5 + 0.5

      let r: number, g: number, b: number
      if (t < 0.20) {
        const st = t / 0.20
        r = 155 + st * 60; g = 75 + st * 55; b = 30 + st * 30
      } else if (t < 0.45) {
        const st = (t - 0.20) / 0.25
        r = 215 + st * 35; g = 130 + st * 60; b = 60 + st * 45
      } else if (t < 0.60) {
        // Horizon glow — the brightest band
        const st = (t - 0.45) / 0.15
        r = 250; g = 190 + st * 20; b = 105 + st * 25
      } else {
        const st = (t - 0.60) / 0.40
        r = 250 - st * 90; g = 210 - st * 90; b = 130 - st * 65
      }

      // Cloud wisps
      if (cn > 0.50) {
        const ca = Math.min(0.25, (cn - 0.50) / 0.3) * Math.max(0, 1 - t * 1.5)
        r += ca * 35; g += ca * 28; b += ca * 15
      }

      r += (sn - 0.5) * 8; g += (sn - 0.5) * 6; b += (sn - 0.5) * 4

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Background buildings (distant, hazy) ===
  console.log("  Background layer...")
  const bgSil = new Float32Array(W * H)
  const groundY = H * 0.82

  // Distant buildings — simpler shapes, varied heights
  const bgBuildings = [
    { left: -30, right: W * 0.15, roofY: H * 0.42 },
    { left: W * 0.12, right: W * 0.30, roofY: H * 0.48 },
    { left: W * 0.28, right: W * 0.50, roofY: H * 0.44 },
    { left: W * 0.48, right: W * 0.62, roofY: H * 0.50 },
    { left: W * 0.60, right: W * 0.78, roofY: H * 0.46 },
    { left: W * 0.76, right: W * 0.92, roofY: H * 0.52 },
    { left: W * 0.90, right: W + 30, roofY: H * 0.43 },
  ]

  for (const bg of bgBuildings) {
    for (let y = Math.max(0, Math.floor(bg.roofY)); y < Math.min(H, groundY); y++) {
      for (let x = Math.max(0, Math.floor(bg.left)); x <= Math.min(W - 1, Math.ceil(bg.right)); x++) {
        bgSil[y * W + x] = 1.0
      }
    }
  }

  // Blur background heavily (atmospheric haze)
  console.log("  Blurring background...")
  const bgBlurred = gaussianBlur(bgSil, W, H, 12)

  // === Foreground silhouettes ===
  console.log("  Foreground layer...")
  const fgSil = new Float32Array(W * H)

  // Ground
  for (let y = Math.floor(groundY); y < H; y++) {
    for (let x = 0; x < W; x++) fgSil[y * W + x] = 1.0
  }

  // Main building — left side, tall with balcony (French Quarter)
  const bldgLeft = -40
  const bldgRight = W * 0.38
  const bldgTop = H * 0.18
  const bldgW = bldgRight - bldgLeft

  // Body
  for (let y = Math.max(0, Math.floor(bldgTop)); y < Math.ceil(groundY); y++) {
    for (let x = Math.max(0, Math.floor(bldgLeft)); x <= Math.min(W - 1, Math.ceil(bldgRight)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Hip roof
  const peakY = bldgTop - (groundY - bldgTop) * 0.08
  const bldgCx = (bldgLeft + bldgRight) / 2
  for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(bldgTop); y++) {
    const t = (y - peakY) / (bldgTop - peakY)
    const halfW = bldgW * t / 2 + 15
    for (let x = Math.max(0, Math.floor(bldgCx - halfW)); x <= Math.min(W - 1, Math.ceil(bldgCx + halfW)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Cornice
  for (let y = Math.floor(bldgTop - 8); y < Math.floor(bldgTop + 5); y++) {
    if (y < 0 || y >= H) continue
    for (let x = Math.max(0, Math.floor(bldgLeft - 12)); x <= Math.min(W - 1, Math.ceil(bldgRight + 12)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Windows (3 floors x 3 windows) — tall French windows
  const floorH = (groundY - bldgTop) / 3
  for (let floor = 0; floor < 3; floor++) {
    const floorTop = bldgTop + floor * floorH
    const winY = floorTop + floorH * 0.14
    const winH = floorH * 0.62
    const winW = bldgW * 0.10
    for (let wi = 0; wi < 3; wi++) {
      const wx = bldgLeft + bldgW * (0.25 + wi * 0.22) - winW / 2
      for (let y = Math.floor(winY); y < Math.floor(winY + winH); y++) {
        if (y < 0 || y >= H) continue
        // Slight arch at top
        const localY = (y - winY) / winH
        let localW = winW
        if (localY < 0.12) localW *= (0.6 + 0.4 * (localY / 0.12))
        for (let x = Math.floor(wx); x <= Math.ceil(wx + localW); x++) {
          if (x >= 0 && x < W) fgSil[y * W + x] = 0.55  // Dim warm glow
        }
      }
    }
  }

  // Balcony on second floor
  const balY = bldgTop + floorH - 5
  const balOverhang = 30
  for (let y = Math.floor(balY); y < Math.floor(balY + 6); y++) {
    if (y < 0 || y >= H) continue
    for (let x = Math.max(0, Math.floor(bldgLeft - balOverhang)); x <= Math.min(W - 1, Math.ceil(bldgRight + balOverhang)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }
  // Railing
  const railTop = balY + 6, railBot = balY + 42
  for (const ry of [railTop, railBot]) {
    for (let x = Math.max(0, Math.floor(bldgLeft - balOverhang)); x <= Math.min(W - 1, Math.ceil(bldgRight + balOverhang)); x++) {
      for (let y = Math.floor(ry); y < Math.floor(ry + 3); y++) {
        if (y >= 0 && y < H) fgSil[y * W + x] = 1.0
      }
    }
  }

  // Chimney
  const chimX = bldgLeft + bldgW * 0.7
  for (let y = Math.max(0, Math.floor(peakY - 40)); y < Math.floor(bldgTop); y++) {
    for (let x = Math.floor(chimX); x <= Math.ceil(chimX + 22); x++) {
      if (x >= 0 && x < W) fgSil[y * W + x] = 1.0
    }
  }

  // Smaller building peeking from right edge
  const rbLeft = W * 0.78
  const rbRight = W + 40
  const rbTop = H * 0.35
  for (let y = Math.max(0, Math.floor(rbTop)); y < Math.ceil(groundY); y++) {
    for (let x = Math.max(0, Math.floor(rbLeft)); x <= Math.min(W - 1, Math.ceil(rbRight)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }
  // Parapet
  for (let y = Math.floor(rbTop - 12); y < Math.floor(rbTop); y++) {
    if (y < 0 || y >= H) continue
    for (let x = Math.max(0, Math.floor(rbLeft - 5)); x <= Math.min(W - 1, Math.ceil(rbRight)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }
  // Right building windows (2 floors x 2 visible)
  for (let floor = 0; floor < 2; floor++) {
    const fh = (groundY - rbTop) / 2
    const winY = rbTop + floor * fh + fh * 0.15
    const winH = fh * 0.55
    const winW = (rbRight - rbLeft) * 0.12
    for (let wi = 0; wi < 2; wi++) {
      const wx = rbLeft + (rbRight - rbLeft) * (0.2 + wi * 0.3) - winW / 2
      for (let y = Math.floor(winY); y < Math.floor(winY + winH); y++) {
        if (y < 0 || y >= H) continue
        for (let x = Math.floor(wx); x <= Math.ceil(wx + winW); x++) {
          if (x >= 0 && x < W) fgSil[y * W + x] = 0.55
        }
      }
    }
  }

  // === Live oak — right of center ===
  console.log("  Drawing live oak...")
  drawLiveOak(fgSil, W, H,
    W * 0.60, groundY,
    W * 0.32, H * 0.42,
    rand, seed + 500)

  // === Power lines ===
  console.log("  Drawing power lines...")
  // Two lines crossing the sky from left building to off-right
  const poleLeftX = W * 0.36
  const poleLeftY = H * 0.22
  const poleRightX = W * 1.05
  const poleRightY = H * 0.28

  for (let line = 0; line < 2; line++) {
    const sag = 30 + line * 15  // Different sag for each line
    const yOffset = line * 18
    for (let s = 0; s <= 200; s++) {
      const t = s / 200
      const lx = poleLeftX + (poleRightX - poleLeftX) * t
      const baseY = poleLeftY + yOffset + (poleRightY + yOffset - poleLeftY - yOffset) * t
      // Catenary sag
      const ly = baseY + sag * Math.sin(t * Math.PI)

      const px = Math.round(lx), py = Math.round(ly)
      if (px >= 0 && px < W && py >= 0 && py < H) {
        fgSil[py * W + px] = Math.max(fgSil[py * W + px], 0.85)
        if (py + 1 < H) fgSil[(py + 1) * W + px] = Math.max(fgSil[(py + 1) * W + px], 0.5)
      }
    }
  }

  // === Blur foreground slightly for softness ===
  console.log("  Softening edges...")
  const fgBlurred = gaussianBlur(fgSil, W, H, 4)

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 800, 3)
  const texNoise = makeNoise(seed + 900, 20)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const bg = bgBlurred[y * W + x]
      const fg = fgBlurred[y * W + x]

      const skyR = pixels[idx], skyG = pixels[idx + 1], skyB = pixels[idx + 2]

      // Background buildings: hazy, lighter, warm-shifted
      const bgR = 140, bgG = 100, bgB = 80  // Warm brown haze
      const bgAlpha = bg * 0.35  // Very transparent — just a suggestion

      // Foreground: darker, richer
      const depth = y / H
      const tex = texNoise(x, y) * 0.5 + 0.5
      const fgR = 35 + depth * 18 + tex * 8
      const fgG = 22 + depth * 12 + tex * 5
      const fgB = 28 + depth * 15 + tex * 6

      let r = skyR, g = skyG, b = skyB

      // Layer background buildings
      if (bgAlpha > 0.01) {
        r = r * (1 - bgAlpha) + bgR * bgAlpha
        g = g * (1 - bgAlpha) + bgG * bgAlpha
        b = b * (1 - bgAlpha) + bgB * bgAlpha
      }

      // Layer foreground
      if (fg > 0.01) {
        if (fg > 0.50 && fg < 0.62) {
          // Window glow — warm interior light
          const glowStr = 0.35
          const glowR = 225, glowG = 175, glowB = 85
          r = r * (1 - glowStr) + glowR * glowStr
          g = g * (1 - glowStr) + glowG * glowStr
          b = b * (1 - glowStr) + glowB * glowStr
        } else {
          const fgAlpha = Math.min(1, fg * 1.2)
          r = r * (1 - fgAlpha) + fgR * fgAlpha
          g = g * (1 - fgAlpha) + fgG * fgAlpha
          b = b * (1 - fgAlpha) + fgB * fgAlpha
        }
      }

      // Film grain
      const grain = (grainNoise(x, y) * 0.5 + 0.5 - 0.5) * 5
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette (centered slightly above middle — horizon glow)
      const cx = x / W - 0.5
      const cy = y / H - 0.42
      const vig = 1.0 - (cx * cx * 0.7 + cy * cy * 1.3) * 0.35
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v8-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
