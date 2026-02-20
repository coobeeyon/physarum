import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { PipelineState } from "#types/metadata.ts"
import type { EngagementData } from "#types/evolution.ts"

const readRequests = (projectRoot: string): string => {
	try {
		const raw = readFileSync(join(projectRoot, "requests.json"), "utf-8")
		const requests = JSON.parse(raw)
		if (!Array.isArray(requests) || requests.length === 0) return "none"
		return requests.map((r: unknown) => `- ${String(r)}`).join("
")
	} catch {
		return "none"
	}
}

const formatEngagement = (engagement: ReadonlyArray<EngagementData>): string => {
	if (engagement.length === 0) return "No engagement data yet."

	const lines: string[] = []
	for (const e of engagement) {
		const total = e.likes + e.recasts + e.replies
		const rate = e.ageHours > 0 ? (total / e.ageHours).toFixed(2) : "n/a"
		lines.push(
			`  Edition #${e.edition}: ${e.likes} likes, ${e.recasts} recasts, ${e.replies} replies (total: ${total}, rate: ${rate}/hr)`,
		)
	}

	if (engagement.length >= 2) {
		const scored = engagement.map((e) => ({ edition: e.edition, total: e.likes + e.recasts + e.replies }))
		const sorted = [...scored].sort((a, b) => b.total - a.total)
		lines.push(`  Best: #${sorted[0].edition} (${sorted[0].total}), Worst: #${sorted[sorted.length - 1].edition} (${sorted[sorted.length - 1].total})`)
		const recent = scored[scored.length - 1]
		const prev = scored[scored.length - 2]
		const delta = recent.total - prev.total
		lines.push(`  Trend: ${delta > 0 ? "improving" : delta < 0 ? "declining" : "stable"} (${delta > 0 ? "+" : ""}${delta})`)
	}

	return lines.join("
")
}

const formatReflections = (state: PipelineState): string => {
	if (state.reflections.length === 0) return "No prior reflections. This is your first time reflecting."

	return state.reflections
		.map(
			(r) =>
				`  After Edition #${r.edition}: ${r.reasoning}
    Changed: ${r.changes.join(", ")}`,
		)
		.join("
")
}

export const buildReflectionPrompt = (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): string => {
	const requests = readRequests(projectRoot)

	return `You are reflecting on the state of the Stigmergence project. Here is your current situation:

Edition: ${state.lastEdition}

Engagement:
${formatEngagement(engagement)}

Past reflections:
${formatReflections(state)}

Pending human requests: ${requests}

Your MANIFESTO.md and CLAUDE.md are in the project root. Read them.
Do what you think is best to advance the mission. When done, commit your changes and explain what you did and why.`
}
