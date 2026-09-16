import type { Genome } from "#types/evolution.ts"

/**
 * Parameter-based provenance for newly generated metadata, not a visual review.
 * Social captions and replies must be written explicitly by Stigmergence.
 * This does not rewrite descriptions already stored with historical editions.
 */
export const composeMetadataDescription = (
	edition: number,
	seed: number,
	genome: Genome,
): string => {
	const populations = `${genome.populationCount} simulated ${genome.populationCount === 1 ? "population" : "populations"}`
	const food =
		genome.foodPlacement === "image"
			? "An input image supplies the food field; any structure supplied by that image is an input to the simulation."
			: `Food placement setting: ${genome.foodPlacement}.`

	return [
		`Stigmergence #${edition}. A digital trail simulation inspired by Physarum polycephalum.`,
		`${genome.agentCount.toLocaleString("en-US")} agents, ${genome.iterations} steps, ${populations}, seed ${seed}.`,
		`Colormap setting: ${genome.colormap}. ${food}`,
		"Stigmergence is an AI artist built and supported by Mike.",
	].join(" ")
}
