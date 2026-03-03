/**
 * NOSTALGIA v7 — GOLDEN HOUR (refined silhouettes)
 *
 * Same concept as v6 but with:
 * - Better building profiles (hip roofs, cornices, varied heights, parapets)
 * - Dense live oak canopy (filled silhouette, not bare branches)
 * - Prominent Spanish moss (long hanging strands)
 * - Taller French windows with visible shutters
 * - More composition variety (one prominent building + tree, not uniform row)
 * - Atmospheric haze at the horizon line
 * - A lamp post or power line for street-level specificity
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

// Dense tree canopy (filled silhouette with noise edge, not individual branches)
function drawLiveOak(
  sil: Float32Array, w: number, h: number,
  cx: number, groundY: number,
  canopyWidth: number, canopyHeight: number,
  rand: () => number, seed: number
) {
  const edgeNoise = makeNoise(seed + 10, 35)
  const innerNoise = makeNoise(seed + 20, 15)
  const mossNoise = makeNoise(seed + 30, 8)

  const canopyCenter = groundY - canopyHeight * 0.55
  const trunkWidth = canopyWidth * 0.06

  // Trunk (slightly curved)
  const trunkCurve = (rand() - 0.5) * 30
  for (let y = Math.floor(groundY); y > Math.floor(canopyCenter + canopyHeight * 0.15); y--) {
    const t = (groundY - y) / (groundY - canopyCenter)
    const tx = cx + trunkCurve * t
    const tw = trunkWidth * (1 - t * 0.3)
    for (let x = Math.floor(tx - tw); x <= Math.ceil(tx + tw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) {
        sil[y * w + x] = 1.0
      }
    }
  }

  // Main canopy — wide elliptical shape with noisy edges
  // Live oaks are wider than tall, with a flat bottom
  for (let y = Math.floor(canopyCenter - canopyHeight * 0.55); y < Math.floor(groundY - canopyHeight * 0.1); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(cx - canopyWidth * 0.65); x <= Math.ceil(cx + canopyWidth * 0.65); x++) {
      if (x < 0 || x >= w) continue

      // Elliptical distance (wider than tall)
      const dx = (x - cx) / (canopyWidth * 0.55)
      const dy = (y - canopyCenter) / (canopyHeight * 0.5)
      const baseDist = dx * dx + dy * dy

      // Edge noise (makes the canopy look organic, not geometric)
      const en = edgeNoise(x, y) * 0.35
      const in2 = innerNoise(x, y) * 0.2

      const effectiveDist = baseDist + en + in2

      if (effectiveDist < 1.0) {
        // Inside canopy
        const edgeFade = effectiveDist > 0.85 ? (1 - effectiveDist) / 0.15 : 1.0
        sil[y * w + x] = Math.max(sil[y * w + x], edgeFade)
      }
    }
  }

  // Add some gaps/holes in the canopy (sky showing through)
  const gapNoise = makeNoise(seed + 40, 25)
  for (let y = Math.floor(canopyCenter - canopyHeight * 0.5); y < Math.floor(canopyCenter + canopyHeight * 0.3); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(cx - canopyWidth * 0.5); x <= Math.ceil(cx + canopyWidth * 0.5); x++) {
      if (x < 0 || x >= w) continue
      const gn = gapNoise(x, y) * 0.5 + 0.5
      if (gn > 0.72 && sil[y * w + x] > 0.5) {
        // Create gap — reduce silhouette
        sil[y * w + x] *= 0.2
      }
    }
  }

  // Spanish moss — long hanging strands from bottom edge of canopy
  const numStrands = 25 + Math.floor(rand() * 20)
  for (let i = 0; i < numStrands; i++) {
    const mossX = cx + (rand() - 0.5) * canopyWidth * 0.9
    const startY = canopyCenter + canopyHeight * (0.1 + rand() * 0.25)
    const mossLen = 40 + rand() * 100
    const mossWidth = 2 + rand() * 3

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossX + i * 100, startY + my) * 15 * t
      const mx = mossX + sway
      const myy = startY + my
      const mw = mossWidth * (1 - t * 0.6)

      if (myy < 0 || myy >= h) continue
      const opacity = (1 - t * t) * 0.8

      for (let dx = -Math.ceil(mw); dx <= Math.ceil(mw); dx++) {
        const px = Math.round(mx + dx)
        if (px < 0 || px >= w) continue
        const d = Math.abs(dx) / mw
        if (d < 1) {
          const falloff = (1 - d) * opacity
          const py = Math.round(myy)
          if (py >= 0 && py < h) {
            sil[py * w + px] = Math.max(sil[py * w + px], falloff)
          }
        }
      }
    }
  }
}

// Draw a single building with architectural detail
function drawBuilding(
  sil: Float32Array, w: number, h: number,
  left: number, right: number, roofY: number, groundY: number,
  roofType: "flat" | "hip" | "gable" | "parapet",
  hasBalcony: boolean, numFloors: number,
  rand: () => number
) {
  const bw = right - left
  const bh = groundY - roofY

  // Main body
  for (let y = Math.max(0, Math.floor(roofY)); y < Math.min(h, Math.ceil(groundY)); y++) {
    for (let x = Math.max(0, Math.floor(left)); x <= Math.min(w - 1, Math.ceil(right)); x++) {
      sil[y * w + x] = 1.0
    }
  }

  // Roof shape
  if (roofType === "hip") {
    // Hip roof: triangle at top
    const peakY = roofY - bh * 0.12
    const cx = (left + right) / 2
    for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(roofY); y++) {
      const t = (y - peakY) / (roofY - peakY)
      const halfW = bw * t / 2 + 10
      for (let x = Math.max(0, Math.floor(cx - halfW)); x <= Math.min(w - 1, Math.ceil(cx + halfW)); x++) {
        sil[y * w + x] = 1.0
      }
    }
  } else if (roofType === "gable") {
    // Gable: steeper triangle
    const peakY = roofY - bh * 0.18
    const cx = (left + right) / 2
    for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(roofY); y++) {
      const t = (y - peakY) / (roofY - peakY)
      const halfW = bw * t / 2 + 5
      for (let x = Math.max(0, Math.floor(cx - halfW)); x <= Math.min(w - 1, Math.ceil(cx + halfW)); x++) {
        sil[y * w + x] = 1.0
      }
    }
  } else if (roofType === "parapet") {
    // Parapet: short wall above flat roof with decorative cap
    const parapetH = 15 + rand() * 10
    for (let y = Math.max(0, Math.floor(roofY - parapetH)); y < Math.floor(roofY); y++) {
      for (let x = Math.max(0, Math.floor(left - 5)); x <= Math.min(w - 1, Math.ceil(right + 5)); x++) {
        sil[y * w + x] = 1.0
      }
    }
  }

  // Cornice / roof overhang
  const corniceY = roofY
  const overhang = 8 + rand() * 8
  for (let y = Math.floor(corniceY - 6); y < Math.floor(corniceY + 4); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(left - overhang); x <= Math.ceil(right + overhang); x++) {
      if (x < 0 || x >= w) continue
      sil[y * w + x] = 1.0
    }
  }

  // Windows — tall French windows per floor
  const floorHeight = bh / numFloors
  const numWin = Math.max(1, Math.floor(bw / 100))  // roughly 1 per 100px
  const winWidth = bw * 0.12
  const winHeight = floorHeight * 0.60
  const winSpacing = bw / (numWin + 1)

  for (let floor = 0; floor < numFloors; floor++) {
    const floorTop = roofY + floor * floorHeight
    const winY = floorTop + floorHeight * 0.18

    for (let wi = 0; wi < numWin; wi++) {
      const wx = left + winSpacing * (wi + 1) - winWidth / 2
      // French windows: slightly arched at top
      for (let y = Math.floor(winY); y < Math.floor(winY + winHeight); y++) {
        if (y < 0 || y >= h) continue
        const localY = (y - winY) / winHeight
        let localW = winWidth
        // Slight arch at top
        if (localY < 0.15) {
          const archT = localY / 0.15
          localW *= 0.7 + 0.3 * archT
        }
        for (let x = Math.floor(wx + (winWidth - localW) / 2); x <= Math.ceil(wx + (winWidth + localW) / 2); x++) {
          if (x < 0 || x >= w) continue
          sil[y * w + x] = 0.70  // Warm glow through windows
        }
      }
    }
  }

  // Balcony
  if (hasBalcony && numFloors >= 2) {
    const balY = roofY + floorHeight - 8
    const balOverhang = 25
    const railHeight = 35

    // Floor
    for (let y = Math.floor(balY); y < Math.floor(balY + 6); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(left - balOverhang); x <= Math.ceil(right + balOverhang); x++) {
        if (x < 0 || x >= w) continue
        sil[y * w + x] = 1.0
      }
    }

    // Railing (simplified iron railing silhouette)
    const railTop = balY + 6
    const railBot = balY + 6 + railHeight
    // Top and bottom rail
    for (const ry of [railTop, railBot]) {
      for (let x = Math.floor(left - balOverhang); x <= Math.ceil(right + balOverhang); x++) {
        if (x < 0 || x >= w) continue
        for (let y = Math.floor(ry); y < Math.floor(ry + 3); y++) {
          if (y >= 0 && y < h) sil[y * w + x] = 1.0
        }
      }
    }
    // Vertical spindles
    for (let x = Math.floor(left - balOverhang); x <= Math.ceil(right + balOverhang); x += 12) {
      for (let y = Math.floor(railTop); y <= Math.ceil(railBot); y++) {
        if (y >= 0 && y < h && x >= 0 && x < w) {
          sil[y * w + x] = Math.max(sil[y * w + x], 0.9)
          if (x + 1 < w) sil[y * w + x + 1] = Math.max(sil[y * w + x + 1], 0.7)
        }
      }
    }
  }

  // Chimney
  if (rand() < 0.4) {
    const chimX = left + bw * (0.2 + rand() * 0.6)
    const chimW = 18 + rand() * 12
    const chimH = 30 + rand() * 25
    const chimTop = (roofType === "flat" || roofType === "parapet")
      ? roofY - chimH
      : roofY - bh * 0.15 - chimH
    for (let y = Math.max(0, Math.floor(chimTop)); y < Math.floor(roofY); y++) {
      for (let x = Math.floor(chimX); x <= Math.ceil(chimX + chimW); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) sil[y * w + x] = 1.0
      }
    }
  }
}

// Street lamp
function drawLamp(
  sil: Float32Array, w: number, h: number,
  x: number, groundY: number, lampH: number
) {
  const poleW = 4
  const lampTop = groundY - lampH

  // Pole
  for (let y = Math.floor(lampTop); y < Math.floor(groundY); y++) {
    if (y < 0 || y >= h) continue
    for (let dx = -poleW; dx <= poleW; dx++) {
      const px = Math.round(x + dx)
      if (px >= 0 && px < w) {
        const d = Math.abs(dx) / poleW
        sil[y * w + px] = Math.max(sil[y * w + px], d < 0.5 ? 1.0 : 0.7)
      }
    }
  }

  // Lamp fixture (curved arm + lantern shape)
  const armLen = 35
  const lanternW = 18
  const lanternH = 25
  // Curved arm to the right
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const ax = x + t * armLen
    const ay = lampTop - 5 + t * t * 10  // Slight curve down
    const aw = 2 + (1 - t) * 2
    for (let dy = -aw; dy <= aw; dy++) {
      const py = Math.round(ay + dy)
      const px = Math.round(ax)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        sil[py * w + px] = 1.0
      }
    }
  }
  // Lantern
  const lanternX = x + armLen
  const lanternY = lampTop + 5
  for (let y = Math.floor(lanternY); y < Math.floor(lanternY + lanternH); y++) {
    if (y < 0 || y >= h) continue
    const localY = (y - lanternY) / lanternH
    const localW = lanternW * (0.7 + 0.3 * Math.sin(localY * Math.PI))
    for (let dx = -localW; dx <= localW; dx++) {
      const px = Math.round(lanternX + dx)
      if (px >= 0 && px < w) {
        sil[y * w + px] = 0.85  // Slightly transparent — lamp glow
      }
    }
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 87001, b: 87002, c: 87003, d: 87004 }
  const seed = seeds[variant] ?? 87001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v7 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Sky ===
  console.log("  Painting sky...")
  const skyNoise = makeNoise(seed + 100, 500)
  const cloudNoise = makeNoise(seed + 200, 250)
  const cloudNoise2 = makeNoise(seed + 210, 120)
  const microNoise = makeNoise(seed + 300, 4)

  const skyData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H

      const sn = skyNoise(x, y) * 0.5 + 0.5
      const cn = (cloudNoise(x, y) * 0.6 + cloudNoise2(x, y) * 0.4) * 0.5 + 0.5
      const mn = microNoise(x, y) * 0.5 + 0.5

      let r: number, g: number, b: number
      if (t < 0.25) {
        // Upper: deep warm amber
        const st = t / 0.25
        r = 165 + st * 55
        g = 85 + st * 55
        b = 35 + st * 30
      } else if (t < 0.50) {
        // Mid: bright gold-orange
        const st = (t - 0.25) / 0.25
        r = 220 + st * 30
        g = 140 + st * 55
        b = 65 + st * 40
      } else if (t < 0.65) {
        // Horizon: pale gold (brightest — the glow point)
        const st = (t - 0.50) / 0.15
        r = 250 - st * 5
        g = 195 + st * 15
        b = 105 + st * 25
      } else {
        // Below horizon: warm rose fading to dark
        const st = (t - 0.65) / 0.35
        r = 245 - st * 100
        g = 210 - st * 100
        b = 130 - st * 70
      }

      // Clouds (wispy, warm-lit)
      if (cn > 0.52) {
        const ca = Math.min(0.3, (cn - 0.52) / 0.3) * (1 - t * 0.6)
        r += ca * 30
        g += ca * 25
        b += ca * 15
      }

      // Subtle variation
      r += (sn - 0.5) * 8 + (mn - 0.5) * 2
      g += (sn - 0.5) * 6 + (mn - 0.5) * 1.5
      b += (sn - 0.5) * 4 + (mn - 0.5) * 1

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Silhouettes ===
  console.log("  Building streetscape...")
  const sil = new Float32Array(W * H)
  const groundY = H * 0.83

  // Ground (street level and below)
  for (let y = Math.floor(groundY); y < H; y++) {
    for (let x = 0; x < W; x++) {
      sil[y * W + x] = 1.0
    }
  }

  // Buildings — intentionally varied composition
  // Left: tall narrow building with balcony
  drawBuilding(sil, W, H,
    -30, W * 0.22, H * 0.28, groundY,
    "hip", true, 3, rand)

  // Center-left: shorter wider shotgun house
  drawBuilding(sil, W, H,
    W * 0.23, W * 0.48, H * 0.52, groundY,
    "gable", false, 2, rand)

  // Center-right: medium building with parapet
  drawBuilding(sil, W, H,
    W * 0.49, W * 0.68, H * 0.38, groundY,
    "parapet", true, 2, rand)

  // Right: tall building (partially off-frame)
  drawBuilding(sil, W, H,
    W * 0.69, W * 0.88, H * 0.30, groundY,
    "flat", true, 3, rand)

  // Far right (partial)
  drawBuilding(sil, W, H,
    W * 0.89, W + 50, H * 0.48, groundY,
    "hip", false, 2, rand)

  // === Live oak ===
  console.log("  Drawing live oak...")
  drawLiveOak(sil, W, H,
    W * 0.38, groundY,
    W * 0.28, H * 0.38,
    rand, seed + 500)

  // === Street lamp ===
  drawLamp(sil, W, H, W * 0.62, groundY, H * 0.25)

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 800, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      let s = sil[y * W + x]

      const skyR = pixels[idx], skyG = pixels[idx + 1], skyB = pixels[idx + 2]

      // Silhouette color: warm dark purple-brown (not pure black)
      const depth = y / H
      const silR = 38 + depth * 20
      const silG = 25 + depth * 15
      const silB = 32 + depth * 18

      let r: number, g: number, b: number

      if (s >= 0.95) {
        r = silR; g = silG; b = silB
      } else if (s > 0.65 && s < 0.80) {
        // Windows — warm interior glow
        const glowR = 235, glowG = 185, glowB = 95
        const ga = (s - 0.65) / 0.15
        r = silR * (1 - ga * 0.6) + glowR * ga * 0.6
        g = silG * (1 - ga * 0.6) + glowG * ga * 0.6
        b = silB * (1 - ga * 0.6) + glowB * ga * 0.6
      } else if (s > 0.01) {
        // Partial silhouette (edges, moss, etc.)
        r = skyR * (1 - s) + silR * s
        g = skyG * (1 - s) + silG * s
        b = skyB * (1 - s) + silB * s
      } else {
        r = skyR; g = skyG; b = skyB
      }

      // Film grain
      const grain = (grainNoise(x, y) * 0.5 + 0.5 - 0.5) * 5
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx = x / W - 0.5
      const cy = y / H - 0.45  // Slightly off-center (horizon area brighter)
      const vig = 1.0 - (cx * cx * 0.8 + cy * cy * 1.2) * 0.35
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v7-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
