import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { varyGenome } from "#agent/evolve.ts"
import { createClients } from "#chain/client.ts"
import { deployEdition } from "#chain/zora.ts"
import type { RunMode } from "#config/cli.ts"
import type { EnvConfig } from "#config/env.ts"
import { DEFAULT_PARAMS } from "#config/params.ts"
import { type FoodImageData, loadFoodImage } from "#engine/food.ts"
import { simulate } from "#engine/physarum.ts"
import { uploadToImgur } from "#ipfs/imgur.ts"
import { createPinataClient, uploadImage, uploadMetadata } from "#ipfs/upload.ts"
import { updateGallery } from "#pipeline/gallery.ts"
import {
	type LiveRunJournal,
	beginLiveOperation,
	completeLiveOperation,
	completeLiveRun,
	loadLiveRunJournal,
	prepareLiveRun,
} from "#pipeline/journal.ts"
import { loadState, saveState } from "#pipeline/state.ts"
import { renderPng } from "#render/canvas.ts"
import { engageWithCommunity } from "#social/discover.ts"
import { readEngagement } from "#social/engagement.ts"
import { type NeynarConfig, postCast, postReply } from "#social/farcaster.ts"
import { composeCastText, composeMetadataDescription, composeZoraCast } from "#social/narrative.ts"
import type { EngagementData } from "#types/evolution.ts"
import type { NftMetadata } from "#types/metadata.ts"
import type { PhysarumParams } from "#types/physarum.ts"
import { type Result, err, ok } from "#types/result.ts"

const IPFS_GATEWAY = "https://ipfs.io/ipfs"
const OUTPUT_DIR = join(import.meta.dirname, "../../output")

type PipelineOptions = {
	readonly mode: RunMode
	readonly resumeLive?: boolean
	readonly seedOverride?: number
	readonly foodImageSource?: string
	readonly channel?: string
	readonly castText?: string
	readonly zoraCastText?: string
	readonly selfReplyText?: string
}

