import { describe, expect, test } from "bun:test"
import { createCanvas } from "canvas"
import { generateFoodMap, loadFoodImage } from "#engine/food.ts"
import { createPrng } from "#engine/prng.ts"
import type { FoodPlacementStrategy } from "#types/physarum.ts"

const W = 64
const H = 64

describe("food map", () => {
	test("deterministic for same seed", () => {
		const map1 = generateFoodMap(createPrng(42), W, H, "clusters", 0.6, 8)
		const map2 = generateFoodMap(createPrng(42), W, H, "clusters", 0.6, 8)
		expect(map1).toEqual(map2)
	})

	test("correct size", () => {
		const map = generateFoodMap(createPrng(42), W, H, "clusters", 0.6, 8)
		expect(map.length).toBe(W * H)
	})

	test("values in [0, 1]", () => {
		for (const strategy of ["clusters", "rings", "gradient", "grid", "mixed"] as const) {
			const map = generateFoodMap(createPrng(42), W, H, strategy, 0.6, 8)
			for (const v of map) {
				expect(v).toBeGreaterThanOrEqual(0)
				expect(v).toBeLessThanOrEqual(1)
			}
		}
	})

	test("different strategies produce different patterns", () => {
		const strategies: FoodPlacementStrategy[] = ["clusters", "rings", "gradient", "grid"]
		const maps = strategies.map((s) => generateFoodMap(createPrng(42), W, H, s, 0.6, 8))

		// Each pair should differ
		for (let a = 0; a < maps.length; a++) {
			for (let b = a + 1; b < maps.length; b++) {
				let differs = false
				for (let i = 0; i < maps[a].length; i++) {
					if (maps[a][i] !== maps[b][i]) {
						differs = true
						break
					}
				}
				expect(differs).toBe(true)
			}
		}
	})

	test("clusters has non-zero values", () => {
		const map = generateFoodMap(createPrng(42), W, H, "clusters", 0.6, 8)
		let hasNonZero = false
		for (const v of map) {
			if (v > 0) {
				hasNonZero = true
				break
			}
		}
		expect(hasNonZero).toBe(true)
	})

	test("mixed combines strategies", () => {
		const map = generateFoodMap(createPrng(42), W, H, "mixed", 0.6, 8)
		let hasNonZero = false
		for (const v of map) {
			if (v > 0) {
				hasNonZero = true
				break
			}
		}
		expect(hasNonZero).toBe(true)
	})

	test("different seeds produce different maps", () => {
		const map1 = generateFoodMap(createPrng(42), W, H, "clusters", 0.6, 8)
		const map2 = generateFoodMap(createPrng(99), W, H, "clusters", 0.6, 8)
		let differs = false
		for (let i = 0; i < map1.length; i++) {
			if (map1[i] !== map2[i]) {
				differs = true
				break
			}
		}
		expect(differs).toBe(true)
	})

	test("image strategy throws without preloaded map", () => {
		expect(() => generateFoodMap(createPrng(42), W, H, "image", 0.6, 8)).toThrow()
	})
})

describe("loadFoodImage", () => {
	test("returns FoodImageData with luminance, RGB, and native dimensions", async () => {
		// Create a small test PNG: left half white, right half black
		const canvas = createCanvas(8, 8)
		const ctx = canvas.getContext("2d")
		ctx.fillStyle = "#ffffff"
		ctx.fillRect(0, 0, 4, 8)
		ctx.fillStyle = "#000000"
		ctx.fillRect(4, 0, 4, 8)
		const buf = canvas.toBuffer("image/png")

		const data = await loadFoodImage(buf)
		expect(data.width).toBe(8)
		expect(data.height).toBe(8)
		expect(data.luminance.length).toBe(64)
		expect(data.r.length).toBe(64)
		expect(data.g.length).toBe(64)
		expect(data.b.length).toBe(64)

		// Left half should be ~1.0 (white), right half should be ~0.0 (black)
		for (let y = 0; y < 8; y++) {
			expect(data.luminance[y * 8 + 0]).toBeCloseTo(1.0, 1)
			expect(data.luminance[y * 8 + 7]).toBeCloseTo(0.0, 1)
			expect(data.r[y * 8 + 0]).toBeCloseTo(1.0, 1)
			expect(data.r[y * 8 + 7]).toBeCloseTo(0.0, 1)
		}
	})

	test("preserves color channels", async () => {
		// Create red image
		const canvas = createCanvas(4, 4)
		const ctx = canvas.getContext("2d")
		ctx.fillStyle = "#ff0000"
		ctx.fillRect(0, 0, 4, 4)
		const buf = canvas.toBuffer("image/png")

		const data = await loadFoodImage(buf)
		for (let i = 0; i < 16; i++) {
			expect(data.r[i]).toBeCloseTo(1.0, 1)
			expect(data.g[i]).toBeCloseTo(0.0, 1)
			expect(data.b[i]).toBeCloseTo(0.0, 1)
		}
	})

	test("uses native image dimensions", async () => {
		const canvas = createCanvas(16, 24)
		const ctx = canvas.getContext("2d")
		ctx.fillStyle = "#808080"
		ctx.fillRect(0, 0, 16, 24)
		const buf = canvas.toBuffer("image/png")

		const data = await loadFoodImage(buf)
		expect(data.width).toBe(16)
		expect(data.height).toBe(24)
		expect(data.luminance.length).toBe(16 * 24)

		// All luminance values should be ~0.5 (mid-gray)
		for (const v of data.luminance) {
			expect(v).toBeCloseTo(0.502, 1) // 128/255
		}
	})
})
