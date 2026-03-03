/**
 * NOSTALGIA v16 — WARM SCENE
 *
 * Key change from v15: Scene is NOT a flat silhouette.
 * Building walls catch golden light (warm amber). Tree canopy
 * and edges are dark. Windows and lamp glow visibly.
 * Two-layer scene: bright surfaces + dark edges/canopy.
 *
 * The scene should feel like a remembered WARM evening,
 * not a dark twilight.
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
    gradX[i] = Math.cos(a); gradY[i] = Math.sin(a)
  }
  const perm = new Uint16Array(SIZE)
  for (let i = 0; i < SIZE; i++) perm[i] = i
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]]
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
    return n00 + (fade(x - x0)) * (n10 - n00) + (fade(y - y0)) * ((n01 + sx * (n11 - n01)) - (n00 + sx * (n10 - n00)))
  }
}

function makeFBM(seed: number, baseScale: number, octaves: number) {
  const noises = Array.from({ length: octaves }, (_, i) => makeNoise(seed + i * 100, baseScale / (1 << i)))
  return (x: number, y: number): number => {
    let val = 0, amp = 1, totalAmp = 0
    for (let i = 0; i < octaves; i++) {
      val += noises[i](x, y) * amp; totalAmp += amp; amp *= 0.5
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

// Drawing utilities
function drawThickCurve(buf: Float32Array, w: number, h: number,
  pts: Array<{x:number,y:number}>, t0: number, t1: number, val = 1.0) {
  for (let i = 0; i < pts.length; i++) {
    const t = pts.length > 1 ? i / (pts.length - 1) : 0
    const thick = (t0 + (t1 - t0) * t) / 2
    const p = pts[i]
    const m = thick + 2
    for (let y = Math.max(0, Math.floor(p.y - m)); y <= Math.min(h-1, Math.ceil(p.y + m)); y++) {
      for (let x = Math.max(0, Math.floor(p.x - m)); x <= Math.min(w-1, Math.ceil(p.x + m)); x++) {
        const d = Math.sqrt((x-p.x)**2 + (y-p.y)**2)
        if (d < thick) buf[y*w+x] = Math.max(buf[y*w+x], val)
        else if (d < thick + 1.5) buf[y*w+x] = Math.max(buf[y*w+x], val * (1 - (d-thick)/1.5))
      }
    }
  }
}

function drawCircle(buf: Float32Array, w: number, h: number, cx: number, cy: number, r: number, val = 1.0) {
  for (let y = Math.max(0,Math.floor(cy-r-2)); y <= Math.min(h-1,Math.ceil(cy+r+2)); y++) {
    for (let x = Math.max(0,Math.floor(cx-r-2)); x <= Math.min(w-1,Math.ceil(cx+r+2)); x++) {
      const d = Math.sqrt((x-cx)**2+(y-cy)**2)
      if (d < r) buf[y*w+x] = Math.max(buf[y*w+x], val)
      else if (d < r+1.5) buf[y*w+x] = Math.max(buf[y*w+x], val*(1-(d-r)/1.5))
    }
  }
}

function drawBar(buf: Float32Array, w: number, h: number,
  x1: number, y1: number, x2: number, y2: number, thick: number, val = 1.0) {
  const dx = x2-x1, dy = y2-y1, len = Math.sqrt(dx*dx+dy*dy)
  if (len < 0.001) return
  const steps = Math.ceil(len)
  const halfT = thick / 2
  for (let i = 0; i <= steps; i++) {
    const t = i/steps
    const px = x1+dx*t, py = y1+dy*t
    const m = halfT + 2
    for (let y = Math.max(0,Math.floor(py-m)); y <= Math.min(h-1,Math.ceil(py+m)); y++) {
      for (let x = Math.max(0,Math.floor(px-m)); x <= Math.min(w-1,Math.ceil(px+m)); x++) {
        const d = Math.sqrt((x-px)**2+(y-py)**2)
        if (d < halfT) buf[y*w+x] = Math.max(buf[y*w+x], val)
        else if (d < halfT+1.5) buf[y*w+x] = Math.max(buf[y*w+x], val*(1-(d-halfT)/1.5))
      }
    }
  }
}

function sampleBezier4(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,p3x:number,p3y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, u = 1-t
    pts.push({ x: u*u*u*p0x+3*u*u*t*p1x+3*u*t*t*p2x+t*t*t*p3x, y: u*u*u*p0y+3*u*u*t*p1y+3*u*t*t*p2y+t*t*t*p3y })
  }
  return pts
}

function sampleBezier3(p0x:number,p0y:number,p1x:number,p1y:number,p2x:number,p2y:number,steps:number) {
  const pts:{x:number,y:number}[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, u = 1-t
    pts.push({ x: u*u*p0x+2*u*t*p1x+t*t*p2x, y: u*u*p0y+2*u*t*p1y+t*t*p2y })
  }
  return pts
}

function drawVolute(buf: Float32Array, w: number, h: number,
  cx: number, cy: number, startR: number, dir: number, thick: number, turns: number) {
  const pts:{x:number,y:number}[] = []
  const steps = Math.ceil(turns * 80)
  for (let i = 0; i <= steps; i++) {
    const t = i/steps, angle = t * turns * Math.PI * 2
    const r = startR * (1 - t * 0.82)
    pts.push({ x: cx + Math.cos(angle*dir)*r, y: cy + Math.sin(angle*dir)*r })
  }
  drawThickCurve(buf, w, h, pts, thick, thick*0.4)
  drawCircle(buf, w, h, cx, cy, thick*0.9)
}

// Panel styles for variation
type PStyle = "lyreA"|"lyreB"|"cScroll"|"heartScroll"|"twoHeart"

function drawPanel(buf:Float32Array, w:number, h:number,
  left:number, top:number, pw:number, ph:number, style:PStyle, rand:()=>number) {
  const cx = left + pw/2, cy = top + ph/2, iron = 8
  drawBar(buf, w, h, cx, top + ph*0.03, cx, top + ph*0.97, iron*0.85)

  if (style === "lyreA" || style === "lyreB") {
    const sp = style === "lyreA" ? 0.42 : 0.36
    const bu = style === "lyreA" ? 0.48 : 0.44
    for (const mir of [-1,1]) {
      drawThickCurve(buf,w,h, sampleBezier4(cx,top+ph*0.08, cx+mir*pw*sp,top+ph*0.15,
        cx+mir*pw*bu,top+ph*0.55, cx,top+ph*0.92, 120), iron*1.1, iron*0.6)
      drawThickCurve(buf,w,h, sampleBezier4(cx,top+ph*0.18, cx+mir*pw*(sp-0.12),top+ph*0.22,
        cx+mir*pw*(bu-0.14),top+ph*0.50, cx,top+ph*0.82, 80), iron*0.55, iron*0.35)
      drawVolute(buf,w,h, cx+mir*pw*bu*0.65, cy-ph*0.05, 14+rand()*6, mir, iron*0.45, 1.1)
      drawVolute(buf,w,h, cx+mir*pw*bu*0.65, cy+ph*0.12, 12+rand()*5, -mir, iron*0.4, 1.0)
    }
    drawCircle(buf,w,h, cx, top+ph*0.08, iron*1.2)
    drawCircle(buf,w,h, cx, top+ph*0.92, iron*1.2)
  } else if (style === "cScroll") {
    for (const mir of [-1,1]) {
      drawThickCurve(buf,w,h, sampleBezier4(cx,top+ph*0.12, cx+mir*pw*0.38,top+ph*0.05,
        cx+mir*pw*0.42,top+ph*0.30, cx+mir*pw*0.12,top+ph*0.42, 120), iron*1.2, iron*0.65)
      drawVolute(buf,w,h, cx+mir*pw*0.12, top+ph*0.42+8, 18+rand()*6, mir, iron*0.55, 1.2+rand()*0.3)
      drawThickCurve(buf,w,h, sampleBezier4(cx,top+ph*0.88, cx+mir*pw*0.38,top+ph*0.95,
        cx+mir*pw*0.42,top+ph*0.70, cx+mir*pw*0.12,top+ph*0.58, 120), iron*1.2, iron*0.65)
      drawVolute(buf,w,h, cx+mir*pw*0.12, top+ph*0.58-8, 18+rand()*6, -mir, iron*0.55, 1.2+rand()*0.3)
      drawThickCurve(buf,w,h, sampleBezier4(cx+mir*pw*0.38,top+ph*0.22, cx+mir*pw*0.44,top+ph*0.38,
        cx+mir*pw*0.44,top+ph*0.62, cx+mir*pw*0.38,top+ph*0.78, 80), iron*0.7, iron*0.7)
    }
    drawCircle(buf,w,h, cx, cy, iron*1.8)
  } else if (style === "heartScroll") {
    for (const mir of [-1,1]) {
      drawThickCurve(buf,w,h, sampleBezier4(cx,top+ph*0.12, cx+mir*pw*0.50,top-ph*0.05,
        cx+mir*pw*0.46,top+ph*0.65, cx,top+ph*0.88, 120), iron*1.1, iron*0.6)
      drawThickCurve(buf,w,h, sampleBezier3(cx+mir*pw*0.32,top+ph*0.30, cx+mir*pw*0.15,top+ph*0.40,
        cx+mir*pw*0.10,top+ph*0.55, 60), iron*0.5, iron*0.3)
      drawVolute(buf,w,h, cx+mir*pw*0.10, top+ph*0.55, 10+rand()*4, mir, iron*0.35, 0.9)
    }
    drawCircle(buf,w,h, cx, top+ph*0.12, iron*1.0)
    drawCircle(buf,w,h, cx, top+ph*0.88, iron*1.0)
  } else {
    for (const yOff of [0.0, 0.48]) {
      const st = top + ph*(yOff+0.04), sh = ph*0.44
      for (const mir of [-1,1]) {
        drawThickCurve(buf,w,h, sampleBezier4(cx,st+sh*0.10, cx+mir*pw*0.44,st-sh*0.08,
          cx+mir*pw*0.40,st+sh*0.70, cx,st+sh*0.90, 80), iron*0.9, iron*0.5)
        drawVolute(buf,w,h, cx+mir*pw*0.25, st+sh*0.45, 10, mir, iron*0.35, 0.8)
      }
      drawCircle(buf,w,h, cx, st+sh*0.10, iron*0.8)
      drawCircle(buf,w,h, cx, st+sh*0.90, iron*0.8)
    }
  }
}

/**
 * Build scene with TWO channels:
 * - dark: silhouette/edge elements (tree canopy, roof edges, dark surfaces)
 * - warm: lit surfaces (building walls in golden light, ground catching light)
 * - glow: point light sources (windows, lamps)
 */
