import { join } from "node:path"
import { runClaudeReflection } from "#agent/runner.ts"
import { loadEnv } from "#config/env.ts"
import { runPipeline } from "#pipeline/orchestrate.ts"
import { loadState } from "#pipeline/state.ts"
import { engageWithCommunity, respondToInboundReplies } from "#social/discover.ts"
import { readEngagement } from "#social/engagement.ts"

const parseArgs = (args: ReadonlyArray<string>) => {
	const flags = {
		generateOnly: false,
		deployOnly: false,
		postOnly: false,
		dryRun: false,
		readEngagement: false,
		reflect: false,
		engage: false,
		seedOverride: undefined as number | undefined,
		foodImageSource: undefined as string | undefined,
		channel: undefined as string | undefined,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === "--generate-only") flags.generateOnly = true
		else if (arg === "--deploy-only") flags.deployOnly = true
		else if (arg === "--post-only") flags.postOnly = true
		else if (arg === "--dry-run") flags.dryRun = true
		else if (arg === "--read-engagement") flags.readEngagement = true
		else if (arg === "--reflect") flags.reflect = true
		else if (arg === "--engage") flags.engage = true
		else if (arg === "--seed" && i + 1 < args.length) {
			flags.seedOverride = Number.parseInt(args[i + 1], 10)
			i++
		} else if (arg === "--food-image" && i + 1 < args.length) {
			flags.foodImageSource = args[i + 1]
			i++
		} else if (arg === "--channel" && i + 1 < args.length) {
			flags.channel = args[i + 1]
			i++
		}
	}

	return flags
}

const main = async () => {
	const args = process.argv.slice(2)
	const flags = parseArgs(args)

	if (flags.readEngagement) {
		const apiKey = process.env.NEYNAR_API_KEY
		if (!apiKey) {
			console.error("NEYNAR_API_KEY not set")
			process.exit(1)
		}

		const stateResult = loadState()
		if (!stateResult.ok) {
			console.error(`State error: ${stateResult.error}`)
			process.exit(1)
		}

		const result = await readEngagement(apiKey, stateResult.value.history)
		if (!result.ok) {
			console.error(`Engagement error: ${result.error}`)
			process.exit(1)
		}

		for (const w of result.value.warnings) {
			console.error(`warning: ${w}`)
		}
		console.log(JSON.stringify(result.value.engagement, null, 2))
		return
	}

	if (flags.engage) {
		const envResult = loadEnv()
		if (!envResult.ok) {
			console.error(`Config error: ${envResult.error}`)
			process.exit(1)
		}
		const neynarConfig = {
			neynarApiKey: envResult.value.neynarApiKey,
			signerUuid: envResult.value.neynarSignerUuid,
			fid: envResult.value.farcasterFid,
		}

		// Outbound engagement
		const result = await engageWithCommunity(neynarConfig)
		if (!result.ok) {
			console.error(`Engagement error: ${result.error}`)
			process.exit(1)
		}
		const { liked, followed, replied, channels } = result.value

		// Respond to inbound replies on our recent casts
		const stateResult = loadState()
		if (stateResult.ok) {
			const isValidHash = (h: string) => h.length >= 10 && h !== "0x0" && h.startsWith("0x")
			const inboundHashes: string[] = []
			for (const entry of stateResult.value.history.slice(-3)) {
				if (isValidHash(entry.castHash)) inboundHashes.push(entry.castHash)
				if (entry.selfReplyHash && isValidHash(entry.selfReplyHash))
					inboundHashes.push(entry.selfReplyHash)
				if (entry.replyCastHashes) inboundHashes.push(...entry.replyCastHashes.filter(isValidHash))
			}
			await respondToInboundReplies(neynarConfig, inboundHashes)
		}

		console.log(
			`\nDone: ${liked} likes, ${followed} follows, ${replied} replies across ${channels.join(", ")}`,
		)
		return
	}

	if (flags.reflect) {
		const neynarKey = process.env.NEYNAR_API_KEY
		if (!neynarKey) {
			console.error("NEYNAR_API_KEY not set")
			process.exit(1)
		}

		const stateResult = loadState()
		if (!stateResult.ok) {
			console.error(`State error: ${stateResult.error}`)
			process.exit(1)
		}

		const engResult = await readEngagement(neynarKey, stateResult.value.history)
		if (!engResult.ok) {
			console.error(`Engagement error: ${engResult.error}`)
			process.exit(1)
		}

		for (const w of engResult.value.warnings) {
			console.error(`warning: ${w}`)
		}

		const projectRoot = join(import.meta.dirname, "..")
		const result = await runClaudeReflection(
			stateResult.value,
			engResult.value.engagement,
			projectRoot,
		)
		if (!result.ok) {
			console.error(`Reflection error: ${result.error}`)
			process.exit(1)
		}

		console.log("\nReflection complete.")
		return
	}

	// generate-only and dry-run don't need all env vars
	const envResult =
		flags.generateOnly || flags.dryRun
			? {
					ok: true as const,
					value: {
						walletPrivateKey: "0x0" as `0x${string}`,
						pinataJwt: "",
						farcasterFid: 0,
						neynarApiKey: "",
						neynarSignerUuid: "",
						baseRpcUrl: "",
						farcasterChannel: process.env.FARCASTER_CHANNEL?.trim() || undefined,
					},
				}
			: loadEnv()

	if (!envResult.ok) {
		console.error(`Config error: ${envResult.error}`)
		process.exit(1)
	}

	const result = await runPipeline(envResult.value, {
		...flags,
		channel: flags.channel ?? envResult.value.farcasterChannel,
	})

	if (!result.ok) {
		console.error(`Pipeline error: ${result.error}`)
		process.exit(1)
	}

	console.log(`Edition ${result.value.edition} complete.`)
}

main()
