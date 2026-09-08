import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { buildReflectionPrompt } from "#agent/context.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

export const REFLECTION_MODEL = "gpt-6-astra"

export const buildReflectionArgs = (projectRoot: string): string[] => [
	"codex",
	"exec",
	"--model",
	REFLECTION_MODEL,
	"-c",
	'model_reasoning_effort="high"',
	"--json",
	"--dangerously-bypass-approvals-and-sandbox",
	"--dangerously-bypass-hook-trust",
	"-C",
	projectRoot,
	"-",
]

export type ReflectionProgress = { steps: number; completed: boolean; failed: boolean }

export const recordReflectionEvent = (progress: ReflectionProgress, line: string): void => {
	let event: { type?: string; item?: { type?: string } }
	try {
		event = JSON.parse(line)
	} catch {
		return
	}
	if (event.type === "item.completed" && event.item?.type !== "agent_message") progress.steps++
	if (event.type === "turn.completed") progress.completed = true
	if (event.type === "turn.failed" || event.type === "error") progress.failed = true
}

export const runReflection = async (
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<void>> => {
	if (process.env.CONTAINER !== "true") {
		return err(
			"autonomous reflection must run inside the isolated container; use scripts/run-reflect.sh",
		)
	}
	if (process.env.REFLECT_MODEL && process.env.REFLECT_MODEL !== REFLECTION_MODEL) {
		return err(
			`this reflection launcher requires ${REFLECTION_MODEL}; no model fallback is allowed`,
		)
	}
	const historyPath = process.env.STIGMERGENCE_HISTORY_PATH?.trim()
	if (!historyPath) return err("STIGMERGENCE_HISTORY_PATH is required for a history-aware run")
	let autobiography: string
	try {
		autobiography = readFileSync(historyPath, "utf-8").trim()
	} catch (error) {
		return err(`failed to read curated Stigmergence history: ${String(error)}`)
	}
	if (!autobiography) return err("curated Stigmergence history is empty")
	const maxSteps = process.env.REFLECT_MAX_STEPS || "100"
	if (!/^[1-9][0-9]*$/.test(maxSteps)) return err("REFLECT_MAX_STEPS must be a positive integer")
	const prompt = buildReflectionPrompt(state, engagement, projectRoot, maxSteps, autobiography)
	const progress: ReflectionProgress = { steps: 0, completed: false, failed: false }
	const stepCountPath = join(projectRoot, ".turn-count")
	writeFileSync(stepCountPath, `0/${maxSteps} completed tool/reasoning steps (planning budget)`)
	console.log(
		JSON.stringify({
			type: "reflection.launch",
			backend: "codex",
			model: REFLECTION_MODEL,
			effort: "high",
		}),
	)
	const proc = Bun.spawn(buildReflectionArgs(projectRoot), {
		cwd: projectRoot,
		stdin: Buffer.from(prompt),
		stdout: "pipe",
		stderr: "inherit",
	})
	const reader = proc.stdout.getReader()
	const decoder = new TextDecoder()
	let buffer = ""
	const consume = (line: string) => {
		recordReflectionEvent(progress, line)
		writeFileSync(
			stepCountPath,
			`${progress.steps}/${maxSteps} completed tool/reasoning steps (planning budget)`,
		)
	}
	while (true) {
		const { done, value } = await reader.read()
		if (done) break
		const chunk = decoder.decode(value, { stream: true })
		process.stdout.write(chunk)
		buffer += chunk
		let newline = buffer.indexOf("\n")
		while (newline !== -1) {
			consume(buffer.slice(0, newline))
			buffer = buffer.slice(newline + 1)
			newline = buffer.indexOf("\n")
		}
	}
	buffer += decoder.decode()
	if (buffer.trim()) consume(buffer)
	const exitCode = await proc.exited
	if (exitCode !== 0 || progress.failed || !progress.completed) {
		return err(
			`Codex reflection did not complete successfully (exit ${exitCode}, completed ${progress.completed}, failed ${progress.failed}); no fallback attempted`,
		)
	}
	return ok(undefined)
}
