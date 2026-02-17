import { loadEnv } from "#config/env.ts"
import { runPipeline } from "#pipeline/orchestrate.ts"

const parseArgs = (args: ReadonlyArray<string>) => {
	const flags = {
		generateOnly: false,
		deployOnly: false,
		postOnly: false,
		dryRun: false,
		seedOverride: undefined as number | undefined,
		foodImageSource: undefined as string | undefined,
	}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === "--generate-only") flags.generateOnly = true
		else if (arg === "--deploy-only") flags.deployOnly = true
		else if (arg === "--post-only") flags.postOnly = true
		else if (arg === "--dry-run") flags.dryRun = true
		else if (arg === "--seed" && i + 1 < args.length) {
			flags.seedOverride = Number.parseInt(args[i + 1], 10)
			i++
		}
		else if (arg === "--food-image" && i + 1 < args.length) {
			flags.foodImageSource = args[i + 1]
			i++
		}
	}

	return flags
}

const main = async () => {
	const args = process.argv.slice(2)
	const flags = parseArgs(args)

	// generate-only and dry-run don't need all env vars
	const envResult = flags.generateOnly || flags.dryRun
		? { ok: true as const, value: { walletPrivateKey: "0x0" as `0x${string}`, pinataJwt: "", farcasterFid: 0, farcasterSignerKey: new Uint8Array(32), hubUrl: "", baseRpcUrl: "" } }
		: loadEnv()

	if (!envResult.ok) {
		console.error(`Config error: ${envResult.error}`)
		process.exit(1)
	}

	const result = await runPipeline(envResult.value, flags)

	if (!result.ok) {
		console.error(`Pipeline error: ${result.error}`)
		process.exit(1)
	}

	console.log(`Edition ${result.value.edition} complete.`)
}

main()
