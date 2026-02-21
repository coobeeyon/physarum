import type { EngagementData } from "#types/evolution.ts"
import type { HistoryEntry } from "#types/metadata.ts"
import { type Result, ok } from "#types/result.ts"

const HUB_API = "https://hub.pinata.cloud/v1"
// Our Farcaster FID — needed for hub queries
const OUR_FID = 2797211

const isValidCastHash = (hash: string): boolean =>
	hash.length >= 10 && hash !== "0x0" && hash.startsWith("0x")

/** Count reactions of a given type on one of our casts via the public Farcaster hub */
const countReactions = async (
	castHash: string,
	reactionType: "Like" | "Recast",
): Promise<number> => {
	try {
		const url = `${HUB_API}/reactionsByCast?target_fid=${OUR_FID}&target_hash=${castHash}&reaction_type=${reactionType}`
		const resp = await fetch(url)
		if (!resp.ok) return 0
		const data = (await resp.json()) as { messages?: unknown[] }
		return data.messages?.length ?? 0
	} catch {
		return 0
	}
}

/** Count replies to one of our casts via the public Farcaster hub */
const countReplies = async (castHash: string): Promise<number> => {
	try {
		const url = `${HUB_API}/castsByParent?fid=${OUR_FID}&hash=${castHash}`
		const resp = await fetch(url)
		if (!resp.ok) return 0
		const data = (await resp.json()) as { messages?: unknown[] }
		return data.messages?.length ?? 0
	} catch {
		return 0
	}
}

const fetchCastEngagement = async (
	entry: HistoryEntry,
): Promise<{ engagement: EngagementData | null; warning: string | null }> => {
	if (!isValidCastHash(entry.castHash)) {
		return {
			engagement: null,
			warning: `edition ${entry.edition}: skipped (placeholder hash "${entry.castHash}")`,
		}
	}

	try {
		const [likes, recasts, replies] = await Promise.all([
			countReactions(entry.castHash, "Like"),
			countReactions(entry.castHash, "Recast"),
			countReplies(entry.castHash),
		])

		const ageMs = Date.now() - new Date(entry.timestamp).getTime()

		return {
			engagement: {
				edition: entry.edition,
				castHash: entry.castHash,
				likes,
				recasts,
				replies,
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
	_neynarApiKey: string,
	history: ReadonlyArray<HistoryEntry>,
): Promise<Result<{ engagement: EngagementData[]; warnings: string[] }>> => {
	const results = await Promise.all(history.map((entry) => fetchCastEngagement(entry)))

	const engagement: EngagementData[] = []
	const warnings: string[] = []

	for (const r of results) {
		if (r.engagement) engagement.push(r.engagement)
		if (r.warning) warnings.push(r.warning)
	}

	return ok({ engagement, warnings })
}
