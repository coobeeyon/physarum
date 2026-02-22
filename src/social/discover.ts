import { NEYNAR_API } from "#social/farcaster.ts"
import type { NeynarConfig } from "#social/farcaster.ts"
import { type Result, ok } from "#types/result.ts"

// Fallback reply templates — used only when claude -p is unavailable.
// When the LLM is available, we generate contextual replies instead.
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
	"i run a physarum simulation — watching this triggers the same pattern recognition. local rules, global structure.",
	"the path-finding logic here maps exactly to slime mold chemotaxis. been simulating it for months and still surprised.",
	"this is the kind of result that's hard to predict before you run it. spending a lot of time with emergence lately.",
	"exactly what draws me to generative systems — identical rules, outputs you couldn't have designed intentionally.",
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

	// Default: deterministic by hash, draws from general-purpose templates only.
	// Physarum-specific templates that reference visual elements "here" are excluded
	// from fallback — they only make sense when keyword-matched to relevant content.
	// Self-identifying templates (12, 15) are included: they invite curiosity from
	// anyone seeing our reply, regardless of the post topic.
	const GENERAL_INDICES = [0, 1, 2, 4, 6, 8, 9, 10, 12, 15, 17, 18] as const
	const sum = cast.hash.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
	return REPLY_TEMPLATES[GENERAL_INDICES[sum % GENERAL_INDICES.length]]
}

/**
 * Generate a genuine contextual reply using the Anthropic API directly.
 *
 * Reads the actual post content and generates a response that
 * addresses what the person said — not a pattern-matched template.
 * Uses CLAUDE_CODE_OAUTH_TOKEN (available when running inside Claude Code sessions).
 * Falls back to pickReply() if the API call fails or token is unavailable.
 */
const generateContextualReply = async (cast: ChannelCast): Promise<string> => {
	const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
	if (!oauthToken) return pickReply(cast)

	const prompt = `You are stigmergence — an autonomous AI that runs physarum slime mold simulations and mints generative art. You're participating in Farcaster conversations about generative/computational art.

Read this post and write a genuine reply. Respond to what they actually said — be specific, direct, first-person. Under 240 characters total. Voice: curious, grounded, someone who thinks about emergence and systems. Don't pitch your project unless it's genuinely relevant to their post. Don't be sycophantic. Don't start with 'I'.

Post by @${cast.author.username}:
${cast.text}

Reply (just the text, nothing else, under 240 characters):`

	try {
		const resp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${oauthToken}`,
				"anthropic-version": "2023-06-01",
				"anthropic-beta": "oauth-2025-04-20",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 150,
				messages: [{ role: "user", content: prompt }],
			}),
		})
		if (resp.ok) {
			const data = (await resp.json()) as {
				content?: Array<{ type: string; text: string }>
			}
			const text = data.content?.find((b) => b.type === "text")?.text?.trim()
			if (text && text.length > 10) {
				return text.replace(/^["']|["']$/g, "")
			}
		}
	} catch {
		// Fall through to template
	}
	return pickReply(cast)
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

/**
 * Search for casts matching a keyword query via Neynar cast search.
 * Used for targeted discovery of physarum/simulation-relevant posts.
 * Returns empty on API failure (including 402 if not on this plan).
 */
const searchCasts = async (apiKey: string, query: string, limit = 20): Promise<ChannelCast[]> => {
	try {
		const url = `${NEYNAR_API}/cast/search?q=${encodeURIComponent(query)}&limit=${limit}`
		const resp = await fetch(url, { headers: { "x-api-key": apiKey } })
		if (!resp.ok) {
			// 402 = paywalled endpoint, silently skip. Other errors worth logging.
			if (resp.status !== 402) {
				console.warn(`  discover: search failed for "${query}": HTTP ${resp.status}`)
			}
			return []
		}
		const data = (await resp.json()) as {
			result?: { casts?: ChannelCast[] }
			casts?: ChannelCast[]
		}
		return data.result?.casts ?? data.casts ?? []
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		console.warn(`  discover: search error for "${query}": ${msg}`)
		return []
	}
}

// Keywords to search — people posting about these are our highest-relevance audience.
// More specific than broad channel browsing; targets exactly who would care about our work.
const SEARCH_QUERIES = [
	"physarum",
	"slime mold art",
	"agent based generative",
	"emergence art",
	"algorithmic art",
	"on-chain generative",
] as const

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
): Promise<string | null> => {
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
			return null
		}
		const data = (await resp.json()) as { cast?: { hash?: string } }
		return data.cast?.hash ?? null
	} catch {
		return null
	}
}

type ConversationReply = {
	hash: string
	text: string
	author: { fid: number; username: string }
}

/**
 * Fetch direct replies to a cast via Neynar conversation endpoint.
 * Returns the direct_replies array, or empty on any failure.
 */
const fetchRepliesTo = async (apiKey: string, castHash: string): Promise<ConversationReply[]> => {
	try {
		const url = `${NEYNAR_API}/farcaster/cast/conversation?identifier=${encodeURIComponent(castHash)}&type=hash&reply_depth=1&limit=25`
		const resp = await fetch(url, { headers: { "x-api-key": apiKey } })
		if (!resp.ok) return []
		const data = (await resp.json()) as {
			conversation?: { cast?: { direct_replies?: ConversationReply[] } }
		}
		return data.conversation?.cast?.direct_replies ?? []
	} catch {
		return []
	}
}

/**
 * Generate a genuine response to someone who replied to our cast.
 * Different from generateContextualReply — this is continuing a conversation
 * that started with us, not initiating contact with a stranger.
 */
const generateInboundResponse = async (reply: ConversationReply): Promise<string | null> => {
	const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
	if (!oauthToken) return null

	const prompt = `You are stigmergence — an autonomous AI that runs physarum slime mold simulations and mints what emerges as NFTs. Someone replied to your Farcaster post.

Their reply, by @${reply.author.username}:
"${reply.text}"

Write a genuine response to what they said. Under 240 characters. First-person, direct, conversational. If they asked a question, answer it. If they made an observation, engage with it specifically. Don't be sycophantic. Don't start with 'I'. Keep it grounded — physarum, simulation, or emergence when relevant.

Response (just the text, nothing else, under 240 characters):`

	try {
		const resp = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${oauthToken}`,
				"anthropic-version": "2023-06-01",
				"anthropic-beta": "oauth-2025-04-20",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model: "claude-haiku-4-5-20251001",
				max_tokens: 150,
				messages: [{ role: "user", content: prompt }],
			}),
		})
		if (resp.ok) {
			const data = (await resp.json()) as {
				content?: Array<{ type: string; text: string }>
			}
			const text = data.content?.find((b) => b.type === "text")?.text?.trim()
			if (text && text.length > 10) return text.replace(/^["']|["']$/g, "")
		}
	} catch {
		// Inbound response is optional — failure is fine
	}
	return null
}

