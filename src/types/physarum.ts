export type ColormapName = "magma" | "viridis" | "inferno" | "plasma" | "cividis"

export type PhysarumParams = {
	readonly seed: number
	readonly width: number
	readonly height: number
	readonly agentCount: number
	readonly iterations: number
	readonly sensorAngle: number
	readonly sensorDistance: number
	readonly turnAngle: number
	readonly stepSize: number
	readonly depositAmount: number
	readonly decayFactor: number
	readonly colormap: ColormapName
}
