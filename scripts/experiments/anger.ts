/**
 * ANGER
 *
 * Communicates: violence, force, impact, rupture.
 *
 * v1 & v2 failed — random walk cracks always look organic (veins, neurons).
 *
 * v3 approach: VORONOI SHATTER. Like shattered glass or cracked stone.
 * Voronoi cell boundaries are inherently angular — straight segments meeting
 * at sharp vertices. This is what real fractures look like.
 *
 * - Dense point sites near impact (small fragments = more damage)
 * - Sparse sites far from impact (larger intact cells)
 * - Dark crack lines on pressured red surface
 * - Cells near impact are brighter (energy, heat)
 * - Impact glow at the center
 * - Some cells near impact are "missing" (blown out, holes)
 *
 * The viewer should feel: something was hit and shattered.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

// ---- PRNG ----
function makePRNG(seed: number) {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- Noise ----
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

// ---- Generate Voronoi sites ----

interface Site {
  x: number
  y: number
  distFromImpact: number
  blownOut: boolean // "missing" cell — the fragment has been knocked away
}

function generateSites(
  impactX: number,
  impactY: number,
  rand: () => number,
): Site[] {
  const sites: Site[] = []

  // Dense cluster near impact (small shattered fragments)
  const innerCount = 200
  for (let i = 0; i < innerCount; i++) {
    const angle = rand() * Math.PI * 2
    // Gaussian-ish distribution clustered at center
    const r = Math.abs(rand() + rand() + rand() - 1.5) * 350
    const x = impactX + Math.cos(angle) * r
    const y = impactY + Math.sin(angle) * r
    const dist = Math.sqrt((x - impactX) ** 2 + (y - impactY) ** 2)
    sites.push({
      x, y,
      distFromImpact: dist,
      blownOut: dist < 120 && rand() < 0.35, // some near-impact cells are missing
    })
  }

  // Medium density in the mid-range
  const midCount = 150
  for (let i = 0; i < midCount; i++) {
    const angle = rand() * Math.PI * 2
    const r = 200 + rand() * 600
    const x = impactX + Math.cos(angle) * r
    const y = impactY + Math.sin(angle) * r
    const dist = Math.sqrt((x - impactX) ** 2 + (y - impactY) ** 2)
    sites.push({
      x, y,
      distFromImpact: dist,
      blownOut: false,
    })
  }

  // Sparse points across the rest of the canvas (large intact cells)
  const outerCount = 100
  for (let i = 0; i < outerCount; i++) {
    const x = rand() * W
    const y = rand() * H
    const dist = Math.sqrt((x - impactX) ** 2 + (y - impactY) ** 2)
    sites.push({
      x, y,
      distFromImpact: dist,
      blownOut: false,
    })
  }

  return sites
}

// ---- Grid-accelerated nearest site lookup ----

class SiteGrid {
  private cells: Int32Array[]
  private gridW: number
  private gridH: number
  private cellSize: number

  constructor(private sites: Site[], cellSize: number) {
    this.cellSize = cellSize
    this.gridW = Math.ceil(W / cellSize)
    this.gridH = Math.ceil(H / cellSize)
    this.cells = new Array(this.gridW * this.gridH)
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = new Int32Array(0)
    }

    // Assign sites to grid cells
    const cellLists: number[][] = new Array(this.gridW * this.gridH)
    for (let i = 0; i < cellLists.length; i++) cellLists[i] = []

    for (let i = 0; i < sites.length; i++) {
      const gx = Math.floor(sites[i].x / cellSize)
      const gy = Math.floor(sites[i].y / cellSize)
      if (gx >= 0 && gx < this.gridW && gy >= 0 && gy < this.gridH) {
        cellLists[gy * this.gridW + gx].push(i)
      }
    }

    for (let i = 0; i < cellLists.length; i++) {
      this.cells[i] = new Int32Array(cellLists[i])
    }
  }

  // Find nearest and second-nearest site
  findNearest2(px: number, py: number): { nearest: number; second: number; d1: number; d2: number } {
    const gx = Math.floor(px / this.cellSize)
    const gy = Math.floor(py / this.cellSize)

    let bestIdx = -1, bestDist = Infinity
    let secondIdx = -1, secondDist = Infinity

    // Search expanding rings of grid cells
    const searchRadius = 3
    for (let dy = -searchRadius; dy <= searchRadius; dy++) {
      for (let dx = -searchRadius; dx <= searchRadius; dx++) {
        const cx = gx + dx
        const cy = gy + dy
        if (cx < 0 || cx >= this.gridW || cy < 0 || cy >= this.gridH) continue

        const cell = this.cells[cy * this.gridW + cx]
        for (let i = 0; i < cell.length; i++) {
          const s = this.sites[cell[i]]
          const d = (px - s.x) ** 2 + (py - s.y) ** 2
          if (d < bestDist) {
            secondDist = bestDist
            secondIdx = bestIdx
            bestDist = d
            bestIdx = cell[i]
          } else if (d < secondDist) {
            secondDist = d
            secondIdx = cell[i]
          }
        }
      }
    }

    return {
      nearest: bestIdx,
      second: secondIdx,
      d1: Math.sqrt(bestDist),
      d2: Math.sqrt(secondDist),
    }
  }
}

// ---- Rendering ----

function render(
  impactX: number,
  impactY: number,
  sites: Site[],
  seed: number,
): Uint8ClampedArray {
  const N = W * H
  const rgba = new Uint8ClampedArray(N * 4)

  const grid = new SiteGrid(sites, 80)
  const maxDist = Math.sqrt(W * W + H * H)

  // Noise for surface texture
  const noise1 = makeNoise(seed, 250)
  const noise2 = makeNoise(seed + 1000, 80)

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x
      const { nearest, d1, d2 } = grid.findNearest2(x, y)

      // Distance from impact (normalized)
      const impDx = x - impactX
      const impDy = y - impactY
      const impDist = Math.sqrt(impDx * impDx + impDy * impDy) / maxDist

      // How close to a Voronoi boundary (crack line)?
      // Boundary occurs where d1 ≈ d2
      const edgeness = d2 - d1 // small = near edge

      // Surface noise
      const n = noise1(x, y) * 0.3 + noise2(x, y) * 0.2

      let r: number, g: number, b: number

      const site = nearest >= 0 ? sites[nearest] : null

      if (site && site.blownOut) {
        // Blown-out cells: deep dark void with hot glowing edges
        if (edgeness < 8) {
          // Edge of the hole — hot glow, magma visible through gap
          const edgeGlow = 1.0 - edgeness / 8
          const eg2 = edgeGlow * edgeGlow
          r = 160 + eg2 * 95
          g = 20 + eg2 * 50
          b = 5 + eg2 * 15
        } else {
          // Interior of hole — the void
          r = 4 + n * 4
          g = 1 + n * 1
          b = 2 + n * 1
        }
      } else if (edgeness < 7) {
        // ON a crack line — wider, more prominent dark fractures
        const crackIntensity = 1.0 - edgeness / 7
        const crackDepth = crackIntensity * crackIntensity

        // Crack: dark gap with hot glow bleeding through near impact
        const heat = Math.max(0, 1.0 - impDist * 2.0)
        // Near impact: cracks glow hot (magma visible through fractures)
        // Far from impact: cracks are cold dark lines
        r = 8 + crackDepth * heat * 140
        g = 2 + crackDepth * heat * 25
        b = 2 + crackDepth * heat * 10
      } else {
        // Cell interior: the fractured surface
        // MUCH brighter near impact — angry, hot, pressured
        const heat = Math.max(0, 1.0 - impDist * 1.8)
        const heat2 = heat * heat

        // Surface: dark blood red → vivid crimson near impact
        r = 35 + n * 18 + heat * 100 + heat2 * 60
        g = 5 + n * 5 + heat * 12
        b = 7 + n * 4 + heat * 8

        // Per-cell color variation (cells are distinct fragments)
        if (nearest >= 0) {
          const cellNoise = ((nearest * 7919) % 255) / 255
          r += cellNoise * 20 - 10
          g += cellNoise * 5 - 2
        }
      }

      // Impact glow — LARGER, more intense, the heat source
      const glowDist = Math.sqrt(impDx * impDx + impDy * impDy)
      const glowRadius = Math.min(W, H) * 0.22
      if (glowDist < glowRadius) {
        const t = 1.0 - glowDist / glowRadius
        const glow = t * t * 0.7
        r = r * (1 - glow) + 255 * glow
        g = g * (1 - glow) + 90 * glow
        b = b * (1 - glow) + 25 * glow
      }

      rgba[idx * 4 + 0] = Math.round(Math.max(0, Math.min(255, r)))
      rgba[idx * 4 + 1] = Math.round(Math.max(0, Math.min(255, g)))
      rgba[idx * 4 + 2] = Math.round(Math.max(0, Math.min(255, b)))
      rgba[idx * 4 + 3] = 255
    }

    if (y % 256 === 0) console.log(`  row ${y}/${H}`)
  }

  return rgba
}

// ---- Main ----

async function main() {
  const variant = process.argv[2] || "v3"

  const variants: Record<string, { impactX: number; impactY: number; seed: number }> = {
    v3: { impactX: W * 0.35, impactY: H * 0.55, seed: 66623 },
    v4: { impactX: W * 0.42, impactY: H * 0.48, seed: 66624 },
    v5: { impactX: W * 0.30, impactY: H * 0.60, seed: 66625 },
  }

  const config = variants[variant] ?? variants.v3
  const rand = makePRNG(config.seed)

  console.log(`=== ANGER ${variant} (impact: ${Math.round(config.impactX)}, ${Math.round(config.impactY)}) ===`)

  console.log("  Generating sites...")
  const sites = generateSites(config.impactX, config.impactY, rand)
  console.log(`  ${sites.length} Voronoi sites (${sites.filter(s => s.blownOut).length} blown out)`)

  console.log("  Rendering Voronoi shatter...")
  const rgba = render(config.impactX, config.impactY, sites, config.seed)

  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")
  const imageData = ctx.createImageData(W, H)
  imageData.data.set(rgba)
  ctx.putImageData(imageData, 0, 0)

  const filename = `output/anger-${variant}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

main()
