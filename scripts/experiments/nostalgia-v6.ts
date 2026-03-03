/**
 * NOSTALGIA v6 — GOLDEN HOUR STREETSCAPE
 *
 * New approach: silhouette of a French Quarter street against golden sky.
 * Not a blueprint — a memory. The buildings are imprecise shapes in warm
 * darkness. The sky is amber/gold/rose. The detail is in the light.
 *
 * Elements:
 * - Golden/amber sky gradient (the sky of late afternoon New Orleans)
 * - Silhouetted building roofline — mismatched heights, varied facades
 *   with shuttered windows, balcony overhangs, chimneys
 * - A live oak or two with hanging spanish moss (organic silhouette)
 * - Warm atmospheric haze blurring the boundary between sky and street
 * - Film grain / aged texture overlaid
 *
 * The viewer should feel: warmth, fading light, a specific place at a
 * specific time that will never come again.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 1536  // Landscape — like a photograph

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

// Generate a building profile (series of y-values for the roofline)
interface Building {
  left: number
  right: number
  roofY: number          // top of building
  hasBalcony: boolean
  balconyY: number
  hasShutters: boolean
  numWindows: number
  windowWidth: number
  windowHeight: number
  windowY: number
  hasDormer: boolean
  dormerX: number
}

function generateStreetscape(rand: () => number): Building[] {
  const buildings: Building[] = []
  let x = -50

  while (x < W + 100) {
    const width = 180 + rand() * 250
    // Varied heights — French Quarter buildings are 2-4 stories
    // Lower is more common (shotgun houses are 1-2 stories)
    const heightFactor = rand()
    const height = heightFactor < 0.3 ? 0.45 + rand() * 0.10  // tall (3-4 story)
      : heightFactor < 0.6 ? 0.52 + rand() * 0.08              // medium (2-3 story)
      : 0.58 + rand() * 0.08                                     // short (1-2 story)

    const roofY = H * height

    const bldg: Building = {
      left: x,
      right: x + width,
      roofY,
      hasBalcony: rand() < 0.6 && heightFactor < 0.7,  // taller buildings more likely
      balconyY: roofY + (H - roofY) * (0.25 + rand() * 0.15),
      hasShutters: rand() < 0.7,
      numWindows: 2 + Math.floor(rand() * 3),
      windowWidth: 25 + rand() * 15,
      windowHeight: 50 + rand() * 40,
      windowY: roofY + (H - roofY) * (0.15 + rand() * 0.15),
      hasDormer: rand() < 0.25,
      dormerX: x + width * (0.3 + rand() * 0.4),
    }

    buildings.push(bldg)
    x += width + (2 + rand() * 8)  // Small gaps between buildings
  }

  return buildings
}

// Generate a simple tree silhouette using recursive branching
function drawTree(
  silhouette: Float32Array, w: number, h: number,
  trunkX: number, groundY: number,
  height: number, spread: number,
  rand: () => number, seed: number
) {
  const noise = makeNoise(seed, 20)

  // Recursive branch function
  function branch(
    x: number, y: number,
    angle: number, length: number,
    width: number, depth: number
  ) {
    if (depth > 8 || length < 5 || width < 1) return

    // Draw this branch segment
    const endX = x + Math.cos(angle) * length
    const endY = y + Math.sin(angle) * length

    // Fill pixels along the branch
    const steps = Math.ceil(length * 2)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const bx = x + (endX - x) * t
      const by = y + (endY - y) * t
      const bw = width * (1 - t * 0.3)

      const margin = Math.ceil(bw + 2)
      for (let py = Math.max(0, Math.floor(by - margin)); py <= Math.min(h - 1, Math.ceil(by + margin)); py++) {
        for (let px = Math.max(0, Math.floor(bx - margin)); px <= Math.min(w - 1, Math.ceil(bx + margin)); px++) {
          const d = Math.sqrt((px - bx) ** 2 + (py - by) ** 2)
          if (d < bw) {
            silhouette[py * w + px] = Math.max(silhouette[py * w + px], 1.0 - d / bw)
          }
        }
      }
    }

    // Sub-branches
    const numBranches = depth < 3 ? 2 + Math.floor(rand() * 2) : 1 + Math.floor(rand() * 2)
    for (let b = 0; b < numBranches; b++) {
      const branchAngle = angle + (rand() - 0.5) * 1.2 + (rand() < 0.5 ? 0.2 : -0.2)
      const branchLen = length * (0.55 + rand() * 0.3)
      const branchWidth = width * (0.6 + rand() * 0.2)
      branch(endX, endY, branchAngle, branchLen, branchWidth, depth + 1)
    }

    // Spanish moss (hanging strands from branches deeper than 3)
    if (depth >= 3 && depth < 6 && rand() < 0.4) {
      const mossLen = 20 + rand() * 60
      const mossX = endX + (rand() - 0.5) * width * 2
      for (let my = 0; my < mossLen; my++) {
        const mx = mossX + noise(mossX, endY + my) * 8
        const mw = 1.5 + (1 - my / mossLen) * 2
        const py = Math.round(endY + my)
        const px = Math.round(mx)
        if (py >= 0 && py < h && px >= 0 && px < w) {
          const opacity = (1 - my / mossLen) * 0.6
          silhouette[py * w + px] = Math.max(silhouette[py * w + px], opacity)
          if (px + 1 < w) silhouette[py * w + px + 1] = Math.max(silhouette[py * w + px + 1], opacity * 0.5)
        }
      }
    }
  }

  // Trunk
  branch(trunkX, groundY, -Math.PI / 2 + (rand() - 0.5) * 0.2, height * 0.35, spread * 0.08, 0)
  // Main branches spreading wide (live oak characteristic)
  for (let i = 0; i < 4; i++) {
    const angle = -Math.PI / 2 + (i - 1.5) * 0.6 + (rand() - 0.5) * 0.3
    branch(trunkX, groundY - height * 0.3, angle, height * 0.45, spread * 0.05, 2)
  }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 86001, b: 86002, c: 86003, d: 86004 }
  const seed = seeds[variant] ?? 86001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v6 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Step 1: Golden sky ===
  console.log("  Painting sky...")
  const skyNoise = makeNoise(seed + 100, 400)
  const cloudNoise = makeNoise(seed + 200, 200)
  const microNoise = makeNoise(seed + 300, 6)

  const skyData = ctx.createImageData(W, H)

  // Sky gradient: deep amber at top → bright gold at horizon → warm rose near buildings
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const t = y / H  // 0=top, 1=bottom

      const sn = skyNoise(x, y) * 0.5 + 0.5
      const cn = cloudNoise(x, y) * 0.5 + 0.5
      const mn = microNoise(x, y) * 0.5 + 0.5

      // Sky color gradient
      let r: number, g: number, b: number
      if (t < 0.3) {
        // Upper sky: deep warm amber/orange
        const st = t / 0.3
        r = 180 + st * 50
        g = 100 + st * 60
        b = 50 + st * 30
      } else if (t < 0.55) {
        // Mid sky: bright gold
        const st = (t - 0.3) / 0.25
        r = 230 + st * 20
        g = 160 + st * 40
        b = 80 + st * 40
      } else {
        // Lower sky (horizon/haze): warm rose-gold fading to darker
        const st = (t - 0.55) / 0.45
        r = 250 - st * 80
        g = 200 - st * 80
        b = 120 - st * 60
      }

      // Cloud/atmosphere variation
      const cloudAmount = Math.max(0, cn - 0.4) / 0.6
      r += cloudAmount * 15 * (1 - t * 0.5)
      g += cloudAmount * 12 * (1 - t * 0.5)
      b += cloudAmount * 5 * (1 - t * 0.5)

      // Subtle noise texture
      r += (sn - 0.5) * 8
      g += (sn - 0.5) * 6
      b += (sn - 0.5) * 4

      // Very fine grain
      r += (mn - 0.5) * 3
      g += (mn - 0.5) * 2
      b += (mn - 0.5) * 1.5

      skyData.data[idx + 0] = Math.round(Math.max(0, Math.min(255, r)))
      skyData.data[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      skyData.data[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
      skyData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(skyData, 0, 0)

  // === Step 2: Building silhouettes ===
  console.log("  Generating streetscape...")
  const buildings = generateStreetscape(rand)
  const silhouette = new Float32Array(W * H)

  const groundY = H * 0.82  // Ground level (buildings extend from here upward)

  for (const bldg of buildings) {
    // Main building body
    const roofY = bldg.roofY
    for (let y = Math.max(0, Math.floor(roofY)); y < H; y++) {
      for (let x = Math.max(0, Math.floor(bldg.left)); x <= Math.min(W - 1, Math.ceil(bldg.right)); x++) {
        silhouette[y * W + x] = 1.0
      }
    }

    // Balcony overhang (wider than building, just a thin horizontal band)
    if (bldg.hasBalcony) {
      const balOverhang = 20 + rand() * 15
      const balThick = 8
      for (let y = Math.floor(bldg.balconyY); y < Math.floor(bldg.balconyY + balThick); y++) {
        if (y < 0 || y >= H) continue
        for (let x = Math.floor(bldg.left - balOverhang); x <= Math.ceil(bldg.right + balOverhang); x++) {
          if (x < 0 || x >= W) continue
          silhouette[y * W + x] = 1.0
        }
      }

      // Balcony railing (thin horizontal bars)
      const railY = bldg.balconyY + balThick + 3
      for (let y = Math.floor(railY); y < Math.floor(railY + 40); y++) {
        if (y < 0 || y >= H) continue
        for (let x = Math.floor(bldg.left - balOverhang + 5); x <= Math.ceil(bldg.right + balOverhang - 5); x++) {
          if (x < 0 || x >= W) continue
          // Horizontal bars
          if (y === Math.floor(railY) || y === Math.floor(railY + 39)) {
            silhouette[y * W + x] = 1.0
          }
          // Vertical balusters
          const localX = x - Math.floor(bldg.left - balOverhang + 5)
          if (localX % 18 < 3) {
            silhouette[y * W + x] = 1.0
          }
        }
      }
    }

    // Windows (lighter rectangles — cut out of silhouette slightly)
    const windowSpacing = (bldg.right - bldg.left) / (bldg.numWindows + 1)
    for (let wi = 0; wi < bldg.numWindows; wi++) {
      const wx = bldg.left + windowSpacing * (wi + 1) - bldg.windowWidth / 2
      const wy = bldg.windowY
      for (let y = Math.floor(wy); y < Math.floor(wy + bldg.windowHeight); y++) {
        if (y < 0 || y >= H) continue
        for (let x = Math.floor(wx); x < Math.floor(wx + bldg.windowWidth); x++) {
          if (x < 0 || x >= W) continue
          // Windows show warm light from inside (reduce silhouette slightly)
          silhouette[y * W + x] = 0.75  // Partially transparent — warm glow through
        }
      }
      // Shutters (slightly wider than window, solid)
      if (bldg.hasShutters) {
        const shutterW = 8
        for (let y = Math.floor(wy - 3); y < Math.floor(wy + bldg.windowHeight + 3); y++) {
          if (y < 0 || y >= H) continue
          for (let x = Math.floor(wx - shutterW); x < Math.floor(wx); x++) {
            if (x < 0 || x >= W) continue
            silhouette[y * W + x] = 1.0
          }
          for (let x = Math.floor(wx + bldg.windowWidth); x < Math.floor(wx + bldg.windowWidth + shutterW); x++) {
            if (x < 0 || x >= W) continue
            silhouette[y * W + x] = 1.0
          }
        }
      }
    }

    // Dormer (small triangular addition on roofline)
    if (bldg.hasDormer) {
      const dw = 40 + rand() * 25
      const dh = 30 + rand() * 20
      const dx = bldg.dormerX
      for (let y = Math.floor(roofY - dh); y < Math.floor(roofY); y++) {
        if (y < 0 || y >= H) continue
        const progress = (roofY - y) / dh
        const halfW = dw * (1 - progress) / 2
        for (let x = Math.floor(dx - halfW); x <= Math.ceil(dx + halfW); x++) {
          if (x < 0 || x >= W) continue
          silhouette[y * W + x] = 1.0
        }
      }
    }
  }

  // === Step 3: Trees ===
  console.log("  Drawing trees...")
  // One or two live oaks on the street
  const treeX1 = W * (0.15 + rand() * 0.15)
  drawTree(silhouette, W, H, treeX1, groundY, H * 0.45, W * 0.25, rand, seed + 500)

  if (rand() < 0.6) {
    const treeX2 = W * (0.70 + rand() * 0.15)
    drawTree(silhouette, W, H, treeX2, groundY, H * 0.35, W * 0.20, rand, seed + 600)
  }

  // === Step 4: Composite silhouette over sky ===
  console.log("  Compositing...")
  const imageData = ctx.getImageData(0, 0, W, H)
  const pixels = imageData.data

  const grainNoise = makeNoise(seed + 800, 3)
  const hazeNoise = makeNoise(seed + 900, 300)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      let sil = silhouette[y * W + x]

      // Atmospheric haze — softens the silhouette boundary
      // Lower buildings and things further from viewer are hazier
      const hazeAmount = Math.max(0, (y / H - 0.3)) * 0.3
      const haze = hazeNoise(x, y) * 0.5 + 0.5
      if (sil > 0.5) {
        // Partially lift shadows in hazy areas
        sil = sil * (1 - hazeAmount * haze * 0.4)
      }

      const skyR = pixels[idx]
      const skyG = pixels[idx + 1]
      const skyB = pixels[idx + 2]

      // Silhouette color: not pure black — warm dark brown/purple
      // Buildings are warm in late light even in shadow
      const silR = 45 + hazeAmount * 30
      const silG = 30 + hazeAmount * 25
      const silB = 35 + hazeAmount * 30

      // Window glow: where silhouette is 0.75, show warm interior light
      let r: number, g: number, b: number
      if (sil >= 0.99) {
        // Solid silhouette
        r = silR
        g = silG
        b = silB
      } else if (sil > 0.70 && sil < 0.80) {
        // Window — warm interior glow mixed with sky
        const windowGlowR = 240
        const windowGlowG = 190
        const windowGlowB = 100
        r = windowGlowR * 0.5 + silR * 0.5
        g = windowGlowG * 0.5 + silG * 0.5
        b = windowGlowB * 0.5 + silB * 0.5
      } else if (sil > 0.01) {
        // Partial (anti-aliased edges, moss, haze)
        r = skyR * (1 - sil) + silR * sil
        g = skyG * (1 - sil) + silG * sil
        b = skyB * (1 - sil) + silB * sil
      } else {
        r = skyR
        g = skyG
        b = skyB
      }

      // Film grain
      const grain = (grainNoise(x, y) * 0.5 + 0.5 - 0.5) * 6
      r += grain
      g += grain * 0.8
      b += grain * 0.6

      // Overall warm vignette
      const cx = x / W - 0.5
      const cy = y / H - 0.5
      const vig = 1.0 - (cx * cx + cy * cy) * 0.35
      r *= vig; g *= vig; b *= vig

      pixels[idx] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx + 2] = Math.round(Math.max(0, Math.min(255, b)))
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v6-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
