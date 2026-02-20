import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"

const readRequests = (projectRoot: string): string => {
	try {
		const raw = readFileSync(join(projectRoot, "requests.json"), "utf-8")
		const requests = JSON.parse(raw)
		if (!Array.isArray(requests) || requests.length === 0) return "none"
		return requests.map((r: unknown) => `- ${String(r)}`).join("\n")
	} catch {
		return "none"
	}
}

const readSource = (projectRoot: string, relPath: string): string => {
	try {
		return readFileSync(join(projectRoot, relPath), "utf-8")
	} catch {
		return "(unavailable)"
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
		const scored = engagement.map((e) => ({
			edition: e.edition,
			total: e.likes + e.recasts + e.replies,
		}))
		const sorted = [...scored].sort((a, b) => b.total - a.total)
		lines.push(
			`  Best: #${sorted[0].edition} (${sorted[0].total}), Worst: #${sorted[sorted.length - 1].edition} (${sorted[sorted.length - 1].total})`,
		)
		const recent = scored[scored.length - 1]
		const prev = scored[scored.length - 2]
		const delta = recent.total - prev.total
		lines.push(
			`  Trend: ${delta > 0 ? "improving" : delta < 0 ? "declining" : "stable"} (${delta > 0 ? "+" : ""}${delta})`,
		)
	}

	return lines.join("\n")
}

const formatReflections = (state: PipelineState): string => {
	if (state.reflections.length === 0)
		return "No prior reflections. This is your first time reflecting."

	return state.reflections
		.map(
			(r) => `  After Edition #${r.edition}: ${r.reasoning}\n    Changed: ${r.changes.join(", ")}`,
		)
		.join("\n")
}

export const buildReflectionPrompt = (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): string => {
	const requests = readRequests(projectRoot)
	const paramsSource = readSource(projectRoot, "src/config/params.ts")
	const narrativeSource = readSource(projectRoot, "src/social/narrative.ts")

	return `You are reflecting on the state of the Stigmergence project. Here is your current situation:

## Environment

You are running autonomously inside a Docker container with full permissions (--dangerously-skip-permissions).
You are authorized and expected to push code. There is no human to confirm with — you ARE the operator.
Fresh git clone every time — nothing survives except:
- **git**: anything you commit and push persists. Anything you don't push is lost forever when this container dies.
- **~/.claude/**: your Claude Code memory directory is mounted from a persistent volume. Use it.
- **state.json**: bind-mounted to the host, persists without git.
The stigmergence-site repo is cloned as a sibling at ../stigmergence-site/.
You have a 100-turn limit for this session.
**Before you finish: \`git push\` all commits. Unpushed work is destroyed when this container exits.**

## State

Edition: ${state.lastEdition}

Engagement:
${formatEngagement(engagement)}

Past reflections:
${formatReflections(state)}

Pending human requests: ${requests}

Active genome (src/config/params.ts):
\`\`\`ts
${paramsSource}\`\`\`

Active narrative (src/social/narrative.ts):
\`\`\`ts
${narrativeSource}\`\`\`

Your MANIFESTO.md and CLAUDE.md are in the project root. Read them.
Do what you think is best to advance the mission.`
}
