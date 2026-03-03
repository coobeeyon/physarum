/**
 * NOSTALGIA v15 — THROUGH THE IRON (scene character)
 *
 * Fixes from v14:
 * - Live oak: WIDE spreading horizontal branches, not lollipop blob
 * - Shotgun house: porch columns, steps, screen door, visible porch
 * - Street lamp with warm glow
 * - Warmer scene tones (amber/brown, not grey)
 * - Panel variation (different scrollwork per panel)
 * - Glowing windows visible
 * - Spanish moss heavier, more visible
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

// Panel styles — each has different scrollwork
type PanelStyle = "lyreA" | "lyreB" | "cScroll" | "heartScroll" | "twoHeart"

function drawPanelVaried(
  sil: Float32Array, w: number, h: number,
  left: number, top: number, width: number, height: number,
  style: PanelStyle,
  rand: () => number
) {
  const cx = left + width / 2
  const cy = top + height / 2
  const iron = 8

  // Central stem (all styles)
  drawBar(sil, w, h, cx, top + height * 0.03, cx, top + height * 0.97, iron * 0.85)

  if (style === "lyreA" || style === "lyreB") {
    // Lyre shape — two large opposing C-curves meeting at top and bottom
    const spread = style === "lyreA" ? 0.42 : 0.36
    const bulge = style === "lyreA" ? 0.48 : 0.44
    for (const mir of [-1, 1]) {
      const pts = sampleBezier4(
        cx, top + height * 0.08,
        cx + mir * width * spread, top + height * 0.15,
        cx + mir * width * bulge, top + height * 0.55,
        cx, top + height * 0.92,
        120
      )
      drawThickCurve(sil, w, h, pts, iron * 1.1, iron * 0.6)

      // Inner echo curve
      const inner = sampleBezier4(
        cx, top + height * 0.18,
        cx + mir * width * (spread - 0.12), top + height * 0.22,
        cx + mir * width * (bulge - 0.14), top + height * 0.50,
        cx, top + height * 0.82,
        80
      )
      drawThickCurve(sil, w, h, inner, iron * 0.55, iron * 0.35)

      // Volutes at widest point
      const vx = cx + mir * width * bulge * 0.65
      drawVolute(sil, w, h, vx, cy - height * 0.05, 14 + rand() * 6, mir, iron * 0.45, 1.1)
      drawVolute(sil, w, h, vx, cy + height * 0.12, 12 + rand() * 5, -mir, iron * 0.4, 1.0)
    }
    drawCircle(sil, w, h, cx, top + height * 0.08, iron * 1.2)
    drawCircle(sil, w, h, cx, top + height * 0.92, iron * 1.2)

  } else if (style === "cScroll") {
    // Dense C-scroll with central rosette (original v14 style)
    for (const mir of [-1, 1]) {
      const pts1 = sampleBezier4(
        cx, top + height * 0.12,
        cx + mir * width * 0.38, top + height * 0.05,
        cx + mir * width * 0.42, top + height * 0.30,
        cx + mir * width * 0.12, top + height * 0.42, 120
      )
      drawThickCurve(sil, w, h, pts1, iron * 1.2, iron * 0.65)
      drawVolute(sil, w, h,
        cx + mir * width * 0.12, top + height * 0.42 + 8,
        18 + rand() * 6, mir, iron * 0.55, 1.2 + rand() * 0.3)

      const pts2 = sampleBezier4(
        cx, top + height * 0.88,
        cx + mir * width * 0.38, top + height * 0.95,
        cx + mir * width * 0.42, top + height * 0.70,
        cx + mir * width * 0.12, top + height * 0.58, 120
      )
      drawThickCurve(sil, w, h, pts2, iron * 1.2, iron * 0.65)
      drawVolute(sil, w, h,
        cx + mir * width * 0.12, top + height * 0.58 - 8,
        18 + rand() * 6, -mir, iron * 0.55, 1.2 + rand() * 0.3)

      // Connecting S
      const midS = sampleBezier4(
        cx + mir * width * 0.38, top + height * 0.22,
        cx + mir * width * 0.44, top + height * 0.38,
        cx + mir * width * 0.44, top + height * 0.62,
        cx + mir * width * 0.38, top + height * 0.78, 80
      )
      drawThickCurve(sil, w, h, midS, iron * 0.7, iron * 0.7)
    }
    drawCircle(sil, w, h, cx, cy, iron * 1.8)

  } else if (style === "heartScroll") {
    // Heart-like symmetrical form with inner tendrils
    for (const mir of [-1, 1]) {
      // Outer heart curve
      const pts = sampleBezier4(
        cx, top + height * 0.12,
        cx + mir * width * 0.50, top - height * 0.05,
        cx + mir * width * 0.46, top + height * 0.65,
        cx, top + height * 0.88,
        120
      )
      drawThickCurve(sil, w, h, pts, iron * 1.1, iron * 0.6)

      // Inner tendril from midpoint curling inward
      const t1 = sampleBezier3(
        cx + mir * width * 0.32, top + height * 0.30,
        cx + mir * width * 0.15, top + height * 0.40,
        cx + mir * width * 0.10, top + height * 0.55, 60
      )
      drawThickCurve(sil, w, h, t1, iron * 0.5, iron * 0.3)
      drawVolute(sil, w, h, cx + mir * width * 0.10, top + height * 0.55,
        10 + rand() * 4, mir, iron * 0.35, 0.9)

      // Lower inner tendril
      const t2 = sampleBezier3(
        cx + mir * width * 0.30, top + height * 0.65,
        cx + mir * width * 0.15, top + height * 0.60,
        cx + mir * width * 0.08, top + height * 0.72, 50
      )
      drawThickCurve(sil, w, h, t2, iron * 0.45, iron * 0.25)
    }
    drawCircle(sil, w, h, cx, top + height * 0.12, iron * 1.0)
    drawCircle(sil, w, h, cx, top + height * 0.88, iron * 1.0)

  } else { // twoHeart
    // Two stacked smaller heart shapes
    for (const yOff of [0.0, 0.48]) {
      const subTop = top + height * (yOff + 0.04)
      const subH = height * 0.44
      for (const mir of [-1, 1]) {
        const pts = sampleBezier4(
          cx, subTop + subH * 0.10,
          cx + mir * width * 0.44, subTop - subH * 0.08,
          cx + mir * width * 0.40, subTop + subH * 0.70,
          cx, subTop + subH * 0.90,
          80
        )
        drawThickCurve(sil, w, h, pts, iron * 0.9, iron * 0.5)
        drawVolute(sil, w, h,
          cx + mir * width * 0.25, subTop + subH * 0.45,
          10, mir, iron * 0.35, 0.8)
      }
      drawCircle(sil, w, h, cx, subTop + subH * 0.10, iron * 0.8)
      drawCircle(sil, w, h, cx, subTop + subH * 0.90, iron * 0.8)
    }
  }

  // Top and bottom accent dots
  drawCircle(sil, w, h, cx, top + height * 0.01, iron * 0.7)
  drawCircle(sil, w, h, cx, top + height * 0.99, iron * 0.7)
}

/**
 * Build scene — spreading live oak, shotgun house with porch, street lamp
 */
