/**
 * Generate an Ed25519 signer key and register it on-chain for a Farcaster account.
 *
 * Usage:
 *   bun scripts/register-signer.ts --generate-only          # just generate key pair
 *   bun scripts/register-signer.ts --custody-key 0x...      # generate + register on OP Mainnet
 *
 * Requires:
 *   --custody-key: Private key for the FID's custody address (to sign metadata + send tx)
 *   OP ETH in the custody address for gas
 *
 * Environment (optional):
 *   FARCASTER_FID: defaults to 2797211
 *   OP_RPC_URL: defaults to https://mainnet.optimism.io
 */

import { createWalletClient, createPublicClient, http, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { optimism } from "viem/chains"
import {
	NobleEd25519Signer,
	ViemLocalEip712Signer,
	KEY_GATEWAY_ADDRESS,
	keyGatewayABI,
} from "@farcaster/hub-nodejs"

const FID = Number(process.env.FARCASTER_FID || "2797211")
const OP_RPC = process.env.OP_RPC_URL || "https://mainnet.optimism.io"

const parseArgs = () => {
	const args = process.argv.slice(2)
	let generateOnly = false
	let custodyKey: `0x${string}` | undefined

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--generate-only") generateOnly = true
		if (args[i] === "--custody-key" && args[i + 1]) {
			custodyKey = args[++i] as `0x${string}`
		}
	}

	return { generateOnly, custodyKey }
}

const generateSignerKey = async () => {
	const privateKey = crypto.getRandomValues(new Uint8Array(32))
	const signer = new NobleEd25519Signer(privateKey)
	const pubKeyResult = await signer.getSignerKey()
	if (pubKeyResult.isErr()) throw new Error(`Failed to derive public key: ${pubKeyResult.error}`)

	return {
		privateKey,
		publicKey: pubKeyResult.value,
		privateKeyHex: `0x${Buffer.from(privateKey).toString("hex")}`,
		publicKeyHex: `0x${Buffer.from(pubKeyResult.value).toString("hex")}`,
	}
}

const main = async () => {
	const { generateOnly, custodyKey } = parseArgs()

	if (!generateOnly && !custodyKey) {
		console.error("Usage:")
		console.error("  bun scripts/register-signer.ts --generate-only")
		console.error("  bun scripts/register-signer.ts --custody-key 0x...")
		process.exit(1)
	}

	// 1. Generate Ed25519 key pair
	console.log("generating Ed25519 signer key pair...")
	const key = await generateSignerKey()
	console.log(`  private key: ${key.privateKeyHex}`)
	console.log(`  public key:  ${key.publicKeyHex}`)

	if (generateOnly) {
		console.log("\nadd to .env:")
		console.log(`  FARCASTER_SIGNER_KEY=${key.privateKeyHex}`)
		return
	}

	// 2. Set up viem clients
	const custodyAccount = privateKeyToAccount(custodyKey!)
	console.log(`\ncustody address: ${custodyAccount.address}`)
	console.log(`FID: ${FID}`)

	const publicClient = createPublicClient({ chain: optimism, transport: http(OP_RPC) })
	const walletClient = createWalletClient({
		account: custodyAccount,
		chain: optimism,
		transport: http(OP_RPC),
	})

	// 3. Check OP ETH balance
	const balance = await publicClient.getBalance({ address: custodyAccount.address })
	console.log(`OP ETH balance: ${formatEther(balance)}`)
	if (balance === 0n) {
		console.error("\nerror: custody address has no OP ETH for gas")
		console.error("send a small amount of ETH on Optimism to:", custodyAccount.address)
		process.exit(1)
	}

	// 4. Create signed key request metadata
	console.log("\nsigning key request metadata...")
	const eip712Signer = new ViemLocalEip712Signer(custodyAccount)
	const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hour

	const metadataResult = await eip712Signer.getSignedKeyRequestMetadata({
		requestFid: BigInt(FID),
		key: key.publicKey,
		deadline,
	})
	if (metadataResult.isErr()) {
		console.error(`failed to sign metadata: ${metadataResult.error}`)
		process.exit(1)
	}
	console.log("  metadata signed")

	// 5. Send KeyGateway.add() transaction
	console.log("submitting KeyGateway.add() on OP Mainnet...")
	const txHash = await walletClient.writeContract({
		address: KEY_GATEWAY_ADDRESS as `0x${string}`,
		abi: keyGatewayABI,
		functionName: "add",
		args: [
			1, // keyType: EdDSA
			key.publicKeyHex as `0x${string}`,
			1, // metadataType: SignedKeyRequest
			`0x${Buffer.from(metadataResult.value).toString("hex")}` as `0x${string}`,
		],
	})
	console.log(`  tx: ${txHash}`)

	// 6. Wait for confirmation
	console.log("waiting for confirmation...")
	const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
	if (receipt.status === "reverted") {
		console.error("transaction reverted!")
		process.exit(1)
	}
	console.log(`  confirmed in block ${receipt.blockNumber}`)

	// 7. Output
	console.log("\n--- signer registered successfully ---")
	console.log(`\nadd to .env:`)
	console.log(`  FARCASTER_SIGNER_KEY=${key.privateKeyHex}`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
