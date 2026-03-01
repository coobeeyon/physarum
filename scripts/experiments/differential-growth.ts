/**
 * Differential Growth
 *
 * A closed curve where nodes repel each other (separation force),
 * are attracted to neighbors (spring force), and grow by inserting
 * new nodes when edges get too long.
 *
 * Produces organic, coral-like forms that curl and fold.
 * Strong compositional potential — grows from a seed shape.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const W = 2048
const H = 2048

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

interface GrowthConfig {
  name: string
  initialRadius: number
  initialNodes: number
  iterations: number
  maxNodes: number
  separationRadius: number
  separationForce: number
  springForce: number
  maxEdgeLength: number
  dampening: number
  seed: number
  bgColor: [number, number, number]
  strokeColor: [number, number, number]
  strokeWidth: number
  fillColor?: [number, number, number, number]
}

const CONFIGS: GrowthConfig[] = [
  {
    name: "coral",
    initialRadius: 60,
    initialNodes: 30,
    iterations: 2000,
    maxNodes: 20000,
    separationRadius: 18,
    separationForce: 1.2,
    springForce: 0.15,
    maxEdgeLength: 5,
    dampening: 0.5,
    seed: 42,
    bgColor: [248, 244, 236],
    strokeColor: [20, 25, 35],
    strokeWidth: 1.5,
  },
  {
    name: "bloom",
    initialRadius: 40,
    initialNodes: 20,
    iterations: 2500,
    maxNodes: 30000,
    separationRadius: 14,
    separationForce: 1.0,
    springForce: 0.12,
    maxEdgeLength: 4,
    dampening: 0.45,
    seed: 7919,
    bgColor: [15, 12, 25],
    strokeColor: [220, 180, 140],
    strokeWidth: 0.8,
    fillColor: [30, 25, 45, 20],
  },
  {
    name: "lichen",
    initialRadius: 80,
    initialNodes: 40,
    iterations: 1800,
    maxNodes: 25000,
    separationRadius: 20,
    separationForce: 1.5,
    springForce: 0.1,
    maxEdgeLength: 6,
    dampening: 0.5,
    seed: 31415,
    bgColor: [235, 240, 235],
    strokeColor: [40, 60, 35],
    strokeWidth: 1.0,
  },
]

function simulate(config: GrowthConfig): Node[] {
  // PRNG
  let s = config.seed | 0
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  // Initialize as a circle
  const nodes: Node[] = []
  for (let i = 0; i < config.initialNodes; i++) {
    const angle = (i / config.initialNodes) * Math.PI * 2
    nodes.push({
      x: W / 2 + Math.cos(angle) * config.initialRadius,
      y: H / 2 + Math.sin(angle) * config.initialRadius,
      vx: 0,
      vy: 0,
    })
  }

  for (let iter = 0; iter < config.iterations; iter++) {
    const n = nodes.length

    // Reset forces
    for (const node of nodes) {
      node.vx = 0
      node.vy = 0
    }

    // Separation: nodes repel nearby non-neighbor nodes
    // Use spatial grid for performance
    const cellSize = config.separationRadius * 2
    const grid = new Map<string, number[]>()
    for (let i = 0; i < n; i++) {
      const cx = Math.floor(nodes[i].x / cellSize)
      const cy = Math.floor(nodes[i].y / cellSize)
      const key = `${cx},${cy}`
      if (!grid.has(key)) grid.set(key, [])
      grid.get(key)!.push(i)
    }

    for (let i = 0; i < n; i++) {
      const node = nodes[i]
      const cx = Math.floor(node.x / cellSize)
      const cy = Math.floor(node.y / cellSize)

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const key = `${cx + dx},${cy + dy}`
          const cell = grid.get(key)
          if (!cell) continue

          for (const j of cell) {
            if (j === i) continue
            // Skip immediate neighbors in chain
            if (j === (i + 1) % n || j === (i - 1 + n) % n) continue

            const ddx = node.x - nodes[j].x
            const ddy = node.y - nodes[j].y
            const dist = Math.sqrt(ddx * ddx + ddy * ddy)

            if (dist < config.separationRadius && dist > 0.01) {
              const force = config.separationForce * (1 - dist / config.separationRadius)
              node.vx += (ddx / dist) * force
              node.vy += (ddy / dist) * force
            }
          }
        }
      }
    }

    // Spring force: attract to neighbors
    for (let i = 0; i < n; i++) {
      const prev = nodes[(i - 1 + n) % n]
      const next = nodes[(i + 1) % n]
      const node = nodes[i]

      // Toward prev
      const dpx = prev.x - node.x
      const dpy = prev.y - node.y
      node.vx += dpx * config.springForce
      node.vy += dpy * config.springForce

      // Toward next
      const dnx = next.x - node.x
      const dny = next.y - node.y
      node.vx += dnx * config.springForce
      node.vy += dny * config.springForce
    }

    // Apply forces
    for (const node of nodes) {
      node.vx *= config.dampening
      node.vy *= config.dampening

      // Add tiny random jitter for symmetry-breaking
      node.vx += (rand() - 0.5) * 0.3
      node.vy += (rand() - 0.5) * 0.3

      node.x += node.vx
      node.y += node.vy

      // Soft boundary
      const margin = 50
      if (node.x < margin) node.vx += 0.5
      if (node.x > W - margin) node.vx -= 0.5
      if (node.y < margin) node.vy += 0.5
      if (node.y > H - margin) node.vy -= 0.5
    }

    // Growth: insert new nodes where edges are too long
    if (nodes.length < config.maxNodes) {
      const insertions: { index: number; node: Node }[] = []

      for (let i = 0; i < nodes.length; i++) {
        const next = nodes[(i + 1) % nodes.length]
        const dx = next.x - nodes[i].x
        const dy = next.y - nodes[i].y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > config.maxEdgeLength) {
          insertions.push({
            index: i + 1,
            node: {
              x: (nodes[i].x + next.x) / 2 + (rand() - 0.5) * 0.5,
              y: (nodes[i].y + next.y) / 2 + (rand() - 0.5) * 0.5,
              vx: 0,
              vy: 0,
            },
          })
        }
      }

      // Insert in reverse order to maintain indices
      for (let i = insertions.length - 1; i >= 0; i--) {
        nodes.splice(insertions[i].index, 0, insertions[i].node)
      }
    }

    if (iter % 100 === 0) {
      console.log(`  iteration ${iter}/${config.iterations}, nodes: ${nodes.length}`)
    }
  }

  return nodes
}

function render(nodes: Node[], config: GrowthConfig) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext("2d")

  // Background
  ctx.fillStyle = `rgb(${config.bgColor[0]}, ${config.bgColor[1]}, ${config.bgColor[2]})`
  ctx.fillRect(0, 0, W, H)

  // Optional fill
  if (config.fillColor) {
    ctx.beginPath()
    ctx.moveTo(nodes[0].x, nodes[0].y)
    for (let i = 1; i < nodes.length; i++) {
      ctx.lineTo(nodes[i].x, nodes[i].y)
    }
    ctx.closePath()
    const [fr, fg, fb, fa] = config.fillColor
    ctx.fillStyle = `rgba(${fr}, ${fg}, ${fb}, ${fa / 255})`
    ctx.fill()
  }

  // Stroke
  ctx.beginPath()
  ctx.moveTo(nodes[0].x, nodes[0].y)
  for (let i = 1; i < nodes.length; i++) {
    ctx.lineTo(nodes[i].x, nodes[i].y)
  }
  ctx.closePath()

  ctx.strokeStyle = `rgb(${config.strokeColor[0]}, ${config.strokeColor[1]}, ${config.strokeColor[2]})`
  ctx.lineWidth = config.strokeWidth
  ctx.lineJoin = "round"
  ctx.stroke()

  const filename = `output/growth-${config.name}.png`
  writeFileSync(filename, canvas.toBuffer("image/png"))
  console.log(`  → ${filename}`)
}

const configName = process.argv[2] || "all"
const toRun = configName === "all" ? CONFIGS : CONFIGS.filter(c => c.name === configName)

if (toRun.length === 0) {
  console.log(`Unknown config: ${configName}`)
  console.log(`Available: ${CONFIGS.map(c => c.name).join(", ")}`)
  process.exit(1)
}

for (const config of toRun) {
  console.log(`\n=== ${config.name} ===`)
  const nodes = simulate(config)
  render(nodes, config)
}
