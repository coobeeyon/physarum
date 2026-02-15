import { describe, expect, test } from "bun:test"
import { applyColormap } from "#engine/colormap.ts"

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
