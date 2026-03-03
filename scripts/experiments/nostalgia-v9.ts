/**
 * NOSTALGIA v9 — SPREADING OAK
 *
 * Key changes from v8:
 * - Live oak is WIDE (2.5:1 aspect), not circular
 * - Tree is the hero element, dominates the scene
 * - Explicit horizontal branch structure visible
 * - Spanish moss hangs heavy
 * - Small shotgun house partially behind tree
 * - More atmospheric: humid golden haze
 * - Stronger grain, deeper vignette
 * - Organic edges on everything (noise-perturbed outlines)
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

function makeFBM(seed: number, baseScale: number, octaves: number) {
  const noises = Array.from({ length: octaves }, (_, i) => makeNoise(seed + i * 100, baseScale / (1 << i)))
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

function drawSpreadingOak(
  sil: Float32Array, w: number, h: number,
  cx: number, groundY: number,
  spread: number, height: number,
  rand: () => number, seed: number
) {
  const edgeNoise = makeNoise(seed + 10, 40)
  const innerNoise = makeNoise(seed + 20, 18)
  const gapNoise = makeNoise(seed + 40, 25)
  const mossNoise = makeNoise(seed + 30, 10)

  // Live oak canopy center: lower than you'd expect — the tree spreads OUT not UP
  const canopyY = groundY - height * 0.65
  const canopyHalfW = spread * 0.52  // Very wide
  const canopyHalfH = height * 0.38   // But not very tall (wider than tall)

  // Trunk — thick, slightly leaning
  const trunkLean = (rand() - 0.4) * 30
  const trunkW = spread * 0.04
  for (let y = Math.floor(groundY + 5); y > Math.floor(canopyY + canopyHalfH * 0.3); y--) {
    const t = (groundY - y) / (groundY - canopyY)
    const tx = cx + trunkLean * t
    const tw = trunkW * (1.5 - t * 0.6)
    // Root flare at base
    const rootFlare = y > groundY - 30 ? (y - (groundY - 30)) / 30 * trunkW * 0.8 : 0
    const totalW = tw + rootFlare
    for (let x = Math.floor(tx - totalW); x <= Math.ceil(tx + totalW); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) sil[y * w + x] = 1.0
    }
  }

  // Major branches — heavy horizontal spreaders
  const branches: Array<{ angle: number, len: number, droop: number }> = []
  const numBranches = 5 + Math.floor(rand() * 3)
  for (let b = 0; b < numBranches; b++) {
    // Spread mostly horizontal, slight upward or downward angles
    const baseAngle = -Math.PI * 0.5 + (b / (numBranches - 1) - 0.5) * Math.PI * 1.1
    const angle = baseAngle + (rand() - 0.5) * 0.25
    const len = spread * (0.25 + rand() * 0.22)
    const droop = rand() * 0.3  // Some branches droop
    branches.push({ angle, len, droop })

    const bw = trunkW * (0.75 - b * 0.05)
    const startX = cx + trunkLean * 0.5
    const startY = canopyY + canopyHalfH * 0.15

    for (let s = 0; s < 60; s++) {
      const t = s / 60
      const bx = startX + Math.cos(angle) * len * t
      // Branches droop under their own weight as they extend
      const by = startY + Math.sin(angle) * len * t + droop * len * t * t
      const thickness = Math.max(2, bw * (1 - t * 0.7))

      for (let dx = -Math.ceil(thickness); dx <= Math.ceil(thickness); dx++) {
        for (let dy = -Math.ceil(thickness); dy <= Math.ceil(thickness); dy++) {
          const px = Math.round(bx + dx), py = Math.round(by + dy)
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const d = Math.sqrt(dx * dx + dy * dy)
            if (d <= thickness) sil[py * w + px] = Math.max(sil[py * w + px], 0.95)
          }
        }
      }
    }
  }

  // Dense canopy — wide ellipse with noise-perturbed edges
  for (let y = Math.floor(canopyY - canopyHalfH * 1.1); y < Math.floor(groundY - height * 0.05); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(cx - canopyHalfW * 1.15); x <= Math.ceil(cx + canopyHalfW * 1.15); x++) {
      if (x < 0 || x >= w) continue

      const dx = (x - cx) / canopyHalfW
      const dy = (y - canopyY) / canopyHalfH
      // Bottom is irregular — branches create bumps
      const dyAdj = dy > 0 ? dy * 0.75 : dy
      let baseDist = dx * dx + dyAdj * dyAdj

      // Noise perturbation of the edge
      const en = edgeNoise(x, y) * 0.25
      const in2 = innerNoise(x, y) * 0.12
      const effectiveDist = baseDist + en + in2

      if (effectiveDist < 1.0) {
        const edgeFade = effectiveDist > 0.78 ? (1 - effectiveDist) / 0.22 : 1.0
        // Gaps in canopy
        const gn = gapNoise(x, y) * 0.5 + 0.5
        const gapThreshold = 0.62 + effectiveDist * 0.18
        const alpha = gn > gapThreshold ? edgeFade * 0.12 : edgeFade
        sil[y * w + x] = Math.max(sil[y * w + x], alpha)
      }
    }
  }

  // Spanish moss — heavy drapes from branch tips and throughout canopy
  const numStrands = 80 + Math.floor(rand() * 40)
  for (let i = 0; i < numStrands; i++) {
    const mossX = cx + (rand() - 0.5) * spread * 1.0
    const startY2 = canopyY + (rand() - 0.2) * canopyHalfH * 1.5
    // Only hang from where canopy exists
    const dx = (mossX - cx) / canopyHalfW
    const dy = (startY2 - canopyY) / canopyHalfH
    if (dx * dx + dy * dy > 1.1) continue

    const mossLen = 40 + rand() * 120
    const mossWidth = 1 + rand() * 3

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossX + i * 77, startY2 + my) * 15 * t
      const mx = mossX + sway
      const myy = startY2 + my
      const mw = mossWidth * (1 - t * 0.4)
      const opacity = (1 - t * t) * 0.7

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

function drawShotgunHouse(
  sil: Float32Array, w: number, h: number,
  left: number, right: number, roofY: number, groundY: number,
  rand: () => number, edgeNoise: (x: number, y: number) => number
) {
  const houseW = right - left
  const houseCx = (left + right) / 2

  // Shotgun houses: narrow, low, with porch
  // Slightly irregular edges from the noise
  for (let y = Math.max(0, Math.floor(roofY)); y < Math.min(h, Math.ceil(groundY)); y++) {
    for (let x = Math.max(0, Math.floor(left)); x <= Math.min(w - 1, Math.ceil(right)); x++) {
      const wobble = edgeNoise(x, y) * 6
      if (x >= left + wobble && x <= right + wobble) {
        sil[y * w + x] = 1.0
      }
    }
  }

  // Gable roof (shotgun houses have side-gable roofs)
  const peakY = roofY - houseW * 0.22
  for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(roofY); y++) {
    if (y >= h) continue
    const t = (y - peakY) / (roofY - peakY)
    const halfW = houseW * t / 2 + 8
    for (let x = Math.max(0, Math.floor(houseCx - halfW)); x <= Math.min(w - 1, Math.ceil(houseCx + halfW)); x++) {
      sil[y * w + x] = 1.0
    }
  }

  // Porch overhang on the front (extends forward)
  const porchOverhang = houseW * 0.15
  const porchY = roofY + (groundY - roofY) * 0.08
  for (let y = Math.floor(porchY); y < Math.floor(porchY + 5); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.max(0, Math.floor(left - porchOverhang)); x <= Math.min(w - 1, Math.ceil(right + porchOverhang)); x++) {
      sil[y * w + x] = 1.0
    }
  }

  // Porch columns (thin)
  const colW = 4
  for (const colX of [left - porchOverhang * 0.6, right + porchOverhang * 0.6]) {
    for (let y = Math.floor(porchY + 5); y < Math.floor(groundY); y++) {
      for (let x = Math.floor(colX - colW / 2); x <= Math.ceil(colX + colW / 2); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) sil[y * w + x] = 1.0
      }
    }
  }

  // Windows (2-3 on front face, tall shuttered)
  const numWin = 2 + Math.floor(rand() * 2)
  const winH = (groundY - roofY) * 0.42
  const winW = houseW * 0.13
  const winStartY = roofY + (groundY - roofY) * 0.2

  for (let wi = 0; wi < numWin; wi++) {
    const wx = left + houseW * (0.22 + wi * (0.56 / Math.max(1, numWin - 1)))
    for (let y = Math.floor(winStartY); y < Math.floor(winStartY + winH); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW / 2); x <= Math.ceil(wx + winW / 2); x++) {
        if (x >= 0 && x < w) sil[y * w + x] = 0.5  // Window glow marker
      }
    }
  }

  // Door
  const doorW = houseW * 0.12
  const doorH = (groundY - roofY) * 0.5
  const doorX = houseCx
  const doorY = groundY - doorH
  for (let y = Math.floor(doorY); y < Math.floor(groundY); y++) {
    if (y < 0 || y >= h) continue
    for (let x = Math.floor(doorX - doorW / 2); x <= Math.ceil(doorX + doorW / 2); x++) {
      if (x >= 0 && x < w) sil[y * w + x] = 0.5
    }
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 99001, b: 99002, c: 99003, d: 99004, e: 99005 }
  const seed = seeds[variant] ?? 99001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v9 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Sky — golden humid evening ===
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed + 100, 600, 4)
  const cloudFBM = makeFBM(seed + 200, 250, 3)
  const hazeFBM = makeFBM(seed + 300, 800, 2)

  const skyData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H
      const sn = skyFBM(x, y) * 0.5 + 0.5
      const cn = cloudFBM(x, y) * 0.5 + 0.5
      const hz = hazeFBM(x, y) * 0.5 + 0.5

      let r: number, g: number, b: number
      if (t < 0.15) {
        // Deep amber upper sky
        const st = t / 0.15
        r = 145 + st * 55; g = 65 + st * 50; b = 25 + st * 25
      } else if (t < 0.40) {
        // Warming gradient
        const st = (t - 0.15) / 0.25
        r = 200 + st * 45; g = 115 + st * 65; b = 50 + st * 50
      } else if (t < 0.58) {
        // Horizon glow — the warmest, brightest band
        const st = (t - 0.40) / 0.18
        r = 245 + st * 8; g = 180 + st * 30; b = 100 + st * 35
      } else {
        // Below horizon (will be mostly hidden by silhouettes)
        const st = (t - 0.58) / 0.42
        r = 253 - st * 100; g = 210 - st * 95; b = 135 - st * 70
      }

      // Cloud wisps — more subtle, atmospheric
      if (cn > 0.48) {
        const ca = Math.min(0.20, (cn - 0.48) / 0.35) * Math.max(0, 1 - t * 1.8)
        r += ca * 30; g += ca * 22; b += ca * 12
      }

      // General atmospheric noise
      r += (sn - 0.5) * 10; g += (sn - 0.5) * 7; b += (sn - 0.5) * 4

      // Humid haze — golden light scattered in the air
      const hazeStr = hz * 0.06 * (1 - Math.abs(t - 0.5) * 1.2)
      r += hazeStr * 40; g += hazeStr * 28; b += hazeStr * 10

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Background buildings (far, hazy) ===
  console.log("  Background layer...")
  const bgSil = new Float32Array(W * H)
  const groundY = H * 0.78

  // Distant low roofline — just a band of buildings
  const bgNoise = makeNoise(seed + 400, 120)
  for (let x = 0; x < W; x++) {
    const baseRoof = H * 0.48 + bgNoise(x, 0) * H * 0.06
    for (let y = Math.max(0, Math.floor(baseRoof)); y < Math.floor(groundY); y++) {
      bgSil[y * W + x] = 1.0
    }
  }

  console.log("  Blurring background...")
  const bgBlurred = gaussianBlur(bgSil, W, H, 16)

  // === Foreground silhouettes ===
  console.log("  Drawing foreground...")
  const fgSil = new Float32Array(W * H)
  const edgeNoise = makeNoise(seed + 500, 50)

  // Ground — slightly uneven (sidewalk, grass)
  for (let x = 0; x < W; x++) {
    const groundVariation = edgeNoise(x, groundY) * 8
    for (let y = Math.floor(groundY + groundVariation); y < H; y++) {
      if (y >= 0) fgSil[y * W + x] = 1.0
    }
  }

  // === Shotgun house — left side ===
  console.log("  Drawing house...")
  const houseLeft = W * 0.02
  const houseRight = W * 0.22
  const houseRoofY = H * 0.42
  drawShotgunHouse(fgSil, W, H, houseLeft, houseRight, houseRoofY, groundY, rand, edgeNoise)

  // === Live oak — center-right, hero element ===
  console.log("  Drawing live oak...")
  drawSpreadingOak(fgSil, W, H,
    W * 0.58, groundY,
    W * 0.65,  // Very wide spread
    H * 0.50,  // Tall but wider
    rand, seed + 600)

  // === Street lamp ===
  const lampX = W * 0.34
  const lampTop = H * 0.32
  const lampPoleW = 4
  // Pole
  for (let y = Math.floor(lampTop); y < Math.floor(groundY); y++) {
    for (let x = Math.floor(lampX - lampPoleW / 2); x <= Math.ceil(lampX + lampPoleW / 2); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) fgSil[y * W + x] = 1.0
    }
  }
  // Lamp head (curved arm + lantern)
  const armLen = 35
  for (let s = 0; s <= 20; s++) {
    const t = s / 20
    const ax = lampX + armLen * t
    const ay = lampTop - 10 + 15 * t * t  // Curved arm
    const aw = 3 - t
    for (let dx = -Math.ceil(aw); dx <= Math.ceil(aw); dx++) {
      for (let dy = -Math.ceil(aw); dy <= Math.ceil(aw); dy++) {
        const px = Math.round(ax + dx), py = Math.round(ay + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          fgSil[py * W + px] = Math.max(fgSil[py * W + px], 0.9)
        }
      }
    }
  }
  // Lantern glow
  const lanternX = lampX + armLen
  const lanternY = lampTop + 5
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -8; dx <= 8; dx++) {
      const px = Math.round(lanternX + dx), py = Math.round(lanternY + dy)
      if (px >= 0 && px < W && py >= 0 && py < H) {
        const d = Math.sqrt(dx * dx / 64 + dy * dy / 144)
        if (d < 1) fgSil[py * W + px] = 0.45  // Lamp glow marker
      }
    }
  }

  // === Power lines ===
  console.log("  Drawing power lines...")
  const lines = [
    { x1: W * 0.20, y1: H * 0.20, x2: W * 1.1, y2: H * 0.25, sag: 35 },
    { x1: W * 0.20, y1: H * 0.23, x2: W * 1.1, y2: H * 0.28, sag: 40 },
    { x1: W * 0.20, y1: H * 0.26, x2: W * 1.1, y2: H * 0.31, sag: 32 },
  ]
  for (const line of lines) {
    for (let s = 0; s <= 300; s++) {
      const t = s / 300
      const lx = line.x1 + (line.x2 - line.x1) * t
      const baseY = line.y1 + (line.y2 - line.y1) * t
      const ly = baseY + line.sag * Math.sin(t * Math.PI)
      // Thicker lines (2-3px)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          fgSil[py * W + px] = Math.max(fgSil[py * W + px], 0.9)
        }
      }
    }
  }

  // === Blur foreground slightly ===
  console.log("  Softening edges...")
  const fgBlurred = gaussianBlur(fgSil, W, H, 3)

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 800, 2.5)
  const texNoise = makeFBM(seed + 900, 30, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const bg = bgBlurred[y * W + x]
      const fg = fgBlurred[y * W + x]

      const skyR = pixels[idx], skyG = pixels[idx + 1], skyB = pixels[idx + 2]

      // Background buildings: warm haze
      const bgR = 150, bgG = 108, bgB = 82
      const bgAlpha = bg * 0.28

      // Foreground: rich dark warm brown with texture
      const depth = y / H
      const tex = texNoise(x, y) * 0.5 + 0.5
      const fgR = 30 + depth * 15 + tex * 12
      const fgG = 18 + depth * 10 + tex * 8
      const fgB = 22 + depth * 12 + tex * 7

      let r = skyR, g = skyG, b = skyB

      // Layer background
      if (bgAlpha > 0.01) {
        r = r * (1 - bgAlpha) + bgR * bgAlpha
        g = g * (1 - bgAlpha) + bgG * bgAlpha
        b = b * (1 - bgAlpha) + bgB * bgAlpha
      }

      // Layer foreground
      if (fg > 0.01) {
        if (fg > 0.42 && fg < 0.56) {
          // Window / lamp glow
          const glowStr = fg < 0.48 ? 0.30 : 0.28  // Lamp slightly brighter
          const glowR = 220, glowG = 168, glowB = 75
          r = r * (1 - glowStr) + glowR * glowStr
          g = g * (1 - glowStr) + glowG * glowStr
          b = b * (1 - glowStr) + glowB * glowStr
        } else {
          const fgAlpha = Math.min(1, fg * 1.15)
          r = r * (1 - fgAlpha) + fgR * fgAlpha
          g = g * (1 - fgAlpha) + fgG * fgAlpha
          b = b * (1 - fgAlpha) + fgB * fgAlpha
        }
      }

      // Atmospheric golden haze in shadow areas (humid air catching last light)
      if (fg > 0.3 && fg < 0.7) {
        const hazeMix = 0.06
        r += hazeMix * 40; g += hazeMix * 25; b += hazeMix * 8
      }

      // Film grain — stronger
      const grain = grainNoise(x, y) * 7
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Deep warm vignette
      const cx2 = x / W - 0.5
      const cy2 = y / H - 0.40
      const vig = 1.0 - (cx2 * cx2 * 0.8 + cy2 * cy2 * 1.5) * 0.4
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v9-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
