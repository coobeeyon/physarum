import type { Genome } from "#types/evolution.ts"
import type { ColormapName, FoodPlacementStrategy } from "#types/physarum.ts"

/**
 * Aesthetic mode: a set of visually-important parameters that override the base genome.
 * Each mode produces a distinctly different visual character.
 * stepSize, depositAmount, and foodWeight are inherited from the base genome (less visually critical).
 */
type AestheticMode = Pick<
	Genome,
	| "agentCount"
	| "iterations"
	| "sensorAngle"
	| "sensorDistance"
	| "turnAngle"
	| "decayFactor"
	| "colormap"
	| "populationCount"
	| "populations"
	| "repulsionStrength"
	| "foodPlacement"
	| "foodDensity"
	| "foodClusterCount"
>

const MODES: readonly AestheticMode[] = [
	// Mode 0: Dense mycelium — viridis, clusters, thick persistent network
	{
		agentCount: 500_000,
		iterations: 600,
		sensorAngle: 0.65,
		sensorDistance: 12,
		turnAngle: 0.6,
		decayFactor: 0.98,
		colormap: "viridis" as ColormapName,
		populationCount: 1,
		populations: [{ color: [20, 220, 160] as readonly [number, number, number], agentFraction: 1 }],
		repulsionStrength: 0,
		foodPlacement: "clusters" as FoodPlacementStrategy,
		foodDensity: 0.7,
		foodClusterCount: 12,
	},

	// Mode 1: River delta — long flowing orange filaments, gradient food
	{
		agentCount: 400_000,
		iterations: 700,
		sensorAngle: 0.3,
		sensorDistance: 26,
		turnAngle: 0.3,
		decayFactor: 0.94,
		colormap: "inferno" as ColormapName,
		populationCount: 1,
		populations: [{ color: [255, 140, 20] as readonly [number, number, number], agentFraction: 1 }],
		repulsionStrength: 0,
		foodPlacement: "gradient" as FoodPlacementStrategy,
		foodDensity: 0.55,
		foodClusterCount: 6,
	},

	// Mode 2: Conflict zone — two competing colonies, orange vs blue, cluster food
	{
		agentCount: 400_000,
		iterations: 600,
		sensorAngle: 0.5,
		sensorDistance: 18,
		turnAngle: 0.5,
		decayFactor: 0.96,
		colormap: "inferno" as ColormapName,
		populationCount: 2,
		populations: [
			{ color: [255, 85, 15] as readonly [number, number, number], agentFraction: 0.55 },
			{ color: [15, 165, 255] as readonly [number, number, number], agentFraction: 0.45 },
		],
		repulsionStrength: 0.5,
		foodPlacement: "clusters" as FoodPlacementStrategy,
		foodDensity: 0.7,
		foodClusterCount: 10,
	},

	// Mode 3: Three-way — red, cyan, green populations with repulsion, clusters
	{
		agentCount: 350_000,
		iterations: 550,
		sensorAngle: 0.6,
		sensorDistance: 14,
		turnAngle: 0.6,
		decayFactor: 0.96,
		colormap: "magma" as ColormapName,
		populationCount: 3,
		populations: [
			{ color: [255, 60, 40] as readonly [number, number, number], agentFraction: 0.36 },
			{ color: [40, 200, 255] as readonly [number, number, number], agentFraction: 0.32 },
			{ color: [60, 255, 100] as readonly [number, number, number], agentFraction: 0.32 },
		],
		repulsionStrength: 0.35,
		foodPlacement: "clusters" as FoodPlacementStrategy,
		foodDensity: 0.7,
		foodClusterCount: 10,
	},

	// Mode 4: Ghost web — sparse ephemeral traces, plasma colormap, grid food
	{
		agentCount: 300_000,
		iterations: 800,
		sensorAngle: 0.25,
		sensorDistance: 28,
		turnAngle: 0.25,
		decayFactor: 0.92,
		colormap: "plasma" as ColormapName,
		populationCount: 1,
		populations: [
			{ color: [200, 100, 255] as readonly [number, number, number], agentFraction: 1 },
		],
		repulsionStrength: 0,
		foodPlacement: "grid" as FoodPlacementStrategy,
		foodDensity: 0.5,
		foodClusterCount: 8,
	},
] as const

/**
 * Returns a varied genome for the given edition number.
 * Cycles through 5 aesthetic modes, each producing a visually distinct output.
 *
 * Edition 7 → mode 2 (conflict zone: orange vs blue, clusters)
 * Edition 8 → mode 3 (three-way: RGB populations, rings)
 * Edition 9 → mode 4 (ghost web: sparse plasma, grid)
 * Edition 10 → mode 0 (dense mycelium: viridis, rings)
 * Edition 11 → mode 1 (river delta: orange filaments, gradient)
 */
export const varyGenome = (edition: number, base: Genome): Genome => ({
	...base,
	...MODES[edition % MODES.length],
})
