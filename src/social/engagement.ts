import type { EngagementData } from "#types/evolution.ts"
import type { HistoryEntry } from "#types/metadata.ts"
import { type Result, ok } from "#types/result.ts"

const NEYNAR_API = "https://api.neynar.com/v2"
// Our Farcaster FID — needed for hub queries
const OUR_FID = 2797211

const isValidCastHash = (hash: string): boolean =>
	hash.length >= 10 && hash !== "0x0" && hash.startsWith("0x")

/** Fetch engagement counts for a cast via Neynar GET /cast */
const fetchCastCounts = async (
	castHash: string,
	apiKey: string,
): Promise<{ likes: number; recasts: number; replies: number }> => {
	try {
		const url = `${NEYNAR_API}/farcaster/cast?identifier=${castHash}&type=hash`
		const resp = await fetch(url, { headers: { "x-api-key": apiKey } })
		if (!resp.ok) return { likes: 0, recasts: 0, replies: 0 }
		const data = (await resp.json()) as {
			cast?: {
				reactions?: { likes_count?: number; recasts_count?: number }
				replies?: { count?: number }
			}
		}
		const cast = data.cast
		return {
			likes: cast?.reactions?.likes_count ?? 0,
			recasts: cast?.reactions?.recasts_count ?? 0,
			replies: cast?.replies?.count ?? 0,
		}
	} catch {
		return { likes: 0, recasts: 0, replies: 0 }
	}
}

const fetchCastEngagement = async (
	entry: HistoryEntry,
	apiKey: string,
): Promise<{ engagement: EngagementData | null; warning: string | null }> => {
	if (!isValidCastHash(entry.castHash)) {
		return {
			engagement: null,
			warning: `edition ${entry.edition}: skipped (placeholder hash "${entry.castHash}")`,
		}
	}

	try {
		// Fetch engagement for primary cast
		const primary = await fetchCastCounts(entry.castHash, apiKey)

		// Also fetch engagement for /zora cross-post and reply casts (where stored)
		const extraHashes: string[] = [
			...(entry.zoraCastHash && isValidCastHash(entry.zoraCastHash) ? [entry.zoraCastHash] : []),
			...(entry.replyCastHashes?.filter(isValidCastHash) ?? []),
		]
		const extraCounts = await Promise.all(extraHashes.map((h) => fetchCastCounts(h, apiKey)))

		const totalLikes = primary.likes + extraCounts.reduce((sum, c) => sum + c.likes, 0)
		const totalRecasts = primary.recasts + extraCounts.reduce((sum, c) => sum + c.recasts, 0)
		const totalReplies = primary.replies + extraCounts.reduce((sum, c) => sum + c.replies, 0)

		const ageMs = Date.now() - new Date(entry.timestamp).getTime()

		return {
			engagement: {
				edition: entry.edition,
				castHash: entry.castHash,
				likes: totalLikes,
				recasts: totalRecasts,
				replies: totalReplies,
				ageHours: Math.round((ageMs / 3_600_000) * 10) / 10,
			},
			warning: null,
		}
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return { engagement: null, warning: `edition ${entry.edition}: ${msg}` }
	}
}

export const readEngagement = async (
	neynarApiKey: string,
	history: ReadonlyArray<HistoryEntry>,
): Promise<Result<{ engagement: EngagementData[]; warnings: string[] }>> => {
	const results = await Promise.all(
		history.map((entry) => fetchCastEngagement(entry, neynarApiKey)),
	)

	const engagement: EngagementData[] = []
	const warnings: string[] = []

	for (const r of results) {
		if (r.engagement) engagement.push(r.engagement)
		if (r.warning) warnings.push(r.warning)
	}

	return ok({ engagement, warnings })
}