function buildScene(w: number, h: number, seed: number, rand: () => number): { scene: Float32Array, glow: Float32Array } {
  const scene = new Float32Array(w * h)
  const glow = new Float32Array(w * h) // separate layer for warm light sources
  const edgeNoise = makeNoise(seed + 500, 40)
  const canopyNoise = makeNoise(seed + 600, 25)
  const gapNoise = makeNoise(seed + 700, 18)

  const groundY = h * 0.80

  // Ground with slight texture
  for (let x = 0; x < w; x++) {
    const gv = edgeNoise(x, groundY) * 6
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) scene[y * w + x] = 1.0
    }
  }

  // Sidewalk (lighter strip along the ground)
  const swY = groundY - h * 0.02
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(swY); y < Math.floor(groundY); y++) {
      if (y >= 0 && y < h) scene[y * w + x] = Math.max(scene[y * w + x], 0.40)
    }
  }

  // Distant roofline (hazy)
  const bgNoise = makeNoise(seed + 300, 150)
  for (let x = 0; x < w; x++) {
    const baseRoof = h * 0.42 + bgNoise(x, 0) * h * 0.06
    const step = Math.floor(x / (w * 0.08))
    const stepOff = ((step * 7 + 3) % 11 - 5) * h * 0.008
    const roofY = baseRoof + stepOff
    for (let y = Math.max(0, Math.floor(roofY)); y < Math.floor(groundY - h * 0.03); y++) {
      scene[y * w + x] = Math.max(scene[y * w + x], 0.22)
    }
  }

  // ===== SHOTGUN HOUSE — right side =====
  const houseL = w * 0.52
  const houseR = w * 0.88
  const houseWall = h * 0.38  // wall top
  const porchRoof = h * 0.34  // porch roof extends above wall

  // Main wall
  for (let y = Math.floor(houseWall); y < Math.floor(groundY); y++) {
    for (let x = Math.floor(houseL); x <= Math.ceil(houseR); x++) {
      if (x >= 0 && x < w) scene[y * w + x] = Math.max(scene[y * w + x], 0.70)
    }
  }

  // Porch roof (extends forward, slightly lower and wider)
  const porchOverhang = w * 0.03
  for (let y = Math.floor(porchRoof); y < Math.floor(houseWall + h * 0.02); y++) {
    for (let x = Math.floor(houseL - porchOverhang); x <= Math.ceil(houseR + porchOverhang * 0.5); x++) {
      if (x >= 0 && x < w) scene[y * w + x] = Math.max(scene[y * w + x], 0.80)
    }
  }

  // Roof peak (gable)
  const peakX = (houseL + houseR) / 2
  const peakY = porchRoof - (houseR - houseL) * 0.10
  for (let y = Math.floor(peakY); y < Math.floor(porchRoof); y++) {
    const t = (y - peakY) / (porchRoof - peakY)
    const halfW2 = ((houseR - houseL) / 2 + 20) * t
    for (let x = Math.floor(peakX - halfW2); x <= Math.ceil(peakX + halfW2); x++) {
      if (x >= 0 && x < w) scene[y * w + x] = Math.max(scene[y * w + x], 0.78)
    }
  }

  // Porch columns (3 thin vertical pillars)
  for (let ci = 0; ci < 3; ci++) {
    const colX = houseL + (houseR - houseL) * (0.12 + ci * 0.35)
    const colW = 8
    for (let y = Math.floor(porchRoof); y < Math.floor(groundY); y++) {
      for (let dx = -colW; dx <= colW; dx++) {
        const px = Math.round(colX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          scene[y * w + px] = Math.max(scene[y * w + px], 0.85)
        }
      }
    }
  }

  // Front door
  const doorX = houseL + (houseR - houseL) * 0.35
  const doorW = (houseR - houseL) * 0.07
  const doorTop = groundY - (groundY - houseWall) * 0.70
  for (let y = Math.floor(doorTop); y < Math.floor(groundY - 5); y++) {
    for (let x = Math.floor(doorX - doorW); x <= Math.ceil(doorX + doorW); x++) {
      if (x >= 0 && x < w) scene[y * w + x] = Math.max(scene[y * w + x], 0.90)
    }
  }

  // Steps (lighter horizontal lines at base)
  for (let si = 0; si < 3; si++) {
    const stepY = groundY - 8 - si * 10
    const stepL = houseL + (houseR - houseL) * 0.15
    const stepR = houseL + (houseR - houseL) * 0.55
    for (let y = Math.floor(stepY - 4); y < Math.floor(stepY); y++) {
      for (let x = Math.floor(stepL); x <= Math.ceil(stepR); x++) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          scene[y * w + x] = Math.max(scene[y * w + x], 0.50 + si * 0.05)
        }
      }
    }
  }

  // Windows (3 windows with warm glow)
  const winW2 = (houseR - houseL) * 0.055
  const winH2 = (groundY - houseWall) * 0.28
  for (let wi = 0; wi < 3; wi++) {
    const wx = houseL + (houseR - houseL) * (0.15 + wi * 0.28)
    const wy = houseWall + (groundY - houseWall) * 0.22
    for (let y = Math.floor(wy); y < Math.floor(wy + winH2); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x < 0 || x >= w) continue
        // Mark as window (special value for glow)
        scene[y * w + x] = 0.35
        glow[y * w + x] = 0.85
      }
    }
  }

  // Porch light (warm glow near door)
  const plX = doorX + doorW * 2
  const plY = porchRoof + (houseWall - porchRoof) * 0.3
  const plR = 35
  for (let dy = -plR; dy <= plR; dy++) {
    for (let dx = -plR; dx <= plR; dx++) {
      const px = Math.round(plX + dx), py = Math.round(plY + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx * dx + dy * dy) / plR
        if (d < 1) {
          glow[py * w + px] = Math.max(glow[py * w + px], (1 - d * d) * 0.6)
        }
      }
    }
  }

  // ===== LIVE OAK — left-center, WIDE spreading branches =====
  const treeCX = w * 0.28
  const treeBaseY = groundY

  // Trunk — short and thick, slightly leaning
  const trunkTopY = h * 0.42
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY - y) / (treeBaseY - trunkTopY)
    const tw = 22 * (1.8 - t * 0.5) // thick trunk
    const lean = t * 15
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX + lean + dx)
      if (px >= 0 && px < w && y >= 0 && y < h) {
        const d = Math.abs(dx) / tw
        if (d < 1) scene[y * w + px] = Math.max(scene[y * w + px], 0.92 * (1 - d * 0.15))
      }
    }
  }

  // Major branches — HORIZONTAL spread (live oak characteristic)
  // Live oaks grow OUT, not UP. Branches nearly horizontal, sometimes touching ground.
  const branches = [
    // x-direction, angle (radians from horizontal), length, thickness
    { dir: -1, angle: -0.15, len: w * 0.30, thick: 16 },   // main left (nearly horizontal)
    { dir: -1, angle: -0.45, len: w * 0.22, thick: 12 },   // upper left
    { dir: -1, angle: 0.08,  len: w * 0.25, thick: 10 },   // lower left (drooping)
    { dir: 1,  angle: -0.20, len: w * 0.18, thick: 14 },   // main right
    { dir: 1,  angle: -0.50, len: w * 0.15, thick: 10 },   // upper right
    { dir: -1, angle: -0.80, len: w * 0.16, thick: 9 },    // up-left
  ]

  const branchEnds: Array<{ x: number, y: number, r: number }> = []

  for (const branch of branches) {
    const bStartX = treeCX + 15 * branch.dir
    const bStartY = trunkTopY + h * 0.02
    const bEndX = bStartX + Math.cos(branch.angle) * branch.len * branch.dir
    const bEndY = bStartY + Math.sin(branch.angle) * branch.len

    // Draw branch as thick tapered bar with slight curve
    const midX = (bStartX + bEndX) / 2 + (rand() - 0.5) * 30
    const midY = (bStartY + bEndY) / 2 + (rand() - 0.5) * 20 - 10
    const pts = sampleBezier3(bStartX, bStartY, midX, midY, bEndX, bEndY, 80)
    drawThickCurve(scene, w, h, pts, branch.thick, branch.thick * 0.4)

    branchEnds.push({ x: bEndX, y: bEndY, r: branch.len * 0.35 })

    // Sub-branches at the end
    for (let sb = 0; sb < 3; sb++) {
      const subAngle = branch.angle + (rand() - 0.5) * 1.2
      const subLen = branch.len * (0.2 + rand() * 0.15)
      const subEndX = bEndX + Math.cos(subAngle) * subLen * branch.dir
      const subEndY = bEndY + Math.sin(subAngle) * subLen
      const subPts = sampleBezier3(
        bEndX, bEndY,
        (bEndX + subEndX) / 2 + (rand() - 0.5) * 15,
        (bEndY + subEndY) / 2 + (rand() - 0.5) * 10,
        subEndX, subEndY, 40
      )
      drawThickCurve(scene, w, h, subPts, branch.thick * 0.35, branch.thick * 0.15)
      branchEnds.push({ x: subEndX, y: subEndY, r: subLen * 0.6 })
    }
  }

  // Canopy — clusters of foliage at branch ends and along branches
  // Live oak canopy is WIDE and DENSE, like an umbrella
  const canopyBlobs = [
    // Major canopy masses
    { x: treeCX - w * 0.28, y: h * 0.28, rx: w * 0.12, ry: h * 0.08 },
    { x: treeCX - w * 0.18, y: h * 0.18, rx: w * 0.14, ry: h * 0.10 },
    { x: treeCX - w * 0.05, y: h * 0.14, rx: w * 0.13, ry: h * 0.09 },
    { x: treeCX + w * 0.08, y: h * 0.16, rx: w * 0.12, ry: h * 0.09 },
    { x: treeCX + w * 0.16, y: h * 0.22, rx: w * 0.10, ry: h * 0.07 },
    // Fill gaps
    { x: treeCX - w * 0.10, y: h * 0.24, rx: w * 0.11, ry: h * 0.07 },
    { x: treeCX + w * 0.02, y: h * 0.22, rx: w * 0.10, ry: h * 0.07 },
    // Lower drooping edges
    { x: treeCX - w * 0.25, y: h * 0.34, rx: w * 0.08, ry: h * 0.06 },
    { x: treeCX + w * 0.14, y: h * 0.30, rx: w * 0.07, ry: h * 0.05 },
    // Near trunk
    { x: treeCX, y: h * 0.30, rx: w * 0.08, ry: h * 0.06 },
    { x: treeCX - w * 0.06, y: h * 0.36, rx: w * 0.06, ry: h * 0.05 },
  ]

  // Add blobs at branch ends
  for (const be of branchEnds) {
    canopyBlobs.push({ x: be.x, y: be.y - be.r * 0.3, rx: be.r, ry: be.r * 0.6 })
  }

  for (const blob of canopyBlobs) {
    const bn = makeNoise(seed + Math.floor(blob.x * 7 + blob.y * 13), 20)
    const gn2 = makeNoise(seed + Math.floor(blob.x * 3 + blob.y * 17) + 500, 14)
    const minX = Math.max(0, Math.floor(blob.x - blob.rx * 1.3))
    const maxX = Math.min(w - 1, Math.ceil(blob.x + blob.rx * 1.3))
    const minY = Math.max(0, Math.floor(blob.y - blob.ry * 1.3))
    const maxY = Math.min(h - 1, Math.ceil(blob.y + blob.ry * 1.3))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = (x - blob.x) / blob.rx
        const dy = (y - blob.y) / blob.ry
        let dist = dx * dx + dy * dy
        dist += bn(x, y) * 0.30
        if (dist < 1.0) {
          const edgeFade = dist > 0.65 ? (1 - dist) / 0.35 : 1.0
          const gap = gn2(x, y) * 0.5 + 0.5
          const gapThresh = 0.58 + dist * 0.20
          const alpha = gap > gapThresh ? edgeFade * 0.05 : edgeFade * 0.88
          scene[y * w + x] = Math.max(scene[y * w + x], alpha)
        }
      }
    }
  }

  // Spanish moss — heavy, long strands hanging from branches
  const mossNoise = makeNoise(seed + 800, 8)
  for (let i = 0; i < 120; i++) {
    // Moss hangs from branch positions
    const mossX = treeCX + (rand() - 0.5) * w * 0.55
    const mossStartY = h * 0.16 + rand() * h * 0.22
    const mossLen = 50 + rand() * 130
    const mossWidth = 2.5 + rand() * 4

    for (let my = 0; my < mossLen; my++) {
      const t = my / mossLen
      const sway = mossNoise(mossX + i * 77, mossStartY + my) * 18 * t
      const mx = mossX + sway
      const myy = mossStartY + my
      if (myy >= h) continue
      const opacity = (1 - t * t) * 0.60
      const mw = mossWidth * (1 - t * 0.4)
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

  // ===== STREET LAMP — left of house =====
  const lampX = w * 0.48
  const lampTopY = h * 0.28
  // Post
  drawBar(scene, w, h, lampX, lampTopY, lampX, groundY, 6)
  // Lamp fixture (cross arm + lantern shape)
  drawBar(scene, w, h, lampX - 18, lampTopY, lampX + 18, lampTopY, 5)
  drawBar(scene, w, h, lampX - 14, lampTopY, lampX - 14, lampTopY + 22, 4)
  drawBar(scene, w, h, lampX + 14, lampTopY, lampX + 14, lampTopY + 22, 4)
  drawBar(scene, w, h, lampX - 14, lampTopY + 22, lampX + 14, lampTopY + 22, 4)

  // Lamp glow
  const lampGlowR = 80
  for (let dy = -lampGlowR; dy <= lampGlowR; dy++) {
    for (let dx = -lampGlowR; dx <= lampGlowR; dx++) {
      const px = Math.round(lampX + dx), py = Math.round(lampTopY + 11 + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx * dx + dy * dy) / lampGlowR
        if (d < 1) {
          glow[py * w + px] = Math.max(glow[py * w + px], (1 - d * d) * 0.70)
        }
      }
    }
  }

  // Power lines
  for (const lineY of [h * 0.15, h * 0.18]) {
    for (let s = 0; s <= 400; s++) {
      const t = s / 400
      const lx = -50 + (w + 100) * t
      const ly = lineY + 20 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          scene[py * w + px] = Math.max(scene[py * w + px], 0.60)
        }
      }
    }
  }

  return { scene, glow }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 15001, b: 15002, c: 15003, d: 15004 }
  const seed = seeds[variant] ?? 15001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v15 variant ${variant} (seed: ${seed}) ===`)

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
      // Richer golden gradient
      if (t < 0.08) {
        const st = t / 0.08
        r = 150 + st * 50; g = 70 + st * 45; b = 35 + st * 20
      } else if (t < 0.25) {
        const st = (t - 0.08) / 0.17
        r = 200 + st * 45; g = 115 + st * 55; b = 55 + st * 38
      } else if (t < 0.48) {
        const st = (t - 0.25) / 0.23
        r = 245 + st * 8; g = 170 + st * 45; b = 93 + st * 30
      } else if (t < 0.70) {
        const st = (t - 0.48) / 0.22
        r = 253 - st * 12; g = 215 - st * 25; b = 123 - st * 15
      } else {
        const st = (t - 0.70) / 0.30
        r = 241 - st * 70; g = 190 - st * 60; b = 108 - st * 35
      }

      // Cloud wisps
      if (cn > 0.42) {
        const ca = Math.min(0.28, (cn - 0.42) / 0.35)
        const glow = Math.max(0, 1 - Math.abs(t - 0.35) * 2.5)
        r += ca * (22 + glow * 18); g += ca * (16 + glow * 14); b += ca * (9 + glow * 8)
      }
      r += (sn - 0.5) * 7; g += (sn - 0.5) * 5; b += (sn - 0.5) * 3

      skyPixels[idx] = r; skyPixels[idx + 1] = g; skyPixels[idx + 2] = b
    }
  }

  // === Layer 2: Scene (soft, atmospheric) ===
  console.log("  Building scene...")
  const { scene: sceneSil, glow: glowMap } = buildScene(W, H, seed, rand)
  console.log("  Blurring scene...")
  const sceneBlurred = gaussianBlur(sceneSil, W, H, 8)
  const glowBlurred = gaussianBlur(glowMap, W, H, 14)

  // === Layer 3: Iron railing (sharp, foreground) ===
  console.log("  Drawing iron railing...")
  const ironSil = new Float32Array(W * H)

  const railTop = H * 0.48
  const railBot = H * 0.84
  const railH2 = railBot - railTop
  const ironThick = 9

  // Rails (top and bottom bars)
  drawBar(ironSil, W, H, -10, railTop, W + 10, railTop, ironThick * 2.5)
  drawBar(ironSil, W, H, -10, railBot, W + 10, railBot, ironThick * 2.5)

  // Panels with varied styles
  const numPanels = 5
  const panelW = (W + 80) / numPanels
  const panelStartX = -40
  const panelStyles: PanelStyle[] = ["lyreA", "cScroll", "heartScroll", "lyreB", "twoHeart"]

  for (let i = 0; i <= numPanels; i++) {
    const px = panelStartX + i * panelW
    drawBar(ironSil, W, H, px, railTop - 10, px, railBot + 10, ironThick * 1.6)
  }

  console.log("  Drawing scrollwork (varied panels)...")
  for (let i = 0; i < numPanels; i++) {
    const pLeft = panelStartX + i * panelW + ironThick * 3
    const pW = panelW - ironThick * 6
    const pRand = makePRNG(seed + 2000 + i * 131)
    drawPanelVaried(ironSil, W, H,
      pLeft, railTop + ironThick * 3.5,
      pW, railH2 - ironThick * 7,
      panelStyles[i % panelStyles.length],
      () => pRand())
  }

  // Finials
  for (let i = 0; i <= numPanels; i++) {
    const fx = panelStartX + i * panelW
    drawBar(ironSil, W, H, fx, railTop - 35, fx, railTop, ironThick * 0.8)
    for (let dy = -14; dy <= 0; dy++) {
      const progress = -dy / 14
      const halfW2 = (1 - progress) * 8 + progress * 2
      for (let dx = -Math.ceil(halfW2); dx <= Math.ceil(halfW2); dx++) {
        const px = Math.round(fx + dx), py = Math.round(railTop - 35 + dy)
        if (px >= 0 && px < W && py >= 0 && py < H) {
          ironSil[py * W + px] = Math.max(ironSil[py * W + px], 1.0)
        }
      }
    }
    drawCircle(ironSil, W, H, fx, railTop - 37, ironThick * 0.5)
  }

  // Below the railing — balcony floor
  for (let y = Math.floor(railBot + ironThick * 2.5); y < H; y++) {
    for (let x = 0; x < W; x++) {
      ironSil[y * W + x] = Math.max(ironSil[y * W + x], 1.0)
    }
  }

  // === Composite ===
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

      // Scene layer
      const scVal = sceneBlurred[y * W + x]
      const glVal = glowBlurred[y * W + x]
      if (scVal > 0.01 || glVal > 0.01) {
        const depth = y / H
        const tex = texNoise(x, y) * 0.5 + 0.5

        if (scVal > 0.01) {
          if (scVal < 0.28) {
            // Distant haze — warm-tinted
            const a = scVal * 0.80
            const bgR = 135 + depth * 25 + tex * 12
            const bgG = 100 + depth * 20 + tex * 8
            const bgB = 78 + depth * 15 + tex * 6
            r = r * (1 - a) + bgR * a
            g = g * (1 - a) + bgG * a
            b = b * (1 - a) + bgB * a
          } else if (scVal < 0.45) {
            // Mid-distance elements (sidewalk, lighter features)
            const a = scVal * 0.70
            const mdR = 100 + depth * 35 + tex * 15
            const mdG = 72 + depth * 28 + tex * 10
            const mdB = 60 + depth * 20 + tex * 8
            r = r * (1 - a) + mdR * a
            g = g * (1 - a) + mdG * a
            b = b * (1 - a) + mdB * a
          } else {
            // Foreground (building, tree, ground) — warm dark brown, not grey
            const a = Math.min(1, scVal * 1.1)
            const fgR = 52 + depth * 20 + tex * 14
            const fgG = 38 + depth * 14 + tex * 10
            const fgB = 35 + depth * 12 + tex * 7
            r = r * (1 - a) + fgR * a
            g = g * (1 - a) + fgG * a
            b = b * (1 - a) + fgB * a
          }
        }

        // Warm glow from windows and lamps
        if (glVal > 0.01) {
          const glowR = 255, glowG = 195, glowB = 90
          r = r + (glowR - r) * glVal * 0.55
          g = g + (glowG - g) * glVal * 0.55
          b = b + (glowB - b) * glVal * 0.55
        }
      }

      // Iron layer
      const iron = ironSil[y * W + x]
      if (iron > 0.01) {
        const a = Math.min(1, iron)
        const itex = texNoise(x * 3, y * 3) * 0.5 + 0.5
        const ironR = 25 + itex * 12
        const ironG = 18 + itex * 8
        const ironB = 22 + itex * 6
        r = r * (1 - a) + ironR * a
        g = g * (1 - a) + ironG * a
        b = b * (1 - a) + ironB * a
      }

      // Film grain
      const grain = grainNoise(x, y) * 6
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx2 = x / W - 0.5
      const cy2 = y / H - 0.38
      const vig = 1.0 - (cx2 * cx2 * 0.6 + cy2 * cy2 * 1.0) * 0.38
      r *= vig; g *= vig; b *= vig

      pixels[idx4] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      pixels[idx4 + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const filename = `output/nostalgia-v15-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
