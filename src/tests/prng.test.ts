import { describe, expect, test } from "bun:test"
import { createPrng } from "#engine/prng.ts"

describe("prng", () => {
	test("deterministic output for same seed", () => {
		const rng1 = createPrng(42)
		const rng2 = createPrng(42)
		const values1 = Array.from({ length: 100 }, () => rng1())
		const values2 = Array.from({ length: 100 }, () => rng2())
		expect(values1).toEqual(values2)
	})

	test("different seeds produce different sequences", () => {
		const rng1 = createPrng(42)
		const rng2 = createPrng(43)
		const v1 = rng1()
		const v2 = rng2()
		expect(v1).not.toEqual(v2)
	})

	test("values are in [0, 1)", () => {
		const rng = createPrng(123)
		for (let i = 0; i < 10000; i++) {
			const v = rng()
			expect(v).toBeGreaterThanOrEqual(0)
			expect(v).toBeLessThan(1)
		}
	})
})