function buildScene(w: number, h: number, seed: number, rand: () => number) {
  const dark = new Float32Array(w * h)  // silhouette elements
  const warm = new Float32Array(w * h)  // golden-lit surfaces
  const glow = new Float32Array(w * h)  // light sources

  const groundY = h * 0.80
  const edgeNoise = makeNoise(seed + 500, 40)

  // Ground — dark closest to us, catching some warm light further back
  for (let x = 0; x < w; x++) {
    const gv = edgeNoise(x, groundY) * 6
    for (let y = Math.floor(groundY + gv); y < h; y++) {
      if (y >= 0) {
        dark[y * w + x] = 0.85
        // Ground catches golden light
        warm[y * w + x] = 0.25
      }
    }
  }

  // Sidewalk — lighter, catches more golden light
  const swTop = groundY - h * 0.025
  for (let x = 0; x < w; x++) {
    for (let y = Math.floor(swTop); y < Math.floor(groundY); y++) {
      if (y >= 0 && y < h) {
        dark[y * w + x] = Math.max(dark[y * w + x], 0.30)
        warm[y * w + x] = Math.max(warm[y * w + x], 0.45)
      }
    }
  }

  // Distant roofline (hazy warm)
  const bgNoise = makeNoise(seed + 300, 150)
  for (let x = 0; x < w; x++) {
    const baseRoof = h * 0.43 + bgNoise(x, 0) * h * 0.05
    const step = Math.floor(x / (w * 0.08))
    const stepOff = ((step * 7 + 3) % 11 - 5) * h * 0.007
    const roofY = baseRoof + stepOff
    for (let y = Math.max(0, Math.floor(roofY)); y < Math.floor(swTop); y++) {
      dark[y * w + x] = Math.max(dark[y * w + x], 0.15)
      warm[y * w + x] = Math.max(warm[y * w + x], 0.20) // warm-tinted haze
    }
  }

  // ===== SHOTGUN HOUSE =====
  const houseL = w * 0.52
  const houseR = w * 0.88
  const houseWall = h * 0.37
  const porchRoof = h * 0.33

  // Main wall — LIT by golden hour. Warm amber, not dark.
  for (let y = Math.floor(houseWall); y < Math.floor(groundY); y++) {
    for (let x = Math.floor(houseL); x <= Math.ceil(houseR); x++) {
      if (x >= 0 && x < w) {
        // Wall catches golden light — warm with slight darkness
        dark[y * w + x] = Math.max(dark[y * w + x], 0.35)
        warm[y * w + x] = Math.max(warm[y * w + x], 0.55) // golden-lit wall
      }
    }
  }

  // Porch ceiling (under roof overhang) — darker
  const porchOverhang = w * 0.035
  for (let y = Math.floor(porchRoof + 5); y < Math.floor(houseWall + 5); y++) {
    for (let x = Math.floor(houseL - porchOverhang); x <= Math.ceil(houseR + porchOverhang * 0.5); x++) {
      if (x >= 0 && x < w) {
        dark[y * w + x] = Math.max(dark[y * w + x], 0.65) // darker under roof
        warm[y * w + x] = Math.max(warm[y * w + x], 0.15)
      }
    }
  }

  // Roof line / eave (dark edge)
  for (let x = Math.floor(houseL - porchOverhang); x <= Math.ceil(houseR + porchOverhang * 0.5); x++) {
    for (let dy = 0; dy < 8; dy++) {
      const py = Math.floor(porchRoof + dy)
      if (x >= 0 && x < w && py >= 0 && py < h) {
        dark[py * w + x] = Math.max(dark[py * w + x], 0.80)
      }
    }
  }

  // Gable roof peak
  const peakX = (houseL + houseR) / 2
  const peakY = porchRoof - (houseR - houseL) * 0.08
  for (let y = Math.floor(peakY); y < Math.floor(porchRoof); y++) {
    const t = (y - peakY) / (porchRoof - peakY)
    const halfW2 = ((houseR - houseL) / 2 + 15) * t
    for (let x = Math.floor(peakX - halfW2); x <= Math.ceil(peakX + halfW2); x++) {
      if (x >= 0 && x < w) {
        dark[y * w + x] = Math.max(dark[y * w + x], 0.70)
        warm[y * w + x] = Math.max(warm[y * w + x], 0.20)
      }
    }
  }

  // Porch columns (dark vertical elements)
  for (let ci = 0; ci < 3; ci++) {
    const colX = houseL + (houseR - houseL) * (0.12 + ci * 0.35)
    for (let y = Math.floor(porchRoof); y < Math.floor(groundY); y++) {
      for (let dx = -6; dx <= 6; dx++) {
        const px = Math.round(colX + dx)
        if (px >= 0 && px < w && y >= 0 && y < h) {
          dark[y * w + px] = Math.max(dark[y * w + px], 0.75)
        }
      }
    }
  }

  // Front door (dark)
  const doorX = houseL + (houseR - houseL) * 0.35
  const doorW2 = (houseR - houseL) * 0.06
  const doorTop = groundY - (groundY - houseWall) * 0.68
  for (let y = Math.floor(doorTop); y < Math.floor(groundY - 5); y++) {
    for (let x = Math.floor(doorX - doorW2); x <= Math.ceil(doorX + doorW2); x++) {
      if (x >= 0 && x < w) dark[y * w + x] = Math.max(dark[y * w + x], 0.80)
    }
  }

  // Windows — BRIGHT warm glow
  const winW2 = (houseR - houseL) * 0.05
  const winH2 = (groundY - houseWall) * 0.26
  for (let wi = 0; wi < 3; wi++) {
    const wx = houseL + (houseR - houseL) * (0.15 + wi * 0.28)
    const wy = houseWall + (groundY - houseWall) * 0.20
    for (let y = Math.floor(wy); y < Math.floor(wy + winH2); y++) {
      if (y < 0 || y >= h) continue
      for (let x = Math.floor(wx - winW2); x <= Math.ceil(wx + winW2); x++) {
        if (x < 0 || x >= w) continue
        glow[y * w + x] = Math.max(glow[y * w + x], 0.90)
      }
    }
    // Window glow halo (spreads warm light onto surrounding wall)
    const haloR = winW2 * 3
    for (let dy = -haloR; dy <= haloR; dy++) {
      for (let dx = -haloR; dx <= haloR; dx++) {
        const px = Math.round(wx + dx), py = Math.round(wy + winH2/2 + dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          const d = Math.sqrt(dx*dx + dy*dy) / haloR
          if (d < 1) glow[py * w + px] = Math.max(glow[py * w + px], (1 - d*d) * 0.40)
        }
      }
    }
  }

  // Porch light
  const plX = doorX + doorW2 * 2.5
  const plY = porchRoof + (houseWall - porchRoof) * 0.35
  const plR = 55
  for (let dy = -plR; dy <= plR; dy++) {
    for (let dx = -plR; dx <= plR; dx++) {
      const px = Math.round(plX + dx), py = Math.round(plY + dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx*dx+dy*dy) / plR
        if (d < 1) glow[py * w + px] = Math.max(glow[py * w + px], (1 - d*d) * 0.65)
      }
    }
  }

  // ===== LIVE OAK — wide spreading =====
  const treeCX = w * 0.28
  const treeBaseY = groundY

  // Trunk — thick, leaning slightly
  const trunkTopY = h * 0.42
  for (let y = Math.floor(treeBaseY); y > Math.floor(trunkTopY); y--) {
    const t = (treeBaseY - y) / (treeBaseY - trunkTopY)
    const tw = 24 * (1.8 - t * 0.5)
    const lean = t * 15
    for (let dx = -Math.ceil(tw); dx <= Math.ceil(tw); dx++) {
      const px = Math.round(treeCX + lean + dx)
      if (px >= 0 && px < w && y >= 0 && y < h) {
        const d = Math.abs(dx) / tw
        if (d < 1) dark[y * w + px] = Math.max(dark[y * w + px], 0.92 * (1 - d * 0.1))
      }
    }
  }

  // Major branches — WIDE horizontal
  const branches = [
    { dir: -1, angle: -0.12, len: w * 0.32, thick: 18 },
    { dir: -1, angle: -0.42, len: w * 0.24, thick: 13 },
    { dir: -1, angle: 0.06,  len: w * 0.26, thick: 11 },
    { dir: 1,  angle: -0.18, len: w * 0.20, thick: 15 },
    { dir: 1,  angle: -0.48, len: w * 0.17, thick: 11 },
    { dir: -1, angle: -0.75, len: w * 0.18, thick: 10 },
  ]

  const branchEnds: Array<{x:number,y:number,r:number}> = []

  for (const br of branches) {
    const bsx = treeCX + 15 * br.dir, bsy = trunkTopY + h * 0.02
    const bex = bsx + Math.cos(br.angle) * br.len * br.dir
    const bey = bsy + Math.sin(br.angle) * br.len
    const mx = (bsx+bex)/2 + (rand()-0.5)*30, my = (bsy+bey)/2 + (rand()-0.5)*20 - 10
    drawThickCurve(dark, w, h, sampleBezier3(bsx,bsy, mx,my, bex,bey, 80), br.thick, br.thick*0.4)
    branchEnds.push({ x: bex, y: bey, r: br.len * 0.35 })

    for (let sb = 0; sb < 3; sb++) {
      const sa = br.angle + (rand()-0.5)*1.2, sl = br.len*(0.2+rand()*0.15)
      const sex = bex + Math.cos(sa)*sl*br.dir, sey = bey + Math.sin(sa)*sl
      drawThickCurve(dark, w, h, sampleBezier3(bex,bey,
        (bex+sex)/2+(rand()-0.5)*15, (bey+sey)/2+(rand()-0.5)*10,
        sex, sey, 40), br.thick*0.35, br.thick*0.15)
      branchEnds.push({ x: sex, y: sey, r: sl * 0.6 })
    }
  }

  // Canopy — DARK masses (true silhouette against sky)
  const canopyBlobs = [
    { x: treeCX - w*0.28, y: h*0.28, rx: w*0.12, ry: h*0.08 },
    { x: treeCX - w*0.18, y: h*0.17, rx: w*0.15, ry: h*0.10 },
    { x: treeCX - w*0.05, y: h*0.13, rx: w*0.14, ry: h*0.10 },
    { x: treeCX + w*0.08, y: h*0.15, rx: w*0.13, ry: h*0.09 },
    { x: treeCX + w*0.17, y: h*0.22, rx: w*0.10, ry: h*0.07 },
    { x: treeCX - w*0.10, y: h*0.24, rx: w*0.11, ry: h*0.07 },
    { x: treeCX + w*0.02, y: h*0.22, rx: w*0.10, ry: h*0.07 },
    { x: treeCX - w*0.25, y: h*0.34, rx: w*0.08, ry: h*0.06 },
    { x: treeCX + w*0.14, y: h*0.30, rx: w*0.07, ry: h*0.05 },
    { x: treeCX, y: h*0.30, rx: w*0.08, ry: h*0.06 },
    { x: treeCX - w*0.06, y: h*0.36, rx: w*0.06, ry: h*0.05 },
  ]
  for (const be of branchEnds) {
    canopyBlobs.push({ x: be.x, y: be.y - be.r * 0.3, rx: be.r, ry: be.r * 0.6 })
  }

  const canopyNoise2 = makeNoise(seed + 600, 25)
  const gapNoise2 = makeNoise(seed + 700, 16)
  for (const blob of canopyBlobs) {
    const bn = makeNoise(seed + Math.floor(blob.x*7+blob.y*13), 20)
    const minX = Math.max(0, Math.floor(blob.x - blob.rx*1.3))
    const maxX = Math.min(w-1, Math.ceil(blob.x + blob.rx*1.3))
    const minY = Math.max(0, Math.floor(blob.y - blob.ry*1.3))
    const maxY = Math.min(h-1, Math.ceil(blob.y + blob.ry*1.3))
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx2 = (x-blob.x)/blob.rx, dy2 = (y-blob.y)/blob.ry
        let dist = dx2*dx2+dy2*dy2 + bn(x,y)*0.30
        if (dist < 1.0) {
          const edgeFade = dist > 0.65 ? (1-dist)/0.35 : 1.0
          const gap = gapNoise2(x,y)*0.5+0.5
          const gapThresh = 0.55 + dist * 0.22
          const alpha = gap > gapThresh ? edgeFade * 0.05 : edgeFade * 0.90
          dark[y*w+x] = Math.max(dark[y*w+x], alpha)
        }
      }
    }
  }

  // Spanish moss — heavier
  const mossNoise = makeNoise(seed + 800, 8)
  for (let i = 0; i < 140; i++) {
    const mx0 = treeCX + (rand()-0.5) * w * 0.55
    const my0 = h * 0.16 + rand() * h * 0.22
    const mLen = 55 + rand() * 140
    const mW = 2.5 + rand() * 4
    for (let my = 0; my < mLen; my++) {
      const t = my / mLen
      const sway = mossNoise(mx0+i*77, my0+my) * 18 * t
      const mx = mx0 + sway, myy = my0 + my
      if (myy >= h) continue
      const opacity = (1 - t*t) * 0.65
      const mw = mW * (1 - t * 0.4)
      for (let ddx = -Math.ceil(mw); ddx <= Math.ceil(mw); ddx++) {
        const px = Math.round(mx+ddx)
        if (px < 0 || px >= w) continue
        const py = Math.round(myy)
        if (py >= 0 && py < h) {
          const d = Math.abs(ddx)/mw
          if (d < 1) dark[py*w+px] = Math.max(dark[py*w+px], (1-d)*opacity)
        }
      }
    }
  }

  // Street lamp
  const lampX = w * 0.48, lampTopY = h * 0.28
  drawBar(dark, w, h, lampX, lampTopY, lampX, groundY, 7)
  drawBar(dark, w, h, lampX-20, lampTopY, lampX+20, lampTopY, 5)
  drawBar(dark, w, h, lampX-16, lampTopY, lampX-16, lampTopY+24, 4)
  drawBar(dark, w, h, lampX+16, lampTopY, lampX+16, lampTopY+24, 4)
  drawBar(dark, w, h, lampX-16, lampTopY+24, lampX+16, lampTopY+24, 4)

  // Lamp glow — STRONG
  const lgR = 100
  for (let dy = -lgR; dy <= lgR; dy++) {
    for (let dx = -lgR; dx <= lgR; dx++) {
      const px = Math.round(lampX+dx), py = Math.round(lampTopY+12+dy)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt(dx*dx+dy*dy)/lgR
        if (d < 1) glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d)*0.80)
      }
    }
  }

  // Lamp light on ground below
  const lgGR = 150
  for (let dy = -lgGR; dy <= lgGR; dy++) {
    for (let dx = -lgGR*1.5; dx <= lgGR*1.5; dx++) {
      const px = Math.round(lampX+dx), py = Math.round(groundY - 10 + dy * 0.3)
      if (px >= 0 && px < w && py >= 0 && py < h) {
        const d = Math.sqrt((dx/(lgGR*1.5))**2+(dy/lgGR)**2)
        if (d < 1) {
          warm[py*w+px] = Math.max(warm[py*w+px], (1-d*d)*0.35)
          glow[py*w+px] = Math.max(glow[py*w+px], (1-d*d)*0.15)
        }
      }
    }
  }

  // Power lines
  for (const lineY of [h * 0.15, h * 0.175]) {
    for (let s = 0; s <= 400; s++) {
      const t = s/400, lx = -50 + (w+100)*t
      const ly = lineY + 20 * Math.sin(t * Math.PI)
      for (let dy = -1; dy <= 1; dy++) {
        const px = Math.round(lx), py = Math.round(ly+dy)
        if (px >= 0 && px < w && py >= 0 && py < h) {
          dark[py*w+px] = Math.max(dark[py*w+px], 0.55)
        }
      }
    }
  }

  return { dark, warm, glow }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string,number> = { a: 16001, b: 16002, c: 16003, d: 16004 }
  const seed = seeds[variant] ?? 16001
  const rand = makePRNG(seed)

  console.log(`=== NOSTALGIA v16 variant ${variant} (seed: ${seed}) ===`)
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
      if (t < 0.08) {
        const st = t / 0.08; r = 150+st*50; g = 70+st*45; b = 35+st*20
      } else if (t < 0.25) {
        const st = (t-0.08)/0.17; r = 200+st*45; g = 115+st*55; b = 55+st*38
      } else if (t < 0.48) {
        const st = (t-0.25)/0.23; r = 245+st*8; g = 170+st*45; b = 93+st*30
      } else if (t < 0.70) {
        const st = (t-0.48)/0.22; r = 253-st*12; g = 215-st*25; b = 123-st*15
      } else {
        const st = (t-0.70)/0.30; r = 241-st*70; g = 190-st*60; b = 108-st*35
      }
      if (cn > 0.42) {
        const ca = Math.min(0.28, (cn-0.42)/0.35)
        const glw = Math.max(0, 1 - Math.abs(t-0.35)*2.5)
        r += ca*(22+glw*18); g += ca*(16+glw*14); b += ca*(9+glw*8)
      }
      r += (sn-0.5)*7; g += (sn-0.5)*5; b += (sn-0.5)*3
      skyPixels[idx] = r; skyPixels[idx+1] = g; skyPixels[idx+2] = b
    }
  }

  // === Layer 2: Scene ===
  console.log("  Building scene...")
  const { dark, warm, glow: glowMap } = buildScene(W, H, seed, rand)
  console.log("  Blurring scene...")
  const darkBlurred = gaussianBlur(dark, W, H, 8)
  const warmBlurred = gaussianBlur(warm, W, H, 10)
  const glowBlurred = gaussianBlur(glowMap, W, H, 16)

  // === Layer 3: Iron ===
  console.log("  Drawing iron...")
  const ironSil = new Float32Array(W * H)
  const railTop = H * 0.48, railBot = H * 0.84
  const railH2 = railBot - railTop, ironThick = 9

  drawBar(ironSil, W, H, -10, railTop, W+10, railTop, ironThick*2.5)
  drawBar(ironSil, W, H, -10, railBot, W+10, railBot, ironThick*2.5)

  const numPanels = 5, panelW = (W+80)/numPanels, panelStartX = -40
  const styles: PStyle[] = ["lyreA","cScroll","heartScroll","lyreB","twoHeart"]
  for (let i = 0; i <= numPanels; i++) {
    drawBar(ironSil, W, H, panelStartX+i*panelW, railTop-10, panelStartX+i*panelW, railBot+10, ironThick*1.6)
  }
  console.log("  Drawing scrollwork...")
  for (let i = 0; i < numPanels; i++) {
    const pL = panelStartX + i*panelW + ironThick*3
    const pW = panelW - ironThick*6
    const pR = makePRNG(seed+2000+i*131)
    drawPanel(ironSil, W, H, pL, railTop+ironThick*3.5, pW, railH2-ironThick*7, styles[i%5], ()=>pR())
  }
  for (let i = 0; i <= numPanels; i++) {
    const fx = panelStartX + i * panelW
    drawBar(ironSil, W, H, fx, railTop-35, fx, railTop, ironThick*0.8)
    for (let dy = -14; dy <= 0; dy++) {
      const p = -dy/14, hw = (1-p)*8+p*2
      for (let dx = -Math.ceil(hw); dx <= Math.ceil(hw); dx++) {
        const px = Math.round(fx+dx), py = Math.round(railTop-35+dy)
        if (px>=0&&px<W&&py>=0&&py<H) ironSil[py*W+px] = Math.max(ironSil[py*W+px], 1.0)
      }
    }
    drawCircle(ironSil, W, H, fx, railTop-37, ironThick*0.5)
  }
  for (let y = Math.floor(railBot + ironThick*2.5); y < H; y++) {
    for (let x = 0; x < W; x++) ironSil[y*W+x] = Math.max(ironSil[y*W+x], 1.0)
  }

  // === Composite ===
  console.log("  Compositing...")
  const imageData = ctx.createImageData(W, H)
  const pixels = imageData.data
  const grainNoise = makeNoise(seed + 900, 2.5)
  const texNoise = makeFBM(seed + 950, 30, 3)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx4 = (y*W+x)*4, idx3 = (y*W+x)*3
      let r = skyPixels[idx3], g = skyPixels[idx3+1], b = skyPixels[idx3+2]

      const dk = darkBlurred[y*W+x]
      const wm = warmBlurred[y*W+x]
      const gl = glowBlurred[y*W+x]
      const tex = texNoise(x,y)*0.5+0.5

      // Warm lit surfaces — blend toward golden amber
      if (wm > 0.01) {
        const warmR = 200 + tex * 20, warmG = 148 + tex * 15, warmB = 78 + tex * 10
        const a = Math.min(0.55, wm * 0.65)
        r = r * (1-a) + warmR * a
        g = g * (1-a) + warmG * a
        b = b * (1-a) + warmB * a
      }

      // Dark elements — blend toward warm dark brown
      if (dk > 0.01) {
        const depth = y / H
        const a = Math.min(1, dk)
        const darkR = 42 + depth * 18 + tex * 12
        const darkG = 30 + depth * 12 + tex * 8
        const darkB = 28 + depth * 10 + tex * 5
        r = r * (1-a) + darkR * a
        g = g * (1-a) + darkG * a
        b = b * (1-a) + darkB * a
      }

      // Glow — bright warm light
      if (gl > 0.01) {
        const glowR = 255, glowG = 200, glowB = 100
        const a = Math.min(0.85, gl * 0.80)
        r = r + (glowR - r) * a
        g = g + (glowG - g) * a
        b = b + (glowB - b) * a
      }

      // Iron
      const iron = ironSil[y*W+x]
      if (iron > 0.01) {
        const a = Math.min(1, iron)
        const itex = texNoise(x*3, y*3)*0.5+0.5
        r = r*(1-a) + (25+itex*12)*a
        g = g*(1-a) + (18+itex*8)*a
        b = b*(1-a) + (22+itex*6)*a
      }

      // Film grain
      const grain = grainNoise(x, y) * 5
      r += grain; g += grain * 0.8; b += grain * 0.6

      // Warm vignette
      const cx2 = x/W - 0.5, cy2 = y/H - 0.38
      const vig = 1.0 - (cx2*cx2*0.6 + cy2*cy2*1.0) * 0.35
      r *= vig; g *= vig; b *= vig

      pixels[idx4] = Math.round(Math.max(0, Math.min(255, r)))
      pixels[idx4+1] = Math.round(Math.max(0, Math.min(255, g)))
      pixels[idx4+2] = Math.round(Math.max(0, Math.min(255, b)))
      pixels[idx4+3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const filename = `output/nostalgia-v16-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
