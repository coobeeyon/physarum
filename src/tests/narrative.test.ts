import { describe, expect, test } from "bun:test"
import { composeCastText } from "#social/narrative.ts"
import type { Genome } from "#types/evolution.ts"
import type { EngagementData } from "#types/evolution.ts"

const makeGenome = (overrides: Partial<Genome> = {}): Genome => ({
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
	foodWeight: 150.0,
	foodPlacement: "mixed",
	foodDensity: 0.8,
	foodClusterCount: 12,
	...overrides,
})

const makeEngagement = (overrides: Partial<EngagementData> = {}): EngagementData => ({
	edition: 2,
	castHash: "0xabc123def456abc123def456abc123def456abc1",
	likes: 5,
	recasts: 2,
	replies: 3,
	ageHours: 24,
	...overrides,
})

describe("composeCastText", () => {
	test("includes edition number", () => {
		const text = composeCastText(1, 7919, makeGenome(), null)

		expect(text).toContain("stigmergence #1")
	})

	test("multi-population uses competing intro and agent count", () => {
		const text = composeCastText(1, 7919, makeGenome(), null)

		expect(text).toContain("300,000 agents")
		expect(text).toContain("three colonies")
	})

	test("single population uses single intro and agent count", () => {
		const genome = makeGenome({
			populationCount: 1,
			populations: [{ color: [255, 255, 255], agentFraction: 1 }],
		})
		const text = composeCastText(1, 100, genome, null)

		expect(text).toContain("300,000 agents")
		expect(text).toContain("300 steps")
	})

	test("acknowledges notable engagement (total > 3)", () => {
		const text = composeCastText(3, 23757, makeGenome(), makeEngagement())

		expect(text).toContain("edition #2 found an audience")
	})

	test("ignores low engagement (total <= 3)", () => {
		const text = composeCastText(
			3,
			23757,
			makeGenome(),
			makeEngagement({ likes: 1, recasts: 0, replies: 0 }),
		)

		expect(text).not.toContain("found an audience")
	})

	test("includes meta-awareness line", () => {
		const text = composeCastText(1, 7919, makeGenome(), null)

		// Should contain one of the META_LINES
		expect(text).toMatch(/AI/)
	})

	test("output stays under 1024 chars", () => {
		const text = composeCastText(3, 23757, makeGenome(), makeEngagement())

		expect(text.length).toBeLessThan(1024)
	})

	test("site URL appears as last line", () => {
		const text = composeCastText(3, 23757, makeGenome(), makeEngagement())
		const lines = text.split("\n")

		expect(lines[lines.length - 1]).toBe("https://stigmergence.art")
	})

	test("different seeds produce different intros", () => {
		const text1 = composeCastText(1, 100, makeGenome(), null)
		const text2 = composeCastText(1, 101, makeGenome(), null)

		// At minimum, the intro or meta line should differ for different seeds
		const lines1 = text1.split("\n").filter((l) => l.length > 0)
		const lines2 = text2.split("\n").filter((l) => l.length > 0)
		const differ = lines1.some((l, i) => l !== lines2[i])
		expect(differ).toBe(true)
	})
})
