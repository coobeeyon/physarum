import { type Result, ok, err } from "#types/result.ts"

export type EnvConfig = {
	readonly walletPrivateKey: `0x${string}`
	readonly pinataJwt: string
	readonly farcasterFid: number
	readonly neynarApiKey: string
	readonly neynarSignerUuid: string
	readonly baseRpcUrl: string
	readonly farcasterChannel?: string
	readonly anthropicApiKey?: string
}

const DEFAULT_BASE_RPC = "https://mainnet.base.org"

export const loadEnv = (): Result<EnvConfig> => {
	const walletPrivateKey = process.env.WALLET_PRIVATE_KEY
	const pinataJwt = process.env.PINATA_JWT
	const farcasterFid = process.env.FARCASTER_FID
	const neynarApiKey = process.env.NEYNAR_API_KEY
	const neynarSignerUuid = process.env.NEYNAR_SIGNER_UUID
	const baseRpcUrl = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC
	const farcasterChannel = process.env.FARCASTER_CHANNEL?.trim() || undefined
	const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined

	if (!walletPrivateKey) return err("WALLET_PRIVATE_KEY is required")
	if (!walletPrivateKey.startsWith("0x")) return err("WALLET_PRIVATE_KEY must start with 0x")
	if (!pinataJwt) return err("PINATA_JWT is required")
	if (!farcasterFid) return err("FARCASTER_FID is required")
	if (!neynarApiKey) return err("NEYNAR_API_KEY is required")
	if (!neynarSignerUuid) return err("NEYNAR_SIGNER_UUID is required")

	const fid = Number.parseInt(farcasterFid, 10)
	if (Number.isNaN(fid) || fid <= 0) return err("FARCASTER_FID must be a positive integer")

	return ok({
		walletPrivateKey: walletPrivateKey as `0x${string}`,
		pinataJwt,
		farcasterFid: fid,
		neynarApiKey,
		neynarSignerUuid,
		baseRpcUrl,
		farcasterChannel,
		anthropicApiKey,
	})
}
