import type { PhysarumParams } from "#types/physarum.ts"

export type EngagementData = {
	readonly edition: number
	readonly castHash: string
	readonly likes: number
	readonly recasts: number
	readonly replies: number
	readonly ageHours: number
}

export type Genome = Omit<PhysarumParams, "seed" | "width" | "height">

export type ReflectionRecord = {
	readonly edition: number
	readonly genome: Genome
	readonly engagement: EngagementData
	readonly changes: ReadonlyArray<string>
	readonly reasoning: string
	readonly date?: string
	readonly model?: string
	readonly inputTokens?: number
	readonly outputTokens?: number
}
