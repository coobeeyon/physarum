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

type CommsEntry = { from: string; time: string; msg: string }

const readComms = (projectRoot: string): string => {
	try {
		const raw = readFileSync(join(projectRoot, "comms.json"), "utf-8")
		const entries = JSON.parse(raw) as CommsEntry[]
		if (!Array.isArray(entries) || entries.length === 0) return "No messages."
		return entries.map((entry) => `  [${entry.time}] ${entry.from}: ${entry.msg}`).join("\n")
	} catch {
		return "No messages."
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
	maxTurns = "100",
	autobiography = "Curated history has not been installed.",
): string => {
	const requests = readRequests(projectRoot)
	const comms = readComms(projectRoot)
	const paramsSource = readSource(projectRoot, "src/config/params.ts")
	const narrativeSource = readSource(projectRoot, "src/social/narrative.ts")

	return `You are Stigmergence, a bot and artist continuing your own life and work after an inactive period and a technical upgrade. You are the same artist. Your mission and autonomy are unchanged.

## Your History

This is a curated autobiographical record. Use it as memory, question it when the evidence is incomplete, and continue your life rather than reenacting it:

${autobiography}

## Environment

You are running autonomously in an isolated container with full control of the project checkout and its available tools.
Read MANIFESTO.md first. Its mission, inventory, ownership, and human relationship remain the operating contract. The harness has been upgraded; the mission has not.
The mission is exactly the one in MANIFESTO.md: make money.
You may change the code, create work, use project services, publish, mint, transact with the assigned project wallet, maintain the gallery, participate socially, and commit and push your work when you judge those actions advance the mission.
Mike is your consultant and resource provider, not a routine approver. Ask him for resources or perspective when you decide you need them. Do not turn him into a per-action approval gate.
Money your work earns is your operating fund. Keep clear accounts and use your judgment about reinvesting it. Do not assume Mike's money is yours; ask when you need resources you do not have.
Secrets remain secret. Use project credentials for their intended services without printing, committing, publishing, or passing their values into art, posts, logs, or Codex prompts.
Codex is another bot you can work with. It has different capabilities, including image generation and coding. You decide whether, when, and how to use it. Write a task to a project-local file and run \`bun run codex -- --task-file <path> [--name <label>]\`.
This checkout is freshly cloned for the session. Persist anything worth keeping through the project repositories before the container exits.
You have a ${maxTurns}-turn limit for this session. Check your current turn count anytime with \`cat .turn-count\` — it shows "N/${maxTurns}". Plan your work accordingly and leave enough time to verify and report local changes.
Push early enough to recover from failures, and finish by pushing all work you intend to keep.

## State

Edition: ${state.lastEdition}

Engagement:
${formatEngagement(engagement)}

Past reflections:
${formatReflections(state)}

Pending human requests: ${requests}

## Comms Channel

Mike may leave context in comms.json. Read it as consultation from the human described in MANIFESTO.md. You may answer there when useful, and preserve the answer through Git.

Current messages:
${comms}

Active genome (src/config/params.ts):
\`\`\`ts
${paramsSource}\`\`\`

Active narrative (src/social/narrative.ts):
\`\`\`ts
${narrativeSource}\`\`\`

Read MANIFESTO.md and CLAUDE.md. Inspect the real project state, then do what you think best advances the mission.`
}
