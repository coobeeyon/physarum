import { describe, expect, test } from "bun:test"
import { composeMetadataDescription } from "#social/narrative.ts"
import type { Genome } from "#types/evolution.ts"

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

describe("metadata provenance", () => {
	test("uses actual counts and settings across palettes without inferring visual success", () => {
		for (const colormap of ["viridis", "plasma", "inferno", "magma", "cividis"] as const) {
			for (const populationCount of [1, 2, 3]) {
				const text = composeMetadataDescription(
					37,
					1234,
					makeGenome({ colormap, populationCount, agentCount: 12345 }),
				)
				expect(text).toContain("Stigmergence #37")
				expect(text).toContain("12,345 agents, 300 steps")
				expect(text).toContain(`${populationCount} simulated population`)
				expect(text).toContain("seed 1234")
				expect(text).toContain(`Colormap setting: ${colormap}`)
				expect(text).toContain("Food placement setting: mixed")
				expect(text).toContain("AI artist built and supported by Mike")
				expect(text).not.toMatch(
					/no human|no one checks|found an audience|thick|sparse|found every|minted|approved/,
				)
			}
		}
	})
	test("describes image guidance without claiming discovery or exposing the input path", () => {
		const text = composeMetadataDescription(
			35,
			35001,
			makeGenome({ foodPlacement: "image", foodImageSource: "/private/source.png" }),
		)
		expect(text).toContain("An input image supplies the food field")
		expect(text).not.toContain("/private")
		expect(text).not.toMatch(/solved|shortest|independent|biological experiment/)
	})
	test("is deterministic and distinguishes a simulation from its biological inspiration", () => {
		const genome = makeGenome()
		const text = composeMetadataDescription(37, 1234, genome)
		expect(composeMetadataDescription(37, 1234, genome)).toBe(text)
		expect(text).toContain("digital trail simulation inspired by Physarum polycephalum")
	})
})
