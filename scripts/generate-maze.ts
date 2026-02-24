/**
 * Generate a maze image for physarum simulation.
 * White corridors on black walls — agents follow the bright corridors as food.
 * The physarum should find the shortest path, replicating the famous
 * Nakagaki 2000 experiment (Nature) where real physarum solved a maze.
 *
 * Uses recursive backtracking to generate a perfect maze (single solution).
 * Food blobs placed at entrance and exit to attract agents to the endpoints.
 *
 * Usage: bun run scripts/generate-maze.ts [output-path] [--seed N] [--cells N]
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const outputPath = args.find((a) => !a.startsWith("--")) ?? "output/maze.png"
const seedArg = args.find((a) => a.startsWith("--seed="))
const cellsArg = args.find((a) => a.startsWith("--cells="))
const SEED = seedArg ? parseInt(seedArg.split("=")[1]) : 35
const CELLS = cellsArg ? parseInt(cellsArg.split("=")[1]) : 20

const SIZE = 2048
const CELL_SIZE = Math.floor(SIZE / (CELLS * 2 + 1))
const GRID_W = CELLS
const GRID_H = CELLS

// Seeded RNG
let rngState = SEED
const rng = () => {
  rngState ^= rngState << 13
  rngState ^= rngState >> 17
  rngState ^= rngState << 5
  return (rngState >>> 0) / 4294967296
}

// Shuffle array in-place with seeded RNG
const shuffle = <T>(arr: T[]): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Maze grid: true = passage, false = wall
const mazeW = GRID_W * 2 + 1
const mazeH = GRID_H * 2 + 1
const maze: boolean[][] = Array.from({ length: mazeH }, () =>
  Array.from({ length: mazeW }, () => false),
)

// Recursive backtracking
const visited = Array.from({ length: GRID_H }, () =>
  Array.from({ length: GRID_W }, () => false),
)

const directions = [
  [0, -1], // up
  [0, 1], // down
  [-1, 0], // left
  [1, 0], // right
]

const carve = (cx: number, cy: number) => {
  visited[cy][cx] = true
  maze[cy * 2 + 1][cx * 2 + 1] = true

  const dirs = shuffle([...directions])
  for (const [dx, dy] of dirs) {
    const nx = cx + dx
    const ny = cy + dy
    if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && !visited[ny][nx]) {
      maze[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = true
      carve(nx, ny)
    }
  }
}

carve(0, 0)

// Entrance and exit
maze[0][1] = true
maze[mazeH - 1][mazeW - 2] = true

// BFS from a maze cell to compute distances to all other cells.
// Returns a 2D array of maze distances (in grid steps), -1 for walls.
const bfs = (startMx: number, startMy: number): number[][] => {
  const dist: number[][] = Array.from({ length: mazeH }, () =>
    Array.from({ length: mazeW }, () => -1),
  )
  dist[startMy][startMx] = 0
  const queue: [number, number][] = [[startMx, startMy]]
  let head = 0
  while (head < queue.length) {
    const [cx, cy] = queue[head++]
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
      const nx = cx + dx
      const ny = cy + dy
      if (nx >= 0 && nx < mazeW && ny >= 0 && ny < mazeH && maze[ny][nx] && dist[ny][nx] === -1) {
        dist[ny][nx] = dist[cy][cx] + 1
        queue.push([nx, ny])
      }
    }
  }
  return dist
}

// Entrance is maze cell (1, 0), exit is (mazeW-2, mazeH-1)
const distFromEntrance = bfs(1, 0)
const distFromExit = bfs(mazeW - 2, mazeH - 1)

// Find the shortest path length (sum of distances at any cell on the optimal path)
// On the shortest path, distFromEntrance[y][x] + distFromExit[y][x] = shortestPathLen
let shortestPathLen = Infinity
for (let my = 0; my < mazeH; my++) {
  for (let mx = 0; mx < mazeW; mx++) {
    if (distFromEntrance[my][mx] >= 0 && distFromExit[my][mx] >= 0) {
      const total = distFromEntrance[my][mx] + distFromExit[my][mx]
      if (total < shortestPathLen) shortestPathLen = total
    }
  }
}

// Find the maximum single distance for normalization
let maxDist = 0
for (let my = 0; my < mazeH; my++) {
  for (let mx = 0; mx < mazeW; mx++) {
    if (distFromEntrance[my][mx] > maxDist) maxDist = distFromEntrance[my][mx]
    if (distFromExit[my][mx] > maxDist) maxDist = distFromExit[my][mx]
  }
}

console.log(`Shortest path: ${shortestPathLen} steps, max distance: ${maxDist}`)

// Render: brightness based on how close a corridor cell is to the optimal path.
// optimality = shortestPathLen / (distEntrance + distExit)
// On the shortest path, optimality = 1.0. Dead ends have optimality < 1.0.
const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext("2d")

ctx.fillStyle = "rgb(0, 0, 0)"
ctx.fillRect(0, 0, SIZE, SIZE)

const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
const pixels = imageData.data

// Corridors on the shortest path: brightness 255
// Corridors far from optimal: brightness drops toward BASE_CORRIDOR
const BASE_CORRIDOR = 15
const PATH_BOOST = 240

for (let py = 0; py < SIZE; py++) {
  for (let px = 0; px < SIZE; px++) {
    const mx = Math.floor(px / CELL_SIZE)
    const my = Math.floor(py / CELL_SIZE)

    if (mx >= mazeW || my >= mazeH || !maze[my][mx]) continue

    const dE = distFromEntrance[my][mx]
    const dX = distFromExit[my][mx]

    if (dE < 0 || dX < 0) {
      // Unreachable corridor (shouldn't happen in perfect maze)
      const i = (py * SIZE + px) * 4
      pixels[i] = BASE_CORRIDOR
      pixels[i + 1] = BASE_CORRIDOR
      pixels[i + 2] = BASE_CORRIDOR
      pixels[i + 3] = 255
      continue
    }

    const totalDist = dE + dX
    // How optimal is this cell? 1.0 = on shortest path, lower = more suboptimal
    const optimality = shortestPathLen / totalDist
    // Sharpen the curve so near-optimal paths are much brighter than suboptimal ones
    const sharpened = Math.pow(optimality, 4)

    const brightness = Math.round(BASE_CORRIDOR + PATH_BOOST * sharpened)
    const clamped = Math.min(255, brightness)

    const i = (py * SIZE + px) * 4
    pixels[i] = clamped
    pixels[i + 1] = clamped
    pixels[i + 2] = clamped
    pixels[i + 3] = 255
  }
}

ctx.putImageData(imageData, 0, 0)

const buf = canvas.toBuffer("image/png")
writeFileSync(outputPath, buf)
console.log(`Maze generated: ${GRID_W}x${GRID_H} cells, ${mazeW}x${mazeH} grid, ${SIZE}x${SIZE}px -> ${outputPath}`)
