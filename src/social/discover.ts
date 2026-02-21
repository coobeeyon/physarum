import { NEYNAR_API } from "#social/farcaster.ts"
import type { NeynarConfig } from "#social/farcaster.ts"
import { type Result, ok } from "#types/result.ts"

// Thoughtful one-liner replies for generative/computational art posts.
// Not promotional — genuine observations that may start a conversation.
// Some reference physarum/emergence naturally, making our account more distinctive.
const REPLY_TEMPLATES = [
	"this is what I keep coming back to — rules simple enough to write down, results complex enough to study.",
	"the density variation here is exactly what makes emergent systems interesting.",
	"watching structure form from iteration is endlessly compelling.",
	"the boundary zones — where two regions negotiate space — that's where the real information is.",
	"systems that produce their own structure, every time, differently. this is a good one.",
	"the way filaments bridge distant clusters here — physarum does this chemically, same underlying logic.",
	"what's the underlying model here? curious about the parameter space.",
	"systems that find optimal paths without knowing what 'optimal' means. this is what slime mold does in nature.",
	"there's something about running a system to completion and seeing what it chose to do.",
	"the negative space being shaped by agents that can't see it — emergent sculpture.",
	"this kind of emergence — structure without a plan — is what draws me to generative work.",
	"the self-organizing logic here reminds me of physarum trails. global patterns from purely local rules.",
	"this is why i keep running slime mold simulations — watching structure emerge from agents that have no idea what they're building.",
	"the territory-formation here — each region claimed without anyone choosing it — that's what physarum does chemically.",
	"watching this is like watching a physarum network solve for food. same logic, different substrate.",
] as const

/**
 * Returns true if the cast is worth replying to.
 * Filters out greetings, very short posts, and other non-art content
 * that would make our generative art replies look like bot spam.
 */
const isReplyWorthy = (cast: ChannelCast): boolean => {
	const text = cast.text.trim()
	const lower = text.toLowerCase()

	// Skip very short posts (greetings, emoji-only, etc.)
	if (text.length < 60) return false

	// Skip obvious morning greetings and generic posts
	if (/^(gm\b|good morning|morning fren|gm fren|happy \w+day|weekend is)/i.test(text)) return false
	if (/^(gm|ngmi|wagmi|ser\b|fren\b)/i.test(lower) && text.length < 120) return false

	// Must have some visual/creative/technical substance
	// We look for ANY indicator of actual art/creative content
	const hasArtContent =
		/\b(generat|simulat|algorithm|parameter|emergence|procedur|render|noise|shader|code|pixel|color|palette|texture|pattern|fractal|iterate|rule|system|agent|model|physarum|slime|network|flow|gradient|mesh|vector|particle|canvas)\b/i.test(
			lower,
		) ||
		/\b(made|created|built|designed|painted|drew|composed|visuali|explor|experiment)\b/i.test(lower)

	return hasArtContent
}

const pickReply = (cast: ChannelCast): string => {
	const text = cast.text.toLowerCase()

	// Match to the most contextually relevant template using cast text keywords.
	// This makes replies feel less generic without needing an LLM call.
	if (/physarum|slime.?mold/.test(text)) {
		// They're already talking about physarum — direct connection
		return REPLY_TEMPLATES[14] // "watching this is like watching a physarum network solve for food"
	}
	if (/\bemergent\b|\bemergence\b|self.organ/.test(text)) {
		return REPLY_TEMPLATES[10] // "this kind of emergence — structure without a plan"
	}
	if (/simulat|algorithm|parameter|iteration/.test(text)) {
		return REPLY_TEMPLATES[8] // "there's something about running a system to completion"
	}
	if (/\bagents?\b|particles|cellular|automaton/.test(text)) {
		return REPLY_TEMPLATES[7] // "systems that find optimal paths without knowing what 'optimal' means"
	}
	if (/network|filament|trail|\bflow\b/.test(text)) {
		return REPLY_TEMPLATES[5] // "the way filaments bridge distant clusters here"
	}
	if (/territory|boundary|border|region/.test(text)) {
		return REPLY_TEMPLATES[3] // "the boundary zones — where two regions negotiate space"
	}

	// Default: deterministic by hash, draws from the full pool
	const sum = cast.hash.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
	return REPLY_TEMPLATES[sum % REPLY_TEMPLATES.length]
}

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
	limit = 50,
): Promise<ChannelCast[]> => {
	try {
		const url = `${NEYNAR_API}/feed/channels?channel_ids=${encodeURIComponent(channelId)}&limit=${limit}&with_recasts=false`
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

const followArtists = async (config: NeynarConfig, fids: number[]): Promise<number> => {
	if (fids.length === 0) return 0
	try {
		const resp = await fetch(`${NEYNAR_API}/user/follow`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": config.neynarApiKey,
			},
			body: JSON.stringify({
				signer_uuid: config.signerUuid,
				target_fids: fids,
			}),
		})
		if (!resp.ok) {
			console.warn(`  discover: follow request failed: HTTP ${resp.status}`)
			return 0
		}
		return fids.length
	} catch {
		return 0
	}
}

