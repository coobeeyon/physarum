import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	beginLiveOperation,
	completeLiveOperation,
	completeLiveRun,
	prepareLiveRun,
} from "#pipeline/journal.ts"

const testRoot = join(tmpdir(), `stigmergence-journal-${process.pid}`)
const testPath = join(testRoot, "live-run.json")

describe("live-run journal", () => {
	afterEach(() => rmSync(testRoot, { recursive: true, force: true }))

	test("writes a private journal and records an operation result", () => {
		const prepared = prepareLiveRun(37, 123, false, testPath)
		expect(prepared.ok).toBe(true)
		if (!prepared.ok) return

		const begun = beginLiveOperation(prepared.value, "mint", testPath)
		expect(begun.ok).toBe(true)
		if (!begun.ok) return

		const completed = completeLiveOperation(
			begun.value,
			"mint",
			{ txHash: "0xabc", tokenId: "37" },
			testPath,
		)
		expect(completed.ok).toBe(true)
		expect(statSync(testPath).mode & 0o777).toBe(0o600)
		const saved = JSON.parse(readFileSync(testPath, "utf-8"))
		expect(saved.pendingOperation).toBeUndefined()
		expect(saved.results.txHash).toBe("0xabc")
	})

	test("refuses to repeat an operation with an uncertain result", () => {
		const prepared = prepareLiveRun(37, 123, false, testPath)
		if (!prepared.ok) throw new Error(prepared.error)
		const begun = beginLiveOperation(prepared.value, "post-primary", testPath)
		if (!begun.ok) throw new Error(begun.error)

		const resumed = prepareLiveRun(37, 123, true, testPath)
		expect(resumed).toEqual({
			ok: false,
			error: "the result of post-primary is uncertain; reconcile it before resuming",
		})
	})

	test("requires explicit resume for incomplete work", () => {
		const prepared = prepareLiveRun(37, 123, false, testPath)
		if (!prepared.ok) throw new Error(prepared.error)

		expect(prepareLiveRun(37, 123, false, testPath)).toEqual({
			ok: false,
			error: "an incomplete live run exists; inspect it and use --resume-live",
		})
	})

	test("marks a fully recorded run complete", () => {
		const prepared = prepareLiveRun(37, 123, false, testPath)
		if (!prepared.ok) throw new Error(prepared.error)
		const completed = completeLiveRun(prepared.value, testPath)
		expect(completed.ok).toBe(true)
		expect(existsSync(testPath)).toBe(true)
		if (completed.ok) expect(completed.value.completedAt).toBeDefined()
	})
})
