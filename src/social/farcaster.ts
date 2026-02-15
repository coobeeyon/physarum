import { NeynarAPIClient } from "@neynar/nodejs-sdk"
import { type Result, ok, err } from "#types/result.ts"

export const createNeynarClient = (apiKey: string) => new NeynarAPIClient({ apiKey })

export const postCast = async (
	client: NeynarAPIClient,
	signerUuid: string,
	imageUrl: string,
	mintUrl: string,
	edition: number,
	seed: number,
): Promise<Result<{ castHash: string }>> => {
	const text = `coobeyon #${edition}\nphysarum simulation | seed ${seed}\nmint: ${mintUrl}`

	const response = await client.publishCast({
		signerUuid,
		text,
		embeds: [{ url: imageUrl }, { url: mintUrl }],
	})

	if (!response.cast?.hash) return err("Neynar returned no cast hash")
	return ok({ castHash: response.cast.hash })
}
