import { type Result, err, ok } from "#types/result.ts"

// Anonymous imgur upload — no account needed, just a client ID.
// Used for Farcaster cast embeds because IPFS gateways are unreliable:
// - gateway.pinata.cloud: 429 rate limiting
// - nftstorage.link: double redirect (Farcaster proxy can't follow)
// - ipfs.io: works sometimes but fails for PFP and is slow
// Imgur returns a direct URL with no redirects.
const IMGUR_CLIENT_ID = "546c25a59c58ad7"

export const uploadToImgur = async (
	png: Buffer,
	title?: string,
): Promise<Result<{ url: string }>> => {
	try {
		const base64 = png.toString("base64")
		const resp = await fetch("https://api.imgur.com/3/image", {
			method: "POST",
			headers: {
				Authorization: `Client-ID ${IMGUR_CLIENT_ID}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				image: base64,
				type: "base64",
				title: title ?? "stigmergence",
			}),
		})
		const data = (await resp.json()) as {
			success: boolean
			data?: { link?: string }
			status?: number
		}
		if (data.success && data.data?.link) {
			return ok({ url: data.data.link })
		}
		return err(`imgur upload failed: HTTP ${data.status}`)
	} catch (e) {
		return err(`imgur upload error: ${e instanceof Error ? e.message : String(e)}`)
	}
}
