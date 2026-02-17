import { createPrng } from "#engine/prng.ts"
import { generateFoodMap } from "#engine/food.ts"
import type { FoodImageData } from "#engine/food.ts"
import type { PhysarumParams, SimulationResult } from "#types/physarum.ts"

const TWO_PI = Math.PI * 2
const clamp = (v: number, max: number) => v < 0 ? 0 : v >= max ? max - 1 : v

const diffuseChannel = (
	channel: Float32Array,
	next: Float32Array,
	width: number,
	height: number,
	decayFactor: number,
) => {
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0
			let count = 0
			for (let dy = -1; dy <= 1; dy++) {
				const ny = y + dy
				if (ny < 0 || ny >= height) continue
				for (let dx = -1; dx <= 1; dx++) {
					const nx = x + dx
					if (nx < 0 || nx >= width) continue
					sum += channel[ny * width + nx]
					count++
				}
			}
			next[y * width + x] = (sum / count) * decayFactor
		}
	}
	channel.set(next)
}

/**
 * Run multi-population physarum simulation with food sources.
 * Returns SimulationResult with per-population trail maps.
 * When foodImageRgb is provided, agents carry RGB color sampled from the food image.
 */
export const simulate = (params: PhysarumParams, preloadedFoodMap?: Float32Array, foodImageRgb?: FoodImageData): SimulationResult => {
	const {
		width, height, agentCount, iterations,
		sensorAngle, sensorDistance, turnAngle, stepSize,
		depositAmount, decayFactor, seed,
		populationCount, populations, repulsionStrength, foodWeight,
		foodPlacement, foodDensity, foodClusterCount,
	} = params
	const rng = createPrng(seed)
	const size = width * height
	const hasColor = !!foodImageRgb

	// Use preloaded food map or generate one
	const foodMap = preloadedFoodMap ?? generateFoodMap(rng, width, height, foodPlacement, foodDensity, foodClusterCount)

	// Initialize per-population trail maps (double-buffered)
	const trailMaps: Float32Array[] = []
	const trailNextMaps: Float32Array[] = []
	for (let p = 0; p < populationCount; p++) {
		trailMaps.push(new Float32Array(size))
		trailNextMaps.push(new Float32Array(size))
	}

	// Color trail maps (only when food image RGB provided)
	let colorTrailR: Float32Array | undefined
	let colorTrailG: Float32Array | undefined
	let colorTrailB: Float32Array | undefined
	let colorNextR: Float32Array | undefined
	let colorNextG: Float32Array | undefined
	let colorNextB: Float32Array | undefined
	if (hasColor) {
		colorTrailR = new Float32Array(size)
		colorTrailG = new Float32Array(size)
		colorTrailB = new Float32Array(size)
		colorNextR = new Float32Array(size)
		colorNextG = new Float32Array(size)
		colorNextB = new Float32Array(size)
	}

	// Split agents across populations by agentFraction
	const popAgentCounts: number[] = []
	let assigned = 0
	for (let p = 0; p < populationCount; p++) {
		const count = p < populationCount - 1
			? Math.round(agentCount * populations[p].agentFraction)
			: agentCount - assigned
		popAgentCounts.push(count)
		assigned += count
	}

	// Agent stride: 3 floats [x, y, angle] or 6 floats [x, y, angle, r, g, b]
	const stride = hasColor ? 6 : 3
	const COLOR_BLEND = 0.05

	// Initialize agents per population
	const popAgents: Float32Array[] = []
	for (let p = 0; p < populationCount; p++) {
		const count = popAgentCounts[p]
		const agents = new Float32Array(count * stride)
		for (let i = 0; i < count; i++) {
			const idx = i * stride
			const ax = rng() * width
			const ay = rng() * height
			agents[idx] = ax
			agents[idx + 1] = ay
			agents[idx + 2] = rng() * TWO_PI
			if (hasColor) {
				const pi = Math.floor(clamp(ay, height)) * width + Math.floor(clamp(ax, width))
				agents[idx + 3] = foodImageRgb!.r[pi]
				agents[idx + 4] = foodImageRgb!.g[pi]
				agents[idx + 5] = foodImageRgb!.b[pi]
			}
		}
		popAgents.push(agents)
	}

	for (let iter = 0; iter < iterations; iter++) {
		// Process each population
		for (let p = 0; p < populationCount; p++) {
			const trail = trailMaps[p]
			const agents = popAgents[p]
			const count = popAgentCounts[p]

			for (let i = 0; i < count; i++) {
				const idx = i * stride
				let x = agents[idx]
				let y = agents[idx + 1]
				let angle = agents[idx + 2]

				// Sense at three directions with multi-population awareness
				const senseLeft = senseEffective(
					trailMaps, foodMap, p, populationCount,
					x, y, angle - sensorAngle, sensorDistance,
					width, height, repulsionStrength, foodWeight,
				)
				const senseCenter = senseEffective(
					trailMaps, foodMap, p, populationCount,
					x, y, angle, sensorDistance,
					width, height, repulsionStrength, foodWeight,
				)
				const senseRight = senseEffective(
					trailMaps, foodMap, p, populationCount,
					x, y, angle + sensorAngle, sensorDistance,
					width, height, repulsionStrength, foodWeight,
				)

				// Rotate
				if (senseCenter > senseLeft && senseCenter > senseRight) {
					// keep going straight
				} else if (senseCenter < senseLeft && senseCenter < senseRight) {
					angle += (rng() > 0.5 ? 1 : -1) * turnAngle
				} else if (senseLeft > senseRight) {
					angle -= turnAngle
				} else if (senseRight > senseLeft) {
					angle += turnAngle
				}

				// Move — die and respawn if out of bounds
				x = x + Math.cos(angle) * stepSize
				y = y + Math.sin(angle) * stepSize
				if (x < 0 || x >= width || y < 0 || y >= height) {
					x = rng() * width
					y = rng() * height
					angle = rng() * TWO_PI
					agents[idx] = x
					agents[idx + 1] = y
					agents[idx + 2] = angle
					if (hasColor) {
						const pi = Math.floor(clamp(y, height)) * width + Math.floor(clamp(x, width))
						agents[idx + 3] = foodImageRgb!.r[pi]
						agents[idx + 4] = foodImageRgb!.g[pi]
						agents[idx + 5] = foodImageRgb!.b[pi]
					}
					continue
				}

				agents[idx] = x
				agents[idx + 1] = y
				agents[idx + 2] = angle

				// Deposit onto own trail map only
				const tx = Math.floor(x)
				const ty = Math.floor(y)
				const pi = ty * width + tx
				trail[pi] += depositAmount

				// Color: blend toward food color at current position, then deposit
				if (hasColor) {
					const ar = agents[idx + 3]
					const ag = agents[idx + 4]
					const ab = agents[idx + 5]
					const fr = foodImageRgb!.r[pi]
					const fg = foodImageRgb!.g[pi]
					const fb = foodImageRgb!.b[pi]
					const nr = ar + (fr - ar) * COLOR_BLEND
					const ng = ag + (fg - ag) * COLOR_BLEND
					const nb = ab + (fb - ab) * COLOR_BLEND
					agents[idx + 3] = nr
					agents[idx + 4] = ng
					agents[idx + 5] = nb
					colorTrailR![pi] += nr * depositAmount
					colorTrailG![pi] += ng * depositAmount
					colorTrailB![pi] += nb * depositAmount
				}
			}
		}

		// Diffuse + Decay independently per trail map
		for (let p = 0; p < populationCount; p++) {
			const trail = trailMaps[p]
			const trailNext = trailNextMaps[p]

			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					let sum = 0
					let count = 0
					for (let dy = -1; dy <= 1; dy++) {
						const ny = y + dy
						if (ny < 0 || ny >= height) continue
						for (let dx = -1; dx <= 1; dx++) {
							const nx = x + dx
							if (nx < 0 || nx >= width) continue
							sum += trail[ny * width + nx]
							count++
						}
					}
					trailNext[y * width + x] = (sum / count) * decayFactor
				}
			}

			trail.set(trailNext)
		}

		// Diffuse color trails
		if (hasColor) {
			diffuseChannel(colorTrailR!, colorNextR!, width, height, decayFactor)
			diffuseChannel(colorTrailG!, colorNextG!, width, height, decayFactor)
			diffuseChannel(colorTrailB!, colorNextB!, width, height, decayFactor)
		}
	}

	// Normalize each trail map independently with gamma correction
	for (let p = 0; p < populationCount; p++) {
		const trail = trailMaps[p]
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
	}

	// Normalize color trails: preserve hue by dividing all channels by the same max intensity
	if (hasColor) {
		let maxIntensity = 0
		for (let i = 0; i < size; i++) {
			const total = colorTrailR![i] + colorTrailG![i] + colorTrailB![i]
			if (total > maxIntensity) maxIntensity = total
		}
		if (maxIntensity > 0) {
			const inv = 1 / maxIntensity
			for (let i = 0; i < size; i++) {
				colorTrailR![i] = Math.sqrt(colorTrailR![i] * inv)
				colorTrailG![i] = Math.sqrt(colorTrailG![i] * inv)
				colorTrailB![i] = Math.sqrt(colorTrailB![i] * inv)
			}
		}
	}

	return {
		trailMaps, foodMap, populationCount, populations, width, height,
		...(hasColor ? { colorTrailR, colorTrailG, colorTrailB } : {}),
	}
}

const sampleAt = (
	map: Float32Array,
	x: number, y: number,
	angle: number, distance: number,
	width: number, height: number,
) => {
	const sx = clamp(Math.floor(x + Math.cos(angle) * distance), width)
	const sy = clamp(Math.floor(y + Math.sin(angle) * distance), height)
	return map[sy * width + sx]
}

const senseEffective = (
	trailMaps: Float32Array[],
	foodMap: Float32Array,
	popIdx: number,
	populationCount: number,
	x: number, y: number,
	angle: number, distance: number,
	width: number, height: number,
	repulsionStrength: number,
	foodWeight: number,
) => {
	const ownSignal = sampleAt(trailMaps[popIdx], x, y, angle, distance, width, height)

	let alienSignal = 0
	for (let q = 0; q < populationCount; q++) {
		if (q !== popIdx) {
			alienSignal += sampleAt(trailMaps[q], x, y, angle, distance, width, height)
		}
	}

	const foodSignal = sampleAt(foodMap, x, y, angle, distance, width, height)

	return ownSignal - repulsionStrength * alienSignal + foodWeight * foodSignal
}
