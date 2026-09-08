import { expect, test } from "bun:test"
import { buildReflectionArgs, recordReflectionEvent, runReflection } from "#agent/runner.ts"

test("primary reflection explicitly runs Astra high in Codex and preserves session evidence", () => {
	const args = buildReflectionArgs("/project")
	expect(args.slice(0, 4)).toEqual(["codex", "exec", "--model", "gpt-6-astra"])
	expect(args).toContain('model_reasoning_effort="high"')
	expect(args).toContain("--dangerously-bypass-approvals-and-sandbox")
	expect(args).toContain("--json")
	expect(args).not.toContain("--ephemeral")
	expect(args).not.toContain("claude")
})

test("full reflection permissions fail closed outside the disposable runner", async () => {
	const result = await runReflection(
		{ contractAddress: null, lastEdition: 0, history: [], reflections: [] },
		[],
		process.cwd(),
	)
	expect(result).toEqual({
		ok: false,
		error:
			"autonomous reflection must run inside the isolated container; use scripts/run-reflect.sh",
	})
})

test("Codex progress distinguishes tool steps, completed turns and failure", () => {
	const progress = { steps: 0, completed: false, failed: false }
	for (const event of [
		{ type: "thread.started", thread_id: "test" },
		{ type: "item.started", item: { type: "command_execution" } },
		{ type: "item.completed", item: { type: "command_execution" } },
		{ type: "item.completed", item: { type: "agent_message" } },
	])
		recordReflectionEvent(progress, JSON.stringify(event))
	expect(progress).toEqual({ steps: 1, completed: false, failed: false })
	recordReflectionEvent(progress, "non-json diagnostic")
	recordReflectionEvent(progress, '{"type":"turn.completed","usage":{"input_tokens":20}}')
	expect(progress.completed).toBe(true)
	recordReflectionEvent(progress, '{"type":"turn.failed","error":{"message":"unavailable"}}')
	expect(progress.failed).toBe(true)
})
