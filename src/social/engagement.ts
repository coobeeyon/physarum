import type { EngagementRead } from "#types/evolution.ts"
import type { HistoryEntry } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

const NEYNAR_API = "https://api.neynar.com/v2"
const isValidCastHash = (hash: string): boolean => /^0x[0-9a-f]{40}$/i.test(hash)
type CastCounts = { likes: number; recasts: number; replies: number }

/** Missing fields and failed requests are unknown, never measured zero. */
const fetchCastCounts = async (castHash: string, apiKey: string): Promise<Result<CastCounts>> => {
	if (!isValidCastHash(castHash)) return err("invalid or placeholder hash")
	try {
		const url = `${NEYNAR_API}/farcaster/cast?identifier=${castHash}&type=hash`
		const resp = await fetch(url, {
			headers: { "x-api-key": apiKey },
			signal: AbortSignal.timeout(10_000),
		})
		if (!resp.ok) return err(`HTTP ${resp.status}`)
		let data: {
			cast?: {
				reactions?: { likes_count?: number; recasts_count?: number }
				replies?: { count?: number }
			}
		} | null
		try {
			data = await resp.json()
		} catch {
			return err("invalid JSON response")
		}
		const likes = data?.cast?.reactions?.likes_count
		const recasts = data?.cast?.reactions?.recasts_count
		const replies = data?.cast?.replies?.count
		const validCount = (n: unknown): n is number =>
			typeof n === "number" && Number.isSafeInteger(n) && n >= 0
		if (!validCount(likes) || !validCount(recasts) || !validCount(replies)) {
			return err("missing or invalid engagement counts")
		}
		return ok({ likes, recasts, replies })
	} catch {
		// Do not echo arbitrary transport errors or response bodies into prompts/logs.
		return err("network error or timeout")
	}
}

const fetchCastEngagement = async (
	entry: HistoryEntry,
	apiKey: string,
): Promise<EngagementRead> => {
	// Keep malformed stored references as failures, rather than silently dropping coverage.
	const corrections = entry.correctionReplies ?? []
	const hashes = [
		...new Set([
			entry.castHash,
			...(entry.selfReplyHash !== undefined ? [entry.selfReplyHash] : []),
			...(entry.zoraCastHash !== undefined ? [entry.zoraCastHash] : []),
			...(entry.replyCastHashes ?? []),
			...corrections.map((c) => c.castHash),
		]),
	]
	const results = await Promise.all(hashes.map((hash) => fetchCastCounts(hash, apiKey)))
	const failures = results.flatMap((r, i) =>
		r.ok ? [] : [{ castHash: hashes[i], error: r.error }],
	)
	const common = {
		edition: entry.edition,
		castHash: entry.castHash,
		ageHours:
			Math.round(((Date.now() - new Date(entry.timestamp).getTime()) / 3_600_000) * 10) / 10,
		requestedCasts: hashes.length,
		successfulCasts: hashes.length - failures.length,
		failures,
	}
	if (common.successfulCasts === 0) {
		return { ...common, status: "unavailable", likes: null, recasts: null, replies: null }
	}
	const counts: CastCounts = { likes: 0, recasts: 0, replies: 0 }
	for (const [i, result] of results.entries()) {
		if (!result.ok) continue
		// Known own replies still belong to the parent even when their count read fails.
		// Only subtract on a successfully read parent, once per distinct child.
		const ownReplies = new Set(
			corrections
				.filter((c) => c.parentHash === hashes[i] && isValidCastHash(c.castHash))
				.map((c) => c.castHash),
		)
		if (
			hashes[i] === entry.castHash &&
			entry.selfReplyHash &&
			isValidCastHash(entry.selfReplyHash)
		) {
			ownReplies.add(entry.selfReplyHash)
		}
		counts.likes += result.value.likes
		counts.recasts += result.value.recasts
		counts.replies += Math.max(0, result.value.replies - ownReplies.size)
	}
	return { ...common, status: failures.length ? "partial" : "complete", ...counts }
}

export const readEngagement = async (
	neynarApiKey: string,
	history: ReadonlyArray<HistoryEntry>,
): Promise<Result<{ engagement: EngagementRead[]; warnings: string[] }>> => {
	const engagement = await Promise.all(
		history.map((entry) => fetchCastEngagement(entry, neynarApiKey)),
	)
	const warnings = engagement.flatMap((e) =>
		e.failures.map(
			(f) =>
				`edition ${e.edition}: ${e.status} (${e.successfulCasts}/${e.requestedCasts} casts read); ${f.castHash}: ${f.error}`,
		),
	)
	return ok({ engagement, warnings })
}
