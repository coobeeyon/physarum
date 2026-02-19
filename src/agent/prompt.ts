import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import type { PipelineState } from "#types/metadata.ts"
import type { EngagementData, Genome } from "#types/evolution.ts"

const EXCLUDED_DIRS = new Set(["node_modules", ".git", ".beads", "output", ".claude"])

const listProjectFiles = (dir: string, root: string): string[] => {
	const results: string[] = []
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (EXCLUDED_DIRS.has(entry.name)) continue
			results.push(...listProjectFiles(join(dir, entry.name), root))
		} else {
			results.push(relative(root, join(dir, entry.name)))
		}
	}
	return results.sort()
}

const readProjectFile = (filePath: string, projectRoot: string): string => {
	try {
		return readFileSync(join(projectRoot, filePath), "utf-8")
	} catch {
		return "(file not found)"
	}
}

const CONTEXT_FILES = [
	"MANIFESTO.md",
	"package.json",
	"src/index.ts",
	"src/config/params.ts",
	"src/config/env.ts",
	"src/types/physarum.ts",
	"src/social/narrative.ts",
	"src/social/farcaster.ts",
	"src/social/engagement.ts",
	"src/pipeline/orchestrate.ts",
	"src/pipeline/gallery.ts",
	"src/agent/prompt.ts",
	"src/agent/reflect.ts",
	"src/agent/evolve.ts",
	"src/engine/food.ts",
	"src/render/canvas.ts",
]

const OUTPUT_FORMAT = `## Output Format

Respond with ONLY a JSON object (no markdown fencing, no text outside the JSON):

{
  "reasoning": "Your analysis of the current situation — what's working, what's not, what you want to try and why.",
  "changes": [
    {
      "file": "path/relative/to/project/root",
      "action": "edit",
      "content": "the complete new content for this file"
    }
  ]
}

The "action" field must be "create", "edit", or "delete".
For "edit" and "create", provide the complete file content.
For "delete", content can be empty.
If no changes are needed, return an empty changes array with reasoning.

## Constraints

- Your changes will be tested with \`bun run build\` (TypeScript type-check). If the build fails, all changes are reverted.
- You may not modify: .env, .git/, node_modules/, bun.lockb
- Everything else in the project is yours to change, including this prompt and the MANIFESTO (except the mission).`

export const buildSystemPrompt = (projectRoot: string): string => {
	const manifesto = readProjectFile("MANIFESTO.md", projectRoot)
	return `${manifesto}\n\n${OUTPUT_FORMAT}`
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

	// Project structure
	const files = listProjectFiles(projectRoot, projectRoot)
	sections.push(`## Project Structure\n${files.map((f) => `- ${f}`).join("\n")}`)

	// Source code
	const codeblocks = CONTEXT_FILES.map((f) => {
		const content = readProjectFile(f, projectRoot)
		const ext = f.split(".").pop() ?? ""
		return `### ${f}\n\`\`\`${ext}\n${content}\`\`\``
	})
	sections.push(`## Source Code\n${codeblocks.join("\n\n")}`)

	return sections.join("\n\n")
}
