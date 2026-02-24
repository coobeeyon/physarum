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
// Normalized to [0,1] range centered on Tokyo
const cities: Array<{ name: string; x: number; y: number; importance: number }> = [
	// Central Tokyo
	{ name: "Tokyo", x: 0.50, y: 0.50, importance: 1.0 },
	{ name: "Shinjuku", x: 0.47, y: 0.48, importance: 0.9 },
	{ name: "Shibuya", x: 0.47, y: 0.51, importance: 0.85 },
	{ name: "Ikebukuro", x: 0.48, y: 0.44, importance: 0.85 },
	{ name: "Ueno", x: 0.51, y: 0.47, importance: 0.8 },

	// Inner ring
	{ name: "Yokohama", x: 0.46, y: 0.65, importance: 0.9 },
	{ name: "Kawasaki", x: 0.48, y: 0.58, importance: 0.75 },
	{ name: "Chiba", x: 0.65, y: 0.52, importance: 0.8 },
	{ name: "Saitama", x: 0.50, y: 0.35, importance: 0.8 },
	{ name: "Funabashi", x: 0.60, y: 0.48, importance: 0.65 },
	{ name: "Machida", x: 0.38, y: 0.58, importance: 0.6 },

	// Outer ring
	{ name: "Tachikawa", x: 0.33, y: 0.47, importance: 0.6 },
	{ name: "Hachioji", x: 0.28, y: 0.52, importance: 0.65 },
	{ name: "Tsukuba", x: 0.62, y: 0.28, importance: 0.5 },
	{ name: "Kashiwa", x: 0.58, y: 0.35, importance: 0.55 },
	{ name: "Matsudo", x: 0.56, y: 0.42, importance: 0.6 },
	{ name: "Tokorozawa", x: 0.38, y: 0.38, importance: 0.55 },
	{ name: "Kawagoe", x: 0.38, y: 0.30, importance: 0.55 },
	{ name: "Omiya", x: 0.48, y: 0.30, importance: 0.7 },
	{ name: "Urawa", x: 0.50, y: 0.33, importance: 0.65 },
	{ name: "Ichikawa", x: 0.57, y: 0.50, importance: 0.55 },

	// Outer cities
	{ name: "Fujisawa", x: 0.40, y: 0.70, importance: 0.5 },
	{ name: "Kamakura", x: 0.43, y: 0.72, importance: 0.45 },
	{ name: "Odawara", x: 0.30, y: 0.75, importance: 0.45 },
	{ name: "Atsugi", x: 0.33, y: 0.62, importance: 0.45 },
	{ name: "Kisarazu", x: 0.62, y: 0.68, importance: 0.4 },
	{ name: "Narita", x: 0.72, y: 0.38, importance: 0.5 },
	{ name: "Kumagaya", x: 0.43, y: 0.22, importance: 0.4 },
	{ name: "Takasaki", x: 0.35, y: 0.15, importance: 0.45 },
	{ name: "Mito", x: 0.72, y: 0.22, importance: 0.45 },
	{ name: "Yokosuka", x: 0.48, y: 0.73, importance: 0.45 },

	// Additional inner stations
	{ name: "Shinagawa", x: 0.49, y: 0.53, importance: 0.75 },
	{ name: "Akihabara", x: 0.51, y: 0.48, importance: 0.7 },
	{ name: "Roppongi", x: 0.48, y: 0.51, importance: 0.6 },
	{ name: "Meguro", x: 0.47, y: 0.53, importance: 0.55 },
	{ name: "Kichijoji", x: 0.40, y: 0.46, importance: 0.55 },
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
	const radius = 15 + city.importance * 35
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
			if (value > pixels[idx]) pixels[idx] = value
		}
	}
}

// Suppress food in Tokyo Bay area (southeast of center)
const bayX = 0.56 * WIDTH
const bayY = 0.60 * HEIGHT
const bayR = 0.07 * WIDTH
for (let y = 0; y < HEIGHT; y++) {
	for (let x = 0; x < WIDTH; x++) {
		const dx = x - bayX
		const dy = y - bayY
		const dist = Math.sqrt(dx * dx + dy * dy)
		if (dist < bayR) {
			pixels[y * WIDTH + x] *= 0.05
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
