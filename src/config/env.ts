import { type Result, ok, err } from "#types/result.ts"

export type EnvConfig = {
	readonly walletPrivateKey: `0x${string}`
	readonly pinataJwt: string
	readonly neynarApiKey: string
	readonly neynarSignerUuid: string
	readonly baseRpcUrl: string
}

const DEFAULT_BASE_RPC = "https://mainnet.base.org"

export const loadEnv = (): Result<EnvConfig> => {
	const walletPrivateKey = process.env.WALLET_PRIVATE_KEY
	const pinataJwt = process.env.PINATA_JWT
	const neynarApiKey = process.env.NEYNAR_API_KEY
	const neynarSignerUuid = process.env.NEYNAR_SIGNER_UUID
	const baseRpcUrl = process.env.BASE_RPC_URL || DEFAULT_BASE_RPC

	if (!walletPrivateKey) return err("WALLET_PRIVATE_KEY is required")
	if (!walletPrivateKey.startsWith("0x")) return err("WALLET_PRIVATE_KEY must start with 0x")
	if (!pinataJwt) return err("PINATA_JWT is required")
	if (!neynarApiKey) return err("NEYNAR_API_KEY is required")
	if (!neynarSignerUuid) return err("NEYNAR_SIGNER_UUID is required")

	return ok({
		walletPrivateKey: walletPrivateKey as `0x${string}`,
		pinataJwt,
		neynarApiKey,
		neynarSignerUuid,
		baseRpcUrl,
	})
}
