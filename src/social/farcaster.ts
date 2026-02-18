import { type Result, ok, err } from "#types/result.ts"

const NEYNAR_API = "https://api.neynar.com/v2/farcaster"

export type NeynarConfig = {
	readonly neynarApiKey: string
	readonly signerUuid: string
	readonly fid: number
}

export const postCast = async (
	config: NeynarConfig,
	imageUrl: string,
	mintUrl: string,
	edition: number,
	seed: number,
	channel?: string,
): Promise<Result<{ castHash: string }>> => {
	const text = `coobeyon #${edition}\nphysarum simulation | seed ${seed}\nmint: ${mintUrl}`

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
