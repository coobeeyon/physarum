/**
 * Draft: run physarum on Tokyo rail food sources (no minting)
 * Second attempt — stronger food attraction, more agents, longer simulation
 */
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import { loadFoodImage } from "#engine/food.ts"
import { writeFileSync } from "node:fs"

const seed = 36002
const foodImagePath = "output/tokyo-rail-food.png"

const foodImage = await loadFoodImage(foodImagePath)
console.log("Food image loaded:", foodImage.width, "x", foodImage.height)

// V2: much stronger food attraction, more agents, longer simulation
// Agents should form bright connecting paths between cities
const params = {
	seed,
	width: 2048,
	height: 2048,
	agentCount: 500_000,
	iterations: 2000,
	sensorAngle: 0.35,      // lower = longer filaments between cities
	sensorDistance: 28,       // further sensing to detect distant food
	turnAngle: 0.35,
	stepSize: 1.3,
	depositAmount: 22,        // brighter trails
	decayFactor: 0.93,        // trails persist longer
	colormap: "inferno" as const,
	populationCount: 1,
	populations: [{ color: [255, 160, 40] as [number, number, number], agentFraction: 1.0 }],
	repulsionStrength: 0,
	foodWeight: 350,          // much stronger food attraction
	foodPlacement: "image" as const,
	foodDensity: 0.7,
	foodClusterCount: 6,
}

console.log(`Simulating (${params.iterations} iterations, ${params.agentCount/1000}k agents, foodWeight=${params.foodWeight})...`)
const startTime = Date.now()
const result = simulate(params, foodImage.luminance, foodImage)
const elapsed = ((Date.now() - startTime) / 1000).toFixed(0)
console.log(`Simulation done in ${elapsed}s`)

for (const cmap of ["inferno", "viridis", "cividis"] as const) {
	const rendered = renderPng(result, cmap)
	if (!rendered.ok) { console.error(rendered.error); process.exit(1) }
	writeFileSync(`output/tokyo-rail-v2-${cmap}.png`, rendered.value.png)
	console.log(`Saved: output/tokyo-rail-v2-${cmap}.png (${(rendered.value.png.length / 1024).toFixed(0)} KB)`)
}
