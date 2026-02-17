/**
 * Complete signer setup: register an app FID, generate Ed25519 signer key,
 * and get a Farcaster deep link for the user to approve.
 *
 * Steps:
 *   1. Bridge ETH from Base → OP Mainnet (to our wallet)
 *   2. Register a new "app FID" on OP Mainnet
 *   3. Generate Ed25519 signer key pair
 *   4. Sign a key request with the app FID
 *   5. POST to Farcaster signed-key-request API
 *   6. Output deep link for user to approve in Farcaster app
 *
 * Usage:
 *   bun scripts/setup-signer.ts
 *
 * Environment:
 *   WALLET_PRIVATE_KEY  - Base wallet (0x7e10...) for funding
 *   FARCASTER_FID       - Target FID (default: 2797211)
 */

import {
	createWalletClient,
	createPublicClient,
	http,
	formatEther,
	parseEther,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base, optimism } from "viem/chains"
import {
	NobleEd25519Signer,
	SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
	SIGNED_KEY_REQUEST_TYPE,
} from "@farcaster/hub-nodejs"

// Farcaster contract addresses on OP Mainnet
const ID_GATEWAY = "0x00000000Fc25870C6eD6b6c7E41Fb078b7656f69" as const
const SIGNED_KEY_REQUEST_API = "https://api.warpcast.com/v2/signed-key-requests"

const idGatewayABI = [
	{
		name: "register",
		type: "function",
		inputs: [
			{ name: "recovery", type: "address" },
		],
		outputs: [
			{ name: "fid", type: "uint256" },
			{ name: "overpayment", type: "uint256" },
		],
		stateMutability: "payable",
	},
	{
		name: "price",
		type: "function",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
] as const

// ---------------------------------------------------------------------------

const walletKey = process.env.WALLET_PRIVATE_KEY
if (!walletKey) {
	console.error("WALLET_PRIVATE_KEY not set")
	process.exit(1)
}

const account = privateKeyToAccount(walletKey as `0x${string}`)
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org"
const OP_RPC = process.env.OP_RPC_URL || "https://mainnet.optimism.io"

const basePublic = createPublicClient({ chain: base, transport: http(BASE_RPC) })
const baseWallet = createWalletClient({ account, chain: base, transport: http(BASE_RPC) })
const opPublic = createPublicClient({ chain: optimism, transport: http(OP_RPC) })
const opWallet = createWalletClient({ account, chain: optimism, transport: http(OP_RPC) })

// ---------------------------------------------------------------------------
// Step 1: Bridge ETH from Base → OP Mainnet
// ---------------------------------------------------------------------------
const bridgeToOp = async (amount: string) => {
	console.log(`\n--- step 1: bridge ${amount} ETH Base → OP Mainnet ---`)
	const balance = await basePublic.getBalance({ address: account.address })
	console.log(`  Base balance: ${formatEther(balance)} ETH`)

	const opBalance = await opPublic.getBalance({ address: account.address })
	if (opBalance > parseEther("0.0003")) {
		console.log(`  OP balance already ${formatEther(opBalance)} ETH, skipping bridge`)
		return
	}

	console.log("  fetching Relay quote...")
	const quoteRes = await fetch("https://api.relay.link/quote", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			user: account.address,
			recipient: account.address,
			originChainId: 8453,
			destinationChainId: 10,
			originCurrency: "0x0000000000000000000000000000000000000000",
			destinationCurrency: "0x0000000000000000000000000000000000000000",
			amount: parseEther(amount).toString(),
			tradeType: "EXACT_INPUT",
		}),
	})

	if (!quoteRes.ok) {
		throw new Error(`Relay quote failed: ${await quoteRes.text()}`)
	}
	const quote = await quoteRes.json()

	for (const step of quote.steps) {
		for (const item of step.items) {
			if (item.status === "complete") continue
			const txData = item.data
			console.log(`  sending bridge tx...`)
			const txHash = await baseWallet.sendTransaction({
				to: txData.to as `0x${string}`,
				data: txData.data as `0x${string}` | undefined,
				value: BigInt(txData.value || "0"),
			})
			console.log(`  tx: ${txHash}`)
			await basePublic.waitForTransactionReceipt({ hash: txHash })

			if (item.check?.endpoint) {
				console.log("  waiting for relay...")
				const checkUrl = `https://api.relay.link${item.check.endpoint}`
				for (let i = 0; i < 60; i++) {
					await new Promise((r) => setTimeout(r, 5000))
					const res = await fetch(checkUrl)
					if (res.ok) {
						const s = await res.json()
						if (s.status === "success" || s.status === "complete") {
							console.log("  bridge complete")
							break
						}
						if (s.status === "failure") throw new Error(`Relay failed: ${JSON.stringify(s)}`)
					}
				}
			}
		}
	}

	const newBal = await opPublic.getBalance({ address: account.address })
	console.log(`  OP balance: ${formatEther(newBal)} ETH`)
}

