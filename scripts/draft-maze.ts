/**
 * Draft: run physarum on maze (no minting)
 */
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import { loadFoodImage } from "#engine/food.ts"
import { writeFileSync } from "node:fs"

const seed = 35001
const foodImagePath = "output/maze.png"

const foodImage = await loadFoodImage(foodImagePath)
console.log("Food image loaded:", foodImage.width, "x", foodImage.height)

const params = {
  seed,
  width: 2048,
  height: 2048,
  agentCount: 200_000,
  iterations: 2000,
  sensorAngle: 0.4,
  sensorDistance: 28,
  turnAngle: 0.3,
  stepSize: 1.2,
  depositAmount: 18,
  decayFactor: 0.95,
  colormap: "viridis" as const,
  populationCount: 1,
  populations: [{ color: [255, 160, 40] as [number, number, number], agentFraction: 1.0 }],
  repulsionStrength: 0,
  foodWeight: 500,
  foodPlacement: "image" as const,
  foodDensity: 0.7,
  foodClusterCount: 6,
}

console.log("Simulating (2000 iterations, 200k agents, foodWeight=500)...")
const result = simulate(params, foodImage.luminance, foodImage)

// Render both colormaps
for (const cmap of ["viridis", "inferno"] as const) {
  const rendered = renderPng(result, cmap)
  if (!rendered.ok) { console.error(rendered.error); process.exit(1) }
  writeFileSync(`output/maze-sim-${cmap}.png`, rendered.value.png)
  console.log(`Saved: output/maze-sim-${cmap}.png`, rendered.value.png.length, "bytes")
}
