import { describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { buildReflectionPrompt } from "#agent/context.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"

const makeEngagement = (overrides: Partial<EngagementData> = {}): EngagementData => ({
	edition: 1,
	castHash: "0xabc123",
	likes: 5,
	recasts: 2,
	replies: 3,
	ageHours: 24,
	...overrides,
})

const makeState = (overrides: Partial<PipelineState> = {}): PipelineState => ({
	contractAddress: "0x584eB68F93bEcf6E463E7F259605c82Ef35c21e3",
	lastEdition: 3,
	history: [],
	reflections: [],
	...overrides,
})

const makeTmpDir = (): string => {
	const dir = join(tmpdir(), `context-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mkdirSync(dir, { recursive: true })
	return dir
}

describe("buildReflectionPrompt", () => {
	test("includes edition number", () => {
		const result = buildReflectionPrompt(makeState({ lastEdition: 7 }), [], "/tmp/fake")
		expect(result).toContain("Edition: 7")
	})

	test("includes empty engagement message", () => {
		const result = buildReflectionPrompt(makeState(), [], "/tmp/fake")
		expect(result).toContain("No engagement data yet.")
	})

	test("includes engagement data", () => {
		const engagement = [
			makeEngagement({ edition: 1, likes: 3, recasts: 1, replies: 0 }),
			makeEngagement({ edition: 2, likes: 8, recasts: 4, replies: 2 }),
		]
		const result = buildReflectionPrompt(makeState(), engagement, "/tmp/fake")

		expect(result).toContain("Edition #1: 3 likes")
		expect(result).toContain("Edition #2: 8 likes")
		expect(result).toContain("Trend:")
	})

	test("includes engagement trend for multiple editions", () => {
		const engagement = [
			makeEngagement({ edition: 1, likes: 10, recasts: 0, replies: 0 }),
			makeEngagement({ edition: 2, likes: 3, recasts: 0, replies: 0 }),
		]
		const result = buildReflectionPrompt(makeState(), engagement, "/tmp/fake")

		expect(result).toContain("declining")
		expect(result).toContain("-7")
	})

	test("shows first reflection message when no reflections", () => {
		const result = buildReflectionPrompt(makeState(), [], "/tmp/fake")
		expect(result).toContain("first time reflecting")
	})

	test("includes past reflections", () => {
		const state = makeState({
			reflections: [
				{
					edition: 2,
					genome: {} as PipelineState["reflections"][0]["genome"],
					engagement: makeEngagement({ edition: 2 }),
					changes: ["src/config/params.ts"],
					reasoning: "Trails felt sparse, increasing density.",
				},
			],
		})
		const result = buildReflectionPrompt(state, [], "/tmp/fake")

		expect(result).toContain("After Edition #2")
		expect(result).toContain("Trails felt sparse")
		expect(result).toContain("src/config/params.ts")
	})

	test("includes requests from requests.json", () => {
		const dir = makeTmpDir()
		try {
			writeFileSync(
				join(dir, "requests.json"),
				JSON.stringify(["try warmer colors", "more agents"]),
			)
			const result = buildReflectionPrompt(makeState(), [], dir)

			expect(result).toContain("try warmer colors")
			expect(result).toContain("more agents")
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("shows none when requests.json missing", () => {
		const result = buildReflectionPrompt(makeState(), [], "/tmp/fake-no-exist")
		expect(result).toContain("Pending human requests: none")
	})

	test("instructs agent to read manifesto and CLAUDE.md", () => {
		const result = buildReflectionPrompt(makeState(), [], "/tmp/fake")
		expect(result).toContain("MANIFESTO.md")
		expect(result).toContain("CLAUDE.md")
	})

	test("computes engagement rate", () => {
		const engagement = [makeEngagement({ likes: 10, recasts: 0, replies: 0, ageHours: 5 })]
		const result = buildReflectionPrompt(makeState(), engagement, "/tmp/fake")
		expect(result).toContain("rate: 2.00/hr")
	})

	test("handles zero age hours", () => {
		const engagement = [makeEngagement({ ageHours: 0 })]
		const result = buildReflectionPrompt(makeState(), engagement, "/tmp/fake")
		expect(result).toContain("rate: n/a")
	})
})
