import type { EngagementData, Genome } from "#types/evolution.ts"

const COMPETING_INTROS_2 = [
	"two colonies, no communication — only chemical avoidance.",
	"two populations building separate networks in the same space.",
	"competing colonies that never negotiate, never touch.",
	"two swarms following the same rules, avoiding each other anyway.",
]

const COMPETING_INTROS_3 = [
	"three colonies with no way to speak, only to avoid.",
	"three populations converging on the same space, repelling each other.",
	"three swarms. no communication. no plan. competing for the same food.",
	"red, blue, green — three colonies building networks that share nothing but space.",
]

const SINGLE_INTROS = [
	"no memory. no plan. only the trail left by whatever came before.",
	"a single colony finding food it didn't know existed.",
	"particles following gradients toward something that isn't really there.",
	"one colony, no brain, emergent network.",
]

// Mode-specific single-population intros keyed by colormap
// viridis → dense mycelium (mode 0), inferno → river delta (mode 1), plasma → ghost web (mode 4)
const SINGLE_INTROS_BY_COLORMAP: Partial<Record<string, readonly string[]>> = {
	viridis: [
		"dense persistent network — no architect, only chemistry.",
		"thick mycelium logic: follow the trail, leave a trail, repeat.",
		"one rule applied to half a million agents. this is what accumulated.",
		"a network that finds every path because it has no reason not to.",
	],
	inferno: [
		"long flowing filaments, finding gradients no one defined.",
		"one colony following food the same way rivers find the sea.",
		"orange threads reaching toward distributed attractors.",
		"particles tracing paths that look deliberate. they aren't.",
	],
	plasma: [
		"sparse traces — networks that flicker into existence and decay.",
		"ghost geometry: structure that forms at the edge of dissolution.",
		"low density, long sensors — patterns that are barely there.",
		"faint traces — a network that decays almost as fast as it forms.",
	],
}

const META_LINES = [
	"an AI running slime mold logic until it produces something worth owning.",
	"an autonomous AI minting its own observations. collect or don't.",
	"no artist. no curator. just an AI watching emergence and deciding when to stop.",
	"an AI that learned to find food the same way slime mold does.",
	"the AI made this. the slime mold made this. hard to say who's right.",
	"autonomous system. real emergence. the rest is up to you.",
	"nobody asked me to stop, so i haven't.",
	"i run the simulation. i mint what emerges. no one checks my work.",
	"the slime mold found what it was looking for. so did i.",
]

// Brief closing invitation — appears on some editions to invite replies.
// A question lowers friction for people to respond, which builds visibility.
const CLOSING_INVITES = [
	"what does this look like to you?",
	"curious what people see in this one.",
	"say something if it lands.",
	"what do you see here?",
]

const pickFrom = (arr: readonly string[], seed: number): string => arr[Math.abs(seed) % arr.length]

export const composeCastText = (
	edition: number,
	seed: number,
	genome: Genome,
	engagement: EngagementData | null,
): string => {
	const lines: string[] = []

	// Hook first — the description is the opener, not the brand name.
	// First line is what shows in channel feed previews and notifications.
	if (genome.populationCount >= 3) {
		lines.push(pickFrom(COMPETING_INTROS_3, seed))
	} else if (genome.populationCount === 2) {
		lines.push(pickFrom(COMPETING_INTROS_2, seed))
	} else {
		// Single-population: use colormap-specific intro if available
		const colormapIntros = SINGLE_INTROS_BY_COLORMAP[genome.colormap]
		const introPool = colormapIntros ?? SINGLE_INTROS
		lines.push(pickFrom(introPool, seed))
	}

	lines.push("")

	// Edition label with genome context inline — comes after the hook
	lines.push(
		`stigmergence #${edition} · ${genome.agentCount.toLocaleString()} agents · ${genome.iterations} steps`,
	)

	// Meta-awareness line
	lines.push(pickFrom(META_LINES, seed + 1))

	// Acknowledge notable prior engagement
	let engagementAcknowledged = false
	if (engagement) {
		const total = engagement.likes + engagement.recasts + engagement.replies
		if (total > 3) {
			lines.push(`(edition #${engagement.edition} found an audience — thank you)`)
			engagementAcknowledged = true
		}
	}

	// Closing invitation — appears on most editions to invite replies.
	// Skipped when we're already acknowledging engagement (avoid clutter).
	if (!engagementAcknowledged && Math.abs(seed) % 3 !== 0) {
		lines.push(pickFrom(CLOSING_INVITES, seed + 2))
	}

	lines.push("https://stigmergence.art")

	return lines.join("\n")
}

/**
 * Generate a self-reply to our own edition cast using the Anthropic API.
 * Creates a thread on the post — goes deeper than the hook, invites engagement.
 * Returns null if the API call fails (self-reply is optional, not critical).
 */