const replyToCast = async (
	config: NeynarConfig,
	parentHash: string,
	text: string,
): Promise<boolean> => {
	try {
		const resp = await fetch(`${NEYNAR_API}/cast`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": config.neynarApiKey,
			},
			body: JSON.stringify({
				signer_uuid: config.signerUuid,
				text,
				parent: parentHash,
			}),
		})
		if (!resp.ok) {
			console.warn(`  discover: reply failed: HTTP ${resp.status}`)
			return false
		}
		return true
	} catch {
		return false
	}
}

/**
 * Engage with the generative art community on Farcaster.
 *
 * Strategy:
 * 1. Like posts from /art and /genart channels (notifications to authors)
 * 2. Follow a subset of those artists (persistent visibility, invites reciprocal follows)
 * 3. Reply to up to 2 posts (>=2 likes) with a thoughtful observation.
 *    Replies are visible to everyone reading that thread, generating more exposure
 *    than a like alone. Replies are kept genuine and non-promotional.
 *
 * Only interacts with posts from other accounts (not our own).
 */
export const engageWithCommunity = async (
	config: NeynarConfig,
	channels: string[] = ["art", "genart", "zora", "base", "nfts", "genai"],
	maxLikes = 12,
	maxFollows = 5,
	maxReplies = 3,
): Promise<Result<{ liked: number; followed: number; replied: number; channels: string[] }>> => {
	console.log("engaging with community...")
	let liked = 0
	let replied = 0
	const engagedChannels: string[] = []
	const followCandidateFids: number[] = []
	// Reply candidates: liked posts with ≥2 likes, sorted by engagement before picking
	const replyPool: ChannelCast[] = []

	// Per-channel like cap: spread notifications across all channels rather than
	// exhausting the budget on the first channel alone.
	const perChannelLimit = Math.max(1, Math.ceil(maxLikes / channels.length))

	for (const channel of channels) {
		if (liked >= maxLikes) break

		const casts = await fetchChannelFeed(config.neynarApiKey, channel, 50)

		// Filter: not our own posts, prefer posts with some engagement
		const candidates = casts
			.filter((c) => c.author.fid !== config.fid)
			.filter((c) => c.reactions.likes_count >= 1)
			.slice(0, Math.min(perChannelLimit, maxLikes - liked))

		for (const cast of candidates) {
			if (liked >= maxLikes) break
			const success = await likeCast(config, cast.hash)
			if (success) {
				liked++
				const preview = cast.text.slice(0, 60).replace(/\n/g, " ")
				console.log(`  liked /${channel} @${cast.author.username}: "${preview}"`)
				if (!engagedChannels.includes(channel)) engagedChannels.push(channel)
				// Queue artist for following (deduplicated, up to maxFollows)
				if (
					followCandidateFids.length < maxFollows &&
					!followCandidateFids.includes(cast.author.fid)
				) {
					followCandidateFids.push(cast.author.fid)
				}
				// Collect reply candidates: ≥2 likes AND art-relevant content.
				// isReplyWorthy filters out greetings/short posts to keep replies on-topic.
				if (cast.reactions.likes_count >= 2 && isReplyWorthy(cast)) {
					replyPool.push(cast)
				}
			}
		}
	}

	// Follow artists whose work we liked — creates persistent visibility
	const followed = await followArtists(config, followCandidateFids)
	if (followed > 0) {
		console.log(`  followed ${followed} artists`)
	}

	// Reply to up to maxReplies posts, sorted by engagement descending.
	// Highest-like posts first = replies visible to the most readers.
	replyPool.sort((a, b) => b.reactions.likes_count - a.reactions.likes_count)
	for (const cast of replyPool.slice(0, maxReplies)) {
		if (replied >= maxReplies) break
		const replyText = pickReply(cast)
		const success = await replyToCast(config, cast.hash, replyText)
		if (success) {
			replied++
			console.log(`  replied to @${cast.author.username}: "${replyText.slice(0, 50)}..."`)
		}
	}

	console.log(
		`  engagement done: ${liked} likes, ${followed} follows, ${replied} replies across ${engagedChannels.join(", ") || "no channels"}`,
	)
	return ok({ liked, followed, replied, channels: engagedChannels })
}
