import { describe, expect, test } from "bun:test"
import { parseArgs } from "#config/cli.ts"

describe("CLI execution modes", () => {
	test("defaults to state-safe studio mode", () => {
		const result = parseArgs([])
		expect(result).toEqual({
			ok: true,
			value: {
				mode: "studio",
				resumeLive: false,
				readEngagement: false,
				reflect: false,
				engage: false,
			},
		})
	})

	test("requires live mode to resume an incomplete run", () => {
		expect(parseArgs(["--resume-live"])).toEqual({
			ok: false,
			error: "--resume-live requires explicit --live mode",
		})
		expect(parseArgs(["--live", "--resume-live"])).toMatchObject({
			ok: true,
			value: { mode: "live", resumeLive: true },
		})
	})

	test("requires an explicit live flag for effectful actions", () => {
		expect(parseArgs(["--engage"])).toEqual({
			ok: false,
			error: "--engage requires explicit --live mode",
		})
		expect(parseArgs(["--live", "--engage"])).toMatchObject({
			ok: true,
			value: { mode: "live", engage: true },
		})
	})

	test("rejects partial modes that could desynchronize state", () => {
		for (const flag of ["--dry-run", "--deploy-only", "--post-only"]) {
			const result = parseArgs([flag])
			expect(result.ok).toBe(false)
			if (!result.ok) expect(result.error).toContain("state out of sync")
		}
	})

	test("rejects conflicting modes and unknown flags", () => {
		expect(parseArgs(["--studio", "--live"])).toEqual({
			ok: false,
			error: "choose either --studio or --live, not both",
		})
		expect(parseArgs(["--publsh"])).toEqual({
			ok: false,
			error: "unknown argument: --publsh",
		})
	})

	test("validates seed values", () => {
		expect(parseArgs(["--seed", "12"])).toMatchObject({
			ok: true,
			value: { seedOverride: 12 },
		})
		expect(parseArgs(["--seed", "12x"])).toEqual({
			ok: false,
			error: "--seed must be a non-negative integer",
		})
	})
})
