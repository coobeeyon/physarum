import type { Genome, EngagementData } from "#types/evolution.ts"

export const composeCastText = (
	edition: number,
	seed: number,
	genome: Genome,
	engagement: EngagementData | null,
	mintUrl: string,
): string => {
	const lines: string[] = [
		`stigmergence #${edition}`,
		`physarum simulation | seed ${seed}`,
		`agents: ${genome.agentCount} | iterations: ${genome.iterations}`,
		`sensor: ${genome.sensorAngle.toFixed(3)} / ${genome.sensorDistance} | turn: ${genome.turnAngle.toFixed(3)}`,
		`decay: ${genome.decayFactor} | deposit: ${genome.depositAmount}`,
	]

	if (genome.foodPlacement === "image") {
		lines.push("food: image")
	} else {
		lines.push(`food: ${genome.foodPlacement} (density ${genome.foodDensity}, clusters ${genome.foodClusterCount})`)
	}

	if (genome.populationCount > 1) {
		lines.push(`populations: ${genome.populationCount} | repulsion: ${genome.repulsionStrength}`)
	} else {
		lines.push(`colormap: ${genome.colormap}`)
	}

	if (engagement) {
		lines.push(`prev #${engagement.edition}: ${engagement.likes} likes \u00b7 ${engagement.recasts} recasts \u00b7 ${engagement.replies} replies`)
	}

	lines.push(mintUrl)

	return lines.join("\n")
}
