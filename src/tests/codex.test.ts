import { expect, test } from "bun:test"
import { buildCodexPrompt, parseCodexTaskArgs, runCodexTask } from "#agent/codex.ts"

test("Codex tasks require a project-local task file and safe label", () => {
	expect(parseCodexTaskArgs([])).toEqual({ ok: false, error: "--task-file is required" })
	expect(
		parseCodexTaskArgs(["--task-file", "runtime-private/task.md", "--name", "../bad"]),
	).toEqual({
		ok: false,
		error: "--name must contain only letters, numbers, and hyphens",
	})
	expect(
		parseCodexTaskArgs(["--task-file", "runtime-private/task.md", "--name", "new-medium"]),
	).toEqual({
		ok: true,
		value: { taskFile: "runtime-private/task.md", name: "new-medium" },
	})
})

test("Codex receives a general collaboration task rather than an image-only role", () => {
	const prompt = buildCodexPrompt("Choose and create the next useful thing.")
	expect(prompt).toContain("whatever capabilities are useful")
	expect(prompt).toContain("including image generation")
	expect(prompt).toContain("preserve its mission")
	expect(prompt).not.toContain("perform any task other than")
})

test("Codex's unrestricted mode is available only inside the disposable runner", async () => {
	expect(await runCodexTask({ taskFile: "unused.md", name: "test" })).toEqual({
		ok: false,
		error: "Codex collaboration must run inside the isolated reflection container",
	})
})
