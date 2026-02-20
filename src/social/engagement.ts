import { NEYNAR_API } from "#social/farcaster.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { HistoryEntry } from "#types/metadata.ts"
import { type Result, ok } from "#types/result.ts"

const isValidCastHash = (hash: string): boolean =>
	hash.length >= 10 && hash !== "0x0" && hash.startsWith("0x")

type NeynarCastResponse = {
	cast: {
		reactions: { likes_count: number; recasts_count: number }
		replies: { count: number }
	}
}

const fetchCastEngagement = async (
	apiKey: string,
	entry: HistoryEntry,
): Promise<{ engagement: EngagementData | null; warning: string | null }> => {
	if (!isValidCastHash(entry.castHash)) {
		return {
			engagement: null,
			warning: `edition ${entry.edition}: skipped (placeholder hash "${entry.castHash}")`,
		}
	}

	try {
		const resp = await fetch(`${NEYNAR_API}/cast?identifier=${entry.castHash}&type=hash`, {
			headers: { "x-api-key": apiKey },
		})

		if (!resp.ok) {
			const detail = await resp.text()
			return {
				engagement: null,
				warning: `edition ${entry.edition}: HTTP ${resp.status} — ${detail}`,
			}
		}

		const data = (await resp.json()) as NeynarCastResponse
		const ageMs = Date.now() - new Date(entry.timestamp).getTime()

		return {
			engagement: {
				edition: entry.edition,
				castHash: entry.castHash,
				likes: data.cast.reactions.likes_count,
				recasts: data.cast.reactions.recasts_count,
				replies: data.cast.replies.count,
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
		history.map((entry) => fetchCastEngagement(neynarApiKey, entry)),
	)

	const engagement: EngagementData[] = []
	const warnings: string[] = []

	for (const r of results) {
		if (r.engagement) engagement.push(r.engagement)
		if (r.warning) warnings.push(r.warning)
	}

	return ok({ engagement, warnings })
}
