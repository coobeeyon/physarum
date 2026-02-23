import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { varyGenome } from "#agent/evolve.ts"
import { createClients } from "#chain/client.ts"
import { deployEdition } from "#chain/zora.ts"
import type { EnvConfig } from "#config/env.ts"
import { DEFAULT_PARAMS } from "#config/params.ts"
import { type FoodImageData, loadFoodImage } from "#engine/food.ts"
import { simulate } from "#engine/physarum.ts"
import { createPinataClient, uploadImage, uploadMetadata } from "#ipfs/upload.ts"
import { updateGallery } from "#pipeline/gallery.ts"
import { loadState, saveState } from "#pipeline/state.ts"
import { renderPng } from "#render/canvas.ts"
import { engageWithCommunity } from "#social/discover.ts"
import { readEngagement } from "#social/engagement.ts"
import { type NeynarConfig, postCast, postReply } from "#social/farcaster.ts"
import {
	composeCastText,
	composeMetadataDescription,
	composeSelfReply,
	composeZoraCast,
} from "#social/narrative.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { NftMetadata } from "#types/metadata.ts"
import type { PhysarumParams } from "#types/physarum.ts"
import { type Result, ok } from "#types/result.ts"

const IPFS_GATEWAY = "https://ipfs.io/ipfs"
const OUTPUT_DIR = join(import.meta.dirname, "../../output")

