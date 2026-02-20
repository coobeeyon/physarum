import { buildReflectionPrompt } from "#agent/context.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

export type ReflectionResult = {
	readonly summary: string
	readonly model: string
	readonly inputTokens: number
	readonly outputTokens: number
	readonly costUsd: number
	readonly numTurns: number
}

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
].join(",")

const isContainer = () => process.env.CONTAINER === "true"

export const runClaudeReflection = async (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<ReflectionResult>> => {
	const model = process.env.REFLECT_MODEL || "sonnet"
	const maxTurns = process.env.REFLECT_MAX_TURNS || "30"

	const prompt = buildReflectionPrompt(state, engagement, projectRoot)

	const baseArgs = [
		"claude",
		"-p",
		prompt,
		"--model",
		model,
		"--max-turns",
		maxTurns,
		"--output-format",
		"json",
	]
	const sandboxArgs = isContainer()
		? ["--dangerously-skip-permissions"]
		: ["--allowedTools", ALLOWED_TOOLS]

	const proc = Bun.spawn([...baseArgs, ...sandboxArgs], {
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "inherit",
	})

	const exitCode = await proc.exited
	const stdout = await new Response(proc.stdout).text()

	if (exitCode !== 0) {
		return err(`claude -p exited with code ${exitCode}: ${stdout.slice(0, 500)}`)
	}

	let output: unknown
	try {
		output = JSON.parse(stdout)
	} catch {
		return err(`Failed to parse claude output as JSON: ${stdout.slice(0, 500)}`)
	}

	const o = output as Record<string, unknown>
	const usage = o.usage as Record<string, number> | undefined

	return ok({
		summary: typeof o.result === "string" ? o.result : "",
		model,
		inputTokens: usage?.input_tokens ?? 0,
		outputTokens: usage?.output_tokens ?? 0,
		costUsd: typeof o.cost_usd === "number" ? o.cost_usd : 0,
		numTurns: typeof o.num_turns === "number" ? o.num_turns : 0,
	})
}