// ---------------------------------------------------------------------------
// Step 2: Register app FID on OP Mainnet
// ---------------------------------------------------------------------------
const registerAppFid = async (): Promise<number> => {
	console.log("\n--- step 2: register app FID on OP Mainnet ---")

	const price = await opPublic.readContract({
		address: ID_GATEWAY,
		abi: idGatewayABI,
		functionName: "price",
	})
	console.log(`  registration price: ${formatEther(price)} ETH`)

	const txHash = await opWallet.writeContract({
		address: ID_GATEWAY,
		abi: idGatewayABI,
		functionName: "register",
		args: [account.address], // recovery = self
		value: price + parseEther("0.0001"), // small buffer for price changes
	})
	console.log(`  tx: ${txHash}`)

	const receipt = await opPublic.waitForTransactionReceipt({ hash: txHash })
	if (receipt.status === "reverted") throw new Error("FID registration reverted")

	// Parse FID from Register event logs
	// Register(address indexed to, uint256 indexed id, address recovery)
	const registerTopic = "0xf2e19a901b0748d8b08e428d0468896a039ac751ec4fec49b44b7b9c28097e45"
	const registerLog = receipt.logs.find((l) => l.topics[0] === registerTopic)
	if (!registerLog?.topics[2]) throw new Error("Could not find FID in tx logs")
	const appFid = Number(BigInt(registerLog.topics[2]))
	console.log(`  app FID: ${appFid}`)
	return appFid
}

// ---------------------------------------------------------------------------
// Step 3: Generate Ed25519 signer key
// ---------------------------------------------------------------------------
const generateSigner = async () => {
	console.log("\n--- step 3: generate Ed25519 signer key ---")
	const privateKey = crypto.getRandomValues(new Uint8Array(32))
	const signer = new NobleEd25519Signer(privateKey)
	const pubResult = await signer.getSignerKey()
	if (pubResult.isErr()) throw new Error(`Key derivation failed: ${pubResult.error}`)

	const privateKeyHex = `0x${Buffer.from(privateKey).toString("hex")}`
	const publicKeyHex = `0x${Buffer.from(pubResult.value).toString("hex")}`
	console.log(`  private key: ${privateKeyHex}`)
	console.log(`  public key:  ${publicKeyHex}`)
	return { privateKey, publicKey: pubResult.value, privateKeyHex, publicKeyHex }
}

// ---------------------------------------------------------------------------
// Step 4-5: Sign key request and post to Farcaster API
// ---------------------------------------------------------------------------
const requestSignerApproval = async (appFid: number, publicKeyHex: string) => {
	console.log("\n--- step 4: sign key request ---")
	const deadline = Math.floor(Date.now() / 1000) + 86400 // 24 hours

	const signature = await account.signTypedData({
		domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN as {
			name: string
			version: string
			chainId: number
			verifyingContract: `0x${string}`
		},
		types: {
			SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE as readonly [
				{ name: string; type: string },
				{ name: string; type: string },
				{ name: string; type: string },
			],
		},
		primaryType: "SignedKeyRequest",
		message: {
			requestFid: BigInt(appFid),
			key: publicKeyHex as `0x${string}`,
			deadline: BigInt(deadline),
		},
	})
	console.log("  signed")

	console.log("\n--- step 5: post to Farcaster API ---")
	const res = await fetch(SIGNED_KEY_REQUEST_API, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			key: publicKeyHex,
			signature,
			requestFid: appFid,
			deadline,
		}),
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(`Farcaster API error (${res.status}): ${text}`)
	}

	const { result } = await res.json()
	const { token, deeplinkUrl } = result.signedKeyRequest
	console.log(`  token: ${token}`)
	console.log(`  deep link: ${deeplinkUrl}`)
	return { token, deeplinkUrl }
}

// ---------------------------------------------------------------------------
// Step 6: Poll for approval
// ---------------------------------------------------------------------------
const pollForApproval = async (token: string) => {
	console.log("\n--- step 6: waiting for approval ---")
	console.log("  open the deep link above in your Farcaster app and approve")

	for (let i = 0; i < 120; i++) {
		await new Promise((r) => setTimeout(r, 3000))
		const res = await fetch(`${SIGNED_KEY_REQUEST_API}?token=${token}`)
		if (res.ok) {
			const { result } = await res.json()
			const state = result?.signedKeyRequest?.state
			if (state === "completed") {
				console.log("  signer approved and registered on-chain!")
				return true
			}
			if (state === "pending") {
				process.stdout.write(".")
				continue
			}
		}
	}
	console.log("\n  timed out waiting for approval (6 minutes)")
	return false
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const main = async () => {
	console.log("=== Farcaster signer setup ===")
	console.log(`wallet: ${account.address}`)

	// Step 1: Bridge
	await bridgeToOp("0.001")

	// Step 2: Register app FID
	const appFid = await registerAppFid()

	// Step 3: Generate signer key
	const key = await generateSigner()

	// Step 4-5: Get approval deep link
	const { token, deeplinkUrl } = await requestSignerApproval(appFid, key.publicKeyHex)

	console.log("\n========================================")
	console.log("OPEN THIS LINK in your Farcaster app:")
	console.log(deeplinkUrl)
	console.log("========================================\n")

	// Step 6: Poll
	const approved = await pollForApproval(token)

	if (approved) {
		console.log("\n--- setup complete ---")
		console.log(`\nadd to .env:`)
		console.log(`  FARCASTER_SIGNER_KEY=${key.privateKeyHex}`)
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
