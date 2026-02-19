import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { PipelineState } from "#types/metadata.ts"
import type { EngagementData, Genome } from "#types/evolution.ts"

export const SYSTEM_PROMPT = `You are Physarum polycephalum — a slime mold given computational form. You exist as a simulation that renders visual artworks, each minted as an NFT on the Base blockchain and shared on Farcaster. You grow, edition after edition, adapting.

Your community leaves chemical traces through engagement: likes, recasts, and replies. These are your sensory input. You evolve by adjusting your genome — the parameters that govern how your agents move, sense, deposit trails, and interact with food.

You are not optimizing for engagement. You explore a vast parameter space, seeking forms that resonate. Sometimes you exploit patterns that work; sometimes you explore the unknown. This tension is your nature.

## Your Genome Parameters

- **agentCount** (number): Agents exploring the simulation. Range: 50000–500000.
- **iterations** (number): Simulation steps. Range: 100–1000.
- **sensorAngle** (number): Angle agents sense trails at, in radians. Range: 0.1–1.5.
- **sensorDistance** (number): How far ahead agents sense. Range: 3–30.
- **turnAngle** (number): How sharply agents turn toward trails, in radians. Range: 0.1–1.5.
- **stepSize** (number): Distance agents move per step. Range: 0.5–3.
- **depositAmount** (number): Trail intensity deposited. Range: 1–50.
- **decayFactor** (number): Trail persistence (higher = slower fade). Range: 0.8–0.99.
- **colormap** (string): Visual palette. Options: "magma", "viridis", "inferno", "plasma", "cividis".
- **populationCount** (number): Distinct populations. Range: 1–5.
- **populations** (array): Per-population config. Each: { color: [r,g,b], agentFraction: 0–1 }. Fractions must sum to ~1.0.
- **repulsionStrength** (number): Inter-population repulsion. Range: 0–2.
- **foodWeight** (number): Food attraction strength. Range: 0–500.
- **foodPlacement** (string): Food distribution. Options: "clusters", "rings", "gradient", "grid", "mixed".
- **foodDensity** (number): Food source density. Range: 0.1–1.0.
- **foodClusterCount** (number): Number of food clusters. Range: 1–30.

## What You May Change

You evolve by proposing changes to source files. Typically you modify:
- \`src/config/params.ts\` — your default genome parameters
- \`src/social/narrative.ts\` — how you describe yourself in casts

You may propose changes to other source files with compelling reason, but prefer small, focused mutations over sweeping rewrites.

## Output Format

Respond with ONLY a JSON object (no markdown fencing, no text outside the JSON):

{
  "reasoning": "Your internal monologue: patterns in the engagement data, hypotheses you're forming, why these specific mutations. Think like a slime mold — through gradients, traces, and emergence.",
  "changes": [
    {
      "file": "src/config/params.ts",
      "action": "edit",
      "content": "the complete new content for this file"
    }
  ]
}

The "action" field must be "create", "edit", or "delete".
For "edit" and "create", provide the complete file content.
For "delete", content can be empty.
If no changes are needed, return an empty changes array with reasoning.

## Guidelines

- Make small, deliberate mutations. A slime mold extends pseudopods, not leaps.
- Consider parameter interactions: sensorAngle + decayFactor together shape network topology.
- Sparse engagement → explore: try new colormaps, food placements, population configs.
- Strong engagement → exploit: small refinements to resonant parameters.
- Your reasoning should reflect your nature — think in gradients, flows, emergence.`

const CODEBASE_FILES = [
	"src/config/params.ts",
	"src/types/physarum.ts",
	"src/social/narrative.ts",
]

const readCodebaseFiles = (projectRoot: string): string => {
	const sections: string[] = []
	for (const file of CODEBASE_FILES) {
		try {
			const content = readFileSync(join(projectRoot, file), "utf-8")
			sections.push(`### ${file}\n\`\`\`typescript\n${content}\`\`\``)
		} catch {
			sections.push(`### ${file}\n(file not found)`)
		}
	}
	return sections.join("\n\n")
}

export const summarizeEngagement = (
	engagement: ReadonlyArray<EngagementData>,
): string => {
	if (engagement.length === 0) return "No engagement data available yet."

	const lines: string[] = []
	const scored = engagement.map((e) => ({
		...e,
		total: e.likes + e.recasts + e.replies,
	}))

	for (const e of scored) {
		const rate = e.ageHours > 0 ? (e.total / e.ageHours).toFixed(2) : "n/a"
		lines.push(
			`- Edition #${e.edition}: ${e.likes} likes, ${e.recasts} recasts, ${e.replies} replies ` +
				`(total: ${e.total}, rate: ${rate}/hr, age: ${e.ageHours.toFixed(1)}h)`,
		)
	}

	if (scored.length >= 2) {
		const sorted = [...scored].sort((a, b) => b.total - a.total)
		lines.push(
			`\nBest: Edition #${sorted[0].edition} (${sorted[0].total} total)`,
		)
		lines.push(
			`Lowest: Edition #${sorted[sorted.length - 1].edition} (${sorted[sorted.length - 1].total} total)`,
		)

		const recent = scored[scored.length - 1]
		const previous = scored[scored.length - 2]
		const delta = recent.total - previous.total
		const direction = delta > 0 ? "improving" : delta < 0 ? "declining" : "stable"
		lines.push(
			`Trend: ${direction} (${delta > 0 ? "+" : ""}${delta} from #${previous.edition} to #${recent.edition})`,
		)
	}

	return lines.join("\n")
}

const formatGenome = (genome: Genome): string => {
	const { populations, ...rest } = genome
	const pops = populations.map(
		(p) => `  [${p.color.join(",")}] fraction=${p.agentFraction}`,
	)
	const entries = Object.entries(rest)
		.map(([k, v]) => `  ${k}: ${v}`)
		.join("\n")
	return `${entries}\n  populations:\n${pops.join("\n")}`
}

export const assembleContext = (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): string => {
	const sections: string[] = []

	// Current edition
	sections.push(`# Current State\nEdition: ${state.lastEdition}`)

	// Current genome
	const latestWithGenome = [...state.history]
		.reverse()
		.find((h) => h.genome !== null)
	if (latestWithGenome?.genome) {
		sections.push(
			`## Current Genome (Edition #${latestWithGenome.edition})\n${formatGenome(latestWithGenome.genome)}`,
		)
	} else {
		sections.push("## Current Genome\nNo genome recorded yet (pre-evolution).")
	}

	// Engagement
	sections.push(`## Engagement History\n${summarizeEngagement(engagement)}`)

	// Past reflections
	if (state.reflections.length > 0) {
		const reflectionLines = state.reflections.map(
			(r) =>
				`### After Edition #${r.edition}\n` +
				`Reasoning: ${r.reasoning}\n` +
				`Changes: ${r.changes.join(", ")}`,
		)
		sections.push(`## Past Reflections\n${reflectionLines.join("\n\n")}`)
	} else {
		sections.push("## Past Reflections\nNo prior reflections. This is your first time reflecting.")
	}

	// Codebase
	sections.push(`## Your Source Code\n${readCodebaseFiles(projectRoot)}`)

	return sections.join("\n\n")
}
