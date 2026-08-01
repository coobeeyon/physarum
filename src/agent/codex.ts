import { randomUUID } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, realpathSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import { type Result, err, ok } from "#types/result.ts"

export type CodexTaskArgs = {
	readonly taskFile: string
	readonly name: string
}

export const parseCodexTaskArgs = (args: ReadonlyArray<string>): Result<CodexTaskArgs> => {
	let taskFile: string | undefined
	let name = "codex-task"

	for (let index = 0; index < args.length; index++) {
		const arg = args[index]
		const value = args[index + 1]
		if (arg === "--task-file" && value) {
			taskFile = value
			index++
		} else if (arg === "--name" && value) {
			name = value
			index++
		} else return err(`unknown or incomplete argument: ${arg}`)
	}

	if (!taskFile) return err("--task-file is required")
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(name)) {
		return err("--name must contain only letters, numbers, and hyphens")
	}
	return ok({ taskFile, name })
}

export const buildCodexPrompt = (task: string): string =>
	`You are Codex, another bot collaborating with Stigmergence inside its isolated project runner.
Complete the task below using whatever capabilities are useful, including image generation when appropriate.
Work in the Physarum repository. Follow its repository instructions and preserve its mission.
Stigmergence owns the objective and will judge the result. Report what you did and any remaining problem.

Task from Stigmergence:
${task}`

export const runCodexTask = async (args: CodexTaskArgs): Promise<Result<string>> => {
	if (process.env.CONTAINER !== "true") {
		return err("Codex collaboration must run inside the isolated reflection container")
	}
	const projectRoot = realpathSync(join(import.meta.dirname, "../.."))
	let taskPath: string
	try {
		taskPath = realpathSync(resolve(projectRoot, args.taskFile))
	} catch (error) {
		return err(`failed to read Codex task path: ${String(error)}`)
	}
	const taskRelative = relative(projectRoot, taskPath)
	if (taskRelative.startsWith("..") || taskRelative === "") {
		return err("task file must be inside the Physarum project")
	}

	const task = readFileSync(taskPath, "utf-8").trim()
	if (!task) return err("Codex task is empty")

	const requestId = `${args.name}-${randomUUID()}`
	const requestDir = join(projectRoot, "runtime-private", "codex", requestId)
	mkdirSync(requestDir, { recursive: true, mode: 0o700 })
	chmodSync(requestDir, 0o700)
	const resultPath = join(requestDir, "result.txt")

	const prompt = buildCodexPrompt(task)

	const proc = Bun.spawn(
		[
			"codex",
			"exec",
			"--dangerously-bypass-approvals-and-sandbox",
			"--dangerously-bypass-hook-trust",
			"--ephemeral",
			"-C",
			projectRoot,
			"--output-last-message",
			resultPath,
			"-",
		],
		{
			cwd: projectRoot,
			stdin: Buffer.from(prompt),
			stdout: "inherit",
			stderr: "inherit",
		},
	)
	const exitCode = await proc.exited
	if (exitCode !== 0) return err(`Codex exited with code ${exitCode}`)

	let result: string
	try {
		result = readFileSync(resultPath, "utf-8").trim()
	} catch (error) {
		return err(`Codex completed without a result: ${String(error)}`)
	}
	chmodSync(resultPath, 0o600)
	return ok(result)
}

if (import.meta.main) {
	const parsed = parseCodexTaskArgs(process.argv.slice(2))
	if (!parsed.ok) {
		console.error(`Codex task error: ${parsed.error}`)
		process.exit(1)
	}
	const result = await runCodexTask(parsed.value)
	if (!result.ok) {
		console.error(`Codex task error: ${result.error}`)
		process.exit(1)
	}
	console.log(result.value)
}