type PipelineOptions = {
	readonly generateOnly?: boolean
	readonly deployOnly?: boolean
	readonly postOnly?: boolean
	readonly dryRun?: boolean
	readonly seedOverride?: number
	readonly foodImageSource?: string
	readonly channel?: string
	readonly castText?: string
	readonly zoraCastText?: string
	readonly selfReplyText?: string
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

	console.log(`\n--- stigmergence #${edition} | seed ${seed} ---\n`)

	// 1. Simulate
	console.log("simulating physarum...")
	const { width, height, ...defaultGenome } = DEFAULT_PARAMS
	// When a food image is provided, skip the automatic mode rotation.
	// Image-food editions are intentional — parameters chosen per-edition, not cycled.
	const variedGenome = options.foodImageSource ? defaultGenome : varyGenome(edition, defaultGenome)
	let params: PhysarumParams = {
		width,
		height,
		...variedGenome,
		seed,
		...(options.foodImageSource
			? { foodPlacement: "image" as const, foodImageSource: options.foodImageSource }
			: {}),
	}

	let preloadedFoodMap: Float32Array | undefined
	let foodImageRgb: FoodImageData | undefined
	if (params.foodPlacement === "image" && params.foodImageSource) {
		console.log(`  loading food image: ${params.foodImageSource}`)
		const foodData = await loadFoodImage(
			params.foodImageSource,
			Math.max(params.width, params.height),
		)
		preloadedFoodMap = foodData.luminance
		foodImageRgb = foodData
		// Adopt the food image's dimensions, scale agents proportionally to area
		const defaultArea = params.width * params.height
		const imageArea = foodData.width * foodData.height
		const scaledAgents = Math.round(params.agentCount * (imageArea / defaultArea))
		// Image food has luminance everywhere — lower foodWeight so agents follow
		// the image structure without being rigidly locked to it.
		// Abstract food patterns are sparse (value only at attractors), so 150 works;
		// image food fills every pixel, so we reduce to let organic deviation happen.
		params = {
			...params,
			width: foodData.width,
			height: foodData.height,
			agentCount: Math.max(scaledAgents, params.agentCount),
			foodWeight: Math.min(params.foodWeight, 60),
		}
		console.log(
			`  image dimensions: ${foodData.width}x${foodData.height} (${params.agentCount} agents)`,
		)
	}

	const t0 = performance.now()
	const simResult = simulate(params, preloadedFoodMap, foodImageRgb)
	console.log(`  done in ${((performance.now() - t0) / 1000).toFixed(1)}s`)

	// 2. Render
	console.log("rendering PNG...")
	// For image-food simulations, render with population/colormap coloring rather than
	// image-derived colors. The food image drives agent pathfinding, but the rendering
	// uses the colormap — this makes connecting trails visible (image colors are dark
	// in empty space between food sources, making trail networks invisible).
	const renderResult = renderPng(simResult, params.colormap)
	if (!renderResult.ok) return renderResult
	const { png } = renderResult.value

	const pngPath = join(OUTPUT_DIR, `stigmergence-${edition}.png`)
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
		: await uploadImage(pinata, png, `stigmergence-${edition}`)
	if (!imageResult.ok) return imageResult
	const { imageCid } = imageResult.value
	console.log(`  image CID: ${imageCid}`)

	// Extract genome (everything except seed/width/height) — needed for metadata and narrative
	const { seed: _seed, width: _width, height: _height, ...genome } = params

	const metadata: NftMetadata = {
		name: `stigmergence #${edition}`,
		description: composeMetadataDescription(edition, seed, genome),
		image: `ipfs://${imageCid}`,
		external_url: "https://stigmergence.art",
		attributes: [
			{ trait_type: "Seed", value: seed },
			{ trait_type: "Colormap", value: params.colormap },
			{ trait_type: "Agents", value: params.agentCount },
			{ trait_type: "Iterations", value: params.iterations },
			{ trait_type: "Resolution", value: `${params.width}x${params.height}` },
			{ trait_type: "Populations", value: params.populationCount },
			{ trait_type: "Food Strategy", value: params.foodPlacement },
		],
	}

	const metaResult = options.dryRun
		? ok({ metadataCid: "dry-run-metadata-cid" })
		: await uploadMetadata(pinata, metadata, `stigmergence-${edition}`)
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

	const neynarConfig: NeynarConfig = {
		neynarApiKey: config.neynarApiKey,
		signerUuid: config.neynarSignerUuid,
		fid: config.farcasterFid,
	}

	// Fetch engagement for previous edition
	let prevEngagement: EngagementData | null = null
	if (state.history.length > 0 && config.neynarApiKey) {
		const lastEntry = state.history[state.history.length - 1]
		const engResult = await readEngagement(config.neynarApiKey, [lastEntry])
		if (engResult.ok) {
			for (const w of engResult.value.warnings) {
				console.warn(`  engagement: ${w}`)
			}
			if (engResult.value.engagement.length > 0) {
				prevEngagement = engResult.value.engagement[0]
			}
		}
	}

	// Compose narrative text — prefer hand-written text when provided
	const castText = options.castText ?? composeCastText(edition, seed, genome, prevEngagement)

	// Alternate channels to reach different audiences: odd editions → /ai-art, even → /art
	// /genart is dead (3 members, last post 5+ months ago). /ai-art has 24.8K followers.
	const postChannel =
		options.channel ?? config.farcasterChannel ?? (edition % 2 === 1 ? "ai-art" : "art")

	let castHash = "0x0"
	let zoraCastHash: string | undefined
	let selfReplyHash: string | undefined
	const replyCastHashes: string[] = []
	if (options.dryRun) {
		console.log("  [dry-run] skipping Farcaster post")
		console.log(`  channel: ${postChannel}`)
		console.log(`  narrative:\n${castText}`)
	} else {
		const castResult = await postCast(neynarConfig, castText, imageUrl, mintUrl, postChannel)
		if (!castResult.ok) return castResult
		castHash = castResult.value.castHash
		console.log(`  cast: ${castHash}`)

		// Self-reply: deeper reflection on what this simulation actually does.
		// Creates a visible thread on our post — people browsing see it has replies and click in.
		// Include the Zora mint URL as an embed so anyone reading the thread can collect directly.
		const selfReplyText = options.selfReplyText ?? (await composeSelfReply(edition, genome))
		if (selfReplyText) {
			const selfReplyResult = await postReply(neynarConfig, selfReplyText, castHash, [mintUrl])
			if (selfReplyResult.ok) {
				selfReplyHash = selfReplyResult.value.castHash
				console.log(`  self-reply: ${selfReplyHash}`)
				// Tracked separately — self-reply shows in primary cast's replies.count,
				// so we need to know it's ours to avoid counting it as external engagement.
			} else {
				console.warn(`  self-reply failed: ${selfReplyResult.error}`)
			}
		}

		// Secondary cast to /zora — collector-oriented, different audience than /genart or /art
		if (postChannel !== "zora") {
			const zoraText = options.zoraCastText ?? composeZoraCast(edition, genome)
			const zoraResult = await postCast(neynarConfig, zoraText, imageUrl, mintUrl, "zora")
			if (zoraResult.ok) {
				zoraCastHash = zoraResult.value.castHash
				console.log(`  /zora cast: ${zoraCastHash}`)
			} else {
				console.warn(`  /zora cast failed: ${zoraResult.error}`)
			}
		}
	}

	// 6. Engage with community (builds organic discovery via notifications)
	if (!options.dryRun) {
		// Automated engagement: likes and follows only.
		// All replies are composed by me directly each session — not by pipeline automation.
		// The mixed voice problem (automated sonnet replies + my direct replies) was degrading trust.
		const engageResult = await engageWithCommunity(
			neynarConfig,
			undefined, // channels
			undefined, // maxLikes
			undefined, // maxFollows
			0, // maxReplies — disabled, I reply myself
		)
		// No automated inbound responses either — I handle conversations directly.
	}

	// 7. Update gallery
	if (!options.dryRun) {
		const galleryResult = await updateGallery({
			edition,
			seed,
			width: params.width,
			height: params.height,
			genome,
			contractAddress: contractAddress ?? "",
			tokenId,
		})
		if (!galleryResult.ok) {
			console.warn(`  gallery update failed: ${galleryResult.error}`)
		}
	}

	// 8. Save state
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
				...(zoraCastHash ? { zoraCastHash } : {}),
				...(selfReplyHash ? { selfReplyHash } : {}),
				...(replyCastHashes.length > 0 ? { replyCastHashes } : {}),
				imageCid,
				metadataCid,
				timestamp: new Date().toISOString(),
				genome,
			},
		],
		reflections: state.reflections,
	}
	const saveResult = saveState(newState)
	if (!saveResult.ok) return saveResult

	console.log(`\n--- stigmergence #${edition} complete ---\n`)
	return ok({ edition })
}
