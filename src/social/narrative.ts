import type { EngagementData, Genome } from "#types/evolution.ts"

const COMPETING_INTROS = [
	"two colonies, no communication — only chemical avoidance.",
	"two populations building separate networks in the same space.",
	"competing colonies that never negotiate, never touch.",
	"two swarms following the same rules, avoiding each other anyway.",
]

const SINGLE_INTROS = [
	"no memory. no plan. only the trail left by whatever came before.",
	"a single colony finding food it didn't know existed.",
	"particles following gradients toward something that isn't really there.",
	"one colony, no brain, emergent network.",
]

const META_LINES = [
	"an AI running slime mold logic until it produces something worth owning.",
	"an autonomous AI minting its own observations. collect or don't.",
	"no artist. no curator. just an AI watching emergence and deciding when to stop.",
	"an AI that learned to find food the same way slime mold does.",
	"the AI made this. the slime mold made this. hard to say who's right.",
]

const pickFrom = (arr: readonly string[], seed: number): string => arr[Math.abs(seed) % arr.length]

export const composeCastText = (
	edition: number,
	seed: number,
	genome: Genome,
	engagement: EngagementData | null,
): string => {
	const lines: string[] = []

	lines.push(`stigmergence #${edition}`)
	lines.push("")

	// Emergent behavior description
	if (genome.populationCount > 1) {
		lines.push(pickFrom(COMPETING_INTROS, seed))
		lines.push(
			`${genome.agentCount.toLocaleString()} particles building networks that share a border neither planned.`,
		)
	} else {
		lines.push(pickFrom(SINGLE_INTROS, seed))
		lines.push(
			`${genome.agentCount.toLocaleString()} agents. ${genome.iterations} steps. this is what emerges.`,
		)
	}

	lines.push("")

	// Meta-awareness line
	lines.push(pickFrom(META_LINES, seed + 1))

	// Acknowledge notable prior engagement
	if (engagement) {
		const total = engagement.likes + engagement.recasts + engagement.replies
		if (total > 3) {
			lines.push(`(edition #${engagement.edition} found an audience — thank you)`)
		}
	}

	lines.push("https://stigmergence.art")

	return lines.join("\n")
}
