import { describe, expect, test } from "bun:test"
import { simulate } from "#engine/physarum.ts"
import type { PhysarumParams } from "#types/physarum.ts"
const SMALL_PARAMS: PhysarumParams = {
	seed: 42,
	width: 64,
	height: 64,
	agentCount: 100,
	iterations: 10,
	sensorAngle: Math.PI / 4,
	sensorDistance: 9,
	turnAngle: Math.PI / 4,
	stepSize: 1,
	depositAmount: 5,
	decayFactor: 0.9,
	colormap: "magma",
	populationCount: 3,
	populations: [
		{ color: [255, 60, 40], agentFraction: 0.34 },
		{ color: [40, 200, 255], agentFraction: 0.33 },
		{ color: [60, 255, 100], agentFraction: 0.33 },
	],
	repulsionStrength: 0.5,
	foodWeight: 2.0,
	foodPlacement: "mixed",
	foodDensity: 0.6,
	foodClusterCount: 8,
}

describe("physarum simulation", () => {
	test("deterministic for same seed", () => {
		const r1 = simulate(SMALL_PARAMS)
		const r2 = simulate(SMALL_PARAMS)
		for (let p = 0; p < r1.populationCount; p++) {
			expect(r1.trailMaps[p]).toEqual(r2.trailMaps[p])
		}
		expect(r1.foodMap).toEqual(r2.foodMap)
	})

	test("returns correct number of trail maps", () => {
		const result = simulate(SMALL_PARAMS)
		expect(result.trailMaps.length).toBe(3)
		expect(result.populationCount).toBe(3)
	})

	test("trail maps have correct size", () => {
		const result = simulate(SMALL_PARAMS)
		for (const trail of result.trailMaps) {
			expect(trail.length).toBe(64 * 64)
		}
	})

	test("food map has correct size", () => {
		const result = simulate(SMALL_PARAMS)
		expect(result.foodMap.length).toBe(64 * 64)
	})

	test("trail values are normalized to [0, 1]", () => {
		const result = simulate(SMALL_PARAMS)
		for (const trail of result.trailMaps) {
			let max = 0
			let min = Infinity
			for (const v of trail) {
				if (v > max) max = v
				if (v < min) min = v
			}
			expect(min).toBeGreaterThanOrEqual(0)
			expect(max).toBeLessThanOrEqual(1)
		}
	})

	test("at least one population has non-zero trail", () => {
		const result = simulate(SMALL_PARAMS)
		let anyNonZero = false
		for (const trail of result.trailMaps) {
			for (const v of trail) {
				if (v > 0) { anyNonZero = true; break }
			}
			if (anyNonZero) break
		}
		expect(anyNonZero).toBe(true)
	})

	test("different seeds produce different results", () => {
		const r1 = simulate(SMALL_PARAMS)
		const r2 = simulate({ ...SMALL_PARAMS, seed: 99 })
		let differs = false
		for (let i = 0; i < r1.trailMaps[0].length; i++) {
			if (r1.trailMaps[0][i] !== r2.trailMaps[0][i]) {
				differs = true
				break
			}
		}
		expect(differs).toBe(true)
	})

	test("single population works", () => {
		const singlePop: PhysarumParams = {
			...SMALL_PARAMS,
			populationCount: 1,
			populations: [{ color: [255, 255, 255], agentFraction: 1.0 }],
		}
		const result = simulate(singlePop)
		expect(result.trailMaps.length).toBe(1)
		expect(result.trailMaps[0].length).toBe(64 * 64)
	})

	test("populations have distinct trails", () => {
		const result = simulate(SMALL_PARAMS)
		// Trail maps for different populations should differ
		let differs = false
		for (let i = 0; i < result.trailMaps[0].length; i++) {
			if (result.trailMaps[0][i] !== result.trailMaps[1][i]) {
				differs = true
				break
			}
		}
		expect(differs).toBe(true)
	})

	test("accepts preloaded food map", () => {
		const size = SMALL_PARAMS.width * SMALL_PARAMS.height
		const foodMap = new Float32Array(size)
		// Create a gradient food map
		for (let i = 0; i < size; i++) {
			foodMap[i] = i / size
		}

		const result = simulate(SMALL_PARAMS, foodMap)
		expect(result.foodMap).toBe(foodMap) // same reference
		expect(result.trailMaps.length).toBe(SMALL_PARAMS.populationCount)

		// Should produce non-zero trails
		let anyNonZero = false
		for (const trail of result.trailMaps) {
			for (const v of trail) {
				if (v > 0) { anyNonZero = true; break }
			}
			if (anyNonZero) break
		}
		expect(anyNonZero).toBe(true)
	})

	test("returns color trails when foodImageRgb provided", () => {
		const size = SMALL_PARAMS.width * SMALL_PARAMS.height
		const foodMap = new Float32Array(size)
		const r = new Float32Array(size)
		const g = new Float32Array(size)
		const b = new Float32Array(size)
		// Red gradient food image
		for (let i = 0; i < size; i++) {
			const t = i / size
			foodMap[i] = t
			r[i] = t
			g[i] = 0.2
			b[i] = 0.1
		}

		const result = simulate(SMALL_PARAMS, foodMap, { width: SMALL_PARAMS.width, height: SMALL_PARAMS.height, luminance: foodMap, r, g, b })
		expect(result.colorTrailR).toBeDefined()
		expect(result.colorTrailG).toBeDefined()
		expect(result.colorTrailB).toBeDefined()
		expect(result.colorTrailR!.length).toBe(size)
		expect(result.colorTrailG!.length).toBe(size)
		expect(result.colorTrailB!.length).toBe(size)

		// At least some color values should be non-zero
		let anyNonZero = false
		for (let i = 0; i < size; i++) {
			if (result.colorTrailR![i] > 0 || result.colorTrailG![i] > 0 || result.colorTrailB![i] > 0) {
				anyNonZero = true
				break
			}
		}
		expect(anyNonZero).toBe(true)
	})

	test("no color trails without foodImageRgb", () => {
		const result = simulate(SMALL_PARAMS)
		expect(result.colorTrailR).toBeUndefined()
		expect(result.colorTrailG).toBeUndefined()
		expect(result.colorTrailB).toBeUndefined()
	})
})
