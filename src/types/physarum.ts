export type { FoodImageData } from "#engine/food.ts"

export type ColormapName = "magma" | "viridis" | "inferno" | "plasma" | "cividis"

export type FoodPlacementStrategy = "clusters" | "rings" | "gradient" | "grid" | "mixed" | "image"

export type PopulationConfig = {
	readonly color: readonly [number, number, number]
	readonly agentFraction: number
}

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
	readonly populationCount: number
	readonly populations: readonly PopulationConfig[]
	readonly repulsionStrength: number
	readonly foodWeight: number
	readonly foodPlacement: FoodPlacementStrategy
	readonly foodDensity: number
	readonly foodClusterCount: number
	readonly foodImageSource?: string
	readonly normPower?: number // gamma correction exponent: 1/3 (cbrt, default) or 1/2 (sqrt, old)
}

export type SimulationResult = {
	readonly trailMaps: Float32Array[]
	readonly foodMap: Float32Array
	readonly populationCount: number
	readonly populations: readonly PopulationConfig[]
	readonly width: number
	readonly height: number
	readonly colorTrailR?: Float32Array
	readonly colorTrailG?: Float32Array
	readonly colorTrailB?: Float32Array
}
