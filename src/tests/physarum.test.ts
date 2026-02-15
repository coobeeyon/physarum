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
}

describe("physarum simulation", () => {
	test("deterministic for same seed", () => {
		const trail1 = simulate(SMALL_PARAMS)
		const trail2 = simulate(SMALL_PARAMS)
		expect(trail1).toEqual(trail2)
	})

	test("returns correct size", () => {
		const trail = simulate(SMALL_PARAMS)
		expect(trail.length).toBe(64 * 64)
	})

	test("values are normalized to [0, 1]", () => {
		const trail = simulate(SMALL_PARAMS)
		let max = 0
		let min = Infinity
		for (const v of trail) {
			if (v > max) max = v
			if (v < min) min = v
		}
		expect(min).toBeGreaterThanOrEqual(0)
		expect(max).toBeLessThanOrEqual(1)
		// Should have some non-zero values
		expect(max).toBeGreaterThan(0)
	})

	test("different seeds produce different results", () => {
		const trail1 = simulate(SMALL_PARAMS)
		const trail2 = simulate({ ...SMALL_PARAMS, seed: 99 })
		// At least some values should differ
		let differs = false
		for (let i = 0; i < trail1.length; i++) {
			if (trail1[i] !== trail2[i]) {
				differs = true
				break
			}
		}
		expect(differs).toBe(true)
	})
})
