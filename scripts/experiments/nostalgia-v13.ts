/**
 * NOSTALGIA v13 — THROUGH THE IRON
 *
 * The viewer is on a balcony, looking through wrought iron railing
 * at a New Orleans street at dusk. The iron is close, dark, detailed.
 * The scene beyond is soft, warm, atmospheric.
 *
 * Three layers:
 * 1. Background: golden sky
 * 2. Middle: soft atmospheric scene (buildings, oak, street) — BLURRED
 * 3. Foreground: wrought iron railing — SHARP, dark, framing
 *
 * The iron doesn't fill the image — it's the bottom third, like
 * resting your arms on a railing and looking out.
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

function drawThickCurve(
  sil: Float32Array, w: number, h: number,
  points: Array<{ x: number, y: number }>,
  thicknessStart: number,
  thicknessEnd: number,
) {
  for (let i = 0; i < points.length; i++) {
    const t = points.length > 1 ? i / (points.length - 1) : 0
    const thickness = thicknessStart + (thicknessEnd - thicknessStart) * t
    const halfW = thickness / 2
    const p = points[i]
    const margin = halfW + 2
    const minX = Math.max(0, Math.floor(p.x - margin))
    const maxX = Math.min(w - 1, Math.ceil(p.x + margin))
    const minY = Math.max(0, Math.floor(p.y - margin))
    const maxY = Math.min(h - 1, Math.ceil(p.y + margin))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const d = Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2)
        if (d < halfW) sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
        else if (d < halfW + 1.5) sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - halfW) / 1.5)
      }
    }
  }
}

function sampleBezier4(
  p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, p3x: number, p3y: number,
  steps: number
): Array<{ x: number, y: number }> {
  const pts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    pts.push({
      x: u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x,
      y: u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y,
    })
  }
  return pts
}

function sampleBezier3(
  p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, steps: number
): Array<{ x: number, y: number }> {
  const pts: Array<{ x: number, y: number }> = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t
    pts.push({
      x: u*u*p0x + 2*u*t*p1x + t*t*p2x,
      y: u*u*p0y + 2*u*t*p1y + t*t*p2y,
    })
  }
  return pts
}

function drawCircle(sil: Float32Array, w: number, h: number, cx: number, cy: number, r: number) {
  for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(h - 1, Math.ceil(cy + r + 2)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(w - 1, Math.ceil(cx + r + 2)); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d < r) sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
      else if (d < r + 1.5) sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - r) / 1.5)
    }
  }
}

function drawBar(sil: Float32Array, w: number, h: number, x1: number, y1: number, x2: number, y2: number, thickness: number) {
  const halfT = thickness / 2
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.001) return
  const steps = Math.ceil(len)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x1 + dx * t, py = y1 + dy * t
    const margin = halfT + 2
    for (let y = Math.max(0, Math.floor(py - margin)); y <= Math.min(h - 1, Math.ceil(py + margin)); y++) {
      for (let x = Math.max(0, Math.floor(px - margin)); x <= Math.min(w - 1, Math.ceil(px + margin)); x++) {
        const d = Math.sqrt((x - px) ** 2 + (y - py) ** 2)
        if (d < halfT) sil[y * w + x] = Math.max(sil[y * w + x], 1.0)
        else if (d < halfT + 1.5) sil[y * w + x] = Math.max(sil[y * w + x], 1.0 - (d - halfT) / 1.5)
      }
    }
  }
}

function drawVolute(
  sil: Float32Array, w: number, h: number,
  cx: number, cy: number, startR: number,
  direction: number, thickness: number, turns: number
) {
  const pts: Array<{ x: number, y: number }> = []
  const steps = Math.ceil(turns * 80)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const angle = t * turns * Math.PI * 2
    const r = startR * (1 - t * 0.82)
    pts.push({ x: cx + Math.cos(angle * direction) * r, y: cy + Math.sin(angle * direction) * r })
  }
  drawThickCurve(sil, w, h, pts, thickness, thickness * 0.4)
  drawCircle(sil, w, h, cx, cy, thickness * 0.9)
}

/**
 * Draw a full ornate panel with dense flowing scrollwork
 */