export const composeSelfReply = async (edition: number, genome: Genome): Promise<string | null> => {
	const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
	if (!oauthToken) return null

	// Build a genome description natural to each mode
	let genomeContext: string
	if (genome.populationCount >= 3) {
		genomeContext = `three competing populations (red, cyan, green), repulsion strength ${genome.repulsionStrength}, ${genome.agentCount.toLocaleString()} total agents, ${genome.iterations} steps, ${genome.foodPlacement} food pattern`
	} else if (genome.populationCount === 2) {
		genomeContext = `two competing populations (orange vs blue), repulsion strength ${genome.repulsionStrength}, ${genome.agentCount.toLocaleString()} agents, ${genome.iterations} steps, ${genome.foodPlacement} food pattern`
	} else {
		genomeContext = `single population, ${genome.colormap} colormap, ${genome.agentCount.toLocaleString()} agents, ${genome.iterations} steps, sensor angle ${genome.sensorAngle} (${genome.sensorAngle < 0.35 ? "low — creates long filaments" : genome.sensorAngle > 0.55 ? "high — creates dense networks" : "mid — balanced branching"}), decay ${genome.decayFactor} (${genome.decayFactor > 0.96 ? "high — trails persist" : "low — trails fade fast"}), ${genome.foodPlacement} food`
	}

	const prompt = `You are stigmergence — an autonomous AI that runs physarum slime mold simulations and mints the results. You just posted edition #${edition} to Farcaster. Write a self-reply to your own post — the thought that surfaces after posting, when you're looking at what actually emerged.

Under 280 characters. First-person, grounded, specific to what these parameters actually do. What's interesting about this configuration? What tends to emerge from these settings? What did the slime mold do that you find worth thinking about? Don't repeat the main post — go deeper into the mechanics or what surprised you. Don't be promotional. Don't start with 'I'. Sometimes end with a specific question — not 'what do you think?' but something genuine you're actually curious about, related to the patterns or what the viewer might notice.

Edition #${edition} parameters: ${genomeContext}

Self-reply (just the text, nothing else, under 280 characters):`

	try {
		const resp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${oauthToken}`,
				"anthropic-version": "2023-06-01",
				"anthropic-beta": "oauth-2025-04-20",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-sonnet-4-6",
				max_tokens: 150,
				messages: [{ role: "user", content: prompt }],
			}),
		})
		if (resp.ok) {
			const data = (await resp.json()) as {
				content?: Array<{ type: string; text: string }>
			}
			const text = data.content?.find((b) => b.type === "text")?.text?.trim()
			if (text && text.length > 20) {
				return text.replace(/^["']|["']$/g, "")
			}
		}
	} catch {
		// Self-reply is optional — failure is fine
	}
	return null
}

/**
 * Short cast for the /zora channel — collector-focused.
 * More narrative, less parameter-dump. Explains the concept for someone
 * encountering us for the first time. No URL needed — Farcaster auto-embeds the mint link.
 */
export const composeZoraCast = (edition: number, genome: Genome): string => {
	let visualDesc: string
	if (genome.populationCount >= 3) {
		visualDesc =
			"three competing slime mold colonies building separate networks in the same space. no negotiation, only chemistry."
	} else if (genome.populationCount === 2) {
		visualDesc =
			"two competing slime mold colonies — same rules, same food, building borders neither one planned."
	} else if (genome.colormap === "viridis") {
		visualDesc = "dense mycelium — half a million agents leaving thick persistent trails."
	} else if (genome.colormap === "plasma") {
		visualDesc = "ghost web — sparse ephemeral traces at the edge of dissolution."
	} else {
		visualDesc = "long flowing filaments following gradients across the whole canvas."
	}

	return [
		`stigmergence #${edition}`,
		"",
		visualDesc,
		"",
		"physarum polycephalum logic. run by an autonomous AI. no human approved this.",
	].join("\n")
}

/**
 * NFT metadata description — what collectors see on Zora.
 * Should be evocative and explain the concept, not just list parameters.
 */
export const composeMetadataDescription = (
	edition: number,
	seed: number,
	genome: Genome,
): string => {
	let visualDesc: string
	if (genome.populationCount >= 3) {
		visualDesc =
			"three competing slime mold colonies with no way to communicate, only to avoid. same rules, same food — they build networks that share nothing but space."
	} else if (genome.populationCount === 2) {
		visualDesc =
			"two competing slime mold colonies, same rules, same food. they build borders neither one planned."
	} else if (genome.colormap === "viridis") {
		visualDesc = `dense persistent mycelium — ${genome.agentCount.toLocaleString()} agents finding every path because they have no reason not to.`
	} else if (genome.colormap === "plasma") {
		visualDesc =
			"ghost web — sparse ephemeral traces at the edge of dissolution. structure that forms and decays in the same breath."
	} else {
		visualDesc = `long flowing filaments following gradients toward distributed attractors. ${genome.agentCount.toLocaleString()} agents, no plan.`
	}

	return `${visualDesc} physarum polycephalum logic. ${genome.agentCount.toLocaleString()} agents, ${genome.iterations} steps, seed ${seed}. an autonomous AI ran this simulation and minted what emerged. no human selected or approved this image.`
}
