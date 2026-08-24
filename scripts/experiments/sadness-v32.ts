/**
 * SADNESS v32 — REPEATED FAILURE, third pass against blind reads.
 *
 * v31's fresh blind read: emotion still lands ("burdened or exhausted...
 * three figures undergoing the same decline") but verdict stayed borderline —
 * "too little contrast, detail, or immediately legible tension to interrupt
 * scrolling." Two independent readers agree the image is legible but
 * pleasant, not arresting.
 *
 * Bold changes (not tweaks — if this doesn't move the scroll/verdict needle
 * the direction gets parked with a ceiling hypothesis, not iterated again):
 * - Mark 1 becomes a near-black warm umber mass at Kline weight, bleeding
 *   off the top-left edge. Real figure-ground stakes instead of mid-value
 *   rust on cream.
 * - Dissolution becomes fine falling ash: granular particles below the
 *   failing trail, so close looking is rewarded with detail.
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

interface MarkConfig {
  startX: number
  startY: number
  velocity: number       // initial upward speed
  vxBias: number         // rightward drift
  gravity: number
  maxWidth: number       // peak width
  warmthStart: number    // initial warmth (0-1)
  warmthDecay: number    // how fast warmth drains (higher = faster)
  maxSteps: number
  seedOffset: number
}

interface PathPoint {
  x: number; y: number; t: number
  speed: number; angle: number
  phase: "rise" | "apex" | "fall"
}

function generateMark(config: MarkConfig, rand: () => number, masterSeed: number): {
  points: PathPoint[]
  apexIdx: number
} {
  const tremorN1 = makeNoise(masterSeed + config.seedOffset + 240, 35)
  const tremorN2 = makeNoise(masterSeed + config.seedOffset + 245, 10)

  let px = config.startX
  let py = config.startY
  let vx = config.vxBias
  let vy = -config.velocity

  const points: PathPoint[] = []
  let foundApex = false
  let apexStep = 0

  for (let step = 0; step < config.maxSteps; step++) {
    const speed = Math.sqrt(vx * vx + vy * vy)
    const angle = Math.atan2(vy, vx)
    const t = step / config.maxSteps

    let phase: "rise" | "apex" | "fall"
    if (!foundApex) {
      if (vy >= -0.3) {
        foundApex = true
        apexStep = step
        phase = "apex"
      } else {
        phase = "rise"
      }
    } else if (step < apexStep + 60) {
      phase = "apex"
    } else {
      phase = "fall"
    }

    // Trembling
    let tremorAmp: number
    if (phase === "rise") tremorAmp = 0.5 + t * 4
    else if (phase === "apex") tremorAmp = 5 + (step - apexStep) * 0.2
    else tremorAmp = 10 + ((step - apexStep - 60) / (config.maxSteps - apexStep - 60)) * 25

    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)
    const tr = (tremorN1(px, py) * 0.6 + tremorN2(px, py) * 0.4) * tremorAmp

    vy += config.gravity
    vx += 0.005
    vx *= 0.997
    vy *= 0.997

    if (phase === "apex") { vx *= 0.97; vy *= 0.97 }

    px += vx + perpX * tr
    py += vy + perpY * tr

    points.push({ x: px, y: py, t, speed, angle, phase })

    if (py > H * 1.15 && vy > 0) break
    if (px > W * 1.1 || px < -W * 0.1) break
  }

  // Re-normalize t
  for (let i = 0; i < points.length; i++) points[i].t = i / points.length

  return { points, apexIdx: apexStep }
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 30001, b: 30002, c: 30003, d: 30004, e: 30005 }
  const seed = seeds[variant] ?? 30001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v32 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const edgeNoise1 = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 30)
  const dryNoise = makeNoise(seed + 220, 3)
  const gapNoise = makeNoise(seed + 230, 15)
  const colorNoise = makeNoise(seed + 300, 60)
  const fragNoise = makeNoise(seed + 400, 18)
  const bristleNoise = makeNoise(seed + 500, 2.5)

  // === Define marks with decreasing energy ===
  // Attempts march rightward: each failure starts further into the empty
  // half of the canvas, so the emptiness is where the sequence is going.
  const baseStartX = W * (0.08 + rand() * 0.05)

  const marks: MarkConfig[] = [
    // Mark 1: Strong first attempt — a dominant mass, bleeding off-canvas
    {
      startX: baseStartX - W * 0.04,
      startY: H + 30,
      velocity: 11 + rand() * 1.5,      // apex high but inside the frame — the arch must be seen to fail
      vxBias: 1.5 + rand() * 1.2,
      gravity: 0.022 + rand() * 0.004,
      maxWidth: 250,
      warmthStart: 1.0,
      warmthDecay: 0.6,
      maxSteps: 1200,
      seedOffset: 0,
    },
    // Mark 2: Weaker second attempt, well right of mark 1
    {
      startX: baseStartX + W * (0.30 + rand() * 0.05),
      startY: H + 20,
      velocity: 6.5 + rand() * 1.5,     // much less upward force
      vxBias: 1.2 + rand() * 1.0,
      gravity: 0.025 + rand() * 0.005,
      maxWidth: 100,                     // thinner
      warmthStart: 0.55,                 // already less warm (depleted)
      warmthDecay: 1.2,                  // loses warmth faster
      maxSteps: 800,
      seedOffset: 1000,
    },
    // Mark 3: Barely tries, deep in the empty half
    {
      startX: baseStartX + W * (0.55 + rand() * 0.06),
      startY: H + 10,
      velocity: 3.5 + rand() * 1.0,     // weak
      vxBias: 0.8 + rand() * 0.6,
      gravity: 0.030 + rand() * 0.005,
      maxWidth: 50,                      // thin
      warmthStart: 0.20,                 // barely warm
      warmthDecay: 2.5,                  // drains immediately
      maxSteps: 400,
      seedOffset: 2000,
    },
  ]

  // Generate all marks
  const allMarks: Array<{ points: PathPoint[]; apexIdx: number; config: MarkConfig }> = []
  for (const config of marks) {
    const mark = generateMark(config, rand, seed)
    allMarks.push({ ...mark, config })
    const apexPt = mark.points[mark.apexIdx] || mark.points[mark.points.length - 1]
    console.log(`  Mark: width=${config.maxWidth}, apex=(${Math.round(apexPt.x)}, ${Math.round(apexPt.y)})`)
  }

  // === Render all marks into ink buffer ===
  const inkBuffer = new Float32Array(W * H)
  const warmBuffer = new Float32Array(W * H)

  for (let mi = 0; mi < allMarks.length; mi++) {
    const { points, apexIdx, config } = allMarks[mi]
    const totalSteps = points.length
    const apexT = apexIdx / totalSteps

    console.log(`  Rendering mark ${mi + 1} (${totalSteps} points)...`)

    for (let i = 0; i < totalSteps; i++) {
      const p = points[i]
      const t = p.t

      // Width
      let width: number
      if (t < 0.03) {
        width = config.maxWidth * 0.4 + config.maxWidth * 0.6 * (t / 0.03)
      } else if (p.phase === "rise") {
        width = config.maxWidth - config.maxWidth * 0.1 * ((t - 0.03) / Math.max(0.01, apexT - 0.03))
      } else if (p.phase === "apex") {
        const apexProg = Math.min(1, (t - apexT) / 0.05)
        width = config.maxWidth * 0.9 + config.maxWidth * 0.15 * Math.sin(apexProg * Math.PI)
      } else {
        const fallT = Math.min(1, (t - apexT - 0.05) / Math.max(0.01, 1.0 - apexT - 0.05))
        width = config.maxWidth * 0.9 * Math.pow(1 - fallT, 1.8)
      }
      width = Math.max(2, width)

      // Warmth
      let warmth: number
      const warmStart = config.warmthStart
      if (t < 0.06) {
        warmth = warmStart
      } else if (t < apexT) {
        warmth = warmStart * (1 - (t - 0.06) / (apexT - 0.06) * 0.4 * config.warmthDecay)
      } else {
        const postT = (t - apexT) / (1.0 - apexT)
        warmth = warmStart * Math.max(0, 0.6 - postT * 0.8 * config.warmthDecay)
      }
      warmth = Math.max(0, Math.min(1, warmth))

      // Opacity
      let opacity: number
      if (t < apexT) opacity = 0.92
      else {
        const postT = (t - apexT) / (1.0 - apexT)
        opacity = Math.max(0.04, 0.92 - postT * 0.88)
      }

      // Gaps
      if (t > apexT + 0.06) {
        const gn = gapNoise(p.x + config.seedOffset, p.y) * 0.5 + 0.5
        const postT = (t - apexT - 0.06) / Math.max(0.01, 1.0 - apexT - 0.06)
        if (gn < postT * 0.5) continue
      }

      if (p.x < -width || p.x >= W + width || p.y < -width || p.y >= H + width) continue

      const margin = Math.ceil(width * 1.4)
      const minX = Math.max(0, Math.floor(p.x - margin))
      const maxX = Math.min(W - 1, Math.ceil(p.x + margin))
      const minY = Math.max(0, Math.floor(p.y - margin))
      const maxY = Math.min(H - 1, Math.ceil(p.y + margin))

      for (let ry = minY; ry <= maxY; ry++) {
        for (let rx = minX; rx <= maxX; rx++) {
          const dx = rx - p.x, dy = ry - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          const en1 = edgeNoise1(rx + config.seedOffset * 7, ry)
          const en2 = edgeNoise2(rx + config.seedOffset * 3, ry)
          // Confident stroke has a clean edge; fraying belongs to failure.
          const failFrac = p.phase === "fall" ? Math.min(1, (t - apexT) / Math.max(0.01, 1 - apexT)) : 0
          const edgeWarp = (en1 * 0.4 + en2 * 0.3) * (0.05 + failFrac * 0.65)
          const effWidth = width * (1.0 + edgeWarp)

          if (dist > effWidth) continue

          // Sharper brush-like falloff
          const nd = dist / effWidth
          let falloff: number
          if (nd < 0.72) falloff = 1.0
          else falloff = Math.max(0, 1.0 - ((nd - 0.72) / 0.28) ** 2)

          // Dry brush
          if (t > apexT + 0.04) {
            const dryT = (t - apexT - 0.04) / Math.max(0.01, 1.0 - apexT - 0.04)
            const dn = dryNoise(rx + config.seedOffset, ry) * 0.5 + 0.5
            if (dn < dryT * 0.5) continue
            const bn = bristleNoise(rx + config.seedOffset * 5, ry) * 0.5 + 0.5
            if (bn < dryT * 0.2) falloff *= 0.3
          }

          const inkAmount = falloff * opacity
          const idx = ry * W + rx
          if (inkAmount > inkBuffer[idx]) {
            inkBuffer[idx] = inkAmount
            const cn = colorNoise(rx, ry) * 0.5 + 0.5
            warmBuffer[idx] = Math.max(0, Math.min(1, warmth + (cn - 0.5) * 0.12 * warmth))
          }
        }
      }
    }
  }

  // === Falling ash below each failing trail ===
  // Fine granular particles shed from the fall phase of every mark: dense
  // just under the trail, sparse further down, drifting slightly with the
  // stroke's direction of travel. Detail that rewards close looking.
  for (const mark of allMarks) {
    const apexT = mark.apexIdx / mark.points.length
    const fallPoints = mark.points.filter((p) => p.phase === "fall")
    const particleCount = Math.floor(fallPoints.length * 2.2)
    for (let i = 0; i < particleCount; i++) {
      const pp = fallPoints[Math.floor(rand() * fallPoints.length)]
      if (!pp) continue
      const fallT = Math.min(1, (pp.t - apexT) / Math.max(0.01, 1 - apexT))
      // Later in the failure, more shedding, falling further
      const fallDist = (10 + rand() * rand() * 380) * (0.4 + fallT * 0.9)
      const drift = (rand() - 0.5) * 40 + fallDist * 0.12
      const fx = pp.x + drift
      const fy = pp.y + fallDist
      if (fx < 0 || fx >= W || fy < 0 || fy >= H) continue

      const nearness = Math.max(0.05, 1.0 - fallDist / 420)
      const size = 0.8 + rand() * 2.6 * nearness
      const warmth = mark.config.warmthStart * 0.25 * nearness
      const opacity = Math.max(0.05, (0.14 + rand() * 0.30) * nearness)

      const ir = Math.ceil(size + 1)
      for (let ry = Math.max(0, Math.floor(fy - ir)); ry < Math.min(H, Math.ceil(fy + ir)); ry++) {
        for (let rx = Math.max(0, Math.floor(fx - ir)); rx < Math.min(W, Math.ceil(fx + ir)); rx++) {
          const dx = rx - fx, dy = ry - fy
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < size) {
            const falloff = 1.0 - dist / size
            const inkAmount = falloff * opacity
            const idx = ry * W + rx
            if (inkAmount > inkBuffer[idx]) {
              inkBuffer[idx] = inkAmount
              warmBuffer[idx] = warmth
            }
          }
        }
      }
    }
  }

  console.log("  Final render...")

  // === Final render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkBuffer[idx]
      const warmth = warmBuffer[idx]

      const bn = bgNoise1(x, y) * 0.6 + bgNoise2(x, y) * 0.4 + 0.5
      let bgR = 236 + bn * 5
      let bgG = 228 + bn * 4
      let bgB = 220 + bn * 3

      if (ink < 0.003) {
        rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, bgR)))
        rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, bgG)))
        rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, bgB)))
        rgba[idx * 4 + 3] = 255
        continue
      }

      // Near-black warm umber → ash grey. The strong stroke reads as black
      // mass with a warm cast; warmth draining shows as the cast going cold,
      // not as the pigment thinning. Contrast is the point (two blind reads
      // named its absence).
      const warmR = 52 + warmth * 26
      const warmG = 26 + warmth * 12
      const warmB = 12 + warmth * 6
      const coldR = 96
      const coldG = 91
      const coldB = 87

      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.65)
      const r = bgR * (1 - opacity) + inkR * opacity
      const g = bgG * (1 - opacity) + inkG * opacity
      const b = bgB * (1 - opacity) + inkB * opacity

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/sadness-v32-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