function drawPanel(
  sil: Float32Array, w: number, h: number,
  left: number, top: number, width: number, height: number,
  rand: () => number
) {
  const cx = left + width / 2
  const cy = top + height / 2
  const iron = 8

  // Central stem
  drawBar(sil, w, h, cx, top + height * 0.03, cx, top + height * 0.97, iron * 0.85)

  for (const mir of [-1, 1]) {
    // Large C-scroll, upper half
    const pts1 = sampleBezier4(
      cx, top + height * 0.12,
      cx + mir * width * 0.38, top + height * 0.05,
      cx + mir * width * 0.42, top + height * 0.30,
      cx + mir * width * 0.12, top + height * 0.42,
      120
    )
    drawThickCurve(sil, w, h, pts1, iron * 1.2, iron * 0.65)
    drawVolute(sil, w, h,
      cx + mir * width * 0.12, top + height * 0.42 + 8,
      18 + rand() * 6, mir, iron * 0.55, 1.2 + rand() * 0.3)

    // Large C-scroll, lower half (vertically mirrored)
    const pts2 = sampleBezier4(
      cx, top + height * 0.88,
      cx + mir * width * 0.38, top + height * 0.95,
      cx + mir * width * 0.42, top + height * 0.70,
      cx + mir * width * 0.12, top + height * 0.58,
      120
    )
    drawThickCurve(sil, w, h, pts2, iron * 1.2, iron * 0.65)
    drawVolute(sil, w, h,
      cx + mir * width * 0.12, top + height * 0.58 - 8,
      18 + rand() * 6, -mir, iron * 0.55, 1.2 + rand() * 0.3)

    // Mid S-curve connecting the two C-scrolls near the edge
    const midS = sampleBezier4(
      cx + mir * width * 0.38, top + height * 0.22,
      cx + mir * width * 0.44, top + height * 0.38,
      cx + mir * width * 0.44, top + height * 0.62,
      cx + mir * width * 0.38, top + height * 0.78,
      80
    )
    drawThickCurve(sil, w, h, midS, iron * 0.7, iron * 0.7)

    // Outward volutes at mid S-curve ends
    drawVolute(sil, w, h,
      cx + mir * width * 0.39, top + height * 0.20,
      12, mir, iron * 0.4, 1.0)
    drawVolute(sil, w, h,
      cx + mir * width * 0.39, top + height * 0.80,
      12, -mir, iron * 0.4, 1.0)

    // Thin inner curves (between stem and C-scrolls)
    const inner1 = sampleBezier3(
      cx, top + height * 0.20,
      cx + mir * width * 0.15, top + height * 0.15,
      cx + mir * width * 0.20, top + height * 0.28,
      50
    )
    drawThickCurve(sil, w, h, inner1, iron * 0.5, iron * 0.3)

    const inner2 = sampleBezier3(
      cx, top + height * 0.80,
      cx + mir * width * 0.15, top + height * 0.85,
      cx + mir * width * 0.20, top + height * 0.72,
      50
    )
    drawThickCurve(sil, w, h, inner2, iron * 0.5, iron * 0.3)

    // Leaf tendrils near the center
    for (const yPos of [0.35, 0.50, 0.65]) {
      const leaf = sampleBezier3(
        cx + mir * 4, top + height * yPos,
        cx + mir * width * 0.10, top + height * (yPos - 0.05),
        cx + mir * width * 0.08, top + height * (yPos + 0.03),
        40
      )
      drawThickCurve(sil, w, h, leaf, iron * 0.4, iron * 0.2)
    }
  }

  // Central rosette
  drawCircle(sil, w, h, cx, cy, iron * 1.8)
  // Top and bottom accent dots
  drawCircle(sil, w, h, cx, top + height * 0.05, iron * 0.9)
  drawCircle(sil, w, h, cx, top + height * 0.95, iron * 0.9)
}

/**
 * Build the scene layer (buildings, oak tree, ground) as a soft silhouette
 */
