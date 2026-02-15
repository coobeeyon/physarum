import { createPrng } from "#engine/prng.ts"
import type { PhysarumParams } from "#types/physarum.ts"

const TWO_PI = Math.PI * 2

/**
 * Run physarum simulation, returning a normalized Float32Array trail map.
 * Agents stored as flat array: [x0, y0, angle0, x1, y1, angle1, ...]
 */
export const simulate = (params: PhysarumParams) => {
	const { width, height, agentCount, iterations, sensorAngle, sensorDistance, turnAngle, stepSize, depositAmount, decayFactor, seed } = params
	const rng = createPrng(seed)
	const size = width * height

	// Initialize trail map
	const trail = new Float32Array(size)
	const trailNext = new Float32Array(size)

	// Initialize agents: flat array [x, y, angle, x, y, angle, ...]
	const agents = new Float32Array(agentCount * 3)
	for (let i = 0; i < agentCount; i++) {
		const idx = i * 3
		agents[idx] = rng() * width
		agents[idx + 1] = rng() * height
		agents[idx + 2] = rng() * TWO_PI
	}

	for (let iter = 0; iter < iterations; iter++) {
		// Sense → Rotate → Move → Deposit
		for (let i = 0; i < agentCount; i++) {
			const idx = i * 3
			let x = agents[idx]
			let y = agents[idx + 1]
			let angle = agents[idx + 2]

			// Sense at three directions
			const senseLeft = sampleTrail(trail, x, y, angle - sensorAngle, sensorDistance, width, height)
			const senseCenter = sampleTrail(trail, x, y, angle, sensorDistance, width, height)
			const senseRight = sampleTrail(trail, x, y, angle + sensorAngle, sensorDistance, width, height)

			// Rotate
			if (senseCenter > senseLeft && senseCenter > senseRight) {
				// keep going straight
			} else if (senseCenter < senseLeft && senseCenter < senseRight) {
				// random turn
				angle += (rng() > 0.5 ? 1 : -1) * turnAngle
			} else if (senseLeft > senseRight) {
				angle -= turnAngle
			} else if (senseRight > senseLeft) {
				angle += turnAngle
			}

			// Move
			x = ((x + Math.cos(angle) * stepSize) % width + width) % width
			y = ((y + Math.sin(angle) * stepSize) % height + height) % height

			agents[idx] = x
			agents[idx + 1] = y
			agents[idx + 2] = angle

			// Deposit
			const tx = Math.floor(x)
			const ty = Math.floor(y)
			trail[ty * width + tx] += depositAmount
		}

		// Diffuse (3x3 box blur) + Decay
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				let sum = 0
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx = ((x + dx) % width + width) % width
						const ny = ((y + dy) % height + height) % height
						sum += trail[ny * width + nx]
					}
				}
				trailNext[y * width + x] = (sum / 9) * decayFactor
			}
		}

		// Swap buffers
		trail.set(trailNext)
	}

	// Normalize to [0, 1] with gamma correction for visual contrast
	let max = 0
	for (let i = 0; i < size; i++) {
		if (trail[i] > max) max = trail[i]
	}
	if (max > 0) {
		const invMax = 1 / max
		for (let i = 0; i < size; i++) {
			trail[i] = Math.sqrt(trail[i] * invMax) // gamma 0.5
		}
	}

	return trail
}

const sampleTrail = (
	trail: Float32Array,
	x: number,
	y: number,
	angle: number,
	distance: number,
	width: number,
	height: number,
) => {
	const sx = ((Math.floor(x + Math.cos(angle) * distance) % width) + width) % width
	const sy = ((Math.floor(y + Math.sin(angle) * distance) % height) + height) % height
	return trail[sy * width + sx]
}
