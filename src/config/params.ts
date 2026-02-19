import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"

export const DEFAULT_POPULATIONS: readonly PopulationConfig[] = [
	{ color: [255, 85, 15], agentFraction: 0.55 },
	{ color: [15, 165, 255], agentFraction: 0.45 },
]

export const DEFAULT_PARAMS: Omit<PhysarumParams, "seed"> = {
	width: 2048,
	height: 2048,
	agentCount: 400_000,
	iterations: 600,
	sensorAngle: 0.5,
	sensorDistance: 18,
	turnAngle: 0.5,
	stepSize: 1.3,
	depositAmount: 10,
	decayFactor: 0.96,
	colormap: "inferno",
	populationCount: 2,
	populations: DEFAULT_POPULATIONS,
	repulsionStrength: 0.4,
	foodWeight: 150.0,
	foodPlacement: "gradient",
	foodDensity: 0.7,
	foodClusterCount: 6,
}

export const COLORMAPS = ["magma", "viridis", "inferno", "plasma", "cividis"] as const
