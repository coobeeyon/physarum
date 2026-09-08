import { join } from "node:path"
import { runReflection } from "#agent/runner.ts"
import { parseArgs } from "#config/cli.ts"
import { loadEnv } from "#config/env.ts"
import { runPipeline } from "#pipeline/orchestrate.ts"
import { loadState } from "#pipeline/state.ts"
import { engageWithCommunity } from "#social/discover.ts"
import { readEngagement } from "#social/engagement.ts"

const main = async () => {
	const args = process.argv.slice(2)
	const flagsResult = parseArgs(args)
	if (!flagsResult.ok) {
		console.error(`Argument error: ${flagsResult.error}`)
		process.exit(1)
	}
	const flags = flagsResult.value

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

		// Automated engagement: likes and follows only.
		// All replies are composed by me directly each session.
		const result = await engageWithCommunity(
			neynarConfig,
			undefined, // channels
			undefined, // maxLikes
			undefined, // maxFollows
			0, // maxReplies — disabled
		)
		if (!result.ok) {
			console.error(`Engagement error: ${result.error}`)
			process.exit(1)
		}
		const { liked, followed, channels } = result.value

		console.log(`\nDone: ${liked} likes, ${followed} follows across ${channels.join(", ")}`)
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
		const result = await runReflection(stateResult.value, engResult.value.engagement, projectRoot)
		if (!result.ok) {
			console.error(`Reflection error: ${result.error}`)
			process.exit(1)
		}

		console.log("\nReflection complete.")
		return
	}

	const config =
		flags.mode === "live"
			? (() => {
					const envResult = loadEnv()
					if (!envResult.ok) {
						console.error(`Config error: ${envResult.error}`)
						process.exit(1)
					}
					return envResult.value
				})()
			: undefined

	const result = await runPipeline(config, {
		...flags,
		channel: flags.channel ?? config?.farcasterChannel,
	})

	if (!result.ok) {
		console.error(`Pipeline error: ${result.error}`)
		process.exit(1)
	}

	console.log(
		`${result.value.mode === "studio" ? "Studio render" : `Edition ${result.value.edition}`} complete: ${result.value.outputPath}`,
	)
}

main()
