import { describe, expect, test, afterEach } from "bun:test"
import { writeFileSync, unlinkSync, existsSync } from "node:fs"
import { join } from "node:path"

// State module uses import.meta.dirname, so we test the logic directly
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
				},
			],
		}

		writeFileSync(TEST_STATE_PATH, JSON.stringify(state, null, 2))
		const raw = Bun.file(TEST_STATE_PATH).text()
		const loaded = JSON.parse(await raw) as PipelineState

		expect(loaded.contractAddress).toBe("0xabc123")
		expect(loaded.lastEdition).toBe(5)
		expect(loaded.history.length).toBe(1)
		expect(loaded.history[0].seed).toBe(7919)
	})
})
