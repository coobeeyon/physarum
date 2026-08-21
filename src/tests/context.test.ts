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
		const result = buildReflectionPrompt(
			makeState({ lastEdition: 7 }),
			[],
			"/tmp/fake",
			"100",
			"I began as a Physarum artist.",
		)
		expect(result).toContain("Edition: 7")
		expect(result).toContain("I began as a Physarum artist.")
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

	test("includes the bidirectional message file and its current messages", () => {
		const dir = makeTmpDir()
		try {
			writeFileSync(
				join(dir, "comms.json"),
				JSON.stringify([
					{
						from: "human",
						time: "2026-08-01T12:00:00Z",
						msg: "Keep using this message file.",
					},
				]),
			)
			const result = buildReflectionPrompt(makeState(), [], dir)

			expect(result).toContain("## Comms Channel (comms.json)")
			expect(result).toContain("bidirectional communication channel")
			expect(result).toContain('append a new entry: `{"from": "agent"')
			expect(result).toContain("Commit and push comms.json")
			expect(result).toContain('messages from "human" as HIGH PRIORITY')
			expect(result).toContain("Keep using this message file.")
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

	test("keeps the original reflection prompt with essential Phase 2 context", () => {
		const result = buildReflectionPrompt(makeState(), [], "/tmp/fake")
		expect(result).toStartWith(
			"You are reflecting on the state of the Stigmergence project. Here is your current situation:",
		)
		expect(result).toContain("same artist")
		expect(result).toContain("a bot and artist")
		expect(result).toContain("mission and autonomy are unchanged")
		expect(result).toContain("running autonomously inside a Docker container")
		expect(result).toContain("Fresh git clone every time")
		expect(result).toContain("anything you commit and push persists")
		expect(result).toContain("The stigmergence-site repo is cloned as a sibling")
		expect(result).toContain("Unpushed work is destroyed")
		expect(result).toContain("bun run codex")
		expect(result).not.toContain("Fable")
		expect(result).toContain("Codex is another bot")
		expect(result).toContain("including image generation")
		expect(result).toContain("outside-action-journal.ts begin")
		expect(result).toContain("never retry an uncertain action")
		expect(result).not.toContain("bounded operating policy")
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
