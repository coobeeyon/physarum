import {
	getSSLHubRpcClient,
	makeCastAdd,
	NobleEd25519Signer,
	FarcasterNetwork,
	type HubRpcClient,
	createDefaultMetadataKeyInterceptor,
} from "@farcaster/hub-nodejs"
import { type Result, ok, err } from "#types/result.ts"

const DEFAULT_HUB_URL = "snapchain-grpc-api.neynar.com:443"

export type HubConfig = {
	readonly hubUrl: string
	readonly hubApiKey?: string
	readonly fid: number
	readonly signerKey: Uint8Array
}

export const createHubClient = (config: HubConfig): HubRpcClient => {
	const interceptors = config.hubApiKey
		? [createDefaultMetadataKeyInterceptor("x-api-key", config.hubApiKey)]
		: []

	return getSSLHubRpcClient(config.hubUrl, {
		interceptors,
		"grpc.max_receive_message_length": 20 * 1024 * 1024,
	})
}

export const postCast = async (
	client: HubRpcClient,
	config: HubConfig,
	imageUrl: string,
	mintUrl: string,
	edition: number,
	seed: number,
): Promise<Result<{ castHash: string }>> => {
	const text = `coobeyon #${edition}\nphysarum simulation | seed ${seed}\nmint: ${mintUrl}`
	const signer = new NobleEd25519Signer(config.signerKey)

	const castResult = await makeCastAdd(
		{
			text,
			embeds: [{ url: imageUrl }, { url: mintUrl }],
			embedsDeprecated: [],
			mentions: [],
			mentionsPositions: [],
			type: 0, // CastType.CAST
		},
		{ fid: config.fid, network: FarcasterNetwork.MAINNET },
		signer,
	)

	if (castResult.isErr()) return err(`Failed to create cast message: ${castResult.error.message}`)

	const submitResult = await client.submitMessage(castResult.value)

	if (submitResult.isErr()) return err(`Failed to submit cast: ${submitResult.error.message}`)

	const hash = Buffer.from(submitResult.value.hash).toString("hex")
	return ok({ castHash: `0x${hash}` })
}

export { DEFAULT_HUB_URL }
