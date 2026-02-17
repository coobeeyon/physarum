import { type Result, ok, err } from "#types/result.ts"
import { DEFAULT_HUB_URL } from "#social/farcaster.ts"

export type EnvConfig = {
	readonly walletPrivateKey: `0x${string}`
	readonly pinataJwt: string
	readonly farcasterFid: number
	readonly farcasterSignerKey: Uint8Array
	readonly hubUrl: string
	readonly hubApiKey?: string
	readonly baseRpcUrl: string
}

const DEFAULT_BASE_RPC = "https://mainnet.base.org"

export const loadEnv = (): Result<EnvConfig> => {
	const walletPrivateKey = process.env.WALLET_PRIVATE_KEY
	const pinataJwt = process.env.PINATA_JWT
	const farcasterFid = process.env.FARCASTER_FID
	const farcasterSignerKey = process.env.FARCASTER_SIGNER_KEY
	const hubUrl = process.env.HUB_URL || DEFAULT_HUB_URL
	const hubApiKey = process.env.HUB_API_KEY || undefined
	const baseRpcUrl = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC

	if (!walletPrivateKey) return err("WALLET_PRIVATE_KEY is required")
	if (!walletPrivateKey.startsWith("0x")) return err("WALLET_PRIVATE_KEY must start with 0x")
	if (!pinataJwt) return err("PINATA_JWT is required")
	if (!farcasterFid) return err("FARCASTER_FID is required")
	if (!farcasterSignerKey) return err("FARCASTER_SIGNER_KEY is required")

	const fid = Number.parseInt(farcasterFid, 10)
	if (Number.isNaN(fid) || fid <= 0) return err("FARCASTER_FID must be a positive integer")

	const keyHex = farcasterSignerKey.startsWith("0x") ? farcasterSignerKey.slice(2) : farcasterSignerKey
	if (keyHex.length !== 64) return err("FARCASTER_SIGNER_KEY must be 32 bytes (64 hex chars)")
	const signerKey = Uint8Array.from(Buffer.from(keyHex, "hex"))

	return ok({
		walletPrivateKey: walletPrivateKey as `0x${string}`,
		pinataJwt,
		farcasterFid: fid,
		farcasterSignerKey: signerKey,
		hubUrl,
		hubApiKey,
		baseRpcUrl,
	})
}
