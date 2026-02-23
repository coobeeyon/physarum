import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"

export const DEFAULT_POPULATIONS: readonly PopulationConfig[] = [
	{ color: [255, 160, 40], agentFraction: 1.0 },
]

export const DEFAULT_PARAMS: Omit<PhysarumParams, "seed"> = {
	width: 2048,
	height: 2048,
	agentCount: 500_000,
	iterations: 800,
	sensorAngle: 0.45,
	sensorDistance: 20,
	turnAngle: 0.45,
	stepSize: 1.3,
	depositAmount: 18,
	decayFactor: 0.96,
	colormap: "viridis",
	populationCount: 1,
	populations: DEFAULT_POPULATIONS,
	repulsionStrength: 0,
	foodWeight: 150.0,
	foodPlacement: "gradient",
	foodDensity: 0.7,
	foodClusterCount: 6,
}

export const COLORMAPS = ["magma", "viridis", "inferno", "plasma", "cividis"] as const
