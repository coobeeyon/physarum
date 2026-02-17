/**
 * Bridge ETH from Base to Optimism Mainnet via Relay Protocol.
 *
 * Usage:
 *   bun scripts/bridge-to-op.ts [--amount 0.001] [--recipient 0x...]
 *
 * Reads WALLET_PRIVATE_KEY from .env (the Base wallet).
 * Defaults: 0.001 ETH to the Farcaster custody address.
 */

import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const CUSTODY_ADDRESS = "0x058f2a95b414af2b81636e6f895b8cff92dd0f6d"
const BASE_RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org"

const parseArgs = () => {
	const args = process.argv.slice(2)
	let amount = "0.001"
	let recipient = CUSTODY_ADDRESS

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--amount" && args[i + 1]) amount = args[++i]
		if (args[i] === "--recipient" && args[i + 1]) recipient = args[++i]
	}

	return { amount, recipient }
}

const main = async () => {
	const { amount, recipient } = parseArgs()
	const walletKey = process.env.WALLET_PRIVATE_KEY
	if (!walletKey) {
		console.error("WALLET_PRIVATE_KEY not set")
		process.exit(1)
	}

	const account = privateKeyToAccount(walletKey as `0x${string}`)
	const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC) })
	const walletClient = createWalletClient({ account, chain: base, transport: http(BASE_RPC) })

	// Check balance
	const balance = await publicClient.getBalance({ address: account.address })
	const amountWei = parseEther(amount)
	console.log(`wallet: ${account.address}`)
	console.log(`balance: ${formatEther(balance)} ETH (Base)`)
	console.log(`bridging: ${amount} ETH → OP Mainnet`)
	console.log(`recipient: ${recipient}`)

	if (balance < amountWei) {
		console.error(`\ninsufficient balance: need ${amount} ETH, have ${formatEther(balance)}`)
		process.exit(1)
	}

	// Get quote from Relay
	console.log("\nfetching Relay quote...")
	const quoteRes = await fetch("https://api.relay.link/quote", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			user: account.address,
			recipient,
			originChainId: 8453, // Base
			destinationChainId: 10, // OP Mainnet
			originCurrency: "0x0000000000000000000000000000000000000000",
			destinationCurrency: "0x0000000000000000000000000000000000000000",
			amount: amountWei.toString(),
			tradeType: "EXACT_INPUT",
		}),
	})

	if (!quoteRes.ok) {
		const text = await quoteRes.text()
		console.error(`quote failed (${quoteRes.status}): ${text}`)
		process.exit(1)
	}

	const quote = await quoteRes.json()

	if (!quote.steps?.length) {
		console.error("no steps in quote response")
		console.error(JSON.stringify(quote, null, 2))
		process.exit(1)
	}

	// Execute each step
	for (const step of quote.steps) {
		console.log(`\nstep: ${step.action}`)
		console.log(`  ${step.description}`)

		for (const item of step.items) {
			if (item.status === "complete") {
				console.log("  already complete, skipping")
				continue
			}

			const txData = item.data
			console.log(`  sending tx to ${txData.to}...`)

			const txHash = await walletClient.sendTransaction({
				to: txData.to as `0x${string}`,
				data: txData.data as `0x${string}` | undefined,
				value: BigInt(txData.value || "0"),
			})
			console.log(`  tx: ${txHash}`)

			console.log("  waiting for confirmation...")
			const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })
			if (receipt.status === "reverted") {
				console.error("  transaction reverted!")
				process.exit(1)
			}
			console.log(`  confirmed in block ${receipt.blockNumber}`)

			// Poll for relay completion
			if (item.check?.endpoint) {
				console.log("  waiting for relay to complete...")
				const checkUrl = `https://api.relay.link${item.check.endpoint}`
				for (let i = 0; i < 60; i++) {
					await new Promise((r) => setTimeout(r, 5000))
					const statusRes = await fetch(checkUrl)
					if (statusRes.ok) {
						const status = await statusRes.json()
						if (status.status === "success" || status.status === "complete") {
							console.log("  relay complete!")
							break
						}
						if (status.status === "failure") {
							console.error("  relay failed:", JSON.stringify(status))
							process.exit(1)
						}
						process.stdout.write(".")
					}
				}
			}
		}
	}

	console.log(`\n--- bridge complete ---`)
	console.log(`${amount} ETH should arrive at ${recipient} on OP Mainnet shortly`)
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
