/**
 * SADNESS v28 — FAILING REACH (physics-based)
 *
 * Fixes from v27:
 * - MUCH LARGER: mark fills 50%+ of canvas, starts from bottom edge
 * - PHYSICS trajectory: real gravity vs upward force creates struggling arc
 * - SHARPER edges: brush-like with noise threshold, not smooth falloff
 * - DRAMATIC droop: gravity wins, mark plunges down
 * - HESITATION at apex: mark pools/thickens where velocity → 0
 * - More visible fragments, drip trails
 * - Deeper ink contrast (darker against cream)
 *
 * The physics creates an organic, struggling feel vs v27's smooth bezier.
 * The mark fights to rise, stalls, and falls. That IS the sadness.
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
  const seeds: Record<string, number> = { a: 28001, b: 28002, c: 28003, d: 28004, e: 28005 }
  const seed = seeds[variant] ?? 28001
  const rand = makePRNG(seed)

  console.log(`=== SADNESS v28 variant ${variant} (seed: ${seed}) ===`)

  // Noise generators
  const bgNoise1 = makeNoise(seed + 100, 400)
  const bgNoise2 = makeNoise(seed + 110, 120)
  const edgeNoise1 = makeNoise(seed + 200, 10)
  const edgeNoise2 = makeNoise(seed + 210, 30)
  const dryNoise = makeNoise(seed + 220, 3)
  const gapNoise = makeNoise(seed + 230, 15)
  const colorNoise = makeNoise(seed + 300, 60)
  const fragNoise = makeNoise(seed + 400, 18)
  const bristleNoise = makeNoise(seed + 500, 2.5)  // bristle tracks

  // === Physics-based trajectory ===
  // Start from bottom edge, slightly left of center
  let px = W * (0.20 + rand() * 0.15)
  let py = H + 20  // starts just off bottom edge

  // Initial velocity: strong upward, slight rightward
  let vx = 2.5 + rand() * 2.0       // rightward drift
  let vy = -(14 + rand() * 3)        // strong upward (negative = up)

  const gravity = 0.028 + rand() * 0.008  // pulls down
  const drag = 0.997                       // slight air resistance
  const windX = 0.008 + rand() * 0.006    // slight rightward drift

  interface PathPoint {
    x: number; y: number; t: number
    speed: number; angle: number
  }
  const pathPoints: PathPoint[] = []
  const MAX_STEPS = 1200

  // Find the apex (where vy crosses zero) for t normalization
  let apexStep = MAX_STEPS
  let simVy = vy

  for (let step = 0; step < MAX_STEPS; step++) {
    const prevVy = simVy
    simVy += gravity
    simVy *= drag
    if (prevVy < 0 && simVy >= 0) {
      apexStep = step
      break
    }
  }

  // Now simulate for real with trembling
  const tremorNoise1 = makeNoise(seed + 240, 35)
  const tremorNoise2 = makeNoise(seed + 245, 12)

  px = W * (0.20 + rand() * 0.15)
  py = H + 20
  vx = 2.5 + rand() * 2.0
  vy = -(14 + rand() * 3)

  for (let step = 0; step < MAX_STEPS; step++) {
    // Normalized time (0 at start, ~0.5 at apex, 1 at end)
    const t = step / MAX_STEPS

    // Physics
    vy += gravity
    vx += windX
    vx *= drag
    vy *= drag

    // Trembling increases with time (fatigue)
    const speed = Math.sqrt(vx * vx + vy * vy)
    const angle = Math.atan2(vy, vx)
    const perpX = -Math.sin(angle)
    const perpY = Math.cos(angle)

    const tremorAmp = 0.5 + t * t * 8.0  // grows from 0.5 to 8.5px
    const tr = (tremorNoise1(px, py) * 0.7 + tremorNoise2(px, py) * 0.3) * tremorAmp

    px += vx + perpX * tr
    py += vy + perpY * tr

    pathPoints.push({ x: px, y: py, t, speed, angle })

    // Stop if mark has gone below the canvas and is moving down
    if (py > H * 1.1 && vy > 0) break
    // Stop if mark has left the canvas on the right
    if (px > W * 1.05) break
  }

  const totalSteps = pathPoints.length
  console.log(`  ${totalSteps} path points, apex at step ~${apexStep}`)
  console.log(`  Start: (${Math.round(pathPoints[0].x)}, ${Math.round(pathPoints[0].y)})`)

  // Find actual apex (highest point)
  let highestY = Infinity, highestIdx = 0
  for (let i = 0; i < pathPoints.length; i++) {
    if (pathPoints[i].y < highestY) {
      highestY = pathPoints[i].y
      highestIdx = i
    }
  }
  console.log(`  Apex: (${Math.round(pathPoints[highestIdx].x)}, ${Math.round(highestY)}) at step ${highestIdx}`)

  // Re-normalize t based on actual path length
  for (let i = 0; i < pathPoints.length; i++) {
    pathPoints[i].t = i / pathPoints.length
  }

  // === Properties along the path ===
  function getWidth(t: number, speed: number): number {
    const apexT = highestIdx / totalSteps

    // Width based on phase
    let baseWidth: number
    if (t < 0.05) {
      baseWidth = 140 + 110 * (t / 0.05)  // 140→250 (building up from edge)
    } else if (t < apexT * 0.8) {
      baseWidth = 250 - 40 * ((t - 0.05) / (apexT * 0.8 - 0.05))  // 250→210 (slight narrowing during rise)
    } else if (t < apexT * 1.2) {
      // HESITATION at apex — mark pools wider
      const apexProximity = 1.0 - Math.abs(t - apexT) / (apexT * 0.2)
      baseWidth = 210 + apexProximity * 50  // pools to 260
    } else if (t < apexT * 1.2 + 0.15) {
      baseWidth = 210 * (1 - (t - apexT * 1.2) / 0.15 * 0.5)  // 210→105
    } else if (t < 0.85) {
      const tLocal = (t - (apexT * 1.2 + 0.15)) / (0.85 - (apexT * 1.2 + 0.15))
      baseWidth = 105 * (1 - tLocal * 0.75)  // 105→26
    } else {
      baseWidth = Math.max(3, 26 * (1 - (t - 0.85) / 0.15 * 0.88))  // 26→3
    }

    // Speed-dependent thinning (faster = thinner, like real brush)
    const speedThin = Math.max(0.6, 1.0 - speed / 18 * 0.3)
    return baseWidth * speedThin
  }

  function getWarmth(t: number): number {
    const apexT = highestIdx / totalSteps
    if (t < apexT * 0.7) return 1.0
    if (t < apexT * 1.2) {
      return 1.0 - (t - apexT * 0.7) / (apexT * 0.5) * 0.4  // 1.0→0.6
    }
    const postApex = (t - apexT * 1.2) / (1.0 - apexT * 1.2)
    return Math.max(0.0, 0.6 - postApex * 0.6)  // 0.6→0
  }

  function getOpacity(t: number): number {
    const apexT = highestIdx / totalSteps
    if (t < apexT) return 0.95
    const postApex = (t - apexT) / (1.0 - apexT)
    return Math.max(0.05, 0.95 - postApex * 0.90)
  }

  // === Render into ink buffer ===
  const inkBuffer = new Float32Array(W * H)
  const warmBuffer = new Float32Array(W * H)

  console.log("  Rendering gesture...")

  for (let i = 0; i < pathPoints.length; i++) {
    const p = pathPoints[i]
    const t = p.t
    const width = getWidth(t, p.speed)
    const warmth = getWarmth(t)
    const opacity = getOpacity(t)

    // Gaps in the mark (after apex)
    const apexT = highestIdx / totalSteps
    if (t > apexT + 0.15) {
      const gn = gapNoise(p.x, p.y) * 0.5 + 0.5
      const postApexT = (t - apexT - 0.15) / (1.0 - apexT - 0.15)
      if (gn < postApexT * 0.5) continue
    }

    const margin = Math.ceil(width * 1.4)
    const minX = Math.max(0, Math.floor(p.x - margin))
    const maxX = Math.min(W - 1, Math.ceil(p.x + margin))
    const minY = Math.max(0, Math.floor(p.y - margin))
    const maxY = Math.min(H - 1, Math.ceil(p.y + margin))

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px - p.x, dy = py - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Edge: noise-based threshold for sharper, more brush-like edges
        const en1 = edgeNoise1(px, py)
        const en2 = edgeNoise2(px, py)
        const edgeWarp = (en1 * 0.5 + en2 * 0.3) * (0.2 + t * 0.5)
        const effWidth = width * (1.0 + edgeWarp)

        if (dist > effWidth) continue

        // Sharper falloff — more brush-like
        const normalizedDist = dist / effWidth
        // Step-ish function: solid in center, sharp drop at edge
        let falloff: number
        if (normalizedDist < 0.7) {
          falloff = 1.0  // solid core
        } else {
          falloff = 1.0 - ((normalizedDist - 0.7) / 0.3) * ((normalizedDist - 0.7) / 0.3)
        }

        // Dry brush effect after halfway point past apex
        const apexFrac = highestIdx / totalSteps
        if (t > apexFrac + 0.10) {
          const dryT = (t - apexFrac - 0.10) / (1.0 - apexFrac - 0.10)
          const dn = dryNoise(px, py) * 0.5 + 0.5
          if (dn < dryT * 0.6) continue  // striation gap

          // Bristle tracks
          const bn = bristleNoise(px, py) * 0.5 + 0.5
          if (bn < dryT * 0.3) falloff *= 0.3
        }

        const inkAmount = falloff * opacity

        const idx = py * W + px
        if (inkAmount > inkBuffer[idx]) {
          inkBuffer[idx] = inkAmount

          // Warmth with internal color variation
          const cn = colorNoise(px, py) * 0.5 + 0.5
          const localWarmth = Math.max(0, Math.min(1, warmth + (cn - 0.5) * 0.2 * warmth))
          warmBuffer[idx] = localWarmth
        }
      }
    }

    if (i % 200 === 0) process.stdout.write(".")
  }
  console.log("")

  // === Fragments below the droop ===
  const fragments: Array<{ x: number; y: number; size: number; warmth: number; opacity: number }> = []
  const numFragments = 15 + Math.floor(rand() * 10)

  for (let i = 0; i < numFragments; i++) {
    // Sample a point from the later part of the path
    const pathFrac = (highestIdx / totalSteps) + 0.05 + rand() * 0.50
    const pathIdx = Math.min(Math.floor(pathFrac * totalSteps), totalSteps - 1)
    const pp = pathPoints[pathIdx]

    // Fragment falls below/beside the path
    const fallDist = 40 + rand() * 300
    const drift = (rand() - 0.5) * 120

    const fx = pp.x + drift
    const fy = pp.y + fallDist * (0.5 + rand() * 0.5) // mostly downward

    if (fx < 0 || fx >= W || fy < 0 || fy >= H) continue

    const distFactor = Math.max(0.08, 1.0 - fallDist / 350)
    fragments.push({
      x: fx, y: fy,
      size: (12 + rand() * 40) * distFactor,
      warmth: getWarmth(pathFrac) * distFactor * 0.6,
      opacity: Math.max(0.04, 0.40 * distFactor),
    })
  }

  // Render fragments
  for (const frag of fragments) {
    const ir = Math.ceil(frag.size * 1.5)
    for (let py = Math.max(0, Math.floor(frag.y - ir)); py < Math.min(H, Math.ceil(frag.y + ir)); py++) {
      for (let px = Math.max(0, Math.floor(frag.x - ir)); px < Math.min(W, Math.ceil(frag.x + ir)); px++) {
        const dx = px - frag.x, dy = py - frag.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const fn = fragNoise(px, py) * 0.35
        const effSize = frag.size * (1.0 + fn)
        if (dist < effSize) {
          const falloff = 1.0 - dist / effSize
          const inkAmount = falloff * falloff * frag.opacity
          const idx = py * W + px
          if (inkAmount > inkBuffer[idx]) {
            inkBuffer[idx] = inkAmount
            warmBuffer[idx] = frag.warmth
          }
        }
      }
    }
  }

  // === Drip trails from the thickest/warmest section ===
  const numDrips = 6 + Math.floor(rand() * 5)
  const dripWander = makeNoise(seed + 600, 22)

  for (let d = 0; d < numDrips; d++) {
    // Drips from the early section (still rising, thick and warm)
    const pathFrac = 0.03 + rand() * 0.35
    const pathIdx = Math.min(Math.floor(pathFrac * totalSteps), totalSteps - 1)
    const pp = pathPoints[pathIdx]
    const w = getWidth(pathFrac, pp.speed)

    const dripX = pp.x + (rand() - 0.5) * w * 0.5
    const dripStartY = pp.y + w * 0.3
    const dripLen = H * (0.06 + rand() * 0.20)
    const dripEndY = Math.min(H, dripStartY + dripLen)
    const dripWidth = 1.5 + rand() * 3.5
    const dripOpacity = 0.06 + rand() * 0.12
    const dripWarmth = 0.5 + rand() * 0.3

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
          const warmVal = dripWarmth * (1 - dt)
          if (warmBuffer[idx] < warmVal) warmBuffer[idx] = warmVal
        }
      }
    }
  }

  console.log(`  ${numFragments} fragments, ${numDrips} drips`)
  console.log("  Final render...")

  // === Final pixel render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const ink = inkBuffer[idx]
      const warmth = warmBuffer[idx]

      // Background: warm cream
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

      // Warm ink: rich amber-brown (darker than v27 for more contrast)
      const warmR = 145 + warmth * 20
      const warmG = 68 + warmth * 12
      const warmB = 22 + warmth * 5
      // Cold ink: warm grey
      const coldR = 145
      const coldG = 138
      const coldB = 134

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

  const filename = `output/sadness-v28-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  -> ${filename}`)
}

main()
