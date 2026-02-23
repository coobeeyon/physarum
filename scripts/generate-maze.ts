/**
 * Generate a maze image for use as physarum food source.
 * Uses recursive backtracker (DFS) for maze generation.
 * Corridors are colored with a warm-to-cool gradient across the maze.
 * Walls are near-black. Corridors are bright → high food attraction.
 *
 * Usage: bun run scripts/generate-maze.ts [output-path] [--cells N] [--seed N]
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const outputPath = args.find((a) => !a.startsWith("--")) ?? "output/maze-food.png"
const cellsArg = args.find((a) => a.startsWith("--cells="))
const seedArg = args.find((a) => a.startsWith("--seed="))

const CELLS = cellsArg ? parseInt(cellsArg.split("=")[1]) : 24
const SEED = seedArg ? parseInt(seedArg.split("=")[1]) : 42
const SIZE = 2048
const WALL_THICKNESS = 4
const CELL_SIZE = Math.floor((SIZE - WALL_THICKNESS) / CELLS)
const ACTUAL_SIZE = CELLS * CELL_SIZE + WALL_THICKNESS

// Simple seeded RNG (xorshift32)
let rngState = SEED
const rng = () => {
	rngState ^= rngState << 13
	rngState ^= rngState >> 17
	rngState ^= rngState << 5
	return (rngState >>> 0) / 4294967296
}

// Maze grid: each cell stores which walls are open
// Walls: 0=top, 1=right, 2=bottom, 3=left
const walls = Array.from({ length: CELLS * CELLS }, () => [true, true, true, true])
const visited = new Uint8Array(CELLS * CELLS)

const idx = (r: number, c: number) => r * CELLS + c
const inBounds = (r: number, c: number) => r >= 0 && r < CELLS && c >= 0 && c < CELLS

// DFS maze generation (recursive backtracker via explicit stack)
const stack: [number, number][] = []
const start: [number, number] = [0, 0]
visited[idx(0, 0)] = 1
stack.push(start)

const dirs = [
	[-1, 0, 0, 2], // up: remove top wall of current, bottom wall of neighbor
	[0, 1, 1, 3], // right
	[1, 0, 2, 0], // down
	[0, -1, 3, 1], // left
] as const

while (stack.length > 0) {
	const [r, c] = stack[stack.length - 1]

	// Find unvisited neighbors
	const neighbors: number[] = []
	for (let d = 0; d < 4; d++) {
		const nr = r + dirs[d][0]
		const nc = c + dirs[d][1]
		if (inBounds(nr, nc) && !visited[idx(nr, nc)]) {
			neighbors.push(d)
		}
	}

	if (neighbors.length === 0) {
		stack.pop()
		continue
	}

	// Pick random neighbor
	const d = neighbors[Math.floor(rng() * neighbors.length)]
	const nr = r + dirs[d][0]
	const nc = c + dirs[d][1]

	// Remove walls between current and neighbor
	walls[idx(r, c)][dirs[d][2]] = false
	walls[idx(nr, nc)][dirs[d][3]] = false

	visited[idx(nr, nc)] = 1
	stack.push([nr, nc])
}

// Render maze to canvas
const canvas = createCanvas(ACTUAL_SIZE, ACTUAL_SIZE)
const ctx = canvas.getContext("2d")

// Background: near-black (walls)
ctx.fillStyle = "rgb(8, 6, 12)"
ctx.fillRect(0, 0, ACTUAL_SIZE, ACTUAL_SIZE)

// Draw corridors with color gradient
// Warm (orange/gold) at top-left → Cool (teal/blue) at bottom-right
for (let r = 0; r < CELLS; r++) {
	for (let c = 0; c < CELLS; c++) {
		const x = WALL_THICKNESS + c * CELL_SIZE
		const y = WALL_THICKNESS + r * CELL_SIZE

		// Gradient parameter: 0 at top-left, 1 at bottom-right
		const t = (r / (CELLS - 1) + c / (CELLS - 1)) / 2

		// Warm → cool gradient
		const red = Math.round(255 * (1 - t * 0.6))
		const green = Math.round(180 + 40 * t)
		const blue = Math.round(60 + 195 * t)
		ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`

		// Fill cell interior (excluding wall thickness)
		const inner = CELL_SIZE - WALL_THICKNESS
		ctx.fillRect(x, y, inner, inner)

		// Fill corridor connections where walls are open
		const w = walls[idx(r, c)]
		if (!w[1] && c < CELLS - 1) {
			// Right wall open: fill gap to the right
			ctx.fillRect(x + inner, y, WALL_THICKNESS, inner)
		}
		if (!w[2] && r < CELLS - 1) {
			// Bottom wall open: fill gap below
			ctx.fillRect(x, y + inner, inner, WALL_THICKNESS)
		}
		// Fill corner if both right and bottom are open and diagonal neighbor's left and top are open
		if (!w[1] && !w[2] && r < CELLS - 1 && c < CELLS - 1) {
			const diagWalls = walls[idx(r + 1, c + 1)]
			if (!diagWalls[0] && !diagWalls[3]) {
				ctx.fillRect(x + inner, y + inner, WALL_THICKNESS, WALL_THICKNESS)
			}
		}
	}
}

// Save
const buf = canvas.toBuffer("image/png")
writeFileSync(outputPath, buf)
console.log(
	`Maze generated: ${CELLS}×${CELLS} cells, ${ACTUAL_SIZE}×${ACTUAL_SIZE}px → ${outputPath}`,
)
