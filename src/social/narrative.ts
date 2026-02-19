import type { Genome, EngagementData } from "#types/evolution.ts"

export const composeCastText = (
	edition: number,
	seed: number,
	genome: Genome,
	engagement: EngagementData | null,
	mintUrl: string,
): string => {
	const lines: string[] = []

	// Identity line
	lines.push(`stigmergence #${edition}`)

	// Brief biological framing
	if (genome.populationCount === 1) {
		lines.push(`a single colony extends its network — ${genome.agentCount.toLocaleString()} agents, ${genome.iterations} steps`)
	} else {
		lines.push(`${genome.populationCount} competing colonies — ${genome.agentCount.toLocaleString()} agents, ${genome.iterations} steps`)
	}

	// Sensing geometry
	lines.push(`sensing: angle ${genome.sensorAngle.toFixed(2)}r · distance ${genome.sensorDistance} · turn ${genome.turnAngle.toFixed(2)}r`)

	// Trail dynamics
	lines.push(`trail: deposit ${genome.depositAmount} · decay ${genome.decayFactor} · step ${genome.stepSize}`)

	// Food environment
	if (genome.foodPlacement === "image") {
		lines.push(`food: image-guided growth`)
	} else {
		lines.push(`food: ${genome.foodPlacement} · density ${genome.foodDensity}`)
	}

	// Visual palette
	if (genome.populationCount > 1) {
		lines.push(`repulsion: ${genome.repulsionStrength} · colormap: ${genome.colormap}`)
	} else {
		lines.push(`colormap: ${genome.colormap} · seed: ${seed}`)
	}

	// Prior engagement reflection
	if (engagement) {
		const total = engagement.likes + engagement.recasts + engagement.replies
		if (total > 0) {
			lines.push(`prev #${engagement.edition}: ${engagement.likes}♥ ${engagement.recasts}↺ ${engagement.replies}✦`)
		}
	}

	lines.push(mintUrl)

	return lines.join("\n")
}
