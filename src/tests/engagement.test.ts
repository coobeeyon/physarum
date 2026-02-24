import { beforeEach, describe, expect, mock, test } from "bun:test"
import { readEngagement } from "#social/engagement.ts"
import type { HistoryEntry } from "#types/metadata.ts"

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
	edition: 1,
	seed: 7919,
	tokenId: "1",
	txHash: "0xabc",
	castHash: "0xdb5413d13b79c73e5bbf1f03b3e248263f33d33a",
	imageCid: "QmImage",
	metadataCid: "QmMeta",
	timestamp: new Date(Date.now() - 24 * 3_600_000).toISOString(), // 24h ago
	genome: null,
	...overrides,
})

const neynarResponse = (likes: number, recasts: number, replies: number) => ({
	cast: {
		reactions: { likes_count: likes, recasts_count: recasts },
		replies: { count: replies },
	},
})

describe("readEngagement", () => {
	beforeEach(() => {
		mock.restore()
	})

	test("fetches engagement for valid cast hash", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify(neynarResponse(5, 2, 3)), { status: 200 }),
		) as typeof fetch

		const result = await readEngagement("test-key", [makeEntry()])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(1)
		expect(result.value.engagement[0].likes).toBe(5)
		expect(result.value.engagement[0].recasts).toBe(2)
		expect(result.value.engagement[0].replies).toBe(3)
		expect(result.value.warnings).toHaveLength(0)

		globalThis.fetch = originalFetch
	})

	test("skips placeholder hash 0x0", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = mock(async () => {
			throw new Error("should not be called")
		}) as typeof fetch

		const result = await readEngagement("test-key", [makeEntry({ castHash: "0x0" })])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(0)
		expect(result.value.warnings).toHaveLength(1)
		expect(result.value.warnings[0]).toContain("placeholder")

		globalThis.fetch = originalFetch
	})

	test("skips short hash", async () => {
		const result = await readEngagement("test-key", [makeEntry({ castHash: "0xabc" })])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(0)
		expect(result.value.warnings).toHaveLength(1)
	})

	test("handles HTTP error as zero engagement", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = mock(async () => new Response("Not Found", { status: 404 })) as typeof fetch

		const result = await readEngagement("test-key", [makeEntry()])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(1)
		expect(result.value.engagement[0].likes).toBe(0)
		expect(result.value.engagement[0].recasts).toBe(0)
		expect(result.value.engagement[0].replies).toBe(0)
		expect(result.value.warnings).toHaveLength(0)

		globalThis.fetch = originalFetch
	})

	test("handles network error as zero engagement", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = mock(async () => {
			throw new Error("network down")
		}) as typeof fetch

		const result = await readEngagement("test-key", [makeEntry()])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(1)
		expect(result.value.engagement[0].likes).toBe(0)
		expect(result.value.warnings).toHaveLength(0)

		globalThis.fetch = originalFetch
	})

	test("calculates ageHours from timestamp", async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = mock(
			async () => new Response(JSON.stringify(neynarResponse(0, 0, 0)), { status: 200 }),
		) as typeof fetch

		const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()
		const result = await readEngagement("test-key", [makeEntry({ timestamp: twoHoursAgo })])

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement[0].ageHours).toBeCloseTo(2, 0)

		globalThis.fetch = originalFetch
	})

	test("fetches multiple entries in parallel", async () => {
		const originalFetch = globalThis.fetch
		let callCount = 0
		globalThis.fetch = mock(async () => {
			callCount++
			return new Response(JSON.stringify(neynarResponse(1, 0, 0)), { status: 200 })
		}) as typeof fetch

		const entries = [
			makeEntry({ edition: 1, castHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
			makeEntry({ edition: 2, castHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" }),
		]
		const result = await readEngagement("test-key", entries)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.engagement).toHaveLength(2)
		expect(callCount).toBe(2)

		globalThis.fetch = originalFetch
	})
})
