/**
 * Generate a food source image for the Tokyo rail network experiment.
 * Based on Tero et al. 2010 (Science): Physarum polycephalum recreated
 * the Greater Tokyo Area rail network when fed oat flakes at city positions.
 *
 * We place bright food sources at approximate positions of major cities
 * around Tokyo on a 2048x2048 canvas. Tokyo is central and brightest.
 */

import { createCanvas } from "canvas"
import { writeFileSync } from "fs"

const WIDTH = 2048
const HEIGHT = 2048

// Greater Tokyo Area cities — approximate relative positions
// Normalized to [0,1] range centered on Tokyo.
// Inner stations (Shinjuku, Shibuya, etc.) omitted — they merge into Tokyo's blob.
// Matches Tero et al. 2010: distinct oat flakes at each major city.
const cities: Array<{ name: string; x: number; y: number; importance: number }> = [
	// Central hub
	{ name: "Tokyo", x: 0.50, y: 0.50, importance: 1.0 },

	// Inner ring (distinct satellite cities)
	{ name: "Yokohama", x: 0.46, y: 0.65, importance: 0.9 },
	{ name: "Kawasaki", x: 0.48, y: 0.58, importance: 0.7 },
	{ name: "Chiba", x: 0.65, y: 0.52, importance: 0.8 },
	{ name: "Saitama", x: 0.49, y: 0.32, importance: 0.8 },
	{ name: "Funabashi", x: 0.60, y: 0.48, importance: 0.6 },
	{ name: "Machida", x: 0.38, y: 0.58, importance: 0.55 },

	// Middle ring
	{ name: "Tachikawa", x: 0.33, y: 0.47, importance: 0.55 },
	{ name: "Hachioji", x: 0.28, y: 0.52, importance: 0.6 },
	{ name: "Matsudo", x: 0.57, y: 0.42, importance: 0.55 },
	{ name: "Kashiwa", x: 0.58, y: 0.35, importance: 0.5 },
	{ name: "Tokorozawa", x: 0.38, y: 0.38, importance: 0.5 },
	{ name: "Kawagoe", x: 0.38, y: 0.28, importance: 0.5 },

	// Outer ring
	{ name: "Fujisawa", x: 0.40, y: 0.72, importance: 0.45 },
	{ name: "Odawara", x: 0.28, y: 0.75, importance: 0.45 },
	{ name: "Narita", x: 0.72, y: 0.38, importance: 0.5 },
	{ name: "Tsukuba", x: 0.62, y: 0.25, importance: 0.45 },
	{ name: "Takasaki", x: 0.35, y: 0.15, importance: 0.45 },
	{ name: "Mito", x: 0.73, y: 0.20, importance: 0.45 },
	{ name: "Kisarazu", x: 0.62, y: 0.68, importance: 0.4 },
	{ name: "Yokosuka", x: 0.47, y: 0.74, importance: 0.4 },
]

// Create canvas
const canvas = createCanvas(WIDTH, HEIGHT)
const ctx = canvas.getContext("2d")

// Black background
ctx.fillStyle = "black"
ctx.fillRect(0, 0, WIDTH, HEIGHT)

// Build food intensity buffer for Gaussian blobs
const pixels = new Float32Array(WIDTH * HEIGHT)

for (const city of cities) {
	const cx = Math.round(city.x * WIDTH)
	const cy = Math.round(city.y * HEIGHT)
	// Visible but distinct — large enough to see, small enough for dark gaps between cities
	const radius = 25 + city.importance * 55
	const intensity = city.importance
	const r3 = Math.ceil(radius * 3)

	for (let dy = -r3; dy <= r3; dy++) {
		for (let dx = -r3; dx <= r3; dx++) {
			const px = cx + dx
			const py = cy + dy
			if (px < 0 || px >= WIDTH || py < 0 || py >= HEIGHT) continue
			const dist2 = dx * dx + dy * dy
			const value = intensity * Math.exp(-dist2 / (2 * radius * radius))
			const idx = py * WIDTH + px
			// Additive blending — overlapping cities create brighter center
			pixels[idx] += value
		}
	}
}

// Suppress food in Tokyo Bay area (southeast of center) — soft elliptical falloff
// Bay is wider east-west than north-south, positioned between Tokyo and Kisarazu
const bayX = 0.55 * WIDTH
const bayY = 0.60 * HEIGHT
const bayRx = 0.10 * WIDTH  // wider east-west
const bayRy = 0.07 * HEIGHT // narrower north-south
for (let y = 0; y < HEIGHT; y++) {
	for (let x = 0; x < WIDTH; x++) {
		const dx = (x - bayX) / bayRx
		const dy = (y - bayY) / bayRy
		const d2 = dx * dx + dy * dy
		if (d2 < 4) { // suppress within 2x radius with smooth falloff
			const suppression = Math.exp(-d2 * 0.5) * 0.95 // up to 95% suppression at center
			pixels[y * WIDTH + x] *= (1 - suppression)
		}
	}
}

// Find max for normalization
let maxVal = 0
for (let i = 0; i < pixels.length; i++) {
	if (pixels[i] > maxVal) maxVal = pixels[i]
}

// Write to canvas as grayscale
const imageData = ctx.getImageData(0, 0, WIDTH, HEIGHT)
for (let i = 0; i < pixels.length; i++) {
	const v = Math.round((pixels[i] / maxVal) * 255)
	imageData.data[i * 4] = v
	imageData.data[i * 4 + 1] = v
	imageData.data[i * 4 + 2] = v
	imageData.data[i * 4 + 3] = 255
}
ctx.putImageData(imageData, 0, 0)

// Save as PNG
const outputPath = "output/tokyo-rail-food.png"
const pngBuf = canvas.toBuffer("image/png")
writeFileSync(outputPath, pngBuf)
console.log(`Food image: ${outputPath}`)
console.log(`Cities: ${cities.length}`)
console.log(`Canvas: ${WIDTH}x${HEIGHT}`)

// Also save city positions for overlay reference
console.log("\nCity positions:")
for (const c of cities) {
	const px = Math.round(c.x * WIDTH)
	const py = Math.round(c.y * HEIGHT)
	console.log(`  ${c.name}: (${px}, ${py}) importance=${c.importance}`)
}