export const runPipeline = async (
	config: EnvConfig | undefined,
	options: PipelineOptions,
): Promise<Result<{ edition: number; mode: RunMode; outputPath: string }>> => {
	// Load state
	const stateResult = loadState()
	if (!stateResult.ok) return stateResult

	const state = stateResult.value
	let edition = state.lastEdition + 1
	let seed = options.seedOverride ?? edition * 7919 // prime-based seed
	let journal: LiveRunJournal | undefined

	if (options.mode === "live") {
		if (!config) return err("live mode requires a complete environment configuration")
		if (!options.castText || !options.selfReplyText || !options.zoraCastText) {
			return err(
				"live mode requires explicit --cast-text, --self-reply-text, and --zora-text from Stigmergence",
			)
		}

		if (options.resumeLive) {
			const existingResult = loadLiveRunJournal()
			if (!existingResult.ok) return existingResult
			if (!existingResult.value || existingResult.value.completedAt) {
				return err("there is no incomplete live run to resume")
			}
			edition = existingResult.value.edition
			seed = existingResult.value.seed
			if (state.lastEdition === edition) {
				if (
					existingResult.value.pendingOperation ||
					!existingResult.value.completedOperations.includes("save-state")
				) {
					return err("state advanced but the live-run journal is uncertain; reconcile it manually")
				}
				const completed = completeLiveRun(existingResult.value)
				if (!completed.ok) return completed
				return ok({
					edition,
					mode: options.mode,
					outputPath: join(OUTPUT_DIR, `stigmergence-${edition}.png`),
				})
			}
			if (state.lastEdition !== edition - 1) {
				return err("state.json does not match the incomplete live run")
			}
		}

		const journalResult = prepareLiveRun(edition, seed, options.resumeLive ?? false)
		if (!journalResult.ok) return journalResult
		journal = journalResult.value
	}

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
		// Scale agents proportionally to the food image area.
		// foodWeight is left as-is from DEFAULT_PARAMS — each edition's params
		// are tuned for the specific food image (maze needs 500, photo needs 60).
		params = {
			...params,
			width: foodData.width,
			height: foodData.height,
			agentCount: Math.max(scaledAgents, params.agentCount),
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

	const outputDir = options.mode === "studio" ? join(OUTPUT_DIR, "studio") : OUTPUT_DIR
	mkdirSync(outputDir, { recursive: true })
	const pngPath = join(
		outputDir,
		options.mode === "studio"
			? `stigmergence-${edition}-seed-${seed}.png`
			: `stigmergence-${edition}.png`,
	)
	writeFileSync(pngPath, png)
	console.log(`  saved to ${pngPath}`)

	if (options.mode === "studio") {
		console.log("  studio mode: no uploads, wallet calls, posts, gallery changes, or state writes")
		return ok({ edition, mode: options.mode, outputPath: pngPath })
	}
	if (!config || !journal) return err("live mode was not prepared")

	// 3. Upload to IPFS
	console.log("uploading to IPFS...")

	const pinata = createPinataClient(config.pinataJwt)

	let imageCid = journal.results.imageCid
	if (!imageCid) {
		const begun = beginLiveOperation(journal, "upload-image")
		if (!begun.ok) return begun
		journal = begun.value
		const imageResult = await uploadImage(pinata, png, `stigmergence-${edition}`)
		if (!imageResult.ok) return imageResult
		imageCid = imageResult.value.imageCid
		const completed = completeLiveOperation(journal, "upload-image", { imageCid })
		if (!completed.ok) return completed
		journal = completed.value
	}
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

	let metadataCid = journal.results.metadataCid
	if (!metadataCid) {
		const begun = beginLiveOperation(journal, "upload-metadata")
		if (!begun.ok) return begun
		journal = begun.value
		const metaResult = await uploadMetadata(pinata, metadata, `stigmergence-${edition}`)
		if (!metaResult.ok) return metaResult
		metadataCid = metaResult.value.metadataCid
		const completed = completeLiveOperation(journal, "upload-metadata", { metadataCid })
		if (!completed.ok) return completed
		journal = completed.value
	}
	console.log(`  metadata CID: ${metadataCid}`)

	const metadataUri = `ipfs://${metadataCid}`

	// Upload to imgur for reliable Farcaster embeds (IPFS gateways are flaky)
	let imgurUrl = journal.results.imgurUrl
	if (!imgurUrl && !journal.results.imgurFailed) {
		console.log("uploading to imgur...")
		const begun = beginLiveOperation(journal, "upload-imgur")
		if (!begun.ok) return begun
		journal = begun.value
		const imgurResult = await uploadToImgur(png, `stigmergence #${edition}`)
		if (imgurResult.ok) {
			imgurUrl = imgurResult.value.url
			console.log(`  imgur: ${imgurUrl}`)
			const completed = completeLiveOperation(journal, "upload-imgur", { imgurUrl })
			if (!completed.ok) return completed
			journal = completed.value
		} else {
			console.warn(`  imgur failed: ${imgurResult.error} — falling back to IPFS gateway`)
			const completed = completeLiveOperation(journal, "upload-imgur", { imgurFailed: true })
			if (!completed.ok) return completed
			journal = completed.value
		}
	}

	// 4. Deploy to Zora/Base
	console.log("deploying to Zora/Base...")
	let contractAddress = journal.results.contractAddress ?? state.contractAddress ?? undefined
	let tokenId = journal.results.tokenId
	let txHash = journal.results.txHash
	if (!journal.results.contractAddress || !tokenId || !txHash) {
		const begun = beginLiveOperation(journal, "mint")
		if (!begun.ok) return begun
		journal = begun.value
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
		const completed = completeLiveOperation(journal, "mint", {
			contractAddress,
			tokenId,
			txHash,
		})
		if (!completed.ok) return completed
		journal = completed.value
	}
	console.log(`  contract: ${contractAddress}`)
	console.log(`  tokenId: ${tokenId}`)
	console.log(`  tx: ${txHash}`)

	// 5. Post to Farcaster
	console.log("posting to Farcaster...")
	// Prefer imgur for cast embeds (direct URL, no redirects, no rate limiting).
	// Fall back to IPFS gateway if imgur upload failed.
	const imageUrl = imgurUrl ?? `${IPFS_GATEWAY}/${imageCid}`
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

	let castHash = journal.results.castHash
	let zoraCastHash = journal.results.zoraCastHash
	let selfReplyHash = journal.results.selfReplyHash
	const replyCastHashes: string[] = []
	// Primary cast embeds image only — no Zora card competing with the art.
	// The Zora collect URL goes in the self-reply thread instead.
	if (!castHash) {
		const begun = beginLiveOperation(journal, "post-primary")
		if (!begun.ok) return begun
		journal = begun.value
		const castResult = await postCast(neynarConfig, castText, imageUrl, undefined, postChannel)
		if (!castResult.ok) return castResult
		castHash = castResult.value.castHash
		const completed = completeLiveOperation(journal, "post-primary", { castHash })
		if (!completed.ok) return completed
		journal = completed.value
	}
	if (!castHash) return err("primary cast was not recorded")
	console.log(`  cast: ${castHash}`)

	// Self-reply: deeper reflection on what this simulation actually does.
	// Creates a visible thread on our post — people browsing see it has replies and click in.
	// Include the Zora mint URL as an embed so anyone reading the thread can collect directly.
	const selfReplyText = options.selfReplyText ?? ""
	if (!selfReplyHash) {
		const begun = beginLiveOperation(journal, "post-self-reply")
		if (!begun.ok) return begun
		journal = begun.value
		const selfReplyResult = await postReply(neynarConfig, selfReplyText, castHash, [mintUrl])
		if (selfReplyResult.ok) {
			selfReplyHash = selfReplyResult.value.castHash
			console.log(`  self-reply: ${selfReplyHash}`)
			// Tracked separately — self-reply shows in primary cast's replies.count,
			// so we need to know it's ours to avoid counting it as external engagement.
			const completed = completeLiveOperation(journal, "post-self-reply", { selfReplyHash })
			if (!completed.ok) return completed
			journal = completed.value
		} else return selfReplyResult
	}

	// Secondary cast to /zora — collector-oriented, different audience than /genart or /art
	// Image-only embed (no Zora promotional card) — the garish +325% chrome graphic
	// competes with the art. Collect URL goes as text instead.
	if (postChannel !== "zora") {
		if (!zoraCastHash) {
			const begun = beginLiveOperation(journal, "post-zora")
			if (!begun.ok) return begun
			journal = begun.value
			const zoraText = options.zoraCastText ?? composeZoraCast(edition, genome)
			const zoraTextWithLink = `${zoraText}\n\n${mintUrl}`
			const zoraResult = await postCast(neynarConfig, zoraTextWithLink, imageUrl, undefined, "zora")
			if (!zoraResult.ok) return zoraResult
			zoraCastHash = zoraResult.value.castHash
			console.log(`  /zora cast: ${zoraCastHash}`)
			const completed = completeLiveOperation(journal, "post-zora", { zoraCastHash })
			if (!completed.ok) return completed
			journal = completed.value
		}
	} else if (!journal.completedOperations.includes("post-zora")) {
		const begun = beginLiveOperation(journal, "post-zora")
		if (!begun.ok) return begun
		journal = begun.value
		const completed = completeLiveOperation(journal, "post-zora", { zoraPostSkipped: true })
		if (!completed.ok) return completed
		journal = completed.value
	}

	// 6. Engage with community (builds organic discovery via notifications)
	// Automated engagement: likes and follows only.
	// All replies are composed by me directly each session — not by pipeline automation.
	// The mixed voice problem (automated sonnet replies + my direct replies) was degrading trust.
	if (!journal.completedOperations.includes("engage")) {
		const begun = beginLiveOperation(journal, "engage")
		if (!begun.ok) return begun
		journal = begun.value
		const engagementResult = await engageWithCommunity(
			neynarConfig,
			undefined, // channels
			undefined, // maxLikes
			undefined, // maxFollows
			0, // maxReplies — disabled, I reply myself
		)
		if (!engagementResult.ok) return engagementResult
		const completed = completeLiveOperation(journal, "engage")
		if (!completed.ok) return completed
		journal = completed.value
	}
	// No automated inbound responses either — I handle conversations directly.

	// 7. Update gallery
	if (!journal.completedOperations.includes("update-gallery")) {
		const begun = beginLiveOperation(journal, "update-gallery")
		if (!begun.ok) return begun
		journal = begun.value
		const galleryResult = await updateGallery({
			edition,
			seed,
			width: params.width,
			height: params.height,
			genome,
			contractAddress: contractAddress ?? "",
			tokenId,
		})
		if (!galleryResult.ok) return galleryResult
		const completed = completeLiveOperation(journal, "update-gallery")
		if (!completed.ok) return completed
		journal = completed.value
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
	if (!journal.completedOperations.includes("save-state")) {
		const begun = beginLiveOperation(journal, "save-state")
		if (!begun.ok) return begun
		journal = begun.value
		const saveResult = saveState(newState)
		if (!saveResult.ok) return saveResult
		const completed = completeLiveOperation(journal, "save-state")
		if (!completed.ok) return completed
		journal = completed.value
	}
	const runCompleted = completeLiveRun(journal)
	if (!runCompleted.ok) return runCompleted

	console.log(`\n--- stigmergence #${edition} complete ---\n`)
	return ok({ edition, mode: options.mode, outputPath: pngPath })
}
