/**
 * NOSTALGIA v10 — BRANCH-BLOB OAK
 *
 * Key change: tree canopy built from overlapping blobs at branch tips.
 * Each major branch has its own canopy mass. Overlap creates the
 * full shape; gaps between blobs create natural sky holes.
 *
 * Also fixes:
 * - Trunk hidden inside canopy (no antenna effect)
 * - Bigger shotgun house
 * - Thicker Spanish moss
 * - Stronger background buildings
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

function drawBranchBlobOak(
  sil: Float32Array, w: number, h: number,
  cx: number, groundY: number,
  spread: number, treeHeight: number,
  rand: () => number, seed: number
) {
  const mossNoise = makeNoise(seed + 30, 10)

  // Trunk — thick, ends well inside canopy
  const trunkLean = (rand() - 0.45) * 25
  const trunkW = spread * 0.035
  const trunkTop = groundY - treeHeight * 0.55  // Trunk stops partway up

  for (let y = Math.floor(groundY + 5); y > Math.floor(trunkTop); y--) {
    const t = (groundY - y) / (groundY - trunkTop)
    const tx = cx + trunkLean * t
    const tw = trunkW * (1.6 - t * 0.8)
    // Root flare
    const rootFlare = y > groundY - 40 ? Math.pow((y - (groundY - 40)) / 40, 2) * trunkW * 1.2 : 0
    const totalW = tw + rootFlare
    for (let x = Math.floor(tx - totalW); x <= Math.ceil(tx + totalW); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) sil[y * w + x] = 1.0
    }
  }

  // Define major branches and their canopy blobs
  const numBranches = 7 + Math.floor(rand() * 4)
  const blobs: Array<{ cx: number, cy: number, rx: number, ry: number, noiseSeed: number }> = []

  for (let b = 0; b < numBranches; b++) {
    // Spread branches across a wide arc, biased horizontal
    const angle = -Math.PI * 0.5 + (b / (numBranches - 1) - 0.5) * Math.PI * 1.3
    const len = spread * (0.18 + rand() * 0.28)
    const droop = rand() * 0.15

    const startX = cx + trunkLean * 0.5
    const startY = trunkTop + treeHeight * 0.08

    // Draw branch
    const bw = trunkW * (0.65 - b * 0.04)
    for (let s = 0; s < 50; s++) {
      const t = s / 50
      const bx = startX + Math.cos(angle) * len * t
      const by = startY + Math.sin(angle) * len * t + droop * len * t * t
      const thickness = Math.max(2, bw * (1 - t * 0.75))

      for (let dx = -Math.ceil(thickness); dx <= Math.ceil(thickness); dx++) {
        for (let dy = -Math.ceil(thickness); dy <= Math.ceil(thickness); dy++) {
          const px = Math.round(bx + dx), py = Math.round(by + dy)
          if (px >= 0 && px < w && py >= 0 && py < h) {
            if (Math.sqrt(dx * dx + dy * dy) <= thickness)
              sil[py * w + px] = Math.max(sil[py * w + px], 0.95)
          }
        }
      }
    }

    // Canopy blob at branch tip
    const tipX = startX + Math.cos(angle) * len
    const tipY = startY + Math.sin(angle) * len + droop * len
    const blobR = spread * (0.10 + rand() * 0.12)
    // Blobs are wider than tall (leaves drape)
    blobs.push({
      cx: tipX,
      cy: tipY - blobR * 0.2,  // Slightly above branch tip
      rx: blobR * (1.0 + rand() * 0.3),
      ry: blobR * (0.7 + rand() * 0.2),
      noiseSeed: seed + 50 + b * 17
    })
  }

  // Add a couple of extra canopy blobs to fill in the center
  for (let i = 0; i < 3; i++) {
    blobs.push({
      cx: cx + (rand() - 0.5) * spread * 0.3,
      cy: trunkTop - treeHeight * (0.05 + rand() * 0.15),
      rx: spread * (0.12 + rand() * 0.08),
      ry: treeHeight * (0.08 + rand() * 0.06),
      noiseSeed: seed + 200 + i * 33
    })
  }

  // Render all canopy blobs
  for (const blob of blobs) {
    const en = makeNoise(blob.noiseSeed, 25)
    const gn = makeNoise(blob.noiseSeed + 1000, 18)

    const minX = Math.max(0, Math.floor(blob.cx - blob.rx * 1.3))
    const maxX = Math.min(w - 1, Math.ceil(blob.cx + blob.rx * 1.3))
    const minY = Math.max(0, Math.floor(blob.cy - blob.ry * 1.3))
    const maxY = Math.min(h - 1, Math.ceil(blob.cy + blob.ry * 1.3))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - blob.cx) / blob.rx
        const dy = (y - blob.cy) / blob.ry
        let dist = dx * dx + dy * dy

        // Noise perturbation of edge
        dist += en(x, y) * 0.30

        if (dist < 1.0) {
          const edgeFade = dist > 0.75 ? (1 - dist) / 0.25 : 1.0
          // Sky gaps
          const gap = gn(x, y) * 0.5 + 0.5
          const gapThresh = 0.60 + dist * 0.2
          const alpha = gap > gapThresh ? edgeFade * 0.08 : edgeFade
          sil[y * w + x] = Math.max(sil[y * w + x], alpha)
        }
      }
    }
  }

  // Spanish moss — thicker, longer, from branch endpoints and throughout canopy
  const numStrands = 100 + Math.floor(rand() * 60)
  for (let i = 0; i < numStrands; i++) {
    // Pick a random point that should be in the canopy
    let mossX: number, mossStartY: number
    if (i < blobs.length * 3) {
      // Hang from specific blob edges
      const blob = blobs[i % blobs.length]
      const angle = rand() * Math.PI * 2
      mossX = blob.cx + Math.cos(angle) * blob.rx * (0.5 + rand() * 0.4)
      mossStartY = blob.cy + Math.sin(angle) * blob.ry * (0.5 + rand() * 0.4)
    } else {
      mossX = cx + (rand() - 0.5) * spread * 0.9
      mossStartY = trunkTop + (rand() - 0.3) * treeHeight * 0.4
    }

    const mossLen = 50 + rand() * 140
    const mossWidth = 2 + rand() * 4  // Thicker

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossX + i * 77, mossStartY + my) * 18 * t
      const mx = mossX + sway
      const myy = mossStartY + my
      const mw = mossWidth * (1 - t * 0.3)
      const opacity = (1 - t * t) * 0.65

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
  const seeds: Record<string, number> = { a: 10001, b: 10002, c: 10003, d: 10004, e: 10005 }
  const seed = seeds[variant] ?? 10001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v10 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Sky ===
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed + 100, 600, 4)
  const cloudFBM = makeFBM(seed + 200, 300, 3)

  const skyData = ctx.createImageData(W, H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H
      const sn = skyFBM(x, y) * 0.5 + 0.5
      const cn = cloudFBM(x, y) * 0.5 + 0.5

      let r: number, g: number, b: number
      if (t < 0.12) {
        const st = t / 0.12
        r = 140 + st * 55; g = 60 + st * 48; b = 22 + st * 22
      } else if (t < 0.35) {
        const st = (t - 0.12) / 0.23
        r = 195 + st * 50; g = 108 + st * 68; b = 44 + st * 52
      } else if (t < 0.55) {
        // Horizon glow
        const st = (t - 0.35) / 0.20
        r = 245 + st * 8; g = 176 + st * 38; b = 96 + st * 40
      } else {
        const st = (t - 0.55) / 0.45
        r = 253 - st * 95; g = 214 - st * 100; b = 136 - st * 72
      }

      // Cloud wisps
      if (cn > 0.47) {
        const ca = Math.min(0.22, (cn - 0.47) / 0.35) * Math.max(0, 1 - t * 1.6)
        r += ca * 32; g += ca * 24; b += ca * 12
      }

      r += (sn - 0.5) * 10; g += (sn - 0.5) * 7; b += (sn - 0.5) * 4

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Background ===
  console.log("  Background layer...")
  const bgSil = new Float32Array(W * H)
  const groundY = H * 0.78

  // Distant roofline with variation
  const bgNoise = makeNoise(seed + 400, 100)
  for (let x = 0; x < W; x++) {
    const baseRoof = H * 0.46 + bgNoise(x, 0) * H * 0.07
    // Small step variations (building edges)
    const step = Math.floor(x / (W * 0.08))
    const stepOffset = ((step * 7 + 3) % 11 - 5) * H * 0.015
    const roofY = baseRoof + stepOffset
    for (let y = Math.max(0, Math.floor(roofY)); y < Math.floor(groundY); y++) {
      bgSil[y * W + x] = 1.0
    }
  }

  console.log("  Blurring background...")
  const bgBlurred = gaussianBlur(bgSil, W, H, 14)

  // === Foreground ===
  console.log("  Drawing foreground...")
  const fgSil = new Float32Array(W * H)
  const edgeNoise = makeNoise(seed + 500, 45)

  // Ground
  for (let x = 0; x < W; x++) {
    const gv = edgeNoise(x, groundY) * 10
    for (let y = Math.floor(groundY + gv); y < H; y++) {
      if (y >= 0) fgSil[y * W + x] = 1.0
    }
  }

  // === Shotgun house — left side, bigger ===
  console.log("  Drawing house...")
  const houseLeft = -20
  const houseRight = W * 0.28
  const houseW2 = houseRight - houseLeft
  const houseCx = (houseLeft + houseRight) / 2
  const roofLineY = H * 0.36

  // House body
  for (let y = Math.max(0, Math.floor(roofLineY)); y < Math.ceil(groundY); y++) {
    const wobble = edgeNoise(x_unused(houseLeft), y) * 3
    for (let x = Math.max(0, Math.floor(houseLeft + wobble)); x <= Math.min(W - 1, Math.ceil(houseRight + wobble)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Hip roof with overhang
  const peakY = roofLineY - houseW2 * 0.15
  for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(roofLineY); y++) {
    const t = (y - peakY) / (roofLineY - peakY)
    const halfW = (houseW2 / 2 + 20) * t + 10
    for (let x = Math.max(0, Math.floor(houseCx - halfW)); x <= Math.min(W - 1, Math.ceil(houseCx + halfW)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Dormer window (small gable poking from roof)
  const dormerCx = houseCx + houseW2 * 0.1
  const dormerW2 = houseW2 * 0.08
  const dormerBaseY = peakY + (roofLineY - peakY) * 0.35
  const dormerPeakY = dormerBaseY - dormerW2 * 0.9
  for (let y = Math.max(0, Math.floor(dormerPeakY)); y < Math.floor(dormerBaseY + 5); y++) {
    const t = Math.max(0, (y - dormerPeakY) / (dormerBaseY - dormerPeakY))
    const halfW = dormerW2 * Math.min(1, t)
    for (let x = Math.max(0, Math.floor(dormerCx - halfW)); x <= Math.min(W - 1, Math.ceil(dormerCx + halfW)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }
  // Dormer window glow
  for (let y = Math.floor(dormerBaseY - dormerW2 * 0.5); y < Math.floor(dormerBaseY); y++) {
    for (let x = Math.floor(dormerCx - dormerW2 * 0.4); x <= Math.ceil(dormerCx + dormerW2 * 0.4); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) fgSil[y * W + x] = 0.48
    }
  }

  // Cornice
  for (let y = Math.floor(roofLineY - 6); y < Math.floor(roofLineY + 4); y++) {
    if (y < 0 || y >= H) continue
    for (let x = Math.max(0, Math.floor(houseLeft - 15)); x <= Math.min(W - 1, Math.ceil(houseRight + 15)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }

  // Gallery (balcony) on second floor
  const galleryY = roofLineY + (groundY - roofLineY) * 0.42
  const galleryOverhang = 35
  // Gallery floor
  for (let y = Math.floor(galleryY); y < Math.floor(galleryY + 5); y++) {
    if (y < 0 || y >= H) continue
    for (let x = Math.max(0, Math.floor(houseLeft - galleryOverhang)); x <= Math.min(W - 1, Math.ceil(houseRight + galleryOverhang)); x++) {
      fgSil[y * W + x] = 1.0
    }
  }
  // Gallery railing (upper and lower rail)
  for (const ry of [galleryY + 5, galleryY + 35]) {
    for (let y = Math.floor(ry); y < Math.floor(ry + 3); y++) {
      if (y < 0 || y >= H) continue
      for (let x = Math.max(0, Math.floor(houseLeft - galleryOverhang)); x <= Math.min(W - 1, Math.ceil(houseRight + galleryOverhang)); x++) {
        fgSil[y * W + x] = 1.0
      }
    }
  }
  // Gallery balusters
  const balSpacing = 18
  for (let bx = houseLeft - galleryOverhang; bx <= houseRight + galleryOverhang; bx += balSpacing) {
    for (let y = Math.floor(galleryY + 5); y < Math.floor(galleryY + 35); y++) {
      const px = Math.round(bx)
      if (px >= 0 && px < W && y >= 0 && y < H) {
        fgSil[y * W + px] = 1.0
        if (px + 1 < W) fgSil[y * W + px + 1] = 1.0
      }
    }
  }

  // Windows — upper floor (above gallery) and lower floor (below gallery)
  // Upper windows (3 tall)
  const upperWinY = roofLineY + (galleryY - roofLineY) * 0.12
  const upperWinH = (galleryY - roofLineY) * 0.68
  const winW2 = houseW2 * 0.07
  for (let wi = 0; wi < 3; wi++) {
    const wx = Math.max(0, houseLeft) + houseW2 * (0.2 + wi * 0.25)
    for (let y = Math.floor(upperWinY); y < Math.floor(upperWinY + upperWinH); y++) {
      if (y < 0 || y >= H) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x >= 0 && x < W) fgSil[y * W + x] = 0.48
      }
    }
  }

  // Lower windows (3)
  const lowerWinY = galleryY + (groundY - galleryY) * 0.12
  const lowerWinH = (groundY - galleryY) * 0.52
  for (let wi = 0; wi < 3; wi++) {
    const wx = Math.max(0, houseLeft) + houseW2 * (0.2 + wi * 0.25)
    for (let y = Math.floor(lowerWinY); y < Math.floor(lowerWinY + lowerWinH); y++) {
      if (y < 0 || y >= H) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x >= 0 && x < W) fgSil[y * W + x] = 0.48
      }
    }
  }

  // Chimney
  const chimX = houseLeft + houseW2 * 0.75
  for (let y = Math.max(0, Math.floor(peakY - 55)); y < Math.floor(roofLineY - 20); y++) {
    for (let x = Math.floor(chimX); x <= Math.ceil(chimX + 20); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) fgSil[y * W + x] = 1.0
    }
  }

  // === Live oak — center-right ===
  console.log("  Drawing live oak...")
  drawBranchBlobOak(fgSil, W, H,
    W * 0.60, groundY,
    W * 0.60,   // Very wide spread
    H * 0.55,   // Tall
    rand, seed + 600)

  // === Street lamp ===
  const lampX = W * 0.38
  const lampTop = H * 0.30
  for (let y = Math.floor(lampTop); y < Math.floor(groundY); y++) {
    for (let x = Math.floor(lampX - 2); x <= Math.ceil(lampX + 2); x++) {
      if (x >= 0 && x < W && y >= 0 && y < H) fgSil[y * W + x] = 1.0
    }
  }
  // Arm
  const armLen = 40
  for (let s = 0; s <= 25; s++) {
    const t = s / 25
    const ax = lampX + armLen * t
    const ay = lampTop - 8 + 12 * t * t
    for (let d = -3; d <= 3; d++) {
      const px = Math.round(ax), py = Math.round(ay + d)
      if (px >= 0 && px < W && py >= 0 && py < H)
        fgSil[py * W + px] = Math.max(fgSil[py * W + px], 0.9)
    }
  }
  // Lantern
  const lanX = lampX + armLen, lanY = lampTop + 4
  for (let dy = -14; dy <= 14; dy++) {
    for (let dx = -9; dx <= 9; dx++) {
      const d = Math.sqrt(dx * dx / 81 + dy * dy / 196)
      if (d < 1) {
        const px = Math.round(lanX + dx), py = Math.round(lanY + dy)
        if (px >= 0 && px < W && py >= 0 && py < H)
          fgSil[py * W + px] = 0.42
      }
    }
  }

  // === Power lines ===
  console.log("  Drawing power lines...")
  const powerLines = [
    { x1: W * 0.26, y1: H * 0.18, x2: W * 1.1, y2: H * 0.23, sag: 32 },
    { x1: W * 0.26, y1: H * 0.21, x2: W * 1.1, y2: H * 0.26, sag: 38 },
  ]
  for (const line of powerLines) {
    for (let s = 0; s <= 300; s++) {
      const t = s / 300
      const lx = line.x1 + (line.x2 - line.x1) * t
      const baseY2 = line.y1 + (line.y2 - line.y1) * t
      const ly = baseY2 + line.sag * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          fgSil[py * W + px] = Math.max(fgSil[py * W + px], 0.9)
        }
      }
    }
  }

  // === Blur ===
  console.log("  Softening edges...")
  const fgBlurred = gaussianBlur(fgSil, W, H, 3)

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 800, 2.5)
  const texFBM = makeFBM(seed + 900, 30, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const bg = bgBlurred[y * W + x]
      const fg = fgBlurred[y * W + x]

      const skyR = pixels[idx], skyG = pixels[idx + 1], skyB = pixels[idx + 2]

      // Background buildings
      const bgAlpha = bg * 0.35
      const bgR = 145, bgG = 105, bgB = 80

      // Foreground
      const depth = y / H
      const tex = texFBM(x, y) * 0.5 + 0.5
      const fgR = 28 + depth * 15 + tex * 14
      const fgG = 16 + depth * 10 + tex * 9
      const fgB = 20 + depth * 12 + tex * 8

      let r = skyR, g = skyG, b = skyB

      if (bgAlpha > 0.01) {
        r = r * (1 - bgAlpha) + bgR * bgAlpha
        g = g * (1 - bgAlpha) + bgG * bgAlpha
        b = b * (1 - bgAlpha) + bgB * bgAlpha
      }

      if (fg > 0.01) {
        if (fg > 0.40 && fg < 0.55) {
          // Window / lamp glow
          const glowStr = 0.28
          r = r * (1 - glowStr) + 218 * glowStr
          g = g * (1 - glowStr) + 165 * glowStr
          b = b * (1 - glowStr) + 72 * glowStr
        } else {
          const fgAlpha = Math.min(1, fg * 1.15)
          r = r * (1 - fgAlpha) + fgR * fgAlpha
          g = g * (1 - fgAlpha) + fgG * fgAlpha
          b = b * (1 - fgAlpha) + fgB * fgAlpha
        }
      }

      // Film grain
      const grain = grainNoise(x, y) * 8
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx2 = x / W - 0.48
      const cy2 = y / H - 0.40
      const vig = 1.0 - (cx2 * cx2 * 0.9 + cy2 * cy2 * 1.4) * 0.42
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v10-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

// Dummy function — edge noise needs just y, x is unused in wobble calculation
function x_unused(_: number) { return 0 }

main()
