import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { PipelineState } from "#types/metadata.ts"

const TEST_STATE_PATH = join(import.meta.dirname, "test-state.json")

describe("state round-trip", () => {
	afterEach(() => {
		if (existsSync(TEST_STATE_PATH)) unlinkSync(TEST_STATE_PATH)
	})

	test("serialize and deserialize state", async () => {
		const state: PipelineState = {
			contractAddress: "0xabc123",
			lastEdition: 5,
			history: [
				{
					edition: 1,
					seed: 7919,
					tokenId: "1",
					txHash: "0xdef456",
					castHash: "0xghi789",
					imageCid: "QmImage",
					metadataCid: "QmMeta",
					timestamp: "2024-01-01T00:00:00.000Z",
					genome: null,
				},
			],
			reflections: [],
		}

		writeFileSync(TEST_STATE_PATH, JSON.stringify(state, null, 2))
		const raw = Bun.file(TEST_STATE_PATH).text()
		const loaded = JSON.parse(await raw) as PipelineState

		expect(loaded.contractAddress).toBe("0xabc123")
		expect(loaded.lastEdition).toBe(5)
		expect(loaded.history.length).toBe(1)
		expect(loaded.history[0].seed).toBe(7919)
		expect(loaded.history[0].genome).toBeNull()
		expect(loaded.reflections).toEqual([])
	})
})

describe("state migration", () => {
	afterEach(() => {
		if (existsSync(TEST_STATE_PATH)) unlinkSync(TEST_STATE_PATH)
	})

	test("migrates old state without genome or reflections", async () => {
		// loadState reads from the hardcoded STATE_PATH which points at
		// the real state.json — it has old-format entries without genome/reflections.
		// Migration should backfill those fields. Newer entries may have genome set.
		const { loadState } = await import("#pipeline/state.ts")

		const result = loadState()
		expect(result.ok).toBe(true)
		if (!result.ok) return
		for (const entry of result.value.history) {
			expect(entry).toHaveProperty("genome")
		}
		expect(result.value).toHaveProperty("reflections")
		expect(Array.isArray(result.value.reflections)).toBe(true)
	})
})
