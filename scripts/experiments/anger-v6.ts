/**
 * ANGER v6 — GESTURAL VIOLENCE
 *
 * v5 looked like calligraphy. Elegant bezier curves on cream = designed, not destroyed.
 *
 * This version simulates GESTURE — a point moving through space with velocity,
 * momentum, sudden direction changes. The marks carry physical energy.
 * Fast = thin scratches. Slow = thick gouges. Direction changes = loss of control.
 *
 * The fury zone is asymmetric and bleeds past edges.
 * Marks overlap, build up, obscure each other.
 * The surface is damaged EVERYWHERE — not pristine with a neat cluster of cuts.
 *
 * The viewer should feel: someone lost control here.
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

// ---- Gestural stroke simulation ----
interface StrokePoint {
  x: number
  y: number
  radius: number    // width of mark at this point
  pressure: number  // 0-1 how hard the tool is pressed
  speed: number     // how fast the tool was moving
}

interface GestureStroke {
  points: StrokePoint[]
  type: "gouge" | "scratch" | "scrape"  // determines depth/color
}

function simulateGesture(
  startX: number, startY: number,
  initialAngle: number,
  initialSpeed: number,
  duration: number,
  fury: number,  // 0-1, how much random jitter
  maxRadius: number,
  rand: () => number,
): StrokePoint[] {
  const points: StrokePoint[] = []
  let x = startX
  let y = startY
  let vx = Math.cos(initialAngle) * initialSpeed
  let vy = Math.sin(initialAngle) * initialSpeed
  let pressure = 0.7 + rand() * 0.3

  for (let i = 0; i < duration; i++) {
    const speed = Math.sqrt(vx * vx + vy * vy)

    // Radius: inverse of speed (fast = thin, slow = thick gouge)
    // But with randomness — pressure fluctuates
    const speedFactor = Math.max(0.15, 1.0 - speed / 35)
    const radius = maxRadius * speedFactor * pressure

    points.push({ x, y, radius, pressure, speed })

    // SUDDEN direction changes — this is the anger
    // Not smooth bezier transitions — sharp, violent pivots
    if (rand() < fury * 0.18) {
      // Major impulse — a jerk, a flinch, a snap
      const impulseAngle = rand() * Math.PI * 2  // ANY direction
      const impulseMag = 12 + rand() * 35
      vx += Math.cos(impulseAngle) * impulseMag
      vy += Math.sin(impulseAngle) * impulseMag
    }

    // Continuous jitter — the hand shaking with rage
    vx += (rand() - 0.5) * fury * 10
    vy += (rand() - 0.5) * fury * 10

    // Lower friction — marks carry more momentum, change direction more violently
    vx *= 0.88
    vy *= 0.94

    // Pressure fluctuates
    pressure += (rand() - 0.5) * 0.08
    pressure = Math.max(0.1, Math.min(1.0, pressure))

    // Occasional pressure spike — digging in
    if (rand() < 0.03) {
      pressure = Math.min(1.0, pressure + 0.3)
    }

    x += vx
    y += vy
  }

  return points
}

function generateStrokes(rand: () => number): GestureStroke[] {
  const strokes: GestureStroke[] = []

  // Fury zone — OFF-CENTER. Anger isn't balanced.
  // Lower-left to center-right — a diagonal of violence
  const furyX = W * (0.30 + rand() * 0.15)
  const furyY = H * (0.45 + rand() * 0.20)

  // === MAJOR GOUGES: 3-5 big, fast, decisive strokes ===
  // These are the primary cuts. Wide, deep, carrying momentum.
  const majorCount = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < majorCount; i++) {
    // Force angle diversity — partition the angle range
    const baseAngle = (i / majorCount) * Math.PI + (rand() - 0.5) * 0.6
    const speed = 15 + rand() * 20

    // Start from near fury zone, extend outward
    const startOffset = 400 + rand() * 600
    const startX = furyX - Math.cos(baseAngle) * startOffset + (rand() - 0.5) * 200
    const startY = furyY - Math.sin(baseAngle) * startOffset + (rand() - 0.5) * 200

    const points = simulateGesture(
      startX, startY,
      baseAngle,
      speed,
      120 + Math.floor(rand() * 100),  // long strokes
      0.5 + rand() * 0.3,              // moderate fury
      60 + rand() * 50,                // WIDE marks
      rand,
    )

    strokes.push({ points, type: "gouge" })
  }

  // === FRANTIC MARKS: 8-15 short, desperate, overlapping ===
  // Loss of control. Clustered near fury zone but scattered.
  const franticCount = 8 + Math.floor(rand() * 8)
  for (let i = 0; i < franticCount; i++) {
    const cx = furyX + (rand() - 0.5) * 800
    const cy = furyY + (rand() - 0.5) * 600
    const angle = rand() * Math.PI * 2
    const speed = 20 + rand() * 25

    const points = simulateGesture(
      cx, cy,
      angle,
      speed,
      30 + Math.floor(rand() * 50),  // short, violent
      0.7 + rand() * 0.3,            // HIGH fury
      30 + rand() * 40,
      rand,
    )

    strokes.push({ points, type: "gouge" })
  }

  // === SCRATCHES: 4-8 long thin surface marks ===
  // Not deep — just surface damage. Like fingernails.
  const scratchCount = 4 + Math.floor(rand() * 5)
  for (let i = 0; i < scratchCount; i++) {
    const startX = rand() * W
    const startY = rand() * H
    const angle = rand() * Math.PI
    const speed = 25 + rand() * 15  // fast = thin

    const points = simulateGesture(
      startX, startY,
      angle,
      speed,
      80 + Math.floor(rand() * 120),  // long
      0.2 + rand() * 0.3,             // less fury — more controlled
      12 + rand() * 10,               // thin
      rand,
    )

    strokes.push({ points, type: "scratch" })
  }

  // === STABS: 3-6 concentrated marks in one area ===
  // The same spot hit over and over. Obsessive. Out of control.
  const stabClusters = 2 + Math.floor(rand() * 3)
  for (let c = 0; c < stabClusters; c++) {
    const cx = furyX + (rand() - 0.5) * 400
    const cy = furyY + (rand() - 0.5) * 300
    const stabCount = 3 + Math.floor(rand() * 4)
    for (let i = 0; i < stabCount; i++) {
      const angle = rand() * Math.PI * 2
      const points = simulateGesture(
        cx + (rand() - 0.5) * 80,
        cy + (rand() - 0.5) * 80,
        angle,
        5 + rand() * 12,   // slow — digging in
        15 + Math.floor(rand() * 25),  // very short
        0.9,                // maximum fury
        50 + rand() * 40,  // wide — gouging
        rand,
      )
      strokes.push({ points, type: "gouge" })
    }
  }

  // === SCRAPES: 2-4 wide shallow surface damage ===
  // Like dragging something flat across the surface. Displaces material without cutting.
  const scrapeCount = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < scrapeCount; i++) {
    const cx = furyX + (rand() - 0.5) * 600
    const cy = furyY + (rand() - 0.5) * 400
    const angle = rand() * Math.PI
    const speed = 8 + rand() * 10  // slow

    const points = simulateGesture(
      cx, cy,
      angle,
      speed,
      40 + Math.floor(rand() * 40),
      0.4 + rand() * 0.3,
      80 + rand() * 60,  // very wide
      rand,
    )

    strokes.push({ points, type: "scrape" })
  }

  return strokes
}

// ---- Render ----
function render(strokes: GestureStroke[], seed: number): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)

  // Accumulators for damage
  const depth = new Float32Array(N)       // 0 = surface, 1 = deep void
  const blood = new Float32Array(N)       // 0 = clean, 1 = fully stained
  const scrapeMap = new Float32Array(N)   // 0 = intact, 1 = scraped
  const stressMap = new Float32Array(N)   // surface stress from nearby marks

  const surfNoise1 = makeNoise(seed, 350)
  const surfNoise2 = makeNoise(seed + 100, 100)
  const surfNoise3 = makeNoise(seed + 200, 30)
  const edgeNoise = makeNoise(seed + 300, 15)

  // === Deposit marks onto accumulators ===
  for (const stroke of strokes) {
    for (let i = 0; i < stroke.points.length; i++) {
      const pt = stroke.points[i]
      const prevPt = i > 0 ? stroke.points[i - 1] : pt

      // Interpolate between points for continuous coverage
      const dx = pt.x - prevPt.x
      const dy = pt.y - prevPt.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const steps = Math.max(1, Math.ceil(dist / 2))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const cx = prevPt.x + dx * t
        const cy = prevPt.y + dy * t
        const r = prevPt.radius + (pt.radius - prevPt.radius) * t
        const pr = prevPt.pressure + (pt.pressure - prevPt.pressure) * t

        // Deposit into accumulator grids
        const ir = Math.ceil(r * 1.5)
        const minX = Math.max(0, Math.floor(cx - ir))
        const maxX = Math.min(W - 1, Math.ceil(cx + ir))
        const minY = Math.max(0, Math.floor(cy - ir))
        const maxY = Math.min(H - 1, Math.ceil(cy + ir))

        for (let py = minY; py <= maxY; py++) {
          for (let px = minX; px <= maxX; px++) {
            const ddx = px - cx
            const ddy = py - cy
            const d = Math.sqrt(ddx * ddx + ddy * ddy)
            const en = edgeNoise(px, py) * 0.4  // ragged edges
            const effectiveR = r * (1.0 + en)

            if (d > effectiveR) continue

            const idx = py * W + px
            const falloff = 1.0 - d / effectiveR
            const intensity = falloff * falloff * pr

            if (stroke.type === "gouge") {
              // Deep cut — black void with blood
              depth[idx] = Math.min(1.0, depth[idx] + intensity * 0.6)
              // Blood spreads wider than the cut
              if (d < effectiveR * 2.5) {
                const bloodFalloff = 1.0 - d / (effectiveR * 2.5)
                blood[idx] = Math.min(1.0, blood[idx] + bloodFalloff * bloodFalloff * pr * 0.25)
              }
            } else if (stroke.type === "scratch") {
              // Shallow cut — surface damage, thin
              depth[idx] = Math.min(1.0, depth[idx] + intensity * 0.3)
            } else if (stroke.type === "scrape") {
              // Wide shallow — displaces material
              scrapeMap[idx] = Math.min(1.0, scrapeMap[idx] + intensity * 0.4)
            }

            // All marks create stress in surrounding area
            if (d < effectiveR * 4) {
              const stressFalloff = 1.0 - d / (effectiveR * 4)
              stressMap[idx] = Math.min(1.0, stressMap[idx] + stressFalloff * pr * 0.05)
            }
          }
        }
      }
    }
  }

  // === Add blood bleed around deep marks ===
  // Blood spreads from deep cuts via a simple diffusion pass
  const bloodSpread = new Float32Array(blood)
  for (let pass = 0; pass < 8; pass++) {
    const temp = new Float32Array(bloodSpread)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x
        if (depth[idx] < 0.3) continue  // only bleed from actual cuts
        const avg = (
          bloodSpread[(y - 1) * W + x] + bloodSpread[(y + 1) * W + x] +
          bloodSpread[y * W + x - 1] + bloodSpread[y * W + x + 1]
        ) / 4
        temp[idx] = Math.max(bloodSpread[idx], avg * 0.92)
      }
    }
    bloodSpread.set(temp)
  }
  // Also bleed into surrounding pixels
  for (let pass = 0; pass < 15; pass++) {
    const temp = new Float32Array(bloodSpread)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x
        const avg = (
          bloodSpread[(y - 1) * W + x] + bloodSpread[(y + 1) * W + x] +
          bloodSpread[y * W + x - 1] + bloodSpread[y * W + x + 1]
        ) / 4
        temp[idx] = Math.max(bloodSpread[idx], avg * 0.96)
      }
    }
    bloodSpread.set(temp)
  }

  // === Render to pixels ===
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Surface texture: warm cream plaster
      const sn1 = surfNoise1(x, y) * 0.5 + 0.5
      const sn2 = surfNoise2(x, y) * 0.5 + 0.5
      const sn3 = surfNoise3(x, y) * 0.5 + 0.5
      const surfaceVal = sn1 * 0.4 + sn2 * 0.35 + sn3 * 0.25

      // Base color: warm cream — but STRESSED everywhere
      // The whole surface is under tension
      const stress = stressMap[idx]
      let r = 218 + surfaceVal * 20 - stress * 30
      let g = 205 + surfaceVal * 15 - stress * 40
      let b = 182 + surfaceVal * 10 - stress * 55  // loses blue fastest = gets warmer/angrier

      // Scrape damage — lighter (exposed layer beneath) with edge darkening
      if (scrapeMap[idx] > 0.05) {
        const scrapeT = Math.min(1.0, scrapeMap[idx])
        // Scraped surface is lighter (exposed inner material) but rougher
        r = r * (1 - scrapeT * 0.3) + 235 * scrapeT * 0.3
        g = g * (1 - scrapeT * 0.3) + 220 * scrapeT * 0.3
        b = b * (1 - scrapeT * 0.3) + 200 * scrapeT * 0.3
        // Edge darkening at scrape boundaries
        const edgeT = scrapeT * (1 - scrapeT) * 4  // peaks at 0.5
        r -= edgeT * 40
        g -= edgeT * 35
        b -= edgeT * 30
      }

      // Blood staining — dark red-brown, not bright
      const bloodVal = bloodSpread[idx]
      if (bloodVal > 0.01) {
        const bt = Math.min(1.0, bloodVal * 2.5)
        // Dried blood: dark brownish red. Not bright, not cheerful.
        r = r * (1 - bt) + (120 + bt * 30) * bt
        g = g * (1 - bt) + 15 * bt
        b = b * (1 - bt) + 8 * bt
      }

      // Void — the cut itself. Nearly black.
      const d = depth[idx]
      if (d > 0.05) {
        const voidT = Math.min(1.0, d * 2.0)
        const voidCurve = voidT * voidT  // sharp transition into darkness
        r = r * (1 - voidCurve) + 8 * voidCurve
        g = g * (1 - voidCurve) + 4 * voidCurve
        b = b * (1 - voidCurve) + 4 * voidCurve
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  return rgba
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 66601, b: 66602, c: 66603, d: 66604 }
  const seed = seeds[variant] ?? 66601
  const rand = makePRNG(seed)

  console.log(`=== ANGER v6 variant ${variant} (seed: ${seed}) ===`)
  console.log("  Generating gestural strokes...")
  const strokes = generateStrokes(rand)
  console.log(`  ${strokes.length} strokes (${strokes.filter(s => s.type === "gouge").length} gouges, ${strokes.filter(s => s.type === "scratch").length} scratches, ${strokes.filter(s => s.type === "scrape").length} scrapes)`)

  console.log("  Rendering...")
  const rgba = render(strokes, seed)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-v6-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
