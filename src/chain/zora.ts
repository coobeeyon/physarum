import { createCreatorClient } from "@zoralabs/protocol-sdk"
import type { PublicClient, WalletClient, Account, Chain, Transport } from "viem"
import { base } from "viem/chains"
import { type Result, ok, err } from "#types/result.ts"

type DeployResult = {
	readonly contractAddress: string
	readonly tokenId: string
	readonly txHash: string
}

export const deployEdition = async (
	publicClient: PublicClient<Transport, Chain>,
	walletClient: WalletClient<Transport, Chain, Account>,
	metadataUri: string,
	existingContractAddress?: string,
): Promise<Result<DeployResult>> => {
	const creatorClient = createCreatorClient({ chainId: base.id, publicClient })

	if (existingContractAddress) {
		// Add new token to existing contract
		const { parameters, tokenId } = await creatorClient.create1155OnExistingContract({
			contractAddress: existingContractAddress as `0x${string}`,
			token: {
				tokenMetadataURI: metadataUri,
			},
			account: walletClient.account,
		})

		const txHash = await walletClient.writeContract(parameters)
		await publicClient.waitForTransactionReceipt({ hash: txHash })

		return ok({
			contractAddress: existingContractAddress,
			tokenId: String(tokenId),
			txHash,
		})
	}

	// Create new contract + first token
	const { parameters, contractAddress, tokenId } = await creatorClient.create1155({
		contract: {
			name: "coobeyon",
			uri: metadataUri,
		},
		token: {
			tokenMetadataURI: metadataUri,
		},
		account: walletClient.account,
	})

	const txHash = await walletClient.writeContract(parameters)
	await publicClient.waitForTransactionReceipt({ hash: txHash })

	return ok({
		contractAddress,
		tokenId: String(tokenId),
		txHash,
	})
}
