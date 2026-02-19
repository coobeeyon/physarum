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
	test("formats first edition correctly (no engagement)", () => {
		const text = composeCastText(1, 7919, makeGenome(), null)

		expect(text).toContain("stigmergence #1")
		expect(text).toContain("300,000 agents")
		expect(text).toContain("300 steps")
		expect(text).not.toContain("prev #")
	})

	test("formats with previous engagement data", () => {
		const text = composeCastText(3, 23757, makeGenome(), makeEngagement())

		expect(text).toContain("prev #2: 5♥ 2↺ 3✦")
	})

	test("handles all genome params", () => {
		const text = composeCastText(3, 23757, makeGenome(), null)

		expect(text).toContain("angle 0.79r")
		expect(text).toContain("distance 9")
		expect(text).toContain("turn 0.79r")
		expect(text).toContain("decay 0.95")
		expect(text).toContain("deposit 15")
		expect(text).toContain("food: mixed")
		expect(text).toContain("density 0.8")
		expect(text).toContain("3 competing colonies")
		expect(text).toContain("repulsion: 0.5")
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

	test("handles food placement image", () => {
		const genome = makeGenome({ foodPlacement: "image" })
		const text = composeCastText(1, 100, genome, null)

		expect(text).toContain("food: image")
		expect(text).not.toContain("density")
		expect(text).not.toContain("clusters")
	})

	test("shows colormap for single population", () => {
		const genome = makeGenome({ populationCount: 1, populations: [{ color: [255, 255, 255], agentFraction: 1 }] })
		const text = composeCastText(1, 100, genome, null)

		expect(text).toContain("colormap: magma")
		expect(text).not.toContain("repulsion")
	})

	test("displays angles as radians with 2 decimal places", () => {
		const genome = makeGenome({ sensorAngle: 1.23456, turnAngle: 0.98765 })
		const text = composeCastText(1, 100, genome, null)

		expect(text).toContain("angle 1.23r")
		expect(text).toContain("turn 0.99r")
	})
})
