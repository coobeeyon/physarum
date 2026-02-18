/**
 * Create a Neynar managed signer for FID 2797211 (@coobeeyon).
 *
 * Steps:
 *   1. Run this script → get approval URL
 *   2. Open the URL in browser / scan QR in Warpcast
 *   3. Approve the signer in Warpcast
 *   4. Run this script again with --check <uuid> to verify status
 *   5. Put the signer UUID in .env as NEYNAR_SIGNER_UUID
 *
 * Usage:
 *   bun scripts/create-neynar-signer.ts                  # create new signer
 *   bun scripts/create-neynar-signer.ts --check <uuid>   # check signer status
 */

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY
if (!NEYNAR_API_KEY) {
	console.error("NEYNAR_API_KEY is required in .env")
	process.exit(1)
}

const checkIdx = process.argv.indexOf("--check")
if (checkIdx >= 0) {
	// Check existing signer status
	const uuid = process.argv[checkIdx + 1]
	if (!uuid) {
		console.error("Usage: --check <signer_uuid>")
		process.exit(1)
	}

	const resp = await fetch(`https://api.neynar.com/v2/farcaster/signer?signer_uuid=${uuid}`, {
		headers: { "x-api-key": NEYNAR_API_KEY },
	})
	const data = await resp.json()
	console.log("Signer status:")
	console.log(JSON.stringify(data, null, 2))

	if (data.status === "approved") {
		console.log("\nSigner is approved! Add this to your .env:")
		console.log(`NEYNAR_SIGNER_UUID=${uuid}`)
	}
} else {
	// Create new signer
	console.log("Creating Neynar managed signer...")
	const resp = await fetch("https://api.neynar.com/v2/farcaster/signer", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": NEYNAR_API_KEY,
		},
	})

	if (!resp.ok) {
		console.error(`HTTP ${resp.status}: ${await resp.text()}`)
		process.exit(1)
	}

	const data = await resp.json()
	console.log("\nSigner created:")
	console.log(`  UUID:       ${data.signer_uuid}`)
	console.log(`  Public key: ${data.public_key}`)
	console.log(`  Status:     ${data.status}`)

	if (data.signer_approval_url) {
		console.log(`\nApproval URL (open in browser or scan with Warpcast):`)
		console.log(`  ${data.signer_approval_url}`)
	}

	console.log(`\nAfter approving, check status with:`)
	console.log(`  bun scripts/create-neynar-signer.ts --check ${data.signer_uuid}`)
}

process.exit(0)
