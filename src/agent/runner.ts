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

	const prompt = buildReflectionPrompt(state, engagement, projectRoot)

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
	const proc = Bun.spawn([...baseArgs, ...sandboxArgs], {
		cwd: projectRoot,
		stdin: Buffer.from(prompt),
		stdout: "inherit",
		stderr: "inherit",
	})

	const exitCode = await proc.exited

	if (exitCode !== 0) {
		return err(`claude -p exited with code ${exitCode}`)
	}

	return ok(undefined)
}
