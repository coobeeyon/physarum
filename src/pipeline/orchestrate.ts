import { writeFileSync } from "node:fs"
import { join } from "node:path"
import type { EnvConfig } from "#config/env.ts"
import { DEFAULT_PARAMS } from "#config/params.ts"
import { simulate } from "#engine/physarum.ts"
import { renderPng } from "#render/canvas.ts"
import { createPinataClient, uploadImage, uploadMetadata } from "#ipfs/upload.ts"
import { createClients } from "#chain/client.ts"
import { deployEdition } from "#chain/zora.ts"
import { createNeynarClient, postCast } from "#social/farcaster.ts"
import { loadState, saveState } from "#pipeline/state.ts"
import type { NftMetadata } from "#types/metadata.ts"
import type { PhysarumParams } from "#types/physarum.ts"
import { type Result, ok, err } from "#types/result.ts"

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs"
const OUTPUT_DIR = join(import.meta.dirname, "../../output")

type PipelineOptions = {
	readonly generateOnly?: boolean
	readonly deployOnly?: boolean
	readonly postOnly?: boolean
	readonly dryRun?: boolean
	readonly seedOverride?: number
}

export const runPipeline = async (
	config: EnvConfig,
	options: PipelineOptions = {},
): Promise<Result<{ edition: number }>> => {
	// Load state
	const stateResult = loadState()
	if (!stateResult.ok) return stateResult

	const state = stateResult.value
	const edition = state.lastEdition + 1
	const seed = options.seedOverride ?? edition * 7919 // prime-based seed

	console.log(`\n--- coobeyon #${edition} | seed ${seed} ---\n`)

	// 1. Simulate
	console.log("simulating physarum...")
	const params: PhysarumParams = { ...DEFAULT_PARAMS, seed }
	const t0 = performance.now()
	const trailMap = simulate(params)
	console.log(`  done in ${((performance.now() - t0) / 1000).toFixed(1)}s`)

	// 2. Render
	console.log("rendering PNG...")
	const renderResult = renderPng(trailMap, params.width, params.height, params.colormap)
	if (!renderResult.ok) return renderResult
	const { png } = renderResult.value

	const pngPath = join(OUTPUT_DIR, `coobeyon-${edition}.png`)
	writeFileSync(pngPath, png)
	console.log(`  saved to ${pngPath}`)

	if (options.generateOnly) {
		return ok({ edition })
	}

	// 3. Upload to IPFS
	console.log("uploading to IPFS...")
	if (options.dryRun) {
		console.log("  [dry-run] skipping IPFS upload")
	}

	const pinata = createPinataClient(config.pinataJwt)

	const imageResult = options.dryRun
		? ok({ imageCid: "dry-run-image-cid" })
		: await uploadImage(pinata, png, `coobeyon-${edition}`)
	if (!imageResult.ok) return imageResult
	const { imageCid } = imageResult.value
	console.log(`  image CID: ${imageCid}`)

	const metadata: NftMetadata = {
		name: `coobeyon #${edition}`,
		description: `Physarum simulation | seed ${seed} | ${params.width}x${params.height} | ${params.agentCount} agents | ${params.iterations} iterations`,
		image: `ipfs://${imageCid}`,
		external_url: "https://coobeyon.xyz",
		attributes: [
			{ trait_type: "Seed", value: seed },
			{ trait_type: "Colormap", value: params.colormap },
			{ trait_type: "Agents", value: params.agentCount },
			{ trait_type: "Iterations", value: params.iterations },
			{ trait_type: "Resolution", value: `${params.width}x${params.height}` },
		],
	}

	const metaResult = options.dryRun
		? ok({ metadataCid: "dry-run-metadata-cid" })
		: await uploadMetadata(pinata, metadata, `coobeyon-${edition}`)
	if (!metaResult.ok) return metaResult
	const { metadataCid } = metaResult.value
	console.log(`  metadata CID: ${metadataCid}`)

	const metadataUri = `ipfs://${metadataCid}`

	if (options.deployOnly || options.postOnly) {
		// Skip chain deployment if post-only
	}

	// 4. Deploy to Zora/Base
	console.log("deploying to Zora/Base...")
	let contractAddress = state.contractAddress ?? undefined
	let tokenId = "0"
	let txHash = "0x0"

	if (options.dryRun || options.postOnly) {
		console.log("  [dry-run/post-only] skipping chain deployment")
		contractAddress = contractAddress ?? "0xdry-run"
		tokenId = String(edition)
		txHash = "0xdry-run"
	} else {
		const { publicClient, walletClient } = createClients(config.walletPrivateKey, config.baseRpcUrl)
		const deployResult = await deployEdition(
			publicClient as Parameters<typeof deployEdition>[0],
			walletClient as Parameters<typeof deployEdition>[1],
			metadataUri,
			contractAddress,
		)
		if (!deployResult.ok) return deployResult
		contractAddress = deployResult.value.contractAddress
		tokenId = deployResult.value.tokenId
		txHash = deployResult.value.txHash
		console.log(`  contract: ${contractAddress}`)
		console.log(`  tokenId: ${tokenId}`)
		console.log(`  tx: ${txHash}`)
	}

	if (options.deployOnly) {
		return ok({ edition })
	}

	// 5. Post to Farcaster
	console.log("posting to Farcaster...")
	const imageUrl = `${IPFS_GATEWAY}/${imageCid}`
	const mintUrl = `https://zora.co/collect/base:${contractAddress}/${tokenId}`

	let castHash = "0x0"
	if (options.dryRun) {
		console.log("  [dry-run] skipping Farcaster post")
		console.log(`  would post: coobeyon #${edition}`)
		console.log(`  image: ${imageUrl}`)
		console.log(`  mint: ${mintUrl}`)
	} else {
		const neynar = createNeynarClient(config.neynarApiKey)
		const castResult = await postCast(
			neynar,
			config.neynarSignerUuid,
			imageUrl,
			mintUrl,
			edition,
			seed,
		)
		if (!castResult.ok) return castResult
		castHash = castResult.value.castHash
		console.log(`  cast: ${castHash}`)
	}

	// 6. Save state
	const newState = {
		contractAddress: contractAddress ?? null,
		lastEdition: edition,
		history: [
			...state.history,
			{
				edition,
				seed,
				tokenId,
				txHash,
				castHash,
				imageCid,
				metadataCid,
				timestamp: new Date().toISOString(),
			},
		],
	}
	const saveResult = saveState(newState)
	if (!saveResult.ok) return saveResult

	console.log(`\n--- coobeyon #${edition} complete ---\n`)
	return ok({ edition })
}