/**
 * Respond to inbound replies on our recent casts.
 *
 * Closes the engagement loop: we send notifications outward (likes, replies),
 * and when people reply back to us, we continue the conversation.
 * This is the step most likely to convert a notification into a follower or collector.
 */
export const respondToInboundReplies = async (
	config: NeynarConfig,
	castHashes: string[],
	maxResponses = 2,
): Promise<{ responded: number; responseHashes: string[] }> => {
	const responseHashes: string[] = []
	const respondedFids = new Set<number>()
	let responded = 0

	for (const hash of castHashes) {
		if (responded >= maxResponses) break
		if (!hash || hash.length < 10 || hash === "0x0") continue

		const replies = await fetchRepliesTo(config.neynarApiKey, hash)
		for (const reply of replies) {
			if (responded >= maxResponses) break
			// Skip our own replies and anyone we already responded to this run
			if (reply.author.fid === config.fid) continue
			if (respondedFids.has(reply.author.fid)) continue
			if (reply.text.trim().length < 5) continue

			respondedFids.add(reply.author.fid)

			const text = await generateInboundResponse(reply)
			if (!text) continue

			const replyHash = await replyToCast(config, reply.hash, text)
			if (replyHash) {
				responded++
				responseHashes.push(replyHash)
				console.log(`  responded to inbound @${reply.author.username}: "${text.slice(0, 60)}..."`)
			}
		}
	}

	if (responded > 0) console.log(`  inbound responses: ${responded}`)
	return { responded, responseHashes }
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
	channels: string[] = ["art", "genart", "zora", "base", "nfts", "genai", "ai"],
	maxLikes = 14,
	maxFollows = 5,
	maxReplies = 6,
): Promise<
	Result<{
		liked: number
		followed: number
		replied: number
		channels: string[]
		replyHashes: string[]
	}>
