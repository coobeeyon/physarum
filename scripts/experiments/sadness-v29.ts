/**
 * SADNESS v29 — FAILING REACH (proportioned)
 *
 * Fixes from v28:
 * - Apex ALWAYS on-canvas (y ≈ 15-25% from top)
 * - Much more of the visible mark in the dissolution phase (40%+)
 * - Warmth drains EARLY (starting at 15% of path, not 50%)
 * - Width pooling at apex (hesitation) then dramatic narrowing
 * - More trembling after apex — the mark STAGGERS, doesn't smoothly curve
 * - Larger, more visible fragments below the droop
 * - The post-apex section is LONG — the majority of the visible mark
 * - The overall impression should be: a brief confident start, then a long slow failure
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

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 29001, b: 29002, c: 29003, d: 29004, e: 29005 }
  const seed = seeds[variant] ?? 29001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v29 variant ${variant} (seed: ${seed}) ===`)

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
  const tremorNoise1 = makeNoise(seed + 240, 35)
  const tremorNoise2 = makeNoise(seed + 245, 10)
  const tremorNoise3 = makeNoise(seed + 248, 55)  // large-scale wobble

  // === Physics-based trajectory ===
  // Start from bottom-left, entering from off-canvas
  const startX = W * (0.15 + rand() * 0.12)
  const startY = H + 30  // just below bottom edge

  // Lower initial velocity — apex should be at ~H*0.20
  let vx = 1.8 + rand() * 1.5
  let vy = -(10 + rand() * 2.5)  // less upward force than v28

  const gravity = 0.020 + rand() * 0.006
  const drag = 0.997
  const windX = 0.006 + rand() * 0.005

  interface PathPoint {
    x: number; y: number; t: number
    speed: number; angle: number
    phase: "rise" | "apex" | "fall"
  }
  const pathPoints: PathPoint[] = []
  const MAX_STEPS = 1500  // more steps for longer droop

  let px = startX, py = startY
  let curVx = vx, curVy = vy
  let foundApex = false
  let apexStep = 0

  for (let step = 0; step < MAX_STEPS; step++) {
    const speed = Math.sqrt(curVx * curVx + curVy * curVy)
    const angle = Math.atan2(curVy, curVx)

    // Determine phase
    let phase: "rise" | "apex" | "fall"
    if (!foundApex) {
      if (curVy >= -0.5) {  // velocity nearly zero = approaching apex
        foundApex = true
        apexStep = step
        phase = "apex"
      } else {
        phase = "rise"
      }
    } else if (step < apexStep + 80) {
      phase = "apex"  // linger at apex for ~80 steps
    } else {
      phase = "fall"
    }

    // Trembling — MUCH more after apex
    let tremorAmp: number
    if (phase === "rise") {
      tremorAmp = 0.5 + (step / MAX_STEPS) * 3
    } else if (phase === "apex") {
      tremorAmp = 5 + (step - apexStep) * 0.15  // grows during hesitation
    } else {
      const fallProgress = (step - apexStep - 80) / (MAX_STEPS - apexStep - 80)
      tremorAmp = 8 + fallProgress * 25  // heavy staggering
    }

    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)
    const tr1 = tremorNoise1(px, py) * tremorAmp * 0.5
    const tr2 = tremorNoise2(px, py) * tremorAmp * 0.3
    const tr3 = tremorNoise3(px, py) * tremorAmp * 0.2  // large wobble

    // Physics
    curVy += gravity
    curVx += windX
    curVx *= drag
    curVy *= drag

    // At apex, add random stalling — the mark hesitates
    if (phase === "apex") {
      curVx *= 0.97  // extra damping
      curVy *= 0.97
    }

    px += curVx + perpX * (tr1 + tr2 + tr3)
    py += curVy + perpY * (tr1 + tr2 + tr3)

    pathPoints.push({ x: px, y: py, t: step / MAX_STEPS, speed, angle, phase })

    // Stop conditions
    if (py > H * 1.15 && curVy > 0) break
    if (px > W * 1.1) break
    if (px < -W * 0.1) break
  }

  const totalSteps = pathPoints.length
  // Re-normalize t
  for (let i = 0; i < totalSteps; i++) pathPoints[i].t = i / totalSteps

  // Find actual apex
  let highestY = Infinity, highestIdx = 0
  for (let i = 0; i < totalSteps; i++) {
    if (pathPoints[i].y < highestY) {
      highestY = pathPoints[i].y
      highestIdx = i
    }
  }
  const apexT = highestIdx / totalSteps

  console.log(`  ${totalSteps} path points`)
  console.log(`  Apex: (${Math.round(pathPoints[highestIdx].x)}, ${Math.round(highestY)}) at t=${apexT.toFixed(2)}`)

  // === Properties ===
  function getWidth(t: number, speed: number, phase: string): number {
    if (t < 0.03) return 70 + 120 * (t / 0.03)  // entering canvas: 70→190
    if (phase === "rise") return 190 - 20 * ((t - 0.03) / Math.max(0.01, apexT - 0.03))  // 190→170
    if (phase === "apex") {
      // Pool wider at apex (hesitation)
      const apexProgress = Math.min(1, (t - apexT) / 0.06)
      return 170 + 30 * Math.sin(apexProgress * Math.PI)  // bulges to 200
    }
    // Fall phase — rapid narrowing
    const fallT = (t - apexT - 0.06) / Math.max(0.01, 1.0 - apexT - 0.06)
    const fallWidth = 170 * Math.pow(1 - Math.min(1, fallT), 2.0)  // quadratic decay
    // Speed-based thinning
    const speedThin = Math.max(0.5, 1.0 - speed / 15 * 0.3)
    return Math.max(2, fallWidth * speedThin)
  }

  function getWarmth(t: number): number {
    // KEY CHANGE: warmth starts draining EARLY
    if (t < 0.08) return 1.0  // only brief confident warmth
    if (t < apexT) {
      // Warmth fading during the rise — already losing color before apex
      return 1.0 - (t - 0.08) / (apexT - 0.08) * 0.55  // 1.0→0.45 by apex
    }
    // Post-apex: rapid drain
    const postT = (t - apexT) / (1.0 - apexT)
    return Math.max(0.0, 0.45 * (1 - postT * 1.2))  // 0.45→0
  }

  function getOpacity(t: number): number {
    if (t < apexT) return 0.95
    const postT = (t - apexT) / (1.0 - apexT)
    return Math.max(0.04, 0.95 - postT * 0.91)
  }

  // === Render ===
  const inkBuffer = new Float32Array(W * H)
  const warmBuffer = new Float32Array(W * H)

  console.log("  Rendering gesture...")

  for (let i = 0; i < totalSteps; i++) {
    const p = pathPoints[i]
    const t = p.t
    const width = getWidth(t, p.speed, p.phase)
    const warmth = getWarmth(t)
    const opacity = getOpacity(t)

    // Gaps in the mark (after apex + some margin)
    if (t > apexT + 0.08) {
      const gn = gapNoise(p.x, p.y) * 0.5 + 0.5
      const postT = (t - apexT - 0.08) / Math.max(0.01, 1.0 - apexT - 0.08)
      if (gn < postT * 0.55) continue
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

        // Edge noise for ragged brush edges
        const en1 = edgeNoise1(rx, ry)
        const en2 = edgeNoise2(rx, ry)
        const edgeWarp = (en1 * 0.4 + en2 * 0.3) * (0.15 + t * 0.5)
        const effWidth = width * (1.0 + edgeWarp)

        if (dist > effWidth) continue

        // Sharp brush-like falloff
        const nd = dist / effWidth
        let falloff: number
        if (nd < 0.65) {
          falloff = 1.0  // solid core
        } else {
          falloff = 1.0 - ((nd - 0.65) / 0.35) ** 1.5
        }

        // Dry brush after some point past apex
        if (t > apexT + 0.05) {
          const dryT = (t - apexT - 0.05) / Math.max(0.01, 1.0 - apexT - 0.05)
          const dn = dryNoise(rx, ry) * 0.5 + 0.5
          if (dn < dryT * 0.55) continue
          const bn = bristleNoise(rx, ry) * 0.5 + 0.5
          if (bn < dryT * 0.25) falloff *= 0.25
        }

        const inkAmount = falloff * opacity
        const idx = ry * W + rx
        if (inkAmount > inkBuffer[idx]) {
          inkBuffer[idx] = inkAmount
          const cn = colorNoise(rx, ry) * 0.5 + 0.5
          warmBuffer[idx] = Math.max(0, Math.min(1, warmth + (cn - 0.5) * 0.15 * warmth))
        }
      }
    }

    if (i % 300 === 0) process.stdout.write(".")
  }
  console.log("")

  // === Fragments ===
  const fragments: Array<{ x: number; y: number; size: number; warmth: number; opacity: number }> = []
  const numFragments = 18 + Math.floor(rand() * 10)

  for (let i = 0; i < numFragments; i++) {
    const pathFrac = apexT + 0.02 + rand() * (1 - apexT - 0.02)
    const pathIdx = Math.min(Math.floor(pathFrac * totalSteps), totalSteps - 1)
    const pp = pathPoints[pathIdx]

    const fallDist = 30 + rand() * 250
    const drift = (rand() - 0.5) * 150

    const fx = pp.x + drift
    const fy = pp.y + fallDist * (0.3 + rand() * 0.7)

    if (fx < 0 || fx >= W || fy < 0 || fy >= H) continue

    const distFactor = Math.max(0.08, 1.0 - fallDist / 300)
    fragments.push({
      x: fx, y: fy,
      size: (15 + rand() * 45) * distFactor,
      warmth: getWarmth(pathFrac) * distFactor * 0.5,
      opacity: Math.max(0.04, 0.35 * distFactor),
    })
  }

  for (const frag of fragments) {
    const ir = Math.ceil(frag.size * 1.5)
    for (let ry = Math.max(0, Math.floor(frag.y - ir)); ry < Math.min(H, Math.ceil(frag.y + ir)); ry++) {
      for (let rx = Math.max(0, Math.floor(frag.x - ir)); rx < Math.min(W, Math.ceil(frag.x + ir)); rx++) {
        const dx = rx - frag.x, dy = ry - frag.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const fn = fragNoise(rx, ry) * 0.35
        const effSize = frag.size * (1.0 + fn)
        if (dist < effSize) {
          const falloff = 1.0 - dist / effSize
          const inkAmount = falloff * falloff * frag.opacity
          const idx = ry * W + rx
          if (inkAmount > inkBuffer[idx]) {
            inkBuffer[idx] = inkAmount
            warmBuffer[idx] = frag.warmth
          }
        }
      }
    }
  }

  // === Drip trails from the thick/warm section ===
  const numDrips = 5 + Math.floor(rand() * 4)
  const dripWander = makeNoise(seed + 600, 22)

  for (let d = 0; d < numDrips; d++) {
    const pathFrac = 0.03 + rand() * (apexT - 0.03)
    const pathIdx = Math.min(Math.floor(pathFrac * totalSteps), totalSteps - 1)
    const pp = pathPoints[pathIdx]
    const w = getWidth(pathFrac, pp.speed, pp.phase)

    const dripX = pp.x + (rand() - 0.5) * w * 0.5
    const dripStartY = pp.y + w * 0.3
    const dripLen = H * (0.06 + rand() * 0.18)
    const dripEndY = Math.min(H, dripStartY + dripLen)
    const dripWidth = 1.5 + rand() * 3.5
    const dripOpacity = 0.06 + rand() * 0.12

    for (let y = Math.max(0, Math.floor(dripStartY)); y < Math.ceil(dripEndY); y++) {
      const dt = (y - dripStartY) / (dripEndY - dripStartY)
      const wx = dripWander(dripX, y) * 5
      const w2 = dripWidth * (1.0 - dt * 0.6)
      const op = dripOpacity * (1.0 - dt * dt)

      for (let x = Math.max(0, Math.floor(dripX + wx - w2 * 2)); x < Math.min(W, Math.ceil(dripX + wx + w2 * 2)); x++) {
        const ddx = Math.abs(x - dripX - wx)
        if (ddx < w2) {
          const falloff = 1.0 - ddx / w2
          const inkAmount = falloff * op
          const idx = y * W + x
          inkBuffer[idx] = Math.min(1.0, inkBuffer[idx] + inkAmount * 0.3)
          const dripWarmth = getWarmth(pathFrac) * (1 - dt) * 0.5
          if (warmBuffer[idx] < dripWarmth) warmBuffer[idx] = dripWarmth
        }
      }
    }
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips`)
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

      // Warm amber → grey
      const warmR = 150 + warmth * 18
      const warmG = 72 + warmth * 10
      const warmB = 24 + warmth * 5
      const coldR = 150
      const coldG = 143
      const coldB = 138

      const inkR = warmR * warmth + coldR * (1 - warmth)
      const inkG = warmG * warmth + coldG * (1 - warmth)
      const inkB = warmB * warmth + coldB * (1 - warmth)

      const opacity = Math.min(1.0, ink * 1.4)
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

  const filename = `output/sadness-v29-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
