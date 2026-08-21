import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const testDir = join(tmpdir(), `outside-action-journal-${process.pid}`)
const journalPath = join(testDir, "outside-actions.jsonl")
const scriptPath = join(import.meta.dir, "../../scripts/outside-action-journal.ts")

const run = (...args: string[]) =>
	Bun.spawnSync(["bun", "run", scriptPath, ...args], {
		env: { ...process.env, STIGMERGENCE_OUTSIDE_JOURNAL_PATH: journalPath },
		stdout: "pipe",
		stderr: "pipe",
	})

afterEach(() => rmSync(testDir, { recursive: true, force: true }))

describe("direct outside-action journal", () => {
	test("stops startup while an outside result is uncertain", () => {
		mkdirSync(testDir, { recursive: true })
		expect(run("begin", "reply-1", "social", "Reply to a public post").exitCode).toBe(0)

		const check = run("check")
		expect(check.exitCode).not.toBe(0)
		expect(check.stderr.toString()).toContain("requires reconciliation")
	})

	test("allows startup after a verified result is recorded", () => {
		expect(run("begin", "push-1", "git", "Push reviewed source work").exitCode).toBe(0)
		expect(run("complete", "push-1", "git", "Remote contains the commit").exitCode).toBe(0)

		const check = run("check")
		expect(check.exitCode).toBe(0)
		expect(check.stdout.toString()).toContain("journal is reconciled")
	})

	test("does not reuse an action id", () => {
		expect(run("begin", "like-1", "social", "Like a public post").exitCode).toBe(0)
		expect(run("failed", "like-1", "social", "Service rejected the request").exitCode).toBe(0)

		const repeated = run("begin", "like-1", "social", "Try the same action again")
		expect(repeated.exitCode).not.toBe(0)
		expect(repeated.stderr.toString()).toContain("action id already exists")
	})
})
