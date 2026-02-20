import { NEYNAR_API } from "#social/farcaster.ts"
import type { NeynarConfig } from "#social/farcaster.ts"
import { type Result, ok } from "#types/result.ts"

type ChannelCast = {
	hash: string
	text: string
	author: { fid: number; username: string }
	reactions: { likes_count: number }
}

type NeynarFeedResponse = {
	casts?: ChannelCast[]
}

const fetchChannelFeed = async (
	apiKey: string,
	channelId: string,
	limit = 25,
): Promise<ChannelCast[]> => {
	try {
		const url = `${NEYNAR_API}/feed/channel?channel_id=${encodeURIComponent(channelId)}&limit=${limit}&with_recasts=false`
		const resp = await fetch(url, { headers: { "x-api-key": apiKey } })
		if (!resp.ok) {
			console.warn(`  discover: feed fetch failed for /${channelId}: HTTP ${resp.status}`)
			return []
		}
		const data = (await resp.json()) as NeynarFeedResponse
		return data.casts ?? []
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		console.warn(`  discover: feed fetch error for /${channelId}: ${msg}`)
		return []
	}
}

const likeCast = async (config: NeynarConfig, castHash: string): Promise<boolean> => {
	try {
		const resp = await fetch(`${NEYNAR_API}/reaction`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": config.neynarApiKey,
			},
			body: JSON.stringify({
				signer_uuid: config.signerUuid,
				reaction_type: "like",
				target: castHash,
			}),
		})
		return resp.ok
	} catch {
		return false
	}
}

/**
 * Engage with the generative art community on Farcaster.
 *
 * Strategy: like a handful of posts from /art and /genart channels each run.
 * Each like sends a notification to the post author, who may check our profile.
 * Over time this builds organic discovery without spamming.
 *
 * Only likes posts from other accounts (not our own), and prefers posts
 * that already have some traction (at least 1 like) to avoid appearing
 * to carpet-bomb zero-engagement posts.
 */
export const engageWithCommunity = async (
	config: NeynarConfig,
	channels: string[] = ["art", "genart"],
	maxLikes = 4,
): Promise<Result<{ liked: number; channels: string[] }>> => {
	console.log("engaging with community...")
	let liked = 0
	const engagedChannels: string[] = []

	for (const channel of channels) {
		if (liked >= maxLikes) break

		const casts = await fetchChannelFeed(config.neynarApiKey, channel, 30)

		// Filter: not our own posts, and prefer posts with some engagement
		const candidates = casts
			.filter((c) => c.author.fid !== config.fid)
			.filter((c) => c.reactions.likes_count >= 1)
			.slice(0, maxLikes - liked)

		for (const cast of candidates) {
			if (liked >= maxLikes) break
			const success = await likeCast(config, cast.hash)
			if (success) {
				liked++
				const preview = cast.text.slice(0, 60).replace(/\n/g, " ")
				console.log(`  liked /${channel} @${cast.author.username}: "${preview}"`)
				if (!engagedChannels.includes(channel)) engagedChannels.push(channel)
			}
		}
	}

	console.log(`  engagement done: ${liked} likes across ${engagedChannels.join(", ") || "no channels"}`)
	return ok({ liked, channels: engagedChannels })
}
