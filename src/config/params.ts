import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"

export const DEFAULT_POPULATIONS: readonly PopulationConfig[] = [
	{ color: [255, 60, 40], agentFraction: 0.34 },
	{ color: [40, 200, 255], agentFraction: 0.33 },
	{ color: [60, 255, 100], agentFraction: 0.33 },
]

export const DEFAULT_PARAMS: Omit<PhysarumParams, "seed"> = {
	width: 2048,
	height: 2048,
	agentCount: 300_000,
	iterations: 300,
	sensorAngle: Math.PI / 4,
	sensorDistance: 9,
	turnAngle: Math.PI / 4,
	stepSize: 1,
	depositAmount: 15,
	decayFactor: 0.95,
	colormap: "magma",
	populationCount: 3,
	populations: DEFAULT_POPULATIONS,
	repulsionStrength: 0.5,
	foodWeight: 150.0,
	foodPlacement: "mixed",
	foodDensity: 0.8,
	foodClusterCount: 12,
}

export const COLORMAPS = ["magma", "viridis", "inferno", "plasma", "cividis"] as const
