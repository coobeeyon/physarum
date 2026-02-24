/**
 * Exhibition: Recursive Generations for "Cusp of Rebirth"
 *
 * Gen0: Edition 34 — biological physarum → digital simulation (already rendered)
 * Gen1: Feed Gen0's output to a 2-colony simulation. Competition introduced.
 * Gen2: Feed Gen1's output to a 3-colony simulation. Complexity from competition.
 *
 * The biological organism's vein network persists as a ghost structure
 * through each generation. Each generation is a rebirth.
 *
 * Usage: bun run scripts/exhibition-recursive.ts
 */

import { writeFileSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import { loadFoodImage } from "#engine/food.ts"
import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"

const OUTPUT_DIR = join(import.meta.dirname, "../output")
const GEN0_PATH = join(import.meta.dirname, "../assets/ed34-physarum-selfportrait.png")

// ---- Gen1: 2-colony competition tracing Gen0's ghost ----

const GEN1_CONFIGS = [
	{
		name: "gen1-inferno-2pop",
		seed: 34001,
		colormap: "inferno" as const,
		populations: [
			{ color: [255, 120, 20], agentFraction: 0.5 },   // orange
			{ color: [20, 100, 255], agentFraction: 0.5 },   // blue
		] as PopulationConfig[],
		agentCount: 500_000,
		iterations: 1000,
		sensorAngle: 0.35,
		sensorDistance: 24,
		repulsion: 0.5,
		foodWeight: 55,
	},
	{
		name: "gen1-plasma-2pop",
		seed: 34002,
		colormap: "plasma" as const,
		populations: [
			{ color: [50, 255, 120], agentFraction: 0.5 },   // green
			{ color: [255, 50, 200], agentFraction: 0.5 },   // magenta
		] as PopulationConfig[],
		agentCount: 500_000,
		iterations: 1000,
		sensorAngle: 0.35,
		sensorDistance: 24,
		repulsion: 0.5,
		foodWeight: 55,
	},
]

// ---- Gen2: 3-colony ecology on Gen1's skeleton ----

const GEN2_CONFIG = {
	name: "gen2-magma-3pop",
	seed: 34003,
	colormap: "magma" as const,
	populations: [
		{ color: [255, 60, 40], agentFraction: 0.34 },    // red
		{ color: [40, 255, 200], agentFraction: 0.33 },   // cyan
		{ color: [80, 255, 60], agentFraction: 0.33 },    // green
	] as PopulationConfig[],
	agentCount: 500_000,
	iterations: 800,
	sensorAngle: 0.4,
	sensorDistance: 20,
	repulsion: 0.35,
	foodWeight: 50,
}

async function generateFromFood(
	foodPath: string,
	config: typeof GEN1_CONFIGS[0] | typeof GEN2_CONFIG,
): Promise<Buffer | null> {
	console.log(`  Loading food image: ${foodPath}`)
	const foodData = await loadFoodImage(foodPath, 2048)
	const { width, height } = foodData

	// Scale agent count to image area
	const areaRatio = (width * height) / (2048 * 2048)
	const scaledAgents = Math.round(config.agentCount * areaRatio)

	const params: PhysarumParams = {
		seed: config.seed,
		width,
		height,
		agentCount: scaledAgents,
		iterations: config.iterations,
		sensorAngle: config.sensorAngle,
		sensorDistance: config.sensorDistance,
		turnAngle: 0.45,
		stepSize: 1.3,
		depositAmount: 18,
		decayFactor: 0.96,
		colormap: config.colormap,
		populationCount: config.populations.length,
		populations: config.populations,
		repulsionStrength: config.repulsion,
		foodWeight: Math.min(config.foodWeight, 60),
		foodPlacement: "image",
		foodDensity: 0.7,
		foodClusterCount: 6,
		normPower: 1 / 3,
	}

	console.log(`  Simulating: ${scaledAgents} agents, ${config.iterations} iter, ${config.populations.length} pops...`)
	const result = simulate(params, foodData.luminance, foodData)

	console.log(`  Rendering...`)
	const png = renderPng(result, config.colormap)
	if (!png.ok) {
		console.error(`  Render failed: ${png.error}`)
		return null
	}

	const outPath = join(OUTPUT_DIR, `exhibition-${config.name}.png`)
	writeFileSync(outPath, png.value.png)
	console.log(`  Saved: ${outPath} (${(png.value.png.length / 1024).toFixed(0)} KB)`)
	return png.value.png
}

async function main() {
	console.log("=== Exhibition: Recursive Generations ===")
	console.log("Theme: Cusp of Rebirth — each generation transforms the last\n")

	// Gen0 already exists (ed 34)
	console.log("Gen0: Edition 34 (biological physarum → digital simulation)")
	console.log(`  Source: ${GEN0_PATH}\n`)

	// Gen1: 2 variants
	let strongestGen1Path: string | null = null

	for (const config of GEN1_CONFIGS) {
		console.log(`\n--- Gen1: ${config.name} ---`)
		const pngBuf = await generateFromFood(GEN0_PATH, config)
		if (pngBuf && config.name === "gen1-inferno-2pop") {
			// Save for Gen2 input
			strongestGen1Path = join(OUTPUT_DIR, `exhibition-${config.name}.png`)
		}
	}

	// Gen2: feed Gen1 inferno to 3-colony
	if (strongestGen1Path) {
		console.log(`\n--- Gen2: ${GEN2_CONFIG.name} (feeding Gen1 inferno) ---`)
		await generateFromFood(strongestGen1Path, GEN2_CONFIG)
	}

	console.log("\n=== Done. Review output/ directory. ===")
}

main().catch(console.error)
