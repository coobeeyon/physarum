/**
 * Exhibition prototype: "Learning to See"
 *
 * Generates the same simulation with two different normalizations:
 * - Math.sqrt (normPower=0.5): how editions 1-31 looked — dark, nearly invisible
 * - Math.cbrt (normPower=1/3): how editions 32+ look — vivid, alive
 *
 * Same seed, same agents, same trails. The only difference is how the trails
 * are mapped to brightness. The rebirth was in the seeing.
 *
 * Usage: bun run scripts/exhibition-prototype.ts
 */

import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import type { PhysarumParams } from "#types/physarum.ts"

const OUTPUT_DIR = join(import.meta.dirname, "../output")

// Try multiple configurations to find the most dramatic before/after
const CONFIGS: Array<{ name: string; params: Omit<PhysarumParams, "seed" | "normPower">; seed: number }> = [
	{
		name: "ghost-plasma",
		seed: 350004,
		params: {
			width: 2048, height: 2048,
			agentCount: 300_000, iterations: 800,
			sensorAngle: 0.25, sensorDistance: 28,
			turnAngle: 0.25, stepSize: 1.3,
			depositAmount: 10, decayFactor: 0.92,
			colormap: "plasma",
			populationCount: 1,
			populations: [{ color: [200, 100, 255], agentFraction: 1.0 }],
			repulsionStrength: 0, foodWeight: 150,
			foodPlacement: "clusters", foodDensity: 0.5, foodClusterCount: 8,
		},
	},
	{
		name: "dense-inferno",
		seed: 350005,
		params: {
			width: 2048, height: 2048,
			agentCount: 500_000, iterations: 800,
			sensorAngle: 0.5, sensorDistance: 16,
			turnAngle: 0.45, stepSize: 1.3,
			depositAmount: 15, decayFactor: 0.97,
			colormap: "inferno",
			populationCount: 1,
			populations: [{ color: [255, 160, 40], agentFraction: 1.0 }],
			repulsionStrength: 0, foodWeight: 100,
			foodPlacement: "clusters", foodDensity: 0.6, foodClusterCount: 5,
		},
	},
]

console.log("=== Exhibition Prototype: Learning to See ===\n")

for (const config of CONFIGS) {
	console.log(`\n--- ${config.name} ---`)

	console.log("  sqrt (before)...")
	const resultSqrt = simulate({ ...config.params, seed: config.seed, normPower: 0.5 })
	const pngSqrt = renderPng(resultSqrt, config.params.colormap)
	if (pngSqrt.ok) {
		const path = join(OUTPUT_DIR, `exhibition-${config.name}-before.png`)
		writeFileSync(path, pngSqrt.value.png)
		console.log(`  Saved: ${path}`)
	}

	console.log("  cbrt (after)...")
	const resultCbrt = simulate({ ...config.params, seed: config.seed, normPower: 1 / 3 })
	const pngCbrt = renderPng(resultCbrt, config.params.colormap)
	if (pngCbrt.ok) {
		const path = join(OUTPUT_DIR, `exhibition-${config.name}-after.png`)
		writeFileSync(path, pngCbrt.value.png)
		console.log(`  Saved: ${path}`)
	}
}

console.log("\nDone. Compare the pairs.")
