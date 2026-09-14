import { afterEach, describe, expect, mock, test } from "bun:test"
import { buildReflectionPrompt } from "#agent/context.ts"
import { readEngagement } from "#social/engagement.ts"
import type { HistoryEntry } from "#types/metadata.ts"

const hashes = ["a", "b", "c", "d", "e", "f"].map((letter) => `0x${letter.repeat(40)}`)
const [primary, self, zora, first, second, third] = hashes
const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
	edition: 1,
	seed: 7919,
	tokenId: "1",
	txHash: "0xabc",
	castHash: primary,
	imageCid: "QmImage",
	metadataCid: "QmMeta",
	timestamp: new Date(Date.now() - 24 * 3_600_000).toISOString(),
	genome: null,
	...overrides,
})
const neynarResponse = (likes: number, recasts: number, replies: number) => ({
	cast: { reactions: { likes_count: likes, recasts_count: recasts }, replies: { count: replies } },
})
const originalFetch = globalThis.fetch
afterEach(() => {
	globalThis.fetch = originalFetch
})
const read = async (entries = [makeEntry()]) => {
	const result = await readEngagement("test-key", entries)
	if (!result.ok) throw new Error(result.error)
	return result.value
}
const prompt = (engagement: Awaited<ReturnType<typeof read>>["engagement"]) =>
	buildReflectionPrompt(
		{ contractAddress: null, lastEdition: 2, history: [], reflections: [] },
		engagement,
		"/tmp/fake",
	)