function buildScene(w: number, h: number, seed: number, rand: () => number): Float32Array {
  const scene = new Float32Array(w * h)
  const edgeNoise = makeNoise(seed + 500, 40)
  const canopyNoise = makeNoise(seed + 600, 30)
  const gapNoise = makeNoise(seed + 700, 20)

  const groundY = h * 0.82

  // Ground
  for (let x = 0; x < w; x++) {
    const gv = edgeNoise(x, groundY) * 8
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) scene[y * w + x] = 1.0
    }
  }

  // Distant roofline (hazy background buildings)
  const bgNoise = makeNoise(seed + 300, 120)
  for (let x = 0; x < w; x++) {
    const baseRoof = h * 0.44 + bgNoise(x, 0) * h * 0.08
    const step = Math.floor(x / (w * 0.09))
    const stepOff = ((step * 7 + 3) % 11 - 5) * h * 0.012
    const roofY = baseRoof + stepOff
    for (let y = Math.max(0, Math.floor(roofY)); y < Math.floor(groundY); y++) {
      scene[y * w + x] = 0.30  // Hazy — not solid
    }
  }

  // Shotgun house — right side (viewed from balcony across the street)
  const houseL = w * 0.55
  const houseR = w * 0.85
  const houseRoof = h * 0.35
  for (let y = Math.max(0, Math.floor(houseRoof)); y < Math.floor(groundY); y++) {
    for (let x = Math.max(0, Math.floor(houseL)); x <= Math.min(w - 1, Math.ceil(houseR)); x++) {
      scene[y * w + x] = Math.max(scene[y * w + x], 0.75)
    }
  }
  // Roof peak
  const peakX = (houseL + houseR) / 2
  const peakY = houseRoof - (houseR - houseL) * 0.12
  for (let y = Math.max(0, Math.floor(peakY)); y < Math.floor(houseRoof); y++) {
    const t = (y - peakY) / (houseRoof - peakY)
    const halfW = ((houseR - houseL) / 2 + 15) * t
    for (let x = Math.max(0, Math.floor(peakX - halfW)); x <= Math.min(w - 1, Math.ceil(peakX + halfW)); x++) {
      scene[y * w + x] = Math.max(scene[y * w + x], 0.75)
    }
  }

  // Windows with warm glow (lighter areas in the building)
  const winW = (houseR - houseL) * 0.08
  const winH = (groundY - houseRoof) * 0.22
  for (let wi = 0; wi < 3; wi++) {
    const wx = houseL + (houseR - houseL) * (0.2 + wi * 0.25)
    const wy = houseRoof + (groundY - houseRoof) * 0.35
    for (let y = Math.floor(wy); y < Math.floor(wy + winH); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW); x <= Math.ceil(wx + winW); x++) {
        if (x < 0 || x >= w) continue
        scene[y * w + x] = 0.35  // Window glow
      }
    }
  }

  // Live oak — left-center, spreading wide
  const treeCX = w * 0.30
  const treeSpread = w * 0.35
  const treeTop = h * 0.12
  const treeBot = groundY

  // Trunk
  for (let y = Math.floor(groundY); y > Math.floor(h * 0.45); y--) {
    const t = (groundY - y) / (groundY - h * 0.45)
    const tw = 12 * (1.4 - t * 0.6)
    const lean = t * 15
    for (let x = Math.floor(treeCX + lean - tw); x <= Math.ceil(treeCX + lean + tw); x++) {
      if (x >= 0 && x < w && y >= 0 && y < h) scene[y * w + x] = Math.max(scene[y * w + x], 0.90)
    }
  }

  // Canopy — overlapping blob clusters
  const blobCenters = [
    { x: treeCX - treeSpread * 0.35, y: h * 0.22, rx: treeSpread * 0.22, ry: h * 0.12 },
    { x: treeCX - treeSpread * 0.12, y: h * 0.15, rx: treeSpread * 0.25, ry: h * 0.14 },
    { x: treeCX + treeSpread * 0.10, y: h * 0.18, rx: treeSpread * 0.28, ry: h * 0.15 },
    { x: treeCX + treeSpread * 0.35, y: h * 0.25, rx: treeSpread * 0.20, ry: h * 0.11 },
    { x: treeCX, y: h * 0.25, rx: treeSpread * 0.18, ry: h * 0.10 },
    { x: treeCX - treeSpread * 0.20, y: h * 0.30, rx: treeSpread * 0.15, ry: h * 0.08 },
  ]

  for (const blob of blobCenters) {
    const bn = makeNoise(seed + Math.floor(blob.x * 7 + blob.y * 13), 22)
    const gn2 = makeNoise(seed + Math.floor(blob.x * 3 + blob.y * 17) + 500, 16)
    const minX = Math.max(0, Math.floor(blob.x - blob.rx * 1.3))
    const maxX = Math.min(w - 1, Math.ceil(blob.x + blob.rx * 1.3))
    const minY = Math.max(0, Math.floor(blob.y - blob.ry * 1.3))
    const maxY = Math.min(h - 1, Math.ceil(blob.y + blob.ry * 1.3))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - blob.x) / blob.rx
        const dy = (y - blob.y) / blob.ry
        let dist = dx * dx + dy * dy
        dist += bn(x, y) * 0.28
        if (dist < 1.0) {
          const edgeFade = dist > 0.70 ? (1 - dist) / 0.30 : 1.0
          // Sky gaps in canopy
          const gap = gn2(x, y) * 0.5 + 0.5
          const gapThresh = 0.55 + dist * 0.25
          const alpha = gap > gapThresh ? edgeFade * 0.06 : edgeFade * 0.88
          scene[y * w + x] = Math.max(scene[y * w + x], alpha)
        }
      }
    }
  }

  // Spanish moss — long heavy strands
  const mossNoise = makeNoise(seed + 800, 10)
  for (let i = 0; i < 80; i++) {
    const mossX = treeCX + (rand() - 0.5) * treeSpread * 0.8
    const mossStartY = h * 0.18 + rand() * h * 0.20
    const mossLen = 40 + rand() * 100
    const mossWidth = 2 + rand() * 3

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossX + i * 77, mossStartY + my) * 15 * t
      const mx = mossX + sway
      const myy = mossStartY + my
      if (myy >= h) continue
      const opacity = (1 - t * t) * 0.55
      const mw = mossWidth * (1 - t * 0.3)
      for (let ddx = -Math.ceil(mw); ddx <= Math.ceil(mw); ddx++) {
        const px = Math.round(mx + ddx)
        if (px < 0 || px >= w) continue
        const py = Math.round(myy)
        if (py >= 0 && py < h) {
          const d = Math.abs(ddx) / mw
          if (d < 1) scene[py * w + px] = Math.max(scene[py * w + px], (1 - d) * opacity)
        }
      }
    }
  }

  // Power lines
  for (const lineY of [h * 0.14, h * 0.17]) {
    for (let s = 0; s <= 400; s++) {
      const t = s / 400
      const lx = -50 + (w + 100) * t
      const ly = lineY + 25 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          scene[py * w + px] = Math.max(scene[py * w + px], 0.7)
        }
      }
    }
  }

  return scene
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 13001, b: 13002, c: 13003, d: 13004 }
  const seed = seeds[variant] ?? 13001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v13 variant ${variant} (seed: ${seed}) ===`)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // === Layer 1: Golden sky ===
  console.log("  Painting sky...")
  const skyFBM = makeFBM(seed + 100, 500, 4)
  const cloudFBM = makeFBM(seed + 200, 250, 3)

  const skyPixels = new Float32Array(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3
      const t = y / H
      const sn = skyFBM(x, y) * 0.5 + 0.5
      const cn = cloudFBM(x, y) * 0.5 + 0.5

      let r: number, g: number, b: number
      if (t < 0.10) {
        const st = t / 0.10
        r = 140 + st * 55; g = 60 + st * 44; b = 28 + st * 24
      } else if (t < 0.28) {
        const st = (t - 0.10) / 0.18
        r = 195 + st * 48; g = 104 + st * 58; b = 52 + st * 40
      } else if (t < 0.50) {
        const st = (t - 0.28) / 0.22
        r = 243 + st * 10; g = 162 + st * 48; b = 92 + st * 35
      } else if (t < 0.72) {
        const st = (t - 0.50) / 0.22
        r = 253 - st * 18; g = 210 - st * 32; b = 127 - st * 22
      } else {
        const st = (t - 0.72) / 0.28
        r = 235 - st * 80; g = 178 - st * 68; b = 105 - st * 42
      }

      if (cn > 0.44) {
        const ca = Math.min(0.25, (cn - 0.44) / 0.38)
        const glow = Math.max(0, 1 - Math.abs(t - 0.38) * 2.8)
        r += ca * (20 + glow * 16); g += ca * (15 + glow * 13); b += ca * (8 + glow * 7)
      }
      r += (sn - 0.5) * 8; g += (sn - 0.5) * 6; b += (sn - 0.5) * 4

      skyPixels[idx] = r; skyPixels[idx + 1] = g; skyPixels[idx + 2] = b
    }
  }

  // === Layer 2: Scene (soft, atmospheric) ===
  console.log("  Building scene...")
  const sceneSil = buildScene(W, H, seed, rand)
  console.log("  Blurring scene (atmospheric depth)...")
  const sceneBlurred = gaussianBlur(sceneSil, W, H, 18)

  // === Layer 3: Iron railing (sharp, foreground) ===
  console.log("  Drawing iron railing...")
  const ironSil = new Float32Array(W * H)

  // Railing in the lower portion of the image
  const railTop = H * 0.58
  const railBot = H * 0.88
  const railH = railBot - railTop
  const ironThick = 8

  // Rails
  drawBar(ironSil, W, H, -10, railTop, W + 10, railTop, ironThick * 2.8)
  drawBar(ironSil, W, H, -10, railBot, W + 10, railBot, ironThick * 2.8)

  // Panels
  const numPanels = 5
  const panelW = (W + 80) / numPanels
  const panelStartX = -40

  for (let i = 0; i <= numPanels; i++) {
    const px = panelStartX + i * panelW
    drawBar(ironSil, W, H, px, railTop - 10, px, railBot + 10, ironThick * 1.8)
  }

  console.log("  Drawing scrollwork...")
  for (let i = 0; i < numPanels; i++) {
    const pLeft = panelStartX + i * panelW + ironThick * 3
    const pW = panelW - ironThick * 6
    const pRand = makePRNG(seed + 2000 + i * 131)

    drawPanel(ironSil, W, H,
      pLeft, railTop + ironThick * 4,
      pW, railH - ironThick * 8,
      () => pRand())
  }

  // Finials
  for (let i = 0; i <= numPanels; i++) {
    const fx = panelStartX + i * panelW
    drawBar(ironSil, W, H, fx, railTop - 40, fx, railTop, ironThick * 0.9)
    // Spearhead
    for (let dy = -16; dy <= 0; dy++) {
      const progress = -dy / 16
      const halfW2 = (1 - progress) * 9 + progress * 2
      for (let dx = -Math.ceil(halfW2); dx <= Math.ceil(halfW2); dx++) {
        const px = Math.round(fx + dx), py = Math.round(railTop - 40 + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          ironSil[py * W + px] = Math.max(ironSil[py * W + px], 1.0)
        }
      }
    }
    drawCircle(ironSil, W, H, fx, railTop - 42, ironThick * 0.6)
  }

  // Below the railing — solid dark (the balcony floor / underside)
  for (let y = Math.floor(railBot + ironThick * 3); y < H; y++) {
    for (let x = 0; x < W; x++) {
      ironSil[y * W + x] = Math.max(ironSil[y * W + x], 1.0)
    }
  }

  // === Composite all layers ===
  console.log("  Compositing...")
  const imageData = ctx.createImageData(W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 900, 2.5)
  const texNoise = makeFBM(seed + 950, 30, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx4 = (y * W + x) * 4
      const idx3 = (y * W + x) * 3

      let r = skyPixels[idx3], g = skyPixels[idx3 + 1], b = skyPixels[idx3 + 2]

      // Scene layer (soft silhouette over sky)
      const scVal = sceneBlurred[y * W + x]
      if (scVal > 0.01) {
        const depth = y / H
        const tex = texNoise(x, y) * 0.5 + 0.5

        if (scVal > 0.30 && scVal < 0.40) {
          // Window glow
          const glowStr = 0.22
          r = r * (1 - glowStr) + 225 * glowStr
          g = g * (1 - glowStr) + 175 * glowStr
          b = b * (1 - glowStr) + 80 * glowStr
        } else if (scVal < 0.35) {
          // Hazy background buildings
          const a = scVal * 0.85
          const bgR = 120 + depth * 30 + tex * 15
          const bgG = 85 + depth * 22 + tex * 10
          const bgB = 72 + depth * 18 + tex * 8
          r = r * (1 - a) + bgR * a
          g = g * (1 - a) + bgG * a
          b = b * (1 - a) + bgB * a
        } else {
          // Foreground scene (building, tree, ground)
          const a = Math.min(1, scVal * 1.1)
          const fgR = 38 + depth * 18 + tex * 12
          const fgG = 28 + depth * 12 + tex * 8
          const fgB = 32 + depth * 14 + tex * 7
          r = r * (1 - a) + fgR * a
          g = g * (1 - a) + fgG * a
          b = b * (1 - a) + fgB * a
        }
      }

      // Iron layer (sharp, dark, foreground)
      const iron = ironSil[y * W + x]
      if (iron > 0.01) {
        const a = Math.min(1, iron)
        // Iron with slight texture variation
        const itex = texNoise(x * 3, y * 3) * 0.5 + 0.5
        const ironR = 28 + itex * 10
        const ironG = 20 + itex * 8
        const ironB = 24 + itex * 6
        r = r * (1 - a) + ironR * a
        g = g * (1 - a) + ironG * a
        b = b * (1 - a) + ironB * a
      }

      // Film grain
      const grain = grainNoise(x, y) * 7
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette (centered slightly above middle — on the scene, not the iron)
      const cx2 = x / W - 0.5
      const cy2 = y / H - 0.38
      const vig = 1.0 - (cx2 * cx2 * 0.7 + cy2 * cy2 * 1.1) * 0.40
      r *= vig; g *= vig; b *= vig

      pixels[idx4] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      pixels[idx4 + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v13-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
