import { describe, expect, test } from "bun:test"
import { applyColormap, applyMultiPopulationColors } from "#engine/colormap.ts"

describe("colormap", () => {
	test("produces RGBA output of correct size", () => {
		const trail = new Float32Array(4 * 4)
		trail.fill(0.5)
		const rgba = applyColormap(trail, 4, 4, "magma")
		expect(rgba.length).toBe(4 * 4 * 4)
	})

	test("all alpha values are 255", () => {
		const trail = new Float32Array(8 * 8)
		for (let i = 0; i < trail.length; i++) trail[i] = Math.random()
		const rgba = applyColormap(trail, 8, 8, "viridis")
		for (let i = 3; i < rgba.length; i += 4) {
			expect(rgba[i]).toBe(255)
		}
	})

	test("zero input maps to first color", () => {
		const trail = new Float32Array(1)
		trail[0] = 0
		const rgba = applyColormap(trail, 1, 1, "magma")
		// Magma starts at [0, 0, 4]
		expect(rgba[0]).toBe(0)
		expect(rgba[1]).toBe(0)
		expect(rgba[2]).toBe(4)
	})

	test("all colormaps produce output", () => {
		const trail = new Float32Array(4)
		trail.fill(0.5)
		for (const name of ["magma", "viridis", "inferno", "plasma", "cividis"] as const) {
			const rgba = applyColormap(trail, 2, 2, name)
			expect(rgba.length).toBe(16)
		}
	})
})

describe("multi-population colors", () => {
	test("produces correct output size", () => {
		const trailMaps = [new Float32Array(4 * 4), new Float32Array(4 * 4)]
		trailMaps[0].fill(0.5)
		trailMaps[1].fill(0.5)
		const populations = [
			{ color: [255, 0, 0] as const, agentFraction: 0.5 },
			{ color: [0, 0, 255] as const, agentFraction: 0.5 },
		]
		const rgba = applyMultiPopulationColors(trailMaps, populations, 4, 4)
		expect(rgba.length).toBe(4 * 4 * 4)
	})

	test("all alpha values are 255", () => {
		const trailMaps = [new Float32Array(4), new Float32Array(4)]
		trailMaps[0].fill(0.3)
		trailMaps[1].fill(0.7)
		const populations = [
			{ color: [255, 60, 40] as const, agentFraction: 0.5 },
			{ color: [40, 200, 255] as const, agentFraction: 0.5 },
		]
		const rgba = applyMultiPopulationColors(trailMaps, populations, 2, 2)
		for (let i = 3; i < rgba.length; i += 4) {
			expect(rgba[i]).toBe(255)
		}
	})

	test("additive blending works", () => {
		const trailMaps = [new Float32Array(1), new Float32Array(1)]
		trailMaps[0][0] = 1.0 // full red pop
		trailMaps[1][0] = 1.0 // full blue pop
		const populations = [
			{ color: [255, 0, 0] as const, agentFraction: 0.5 },
			{ color: [0, 0, 255] as const, agentFraction: 0.5 },
		]
		const rgba = applyMultiPopulationColors(trailMaps, populations, 1, 1)
		expect(rgba[0]).toBe(255) // R from pop 0
		expect(rgba[1]).toBe(0) // G from neither
		expect(rgba[2]).toBe(255) // B from pop 1
		expect(rgba[3]).toBe(255) // alpha
	})

	test("clamping to 255 works", () => {
		const trailMaps = [new Float32Array(1), new Float32Array(1)]
		trailMaps[0][0] = 1.0
		trailMaps[1][0] = 1.0
		const populations = [
			{ color: [200, 0, 0] as const, agentFraction: 0.5 },
			{ color: [200, 0, 0] as const, agentFraction: 0.5 },
		]
		const rgba = applyMultiPopulationColors(trailMaps, populations, 1, 1)
		// 200 + 200 = 400, should clamp to 255
		expect(rgba[0]).toBe(255)
	})

	test("zero intensity produces black", () => {
		const trailMaps = [new Float32Array(1), new Float32Array(1)]
		// Both zero by default
		const populations = [
			{ color: [255, 60, 40] as const, agentFraction: 0.5 },
			{ color: [40, 200, 255] as const, agentFraction: 0.5 },
		]
		const rgba = applyMultiPopulationColors(trailMaps, populations, 1, 1)
		expect(rgba[0]).toBe(0)
		expect(rgba[1]).toBe(0)
		expect(rgba[2]).toBe(0)
	})
})
