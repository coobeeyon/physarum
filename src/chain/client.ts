import { http, createPublicClient, createWalletClient } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const createClients = (privateKey: `0x${string}`, rpcUrl: string) => {
	const account = privateKeyToAccount(privateKey)
	const transport = http(rpcUrl)

	const publicClient = createPublicClient({
		chain: base,
		transport,
	})

	const walletClient = createWalletClient({
		chain: base,
		transport,
		account,
	})

	return { publicClient, walletClient, account }
}
