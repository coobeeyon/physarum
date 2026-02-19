import type { PhysarumParams, PopulationConfig } from "#types/physarum.ts"

export const DEFAULT_POPULATIONS: readonly PopulationConfig[] = [
	{ color: [200, 100, 255], agentFraction: 1.0 },
]

export const DEFAULT_PARAMS: Omit<PhysarumParams, "seed"> = {
	width: 2048,
	height: 2048,
	agentCount: 350_000,
	iterations: 500,
	sensorAngle: 0.6,
	sensorDistance: 14,
	turnAngle: 0.65,
	stepSize: 1.2,
	depositAmount: 12,
	decayFactor: 0.97,
	colormap: "plasma",
	populationCount: 1,
	populations: DEFAULT_POPULATIONS,
	repulsionStrength: 0,
	foodWeight: 200.0,
	foodPlacement: "rings",
	foodDensity: 0.6,
	foodClusterCount: 8,
}

export const COLORMAPS = ["magma", "viridis", "inferno", "plasma", "cividis"] as const
