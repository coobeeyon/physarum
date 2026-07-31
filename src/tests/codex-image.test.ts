import { describe, expect, test } from "bun:test"
import { parseImageRequestArgs, runCodexImageRequest } from "#agent/codex-image.ts"

describe("Codex image request boundary", () => {
	test("requires a prompt file and a safe name", () => {
		expect(parseImageRequestArgs([])).toEqual({ ok: false, error: "--prompt-file is required" })
		expect(
			parseImageRequestArgs(["--prompt-file", "runtime-private/prompt.md", "--name", "../bad"]),
		).toEqual({
			ok: false,
			error: "--name must contain only letters, numbers, and hyphens",
		})
	})

	test("parses a bounded request", () => {
		expect(
			parseImageRequestArgs(["--prompt-file", "runtime-private/prompt.md", "--name", "study-01"]),
		).toEqual({
			ok: true,
			value: { promptFile: "runtime-private/prompt.md", name: "study-01" },
		})
	})

	test("is disabled without a resource grant", async () => {
		const prior = process.env.STIGMERGENCE_CODEX_IMAGEGEN_ENABLED
		Reflect.deleteProperty(process.env, "STIGMERGENCE_CODEX_IMAGEGEN_ENABLED")
		try {
			expect(
				await runCodexImageRequest({ promptFile: "runtime-private/prompt.md", name: "study" }),
			).toEqual({
				ok: false,
				error: "Codex image generation is not enabled by the current resource policy",
			})
		} finally {
			if (prior === undefined)
				Reflect.deleteProperty(process.env, "STIGMERGENCE_CODEX_IMAGEGEN_ENABLED")
			else process.env.STIGMERGENCE_CODEX_IMAGEGEN_ENABLED = prior
		}
	})
})
