import { type Result, err, ok } from "#types/result.ts"

export const NEYNAR_API = "https://api.neynar.com/v2/farcaster"

export type NeynarConfig = {
	readonly neynarApiKey: string
	readonly signerUuid: string
	readonly fid: number
}

export const postCast = async (
	config: NeynarConfig,
	text: string,
	imageUrl: string,
	mintUrl: string,
	channel?: string,
): Promise<Result<{ castHash: string }>> => {
	const body: Record<string, unknown> = {
		signer_uuid: config.signerUuid,
		text,
		embeds: [{ url: imageUrl }, { url: mintUrl }],
	}
	if (channel) {
		body.channel_id = channel
	}

	const resp = await fetch(`${NEYNAR_API}/cast`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.neynarApiKey,
		},
		body: JSON.stringify(body),
	})

	if (!resp.ok) {
		const detail = await resp.text()
		return err(`Neynar cast failed (HTTP ${resp.status}): ${detail}`)
	}

	const data = (await resp.json()) as { cast?: { hash?: string } }
	const hash = data.cast?.hash
	if (!hash) return err(`Neynar cast response missing hash: ${JSON.stringify(data)}`)

	return ok({ castHash: hash })
}

/**
 * Post a reply to an existing cast.
 * Used for self-replies to our own edition posts.
 * Pass embedUrls to include clickable cards (e.g. Zora collect link) in the thread.
 */
export const postReply = async (
	config: NeynarConfig,
	text: string,
	parentHash: string,
	embedUrls?: string[],
): Promise<Result<{ castHash: string }>> => {
	const body: Record<string, unknown> = {
		signer_uuid: config.signerUuid,
		text,
		parent: parentHash,
	}
	if (embedUrls && embedUrls.length > 0) {
		body.embeds = embedUrls.map((url) => ({ url }))
	}
	const resp = await fetch(`${NEYNAR_API}/cast`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.neynarApiKey,
		},
		body: JSON.stringify(body),
	})

	if (!resp.ok) {
		const detail = await resp.text()
		return err(`Neynar reply failed (HTTP ${resp.status}): ${detail}`)
	}

	const data = (await resp.json()) as { cast?: { hash?: string } }
	const hash = data.cast?.hash
	if (!hash) return err(`Neynar reply response missing hash: ${JSON.stringify(data)}`)

	return ok({ castHash: hash })
}
