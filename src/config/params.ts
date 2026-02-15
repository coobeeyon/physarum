import type { PhysarumParams } from "#types/physarum.ts"

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
}

export const COLORMAPS = ["magma", "viridis", "inferno", "plasma", "cividis"] as const
