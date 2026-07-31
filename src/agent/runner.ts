import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildReflectionPrompt } from "#agent/context.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

const ALLOWED_TOOLS = [
	"Bash(bun run build)",
	"Bash(bun run lint)",
	"Bash(bun test)",
	"Bash(bun test *)",
	"Bash(git status *)",
	"Bash(git diff *)",
	"Bash(git log *)",
	"Read",
	"Write",
	"Edit",
].join(",")

export const runClaudeReflection = async (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<void>> => {
	const historyPath = process.env.STIGMERGENCE_HISTORY_PATH?.trim()
	if (!historyPath) {
		return err("STIGMERGENCE_HISTORY_PATH is required for a history-aware run")
	}

	let autobiography: string
	try {
		autobiography = readFileSync(historyPath, "utf-8").trim()
	} catch (error) {
		return err(
			`failed to read curated Stigmergence history: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
	if (!autobiography) return err("curated Stigmergence history is empty")

	const model = process.env.REFLECT_MODEL || "claude-fable-5"
	const maxTurns = process.env.REFLECT_MAX_TURNS || "100"

	const prompt = buildReflectionPrompt(state, engagement, projectRoot, maxTurns, autobiography)

	const baseArgs = [
		"claude",
		"-p",
		"--verbose",
		"--model",
		model,
		"--max-turns",
		maxTurns,
		"--output-format",
		"stream-json",
		"--allowedTools",
		ALLOWED_TOOLS,
	]

	// Pipe prompt via stdin to avoid E2BIG when the assembled context exceeds ARG_MAX
	const turnCountPath = join(projectRoot, ".turn-count")
	const proc = Bun.spawn(baseArgs, {
		cwd: projectRoot,
		stdin: Buffer.from(prompt),
		stdout: "pipe",
		stderr: "inherit",
	})

	// Intercept stdout to count turns and write .turn-count
	let turnCount = 0
	const seenMsgIds = new Set<string>()
	const reader = proc.stdout.getReader()
	const decoder = new TextDecoder()
	let buffer = ""

	const pump = async () => {
		while (true) {
			const { done, value } = await reader.read()
			if (done) break
			const chunk = decoder.decode(value, { stream: true })
			process.stdout.write(chunk)
			buffer += chunk
			// Count unique assistant message IDs (one API round-trip = one turn)
			// Claude Code streams multiple JSONL lines per turn (thinking, tool_use, text)
			// that share the same message ID — only count each ID once.
			for (
				let newlineIdx = buffer.indexOf("\n");
				newlineIdx !== -1;
				newlineIdx = buffer.indexOf("\n")
			) {
				const line = buffer.slice(0, newlineIdx)
				buffer = buffer.slice(newlineIdx + 1)
				if (line.includes('"type":"assistant"') || line.includes('"type": "assistant"')) {
					const idMatch = line.match(/"id"\s*:\s*"(msg_[^"]+)"/)
					if (idMatch && !seenMsgIds.has(idMatch[1])) {
						seenMsgIds.add(idMatch[1])
						turnCount++
						writeFileSync(turnCountPath, `${turnCount}/${maxTurns}`)
					}
				}
			}
		}
	}
	await pump()

	const exitCode = await proc.exited

	if (exitCode !== 0) {
		return err(`claude -p exited with code ${exitCode}`)
	}

	return ok(undefined)
}
