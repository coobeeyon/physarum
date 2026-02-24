/**
 * Draft: physarum on Tokyo rail food sources — 2-population competition
 * WINNING PARAMETERS (v6/v7) — ready for final render and minting.
 *
 * Concept: Tero et al. 2010 (Science) placed real physarum on a map of Tokyo
 * with oat flakes at city positions. The organism built a network matching
 * the actual rail system. We try the same with two competing digital colonies.
 *
 * For minting: run at 2048x2048 (remove maxSide param from loadFoodImage).
 * The 1024x1024 drafts take ~8 min; 2048x2048 will take ~30 min.
 */
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import { loadFoodImage } from "#engine/food.ts"
import { writeFileSync } from "node:fs"

const seed = 36007
const foodImagePath = "output/tokyo-rail-food.png"

// Draft at 1024x1024 for fast iteration; remove maxSide for final render
const foodImage = await loadFoodImage(foodImagePath, 1024)
console.log("Food image loaded:", foodImage.width, "x", foodImage.height)

const params = {
	seed,
	width: foodImage.width,
	height: foodImage.height,
	agentCount: 500_000,
	iterations: 2000,
	sensorAngle: 0.30,
	sensorDistance: 22,
	turnAngle: 0.35,
	stepSize: 1.0,
	depositAmount: 25,
	decayFactor: 0.93,
	colormap: "inferno" as const,
	populationCount: 2,
	populations: [
		{ color: [40, 120, 255] as [number, number, number], agentFraction: 0.5 },   // blue
		{ color: [255, 140, 30] as [number, number, number], agentFraction: 0.5 },    // orange
	],
	repulsionStrength: 0.45,
	foodWeight: 200,
	foodPlacement: "image" as const,
	foodDensity: 0.7,
	foodClusterCount: 6,
}

console.log(`Simulating (${params.iterations} iter, ${params.agentCount/1000}k agents, ${params.width}x${params.height}, 2-pop, foodWeight=${params.foodWeight})...`)
const startTime = Date.now()
const result = simulate(params, foodImage.luminance, foodImage)
const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
console.log(`Simulation done in ${elapsed}s`)

const rendered = renderPng(result)
if (!rendered.ok) { console.error(rendered.error); process.exit(1) }
writeFileSync("output/tokyo-rail-final.png", rendered.value.png)
console.log(`Saved: output/tokyo-rail-final.png (${(rendered.value.png.length / 1024).toFixed(0)} KB)`)
