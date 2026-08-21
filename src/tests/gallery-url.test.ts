import { describe, expect, test } from "bun:test"
import { join } from "node:path"

const script = join(import.meta.dir, "../../scripts/epic-runner/gallery-url.sh")

const derive = (sourceUrl: string) =>
	Bun.spawnSync(["bash", script, sourceUrl], {
		stdout: "pipe",
		stderr: "pipe",
	})

describe("gallery repository URL derivation", () => {
	test("handles the deployed SSH source URL without a .git suffix", () => {
		const result = derive("git@github.com:coobeeyon/physarum")

		expect(result.exitCode).toBe(0)
		expect(result.stdout.toString().trim()).toBe("git@github.com:coobeeyon/stigmergence.git")
	})

	test("handles an HTTPS source URL with a .git suffix", () => {
		const result = derive("https://github.com/coobeeyon/physarum.git")

		expect(result.exitCode).toBe(0)
		expect(result.stdout.toString().trim()).toBe("https://github.com/coobeeyon/stigmergence.git")
	})

	test("fails closed for an unrelated source repository", () => {
		const result = derive("git@github.com:coobeeyon/not-physarum.git")

		expect(result.exitCode).not.toBe(0)
		expect(result.stdout.toString()).toBe("")
		expect(result.stderr.toString()).toContain("cannot derive gallery repository")
	})
})
