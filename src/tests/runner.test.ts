import { expect, test } from "bun:test"
import { buildClaudeArgs, runClaudeReflection } from "#agent/runner.ts"

test("reflection runs Fable with the full container capability surface", () => {
	const args = buildClaudeArgs("claude-fable-5", "100")
	expect(args).toContain("claude-fable-5")
	expect(args).toContain("--dangerously-skip-permissions")
	expect(args).not.toContain("--allowedTools")
})

test("full Fable permissions fail closed outside the disposable runner", async () => {
	const result = await runClaudeReflection(
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
