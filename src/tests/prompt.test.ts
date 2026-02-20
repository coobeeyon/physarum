import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { assembleContext, summarizeEngagement } from "#agent/prompt.ts"
import type { EngagementData, Genome } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"

const PROJECT_ROOT = join(import.meta.dirname, "../..")

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
	history: [
		{
			edition: 1,
			seed: 7919,
			tokenId: "1",
			txHash: "0x0",
			castHash: "0x0",
			imageCid: "",
			metadataCid: "",
			timestamp: "2025-02-17T00:00:00.000Z",
			genome: null,
		},
		{
			edition: 2,
			seed: 15838,
			tokenId: "2",
			txHash: "0xdry-run",
			castHash: "0xdb5413",
			imageCid: "bafybei",
			metadataCid: "bafkrei",
			timestamp: "2026-02-18T12:59:19.336Z",
			genome: null,
		},
		{
			edition: 3,
			seed: 23757,
			tokenId: "3",
			txHash: "0xdry-run",
			castHash: "0x0",
			imageCid: "dry-run",
			metadataCid: "dry-run",
			timestamp: "2026-02-19T03:08:20.615Z",
			genome: {
				agentCount: 300_000,
				iterations: 300,
				sensorAngle: Math.PI / 4,
				sensorDistance: 9,
				turnAngle: Math.PI / 4,
				stepSize: 1,
				depositAmount: 15,
				decayFactor: 0.95,
				colormap: "magma",
				populationCount: 3,
				populations: [
					{ color: [255, 60, 40], agentFraction: 0.34 },
					{ color: [40, 200, 255], agentFraction: 0.33 },
					{ color: [60, 255, 100], agentFraction: 0.33 },
				],
				repulsionStrength: 0.5,
				foodWeight: 150,
				foodPlacement: "mixed",
				foodDensity: 0.8,
				foodClusterCount: 12,
			},
		},
	],
	reflections: [],
	...overrides,
})

describe("summarizeEngagement", () => {
	test("returns message for empty engagement", () => {
		const result = summarizeEngagement([])
		expect(result).toBe("No engagement data available yet.")
	})

	test("summarizes single edition", () => {
		const result = summarizeEngagement([makeEngagement()])
		expect(result).toContain("Edition #1")
		expect(result).toContain("5 likes")
		expect(result).toContain("2 recasts")
		expect(result).toContain("3 replies")
		expect(result).toContain("total: 10")
		// No trend or best/worst for single edition
		expect(result).not.toContain("Best")
		expect(result).not.toContain("Trend")
	})

	test("summarizes multiple editions with trends", () => {
		const engagement = [
			makeEngagement({ edition: 1, likes: 3, recasts: 1, replies: 0 }),
			makeEngagement({ edition: 2, likes: 8, recasts: 4, replies: 2 }),
			makeEngagement({ edition: 3, likes: 5, recasts: 2, replies: 1 }),
		]
		const result = summarizeEngagement(engagement)

		expect(result).toContain("Best: Edition #2 (14 total)")
		expect(result).toContain("Lowest: Edition #1 (4 total)")
		expect(result).toContain("Trend: declining")
		expect(result).toContain("-6 from #2 to #3")
	})

	test("shows improving trend", () => {
		const engagement = [
			makeEngagement({ edition: 1, likes: 2, recasts: 0, replies: 0 }),
			makeEngagement({ edition: 2, likes: 10, recasts: 5, replies: 3 }),
		]
		const result = summarizeEngagement(engagement)

		expect(result).toContain("Trend: improving")
		expect(result).toContain("+16")
	})

	test("computes engagement rate", () => {
		const engagement = [makeEngagement({ likes: 10, recasts: 0, replies: 0, ageHours: 5 })]
		const result = summarizeEngagement(engagement)

		expect(result).toContain("rate: 2.00/hr")
	})

	test("handles zero age hours", () => {
		const engagement = [makeEngagement({ ageHours: 0 })]
		const result = summarizeEngagement(engagement)

		expect(result).toContain("rate: n/a")
	})
})

describe("assembleContext", () => {
	test("includes all major sections", () => {
		const state = makeState()
		const engagement = [makeEngagement({ edition: 2 })]
		const result = assembleContext(state, engagement, PROJECT_ROOT)

		expect(result).toContain("# Current State")
		expect(result).toContain("Edition: 3")
		expect(result).toContain("## Current Genome")
		expect(result).toContain("## Engagement History")
		expect(result).toContain("## Past Reflections")
		expect(result).toContain("## Project Structure")
		expect(result).toContain("## Source Code")
	})

	test("shows current genome from latest edition", () => {
		const result = assembleContext(makeState(), [], PROJECT_ROOT)

		expect(result).toContain("Current Genome (Edition #3)")
		expect(result).toContain("agentCount: 300000")
		expect(result).toContain("decayFactor: 0.95")
		expect(result).toContain("foodPlacement: mixed")
	})

	test("handles state with no genome history", () => {
		const state = makeState({
			history: [
				{
					edition: 1,
					seed: 7919,
					tokenId: "1",
					txHash: "0x0",
					castHash: "0x0",
					imageCid: "",
					metadataCid: "",
					timestamp: "2025-02-17T00:00:00.000Z",
					genome: null,
				},
			],
		})
		const result = assembleContext(state, [], PROJECT_ROOT)

		expect(result).toContain("No genome recorded yet")
	})

	test("includes past reflections when present", () => {
		const state = makeState({
			reflections: [
				{
					edition: 2,
					genome: makeState().history[2].genome as Genome,
					engagement: makeEngagement({ edition: 2 }),
					changes: ["src/config/params.ts"],
					reasoning: "The trails felt sparse, needed more density.",
				},
			],
		})
		const result = assembleContext(state, [], PROJECT_ROOT)

		expect(result).toContain("After Edition #2")
		expect(result).toContain("trails felt sparse")
		expect(result).toContain("src/config/params.ts")
	})

	test("shows first reflection message when no reflections", () => {
		const result = assembleContext(makeState(), [], PROJECT_ROOT)

		expect(result).toContain("first time reflecting")
	})

	test("includes source code files", () => {
		const result = assembleContext(makeState(), [], PROJECT_ROOT)

		expect(result).toContain("### src/config/params.ts")
		expect(result).toContain("### src/types/physarum.ts")
		expect(result).toContain("### src/social/narrative.ts")
		expect(result).toContain("### MANIFESTO.md")
		expect(result).toContain("### src/agent/prompt.ts")
		expect(result).toContain("DEFAULT_PARAMS")
		expect(result).toContain("PhysarumParams")
		expect(result).toContain("composeCastText")
	})
})
