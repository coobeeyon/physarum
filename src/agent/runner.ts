import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildReflectionPrompt } from "#agent/context.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

const ALLOWED_TOOLS = [
	"Bash(bun *)",
	"Bash(git add *)",
	"Bash(git commit *)",
	"Bash(git status)",
	"Bash(git diff *)",
	"Bash(git log *)",
	"Read",
	"Write",
	"Edit",
	"mcp__playwright__*",
].join(",")

const isContainer = () => process.env.CONTAINER === "true"

const MCP_CONFIG = JSON.stringify({
	mcpServers: {
		playwright: {
			command: "npx",
			args: isContainer()
				? ["@playwright/mcp@latest", "--headless", "--no-sandbox"]
				: ["@playwright/mcp@latest", "--headless"],
		},
	},
})

export const runClaudeReflection = async (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<void>> => {
	const model = process.env.REFLECT_MODEL || "opus"
	const maxTurns = process.env.REFLECT_MAX_TURNS || "100"

	const prompt = buildReflectionPrompt(state, engagement, projectRoot, maxTurns)

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
		"--mcp-config",
		MCP_CONFIG,
	]
	const sandboxArgs = isContainer()
		? ["--dangerously-skip-permissions"]
		: ["--allowedTools", ALLOWED_TOOLS]

	// Pipe prompt via stdin to avoid E2BIG when the assembled context exceeds ARG_MAX
	const turnCountPath = join(projectRoot, ".turn-count")
	const proc = Bun.spawn([...baseArgs, ...sandboxArgs], {
		cwd: projectRoot,
		stdin: Buffer.from(prompt),
		stdout: "pipe",
		stderr: "inherit",
	})

	// Intercept stdout to count turns and write .turn-count
	let turnCount = 0
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
			// Count complete JSON lines containing assistant messages
			for (
				let newlineIdx = buffer.indexOf("\n");
				newlineIdx !== -1;
				newlineIdx = buffer.indexOf("\n")
			) {
				const line = buffer.slice(0, newlineIdx)
				buffer = buffer.slice(newlineIdx + 1)
				if (line.includes('"type":"assistant"') || line.includes('"type": "assistant"')) {
					turnCount++
					writeFileSync(turnCountPath, `${turnCount}/${maxTurns}`)
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
