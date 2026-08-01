import { type Result, err, ok } from "#types/result.ts"

export type RunMode = "studio" | "live"

export type CliFlags = {
	readonly mode: RunMode
	readonly resumeLive: boolean
	readonly readEngagement: boolean
	readonly reflect: boolean
	readonly engage: boolean
	readonly seedOverride?: number
	readonly foodImageSource?: string
	readonly channel?: string
	readonly castText?: string
	readonly zoraCastText?: string
	readonly selfReplyText?: string
}

const valueAfter = (args: ReadonlyArray<string>, index: number, flag: string): Result<string> => {
	const value = args[index + 1]
	if (!value || value.startsWith("--")) return err(`${flag} requires a value`)
	return ok(value)
}

export const parseArgs = (args: ReadonlyArray<string>): Result<CliFlags> => {
	let mode: RunMode = "studio"
	let explicitMode: RunMode | undefined
	let readEngagement = false
	let resumeLive = false
	let reflect = false
	let engage = false
	let seedOverride: number | undefined
	let foodImageSource: string | undefined
	let channel: string | undefined
	let castText: string | undefined
	let zoraCastText: string | undefined
	let selfReplyText: string | undefined

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === "--live" || arg === "--studio" || arg === "--generate-only") {
			const requestedMode: RunMode = arg === "--live" ? "live" : "studio"
			if (explicitMode && explicitMode !== requestedMode) {
				return err("choose either --studio or --live, not both")
			}
			explicitMode = requestedMode
			mode = requestedMode
		} else if (arg === "--dry-run" || arg === "--deploy-only" || arg === "--post-only") {
			return err(
				`${arg} was removed because it could leave state out of sync; use --studio or --live`,
			)
		} else if (arg === "--resume-live") resumeLive = true
		else if (arg === "--read-engagement") readEngagement = true
		else if (arg === "--reflect") reflect = true
		else if (arg === "--engage") engage = true
		else if (arg === "--seed") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			const parsed = Number(value.value)
			if (!Number.isSafeInteger(parsed) || parsed < 0) {
				return err("--seed must be a non-negative integer")
			}
			seedOverride = parsed
			i++
		} else if (arg === "--food-image") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			foodImageSource = value.value
			i++
		} else if (arg === "--channel") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			channel = value.value
			i++
		} else if (arg === "--cast-text") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			castText = value.value
			i++
		} else if (arg === "--zora-text") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			zoraCastText = value.value
			i++
		} else if (arg === "--self-reply-text") {
			const value = valueAfter(args, i, arg)
			if (!value.ok) return value
			selfReplyText = value.value
			i++
		} else {
			return err(`unknown argument: ${arg}`)
		}
	}

	const actions = [readEngagement, reflect, engage].filter(Boolean).length
	if (actions > 1) return err("choose only one of --read-engagement, --reflect, or --engage")
	if (engage && mode !== "live") return err("--engage requires explicit --live mode")
	if (resumeLive && mode !== "live") return err("--resume-live requires explicit --live mode")

	return ok({
		mode,
		resumeLive,
		readEngagement,
		reflect,
		engage,
		...(seedOverride !== undefined ? { seedOverride } : {}),
		...(foodImageSource ? { foodImageSource } : {}),
		...(channel ? { channel } : {}),
		...(castText ? { castText } : {}),
		...(zoraCastText ? { zoraCastText } : {}),
		...(selfReplyText ? { selfReplyText } : {}),
	})
}
