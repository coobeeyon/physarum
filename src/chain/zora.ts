import { zoraCreator1155ImplABI } from "@zoralabs/protocol-deployments"
import {
	type IContractGetter,
	create1155,
	createNew1155Token,
	new1155ContractVersion,
} from "@zoralabs/protocol-sdk"
import type { Account, Address, Chain, PublicClient, Transport, WalletClient } from "viem"
import { base } from "viem/chains"
import { type Result, err, ok } from "#types/result.ts"

class OnchainContractGetter implements IContractGetter {
	constructor(
		private readonly publicClient: PublicClient<Transport, Chain>,
		private readonly chainId: number,
	) {}

	async getContractInfo({ contractAddress }: { contractAddress: Address }) {
		const [nextTokenId, mintFee, name] = await Promise.all([
			this.publicClient.readContract({
				address: contractAddress,
				abi: zoraCreator1155ImplABI,
				functionName: "nextTokenId",
			}),
			this.publicClient.readContract({
				address: contractAddress,
				abi: zoraCreator1155ImplABI,
				functionName: "mintFee",
			}),
			this.publicClient.readContract({
				address: contractAddress,
				abi: zoraCreator1155ImplABI,
				functionName: "name",
			}),
		])

		return {
			nextTokenId: nextTokenId as bigint,
			mintFee: mintFee as bigint,
			name: name as string,
			contractVersion: new1155ContractVersion(this.chainId),
		}
	}
}

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
	if (existingContractAddress) {
		// Add new token to existing contract — uses on-chain reads instead of dead subgraph
		const contractGetter = new OnchainContractGetter(publicClient, base.id)
		const { parameters, tokenId } = await createNew1155Token({
			contractAddress: existingContractAddress as `0x${string}`,
			token: {
				tokenMetadataURI: metadataUri,
			},
			account: walletClient.account,
			chainId: base.id,
			contractGetter,
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
	const { parameters, contractAddress, tokenId } = await create1155({
		contract: {
			name: "coobeyon",
			uri: metadataUri,
		},
		token: {
			tokenMetadataURI: metadataUri,
		},
		account: walletClient.account,
		publicClient,
	})

	const txHash = await walletClient.writeContract(parameters)
	await publicClient.waitForTransactionReceipt({ hash: txHash })

	return ok({
		contractAddress,
		tokenId: String(tokenId),
		txHash,
	})
}