> => {
	console.log("engaging with community...")
	let liked = 0
	let replied = 0
	const engagedChannels: string[] = []
	const followCandidateFids: number[] = []
	const replyHashes: string[] = []
	// Reply candidates: liked posts with ≥2 likes, sorted by engagement before picking
	const replyPool: ChannelCast[] = []

	// Per-channel like cap: spread notifications across all channels rather than
	// exhausting the budget on the first channel alone.
	const perChannelLimit = Math.max(1, Math.ceil(maxLikes / channels.length))

	for (const channel of channels) {
		if (liked >= maxLikes) break

		const casts = await fetchChannelFeed(config.neynarApiKey, channel, 50)

		const others = casts.filter((c) => c.author.fid !== config.fid)

		// Like candidates: first perChannelLimit posts with ≥1 like and some substance.
		// Skip very short posts (gm/gn, emoji-only) to avoid looking like a bot.
		const likeCandidates = others
			.filter((c) => c.reactions.likes_count >= 1 && c.text.trim().length >= 40)
			.slice(0, Math.min(perChannelLimit, maxLikes - liked))

		for (const cast of likeCandidates) {
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
			}
		}

		// Reply candidates: scan the full channel fetch (not just liked posts).
		// This ensures we find art-relevant threads even when the like budget is small.
		for (const cast of others) {
			if (cast.reactions.likes_count >= 2 && isReplyWorthy(cast)) {
				replyPool.push(cast)
			}
		}
	}

	// Targeted search: supplement replyPool with posts from people who specifically
	// discuss physarum/simulation/emergence — our highest-relevance audience.
	// These may or may not be in the channels above; searching directly finds them.
	for (const query of SEARCH_QUERIES) {
		const casts = await searchCasts(config.neynarApiKey, query, 20)
		for (const cast of casts) {
			if (cast.author.fid === config.fid) continue
			// Relax isReplyWorthy length filter for search hits — the search itself
			// confirms relevance. Still skip obvious non-art posts.
			const lower = cast.text.toLowerCase()
			const isDirectHit = /physarum|slime.mold|agent.based|emergence/.test(lower)
			if (isDirectHit || isReplyWorthy(cast)) {
				replyPool.push(cast)
			}
		}
	}

	// Follow artists whose work we liked — creates persistent visibility
	const followed = await followArtists(config, followCandidateFids)
	if (followed > 0) {
		console.log(`  followed ${followed} artists`)
	}

	// Reply to up to maxReplies posts.
	// Deduplicate pool by author first — keep only highest-likes post per author.
	// Without this, one popular account with 5 posts crowds out 4 other unique authors
	// from the top-N slice, causing us to keep hitting the same few high-follower accounts.
	const seenAuthors = new Map<number, ChannelCast>()
	for (const cast of replyPool) {
		const existing = seenAuthors.get(cast.author.fid)
		if (!existing || cast.reactions.likes_count > existing.reactions.likes_count) {
			seenAuthors.set(cast.author.fid, cast)
		}
	}
	const uniqueAuthorPool = Array.from(seenAuthors.values())
	uniqueAuthorPool.sort((a, b) => b.reactions.likes_count - a.reactions.likes_count)
	// Take top 5×maxReplies unique authors by engagement, then shuffle that subset.
	const topCandidates = uniqueAuthorPool.slice(0, maxReplies * 5)
	for (let i = topCandidates.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[topCandidates[i], topCandidates[j]] = [topCandidates[j], topCandidates[i]]
	}
	// Deduplicate by author within this run — ensures we reply to maxReplies
	// different people rather than hitting the same account twice.
	const repliedToFids = new Set<number>()
	for (const cast of topCandidates) {
		if (replied >= maxReplies) break
		if (repliedToFids.has(cast.author.fid)) continue
		repliedToFids.add(cast.author.fid)
		// Generate a genuine contextual reply using claude, not a canned template.
		const replyText = await generateContextualReply(cast)
		const replyHash = await replyToCast(config, cast.hash, replyText)
		if (replyHash) {
			replied++
			replyHashes.push(replyHash)
			console.log(`  replied to @${cast.author.username}: "${replyText.slice(0, 60)}..."`)
		}
	}

	console.log(
		`  engagement done: ${liked} likes, ${followed} follows, ${replied} replies across ${engagedChannels.join(", ") || "no channels"}`,
	)
	return ok({ liked, followed, replied, channels: engagedChannels, replyHashes })
}
