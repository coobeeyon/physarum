/**
 * ANGER v11 — ERUPTION
 *
 * Previous approaches: scratches (reads as bark), noise-tears (reads as hole),
 * dense marks (reads as thorns). All texture-based. All decorative.
 *
 * New approach: something PUNCHES THROUGH a beautiful surface from behind.
 * The surface buckles, cracks radiate, material flies. The violence is
 * directional and physical, not a noise function. You can feel the FORCE.
 *
 * The intact beauty around the impacts makes the destruction worse.
 * You can see what it WAS. That's what makes it anger, not just damage.
 *
 * Key differences from v7-v10:
 * - DIRECTIONAL force (impacts from behind, not random tears)
 * - Radial crack patterns (from impact points, not noise-shaped)
 * - Displaced material (pushed outward from impacts, with real physics)
 * - Multiple impacts at different scales (not uniform)
 * - The surface WARPS around impacts (deformation, not just removal)
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

interface Impact {
  x: number
  y: number
  radius: number      // size of the crater
  force: number       // how much it pushes outward (0-1)
  crackCount: number  // number of radial cracks
  crackAngles: number[]
  crackLengths: number[]
}

async function main() {
  const variant = process.argv[2] || "a"
  const seeds: Record<string, number> = { a: 11101, b: 11102, c: 11103, d: 11104 }
  const seed = seeds[variant] ?? 11101
  const rand = makePRNG(seed)

  console.log(`=== ANGER v11 variant ${variant} (seed: ${seed}) ===`)

  // Noise layers
  const n1 = makeNoise(seed, 200)
  const n2 = makeNoise(seed + 10, 80)
  const n3 = makeNoise(seed + 20, 35)
  const n4 = makeNoise(seed + 30, 15)
  const n5 = makeNoise(seed + 40, 500)
  const crackNoise = makeNoise(seed + 100, 20)
  const crackNoise2 = makeNoise(seed + 110, 8)
  const edgeNoise = makeNoise(seed + 200, 40)
  const microNoise = makeNoise(seed + 300, 6)

  // Beautiful warm surface texture
  const warmLayer = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ridge1 = 1.0 - Math.abs(n2(x, y)) * 2.0
      const ridge2 = 1.0 - Math.abs(n3(x, y)) * 2.0
      const ridge3 = 1.0 - Math.abs(n4(x, y)) * 2.0
      const base = n1(x, y) * 0.5 + 0.5
      const texture = ridge1 * 0.35 + ridge2 * 0.30 + ridge3 * 0.15 + base * 0.20
      warmLayer[y * W + x] = Math.max(0, Math.min(1, texture))
    }
  }

  // Generate impacts — 1 primary + 2-4 secondary
  const impacts: Impact[] = []

  // Primary impact: off-center, large
  const primaryX = W * (0.38 + rand() * 0.24)
  const primaryY = H * (0.33 + rand() * 0.28)
  const primaryR = W * (0.10 + rand() * 0.06)
  const primaryCracks = 7 + Math.floor(rand() * 5)
  const primaryAngles: number[] = []
  const primaryLengths: number[] = []
  // Radial cracks from impact — not evenly spaced, slightly irregular
  for (let i = 0; i < primaryCracks; i++) {
    const baseAngle = (i / primaryCracks) * Math.PI * 2
    primaryAngles.push(baseAngle + (rand() - 0.5) * 0.6)
    primaryLengths.push(primaryR * (1.5 + rand() * 3.5))
  }
  impacts.push({
    x: primaryX, y: primaryY,
    radius: primaryR, force: 0.95,
    crackCount: primaryCracks,
    crackAngles: primaryAngles,
    crackLengths: primaryLengths,
  })

  // Secondary impacts: smaller, scattered
  const secCount = 2 + Math.floor(rand() * 3)
  for (let i = 0; i < secCount; i++) {
    const ix = W * (0.15 + rand() * 0.70)
    const iy = H * (0.15 + rand() * 0.70)
    const ir = W * (0.03 + rand() * 0.04)
    const nc = 4 + Math.floor(rand() * 4)
    const angles: number[] = []
    const lengths: number[] = []
    for (let j = 0; j < nc; j++) {
      angles.push((j / nc) * Math.PI * 2 + (rand() - 0.5) * 0.8)
      lengths.push(ir * (1.2 + rand() * 2.5))
    }
    impacts.push({
      x: ix, y: iy,
      radius: ir, force: 0.6 + rand() * 0.3,
      crackCount: nc,
      crackAngles: angles,
      crackLengths: lengths,
    })
  }

  console.log(`  ${impacts.length} impacts (1 primary + ${secCount} secondary)`)

  // === Compute destruction/deformation maps ===
  const destructionMap = new Float32Array(W * H)  // 0=intact, 1=destroyed
  const deformX = new Float32Array(W * H)  // displacement X
  const deformY = new Float32Array(W * H)  // displacement Y
  const stressMap = new Float32Array(W * H) // edge stress/reddening
  const crackMap = new Float32Array(W * H)  // crack lines

  for (const impact of impacts) {
    // Crater: circular destruction zone at impact point
    const craterInner = impact.radius * 0.5
    const craterOuter = impact.radius * 1.0

    for (let py = Math.max(0, Math.floor(impact.y - impact.radius * 4));
         py < Math.min(H, Math.ceil(impact.y + impact.radius * 4)); py++) {
      for (let px = Math.max(0, Math.floor(impact.x - impact.radius * 4));
           px < Math.min(W, Math.ceil(impact.x + impact.radius * 4)); px++) {
        const dx = px - impact.x
        const dy = py - impact.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const idx = py * W + px

        // Noise-perturbed boundary
        const en = edgeNoise(px, py) * 0.3 + crackNoise(px, py) * 0.15
        const effInner = craterInner * (1.0 + en)
        const effOuter = craterOuter * (1.0 + en)

        if (dist < effOuter) {
          if (dist < effInner) {
            // Core: full destruction
            destructionMap[idx] = Math.min(1.0, destructionMap[idx] + impact.force)
          } else {
            // Transition zone
            const t = (dist - effInner) / (effOuter - effInner)
            const falloff = (1.0 - t) * (1.0 - t)
            destructionMap[idx] = Math.min(1.0, destructionMap[idx] + falloff * impact.force)
          }
        }

        // Deformation: push material OUTWARD from impact
        const deformRange = impact.radius * 3.0
        if (dist > 0 && dist < deformRange) {
          const pushStrength = Math.max(0, 1.0 - dist / deformRange)
          const push = pushStrength * pushStrength * impact.force * impact.radius * 0.4
          const angle = Math.atan2(dy, dx)
          deformX[idx] += Math.cos(angle) * push
          deformY[idx] += Math.sin(angle) * push
        }

        // Stress zone around crater
        const stressRange = impact.radius * 2.5
        if (dist > effInner && dist < stressRange) {
          const st = (dist - effInner) / (stressRange - effInner)
          stressMap[idx] = Math.min(1.0, stressMap[idx] + (1.0 - st) * impact.force * 0.6)
        }
      }
    }

    // Radial cracks from impact
    for (let c = 0; c < impact.crackCount; c++) {
      const angle = impact.crackAngles[c]
      const length = impact.crackLengths[c]
      const crackWidth = 2 + rand() * 5  // narrow

      // Walk along crack direction with noise perturbation
      const steps = Math.ceil(length / 2)
      let cx = impact.x + Math.cos(angle) * impact.radius * 0.6
      let cy = impact.y + Math.sin(angle) * impact.radius * 0.6
      let ca = angle

      for (let s = 0; s < steps; s++) {
        const progress = s / steps
        // Crack width varies: wider near impact, thinner at tips
        const localWidth = crackWidth * (1.0 - progress * 0.6)
        // Crack depth: stronger near impact
        const localDepth = impact.force * (1.0 - progress * 0.7)

        // Draw the crack point
        const ir = Math.ceil(localWidth * 3)
        for (let py = Math.max(0, Math.floor(cy - ir));
             py < Math.min(H, Math.ceil(cy + ir)); py++) {
          for (let px = Math.max(0, Math.floor(cx - ir));
               px < Math.min(W, Math.ceil(cx + ir)); px++) {
            const ddx = px - cx
            const ddy = py - cy
            const d = Math.sqrt(ddx * ddx + ddy * ddy)

            const en = crackNoise2(px, py) * 0.5
            const effW = localWidth * (1.0 + en)

            if (d < effW) {
              const idx = py * W + px
              const falloff = 1.0 - d / effW
              crackMap[idx] = Math.min(1.0, crackMap[idx] + falloff * localDepth)
              // Cracks also create stress around them
              stressMap[idx] = Math.min(1.0, stressMap[idx] + falloff * localDepth * 0.3)
            }

            // Stress halo around cracks
            if (d >= effW && d < effW * 4) {
              const idx = py * W + px
              const stressFalloff = 1.0 - (d - effW) / (effW * 3)
              stressMap[idx] = Math.min(1.0, stressMap[idx] + stressFalloff * localDepth * 0.15)
            }
          }
        }

        // Advance crack position with noise-based wandering
        const noiseDeflect = crackNoise(cx, cy) * 0.15
        ca += noiseDeflect
        cx += Math.cos(ca) * 2.5
        cy += Math.sin(ca) * 2.5

        // Branching: small probability of a fork
        if (rand() < 0.02 && progress > 0.3) {
          const branchAngle = ca + (rand() > 0.5 ? 1 : -1) * (0.4 + rand() * 0.6)
          const branchLength = (length - s * 2) * 0.4
          const branchSteps = Math.ceil(branchLength / 3)
          let bx = cx, by = cy, ba = branchAngle
          for (let bs = 0; bs < branchSteps; bs++) {
            const bp = bs / branchSteps
            const bw = localWidth * 0.5 * (1.0 - bp)
            const bd = localDepth * 0.5 * (1.0 - bp)
            const bir = Math.ceil(bw * 2)
            for (let bpy = Math.max(0, Math.floor(by - bir));
                 bpy < Math.min(H, Math.ceil(by + bir)); bpy++) {
              for (let bpx = Math.max(0, Math.floor(bx - bir));
                   bpx < Math.min(W, Math.ceil(bx + bir)); bpx++) {
                const bdx = bpx - bx
                const bdy = bpy - by
                const dd = Math.sqrt(bdx * bdx + bdy * bdy)
                if (dd < bw) {
                  const bidx = bpy * W + bpx
                  crackMap[bidx] = Math.min(1.0, crackMap[bidx] + (1.0 - dd / bw) * bd)
                }
              }
            }
            ba += crackNoise(bx, by) * 0.12
            bx += Math.cos(ba) * 3
            by += Math.sin(ba) * 3
          }
        }
      }
    }
  }

  // === Simulate debris/splatter from primary impact ===
  const debrisMap = new Float32Array(W * H)
  const primary = impacts[0]
  const debrisCount = 60 + Math.floor(rand() * 40)
  for (let d = 0; d < debrisCount; d++) {
    // Launch from near crater edge
    const launchAngle = rand() * Math.PI * 2
    const launchDist = primary.radius * (0.3 + rand() * 0.7)
    let dx = primary.x + Math.cos(launchAngle) * launchDist
    let dy = primary.y + Math.sin(launchAngle) * launchDist

    // Velocity: outward from impact
    const speed = 8 + rand() * 25
    let vx = Math.cos(launchAngle) * speed
    let vy = Math.sin(launchAngle) * speed

    // Simulate trajectory with drag
    const size = 3 + rand() * 12
    const trailSteps = 15 + Math.floor(rand() * 30)

    for (let s = 0; s < trailSteps; s++) {
      // Draw splat
      const currentSize = size * (1.0 - s / trailSteps * 0.7)
      const ir = Math.ceil(currentSize)
      for (let py = Math.max(0, Math.floor(dy - ir));
           py < Math.min(H, Math.ceil(dy + ir)); py++) {
        for (let px = Math.max(0, Math.floor(dx - ir));
             px < Math.min(W, Math.ceil(dx + ir)); px++) {
          const ddx = px - dx
          const ddy = py - dy
          const dd = Math.sqrt(ddx * ddx + ddy * ddy)
          if (dd < currentSize) {
            const idx = py * W + px
            debrisMap[idx] = Math.min(1.0, debrisMap[idx] + (1.0 - dd / currentSize) * 0.3)
          }
        }
      }

      dx += vx
      dy += vy
      vx *= 0.88  // drag
      vy *= 0.88
      vx += (rand() - 0.5) * 3
      vy += (rand() - 0.5) * 3
    }
  }

  console.log("  Rendering...")

  // === Final render ===
  const rgba = new Uint8ClampedArray(W * H * 4)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x

      // Apply deformation to sample point (where to read warmth from)
      const sampleX = Math.min(W - 1, Math.max(0, Math.round(x - deformX[idx])))
      const sampleY = Math.min(H - 1, Math.max(0, Math.round(y - deformY[idx])))
      const warmth = warmLayer[sampleY * W + sampleX]

      const destruction = destructionMap[idx]
      const crack = crackMap[idx]
      const stress = stressMap[idx]
      const debris = debrisMap[idx]
      const atm = n5(x, y) * 0.5 + 0.5

      // === Beautiful warm surface ===
      let r = 175 + warmth * 55 + atm * 12
      let g = 132 + warmth * 28 + atm * 8
      let b = 78 + warmth * 14 + atm * 4

      // Veins
      if (warmth > 0.52) {
        const veinT = (warmth - 0.52) / 0.48
        r += veinT * 30
        g += veinT * 12
        b -= veinT * 6
      }

      // === Stress: darkened, reddened areas around damage ===
      if (stress > 0.01) {
        const st = Math.min(1.0, stress)
        // Redden and darken
        r += st * 15   // push toward red
        g -= st * 45   // kill green
        b -= st * 50   // kill blue
        // Additional darkening at high stress
        if (st > 0.3) {
          const dark = (st - 0.3) / 0.7
          r -= dark * 40
          g -= dark * 25
          b -= dark * 15
        }
      }

      // === Cracks: dark lines cutting through ===
      if (crack > 0.05) {
        const ct = Math.min(1.0, crack * 1.3)
        const ctCurve = ct * ct
        // Dark void in cracks
        const crackR = 18 + microNoise(x, y) * 8
        const crackG = 15 + microNoise(x, y) * 6
        const crackB = 22 + microNoise(x, y) * 5
        r = r * (1 - ctCurve) + crackR * ctCurve
        g = g * (1 - ctCurve) + crackG * ctCurve
        b = b * (1 - ctCurve) + crackB * ctCurve
        // Red glow at crack edges
        if (ct > 0.1 && ct < 0.6) {
          const edgeGlow = 1.0 - Math.abs(ct - 0.35) / 0.25
          if (edgeGlow > 0) {
            r += edgeGlow * 60
            g -= edgeGlow * 10
          }
        }
      }

      // === Destruction: crater voids ===
      if (destruction > 0.1) {
        const dt = Math.min(1.0, destruction * 1.2)
        const dtCurve = dt * dt * dt  // sharp transition to void

        // The void: deep dark with subtle red at the edges
        const mn = microNoise(x, y) * 0.5 + 0.5
        const voidR = 12 + mn * 10
        const voidG = 10 + mn * 6
        const voidB = 16 + mn * 4

        r = r * (1 - dtCurve) + voidR * dtCurve
        g = g * (1 - dtCurve) + voidG * dtCurve
        b = b * (1 - dtCurve) + voidB * dtCurve

        // Red rim at the destruction boundary
        if (dt > 0.2 && dt < 0.7) {
          const rimStrength = 1.0 - Math.abs(dt - 0.45) / 0.25
          if (rimStrength > 0) {
            r += rimStrength * 80
            g -= rimStrength * 15
            b -= rimStrength * 20
          }
        }
      }

      // === Debris: warm material splattered outward ===
      if (debris > 0.02) {
        const db = Math.min(1.0, debris * 2.0)
        // Debris is warm material — same tones but DARKER (oxidized/burnt)
        r = r * (1 - db * 0.3) + (120 + db * 40) * db * 0.3
        g = g * (1 - db * 0.3) + (60 + db * 15) * db * 0.3
        b = b * (1 - db * 0.3) + (25 + db * 8) * db * 0.3
        // Edge darkening
        if (db > 0.3) {
          r -= (db - 0.3) * 30
          g -= (db - 0.3) * 20
        }
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 512 === 0) console.log(`  row ${y}/${H}`)
  }

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-v11-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
