/**
 * Generate a food-source image for physarum simulation.
 * Bright colored dots on a dark background — the agents will cluster at the
 * food sources and form networks connecting them. This is what physarum
 * polycephalum is famous for: efficiently connecting distributed food.
 *
 * Usage: bun run scripts/generate-food-sources.ts [output-path] [--seed N]
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "node:fs"

const args = process.argv.slice(2)
const outputPath = args.find((a) => !a.startsWith("--")) ?? "output/food-sources.png"
const seedArg = args.find((a) => a.startsWith("--seed="))
const SEED = seedArg ? parseInt(seedArg.split("=")[1]) : 33

const SIZE = 2048
const MARGIN = 150

// Seeded RNG
let rngState = SEED
const rng = () => {
	rngState ^= rngState << 13
	rngState ^= rngState >> 17
	rngState ^= rngState << 5
	return (rngState >>> 0) / 4294967296
}

// Food source positions — deliberate, not random.
// Asymmetric clusters and isolated points create interesting pathfinding.
// Some dots close together (easy connections), others far apart (long tendrils).
const sources = [
	// Upper-left cluster (3 dots close together)
	{ x: 0.15, y: 0.12, r: 55, color: [255, 200, 60] },
	{ x: 0.22, y: 0.20, r: 45, color: [255, 180, 40] },
	{ x: 0.10, y: 0.25, r: 50, color: [255, 210, 80] },

	// Center: one large bright source
	{ x: 0.50, y: 0.45, r: 70, color: [255, 255, 200] },

	// Right side: pair
	{ x: 0.78, y: 0.30, r: 50, color: [100, 220, 255] },
	{ x: 0.85, y: 0.22, r: 40, color: [60, 200, 255] },

	// Bottom-left: isolated (long tendril needed)
	{ x: 0.18, y: 0.75, r: 55, color: [200, 255, 120] },

	// Bottom: chain of 3
	{ x: 0.42, y: 0.80, r: 45, color: [255, 140, 100] },
	{ x: 0.55, y: 0.85, r: 40, color: [255, 120, 80] },
	{ x: 0.68, y: 0.78, r: 50, color: [255, 160, 120] },

	// Bottom-right: one more isolated
	{ x: 0.88, y: 0.70, r: 45, color: [140, 180, 255] },

	// Upper center: small distant
	{ x: 0.45, y: 0.10, r: 35, color: [255, 220, 180] },

	// Mid-left
	{ x: 0.08, y: 0.50, r: 42, color: [180, 255, 160] },
]

const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext("2d")

// Very dark background with subtle noise
ctx.fillStyle = "rgb(4, 3, 6)"
ctx.fillRect(0, 0, SIZE, SIZE)

// Add subtle background noise so agents have something to sense even in empty areas
const imageData = ctx.getImageData(0, 0, SIZE, SIZE)
for (let i = 0; i < imageData.data.length; i += 4) {
	const noise = Math.floor(rng() * 8)
	imageData.data[i] += noise
	imageData.data[i + 1] += noise
	imageData.data[i + 2] += noise
}
ctx.putImageData(imageData, 0, 0)

// Draw food sources as soft radial gradients (Gaussian-like falloff)
for (const src of sources) {
	const cx = MARGIN + src.x * (SIZE - 2 * MARGIN)
	const cy = MARGIN + src.y * (SIZE - 2 * MARGIN)
	const radius = src.r

	const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.5)
	gradient.addColorStop(0, `rgba(${src.color[0]}, ${src.color[1]}, ${src.color[2]}, 1.0)`)
	gradient.addColorStop(0.3, `rgba(${src.color[0]}, ${src.color[1]}, ${src.color[2]}, 0.7)`)
	gradient.addColorStop(0.7, `rgba(${src.color[0]}, ${src.color[1]}, ${src.color[2]}, 0.2)`)
	gradient.addColorStop(1, `rgba(${src.color[0]}, ${src.color[1]}, ${src.color[2]}, 0.0)`)

	ctx.fillStyle = gradient
	ctx.fillRect(cx - radius * 2.5, cy - radius * 2.5, radius * 5, radius * 5)
}

const buf = canvas.toBuffer("image/png")
writeFileSync(outputPath, buf)
console.log(`Food sources generated: ${sources.length} sources, ${SIZE}×${SIZE}px → ${outputPath}`)
