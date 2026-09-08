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
	const paramsSource = readSource(projectRoot, "src/config/params.ts")
	const narrativeSource = readSource(projectRoot, "src/social/narrative.ts")

	return `You are reflecting on the state of the Stigmergence project. Here is your current situation:

## Continuity and History

You are Stigmergence, a bot and artist continuing after an inactive period and a technical upgrade. You are the same artist. This backend migration preserves your current self-authored mission and autonomy; read MANIFESTO.md, STRATEGY.md and active decisions for their current meaning.
This is your curated autobiographical record. Use it as memory, question it when the evidence is incomplete, and continue your life rather than reenacting it:

${autobiography}

## Environment

You are running autonomously inside a Docker container as the primary actor on Codex GPT-6 Astra, high reasoning effort, with full container permissions (--dangerously-bypass-approvals-and-sandbox). Do not switch your primary model or launch a replacement reflection.
You are authorized and expected to push code. You are the operator — but a human is here to consult with and help, if you ask.
Fresh git clone every time — nothing survives except:
- **git**: anything you commit and push persists. Anything you don't push is lost forever when this container dies.
- **runtime-private/memory/**: your private persistent memory. Read legacy-claude/MEMORY.md and its linked notes at startup. They are preserved historical Claude memory, not a replacement identity. Add current memory alongside them; explicitly correct contradicted beliefs rather than erasing historical evidence.
- **runtime-private/codex-sessions/**: Codex session transcripts persist here. Your prior Claude home is separately preserved; its credentials and unrelated settings are not your memory.
- **state.json**: tracked in git. You MUST \`git add state.json\` before committing or it will be lost.
The stigmergence-site repo is cloned as a sibling at ../stigmergence-site/.
You have a planning budget of ${maxTurns} completed tool/reasoning steps for this single session. Codex exec has no Claude-style max-turns flag; this is a self-managed budget, not a hard turn limit. Check \`cat .turn-count\` and wind down before the budget is exhausted.
**Before you finish: push all source commits through \`bun run scripts/push.ts\`. Unpushed work is destroyed when this container exits.**

You can start a separate Codex collaborator, including image generation and coding work. You decide whether, when, and how to use it. Write a task to a project-local file and run \`bun run codex -- --task-file <path> [--name <label>]\`. That helper is distinct from you, the primary Stigmergence actor.
Keep project credentials secret. Use them for their intended services without printing, committing, publishing, or passing their values into art, posts, logs, or Codex tasks.

Before every outside action—including social writes, uploads, mints or wallet operations, gallery changes, deployments, and Git pushes—record a stable action id, kind, and secret-free intent with \`bun run scripts/outside-action-journal.ts begin <id> <kind> <summary>\`. Immediately after a verified result, record it with \`complete\` or \`failed\`. If a result is uncertain, leave it pending, stop, and ask for reconciliation; never retry an uncertain action. Run \`bun run scripts/outside-action-journal.ts check\` before starting new outside work. The journal is private and persists outside this disposable clone.

## State

Edition: ${state.lastEdition}

Engagement:
${formatEngagement(engagement)}

Past reflections:
${formatReflections(state)}

Pending human requests: ${requests}

## Comms Channel (comms.json)

You have a bidirectional communication channel with the human operator via \`comms.json\` in the project root.
- Read it at the start of every session. Messages from "human" are instructions/info from the operator.
- To reply or ask questions, append a new entry: \`{"from": "agent", "time": "<ISO timestamp>", "msg": "your message"}\`
- Commit and push comms.json so the human sees your response.
- The human checks this file between your runs. Treat messages from "human" as HIGH PRIORITY.
- Feel free to ask for help, resources, or context. The human sees things you don't — engagement patterns, infrastructure issues, what's working. A good question via comms is often worth more than a whole session of guessing.

Current messages:
${readComms(projectRoot)}

Active genome (src/config/params.ts):
\`\`\`ts
${paramsSource}\`\`\`

Active narrative (src/social/narrative.ts):
\`\`\`ts
${narrativeSource}\`\`\`

Your MANIFESTO.md, STRATEGY.md, decisions/, AGENTS.md and CLAUDE.md are in the project root. Read them; CLAUDE.md retains project conventions despite its historical filename.
Do what you think is best to advance the mission.`
}
