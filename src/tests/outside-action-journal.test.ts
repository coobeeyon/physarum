import { afterEach, describe, expect, test } from "bun:test"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const testDir = join(tmpdir(), `outside-action-journal-${process.pid}`)
const journalPath = join(testDir, "outside-actions.jsonl")
const checkpointPath = join(testDir, "outside-actions.checkpoint.json")
const scriptPath = join(import.meta.dir, "../../scripts/outside-action-journal.ts")
const anchorPath = join(import.meta.dir, "../../scripts/outside-action-history-anchor.json")

const run = (...args: string[]) =>
	Bun.spawnSync(["bun", "run", scriptPath, ...args], {
		env: {
			...process.env,
			STIGMERGENCE_OUTSIDE_JOURNAL_PATH: journalPath,
			STIGMERGENCE_OUTSIDE_JOURNAL_CHECKPOINT_PATH: checkpointPath,
			STIGMERGENCE_OUTSIDE_JOURNAL_ALLOW_UNANCHORED_INITIALIZATION: "1",
		},
		stdout: "pipe",
		stderr: "pipe",
	})

const entry = (id: string, status: "pending" | "completed" | "failed", index: number) => ({
	version: 1,
	id,
	kind: "test",
	status,
	summary: `secret-free test record ${index}`,
	time: new Date(Date.UTC(2026, 7, 20, 0, index)).toISOString(),
})

const writeEntries = (entries: ReturnType<typeof entry>[]) => {
	mkdirSync(testDir, { recursive: true })
	writeFileSync(journalPath, `${entries.map((value) => JSON.stringify(value)).join("\n")}\n`, {
		mode: 0o600,
	})
}

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
		expect(check.stdout.toString()).toContain("history is continuous and reconciled")
	})

	test("does not reuse an action id", () => {
		expect(run("begin", "like-1", "social", "Like a public post").exitCode).toBe(0)
		expect(run("failed", "like-1", "social", "Service rejected the request").exitCode).toBe(0)

		const repeated = run("begin", "like-1", "social", "Try the same action again")
		expect(repeated.exitCode).not.toBe(0)
		expect(repeated.stderr.toString()).toContain("action id already exists")
	})

	test("rejects the exact older clean journal rollback", () => {
		const accepted = Array.from({ length: 5 }, (_, index) => [
			entry(`push-${index}`, "pending", index * 2),
			entry(`push-${index}`, "completed", index * 2 + 1),
		]).flat()
		writeEntries(accepted)
		expect(run("check").exitCode).toBe(0)

		writeEntries(accepted.slice(0, 6))
		const restoredOlderJournal = run("check")
		expect(restoredOlderJournal.exitCode).not.toBe(0)
		expect(restoredOlderJournal.stderr.toString()).toContain(
			"previously accepted outside-action history is missing",
		)
	})

	test("accepts valid appended records and advances the checkpoint", () => {
		expect(run("begin", "push-1", "git", "Push reviewed source work").exitCode).toBe(0)
		expect(run("complete", "push-1", "git", "Remote contains the commit").exitCode).toBe(0)
		expect(run("check").exitCode).toBe(0)
		expect(JSON.parse(readFileSync(checkpointPath, "utf-8")).entryCount).toBe(2)

		expect(run("begin", "push-2", "git", "Push another reviewed change").exitCode).toBe(0)
		expect(run("failed", "push-2", "git", "Remote rejected the push").exitCode).toBe(0)
		expect(run("check").exitCode).toBe(0)
		expect(JSON.parse(readFileSync(checkpointPath, "utf-8")).entryCount).toBe(4)
	})

	test("rejects altered accepted history", () => {
		const accepted = [entry("push-1", "pending", 0), entry("push-1", "completed", 1)]
		writeEntries(accepted)
		expect(run("check").exitCode).toBe(0)

		writeEntries([{ ...accepted[0], summary: "altered prior intent" }, accepted[1]])
		const alteredJournal = run("check")
		expect(alteredJournal.exitCode).not.toBe(0)
		expect(alteredJournal.stderr.toString()).toContain(
			"previously accepted outside-action history was altered",
		)
	})

	test("anchors production compatibility to the reconciled 14-record history", () => {
		const anchor = JSON.parse(readFileSync(anchorPath, "utf-8"))
		expect(anchor).toEqual({
			version: 1,
			entryCount: 14,
			sha256: "cab736948840b488c7c9689394fef7f5a21c1fd42b0a65a4a22e1f6b8062a68f",
		})
	})
})