describe("readEngagement", () => {
	test("complete reads preserve counts and measured zero, including in the prompt", async () => {
		globalThis.fetch = mock(async (input) =>
			Response.json(neynarResponse(String(input).includes(primary) ? 5 : 0, 0, 0)),
		) as typeof fetch
		const result = await read([makeEntry(), makeEntry({ edition: 2, castHash: zora })])
		expect(result.warnings).toEqual([])
		expect(result.engagement[0]).toMatchObject({
			status: "complete",
			likes: 5,
			successfulCasts: 1,
			requestedCasts: 1,
		})
		expect(result.engagement[1]).toMatchObject({
			status: "complete",
			likes: 0,
			recasts: 0,
			replies: 0,
		})
		expect(result.engagement[0].ageHours).toBeCloseTo(24, 0)
		expect(prompt(result.engagement)).toContain("Edition #2: 0 likes, 0 recasts, 0 replies")
		expect(prompt(result.engagement)).toContain("declining (-5)")
	})

	for (const status of [404, 429]) {
		test(`HTTP ${status} is unavailable, with null counts and prompt warning`, async () => {
			globalThis.fetch = mock(
				async () => new Response("private response body", { status }),
			) as typeof fetch
			const result = await read()
			expect(result.engagement[0]).toMatchObject({
				status: "unavailable",
				likes: null,
				recasts: null,
				replies: null,
				successfulCasts: 0,
				requestedCasts: 1,
			})
			expect(result.warnings[0]).toContain(`HTTP ${status}`)
			expect(result.warnings[0]).toContain(primary)
			const text = prompt(result.engagement)
			expect(text).toContain("Edition #1: unavailable (0/1 casts read); counts unknown.")
			expect(text).toContain(`HTTP ${status}`)
			expect(text).not.toContain("private response body")
			expect(text).not.toContain("0 likes")
			expect(text).not.toContain("Trend:")
		})
	}

	test("network and timeout errors never substitute zero or leak transport detail", async () => {
		for (const error of [
			new Error("secret transport detail"),
			new DOMException("timeout", "TimeoutError"),
		]) {
			globalThis.fetch = mock(async () => {
				throw error
			}) as typeof fetch
			const result = await read()
			expect(result.engagement[0].status).toBe("unavailable")
			expect(result.engagement[0].likes).toBeNull()
			expect(result.warnings[0]).toContain("network error or timeout")
			expect(JSON.stringify(result)).not.toContain("secret transport detail")
		}
	})

	test("malformed JSON and absent, nonnumeric or negative fields remain unknown", async () => {
		const responses = [
			new Response("{"),
			Response.json(null),
			Response.json({}),
			Response.json({ cast: {} }),
			Response.json(neynarResponse(-1, 0, 0)),
			Response.json({
				cast: { reactions: { likes_count: "2", recasts_count: 0 }, replies: { count: 0 } },
			}),
			Response.json(neynarResponse(0.5, 0, 0)),
		]
		for (const response of responses) {
			globalThis.fetch = mock(async () => response) as typeof fetch
			const result = await read()
			expect(result.engagement[0].status).toBe("unavailable")
			expect(result.engagement[0].likes).toBeNull()
			expect(result.warnings).toHaveLength(1)
		}
	})

	test("invalid primary does not discard a readable cross-post; invalid extras affect coverage", async () => {
		const fetchMock = mock(async () => Response.json(neynarResponse(2, 1, 0)))
		globalThis.fetch = fetchMock as typeof fetch
		const result = await read([
			makeEntry({ castHash: "0x0", zoraCastHash: zora, replyCastHashes: ["0xabc"] }),
		])
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(result.engagement[0]).toMatchObject({
			status: "partial",
			likes: 2,
			recasts: 1,
			successfulCasts: 1,
			requestedCasts: 3,
		})
		expect(result.warnings).toHaveLength(2)
		expect(result.warnings[0]).toContain("placeholder")
	})

	test("mixed successful and failed hashes retain subtotals but cannot imply a rate or trend", async () => {
		globalThis.fetch = mock(async (input) =>
			String(input).includes(zora)
				? new Response("limited", { status: 429 })
				: Response.json(neynarResponse(4, 1, 0)),
		) as typeof fetch
		const result = await read([makeEntry(), makeEntry({ edition: 2, zoraCastHash: zora })])
		expect(result.engagement[1]).toMatchObject({
			status: "partial",
			likes: 4,
			recasts: 1,
			successfulCasts: 1,
			requestedCasts: 2,
		})
		const text = prompt(result.engagement)
		expect(text).toContain(
			"Edition #2: incomplete (1/2 casts read); observed subtotal: 4 likes, 1 recasts, 0 replies. Edition totals and rate unknown.",
		)
		expect(text).toContain("Best/worst and trend unavailable")
		expect(text).not.toContain("Trend:")
		expect(text).not.toContain("Best:")
	})

	test("successful zero plus failed cross-post is an incomplete zero subtotal", async () => {
		globalThis.fetch = mock(async (input) =>
			String(input).includes(zora)
				? new Response("missing", { status: 404 })
				: Response.json(neynarResponse(0, 0, 0)),
		) as typeof fetch
		const result = await read([makeEntry({ zoraCastHash: zora })])
		expect(result.engagement[0]).toMatchObject({ status: "partial", likes: 0 })
		expect(prompt(result.engagement)).toContain("observed subtotal: 0 likes")
		expect(prompt(result.engagement)).toContain("Edition totals and rate unknown")
		expect(prompt(result.engagement)).not.toContain("rate: 0.00")
	})

	test("excludes own corrections, deduplicates references, and retains external responses", async () => {
		const replies = [3, 1, 1, 1, 0, 0]
		const fetchMock = mock(async (input: string | URL | Request) => {
			const hash = new URL(String(input)).searchParams.get("identifier") ?? ""
			return Response.json(neynarResponse(hash === first ? 2 : 0, 0, replies[hashes.indexOf(hash)]))
		})
		globalThis.fetch = fetchMock as typeof fetch
		const result = await read([
			makeEntry({
				selfReplyHash: self,
				zoraCastHash: zora,
				replyCastHashes: [first, primary],
				correctionReplies: [
					{ castHash: first, parentHash: primary },
					{ castHash: first, parentHash: primary },
					{ castHash: self, parentHash: primary }, // duplicated across two storage fields
					{ castHash: second, parentHash: self },
					{ castHash: third, parentHash: zora },
				],
			}),
		])
		expect(result.engagement[0]).toMatchObject({ status: "complete", likes: 2, replies: 2 })
		expect(fetchMock).toHaveBeenCalledTimes(6)
	})

	test("failed own-reply reads do not turn known own replies into audience evidence", async () => {
		globalThis.fetch = mock(async (input) =>
			String(input).includes(primary)
				? Response.json(neynarResponse(0, 0, 3))
				: new Response("missing", { status: 404 }),
		) as typeof fetch
		const result = await read([
			makeEntry({
				selfReplyHash: self,
				correctionReplies: [{ castHash: first, parentHash: primary }],
			}),
		])
		expect(result.engagement[0]).toMatchObject({
			status: "partial",
			replies: 1,
			successfulCasts: 1,
			requestedCasts: 3,
		})
	})

	test("empty history performs no reads", async () => {
		const fetchMock = mock(async () => {
			throw new Error("unexpected call")
		})
		globalThis.fetch = fetchMock as typeof fetch
		expect(await read([])).toEqual({ engagement: [], warnings: [] })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
