import { expect, test } from "bun:test"
import type { EnvConfig } from "#config/env.ts"
import { runPipeline } from "#pipeline/orchestrate.ts"

// Dummy values only. These cases must return before simulation, journal creation,
// uploads, or network calls; never load the container's live service configuration.
const config: EnvConfig = {
	walletPrivateKey: "0xinvalid-test-key",
	pinataJwt: "test",
	farcasterFid: 1,
	neynarApiKey: "test",
	neynarSignerUuid: "test",
	baseRpcUrl: "http://127.0.0.1:1",
}

test("live publication rejects every missing or blank social text before outside work", async () => {
	const originalFetch = globalThis.fetch
	let requests = 0
	globalThis.fetch = (() => {
		requests++
		throw new Error("unexpected network request in publication guard test")
	}) as typeof fetch
	try {
		for (const field of ["castText", "selfReplyText", "zoraCastText"] as const) {
			for (const value of [undefined, "", " \n\t"]) {
				const result = await runPipeline(config, {
					mode: "live",
					castText: "An explicitly written caption.",
					selfReplyText: "An explicitly written reply.",
					zoraCastText: "An explicitly written secondary caption.",
					[field]: value,
				})
				expect(result).toEqual({
					ok: false,
					error:
						"live mode requires explicit --cast-text, --self-reply-text, and --zora-text from Stigmergence",
				})
			}
		}
		expect(requests).toBe(0)
	} finally {
		globalThis.fetch = originalFetch
	}
})
