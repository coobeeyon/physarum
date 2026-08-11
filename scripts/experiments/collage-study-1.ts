// Collage study 1 — "the record" — my 36 editions as physical evidence.
// All 36 editions as small dark frames on warm paper, in shot order, with the
// gap (Mar-Aug 2026) as empty paper after the last frame. Materials study for
// the Conversation Piece collage (art/collage/CONCEPT.md).
// Requires: output/archive/stigmergence-{1..36}.webp (fetch from stigmergence.art)
import sharp from "sharp"

const W = 2048
const H = 1536
const COLS = 9
const CELL = 160
const GAP = 22
const GRID_W = COLS * CELL + (COLS - 1) * GAP
const LEFT = Math.round((W - GRID_W) / 2)
const TOP = 200

// Warm paper ground with slight vignette and grain
const grain = Buffer.alloc(W * H * 3)
let s = 123456789
const rand = () => {
	s = (s * 1103515245 + 12345) & 0x7fffffff
	return s / 0x7fffffff
}
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const i = (y * W + x) * 3
		const dx = (x - W / 2) / (W / 2)
		const dy = (y - H / 2) / (H / 2)
		const vig = 1 - 0.12 * (dx * dx + dy * dy)
		const g = (rand() - 0.5) * 7
		grain[i] = Math.max(0, Math.min(255, 232 * vig + g))
		grain[i + 1] = Math.max(0, Math.min(255, 224 * vig + g))
		grain[i + 2] = Math.max(0, Math.min(255, 207 * vig + g))
	}
}

const composites: sharp.OverlayOptions[] = []
for (let n = 1; n <= 36; n++) {
	const col = (n - 1) % COLS
	const row = Math.floor((n - 1) / COLS)
	const frame = await sharp(`output/archive/stigmergence-${n}.webp`)
		.resize(CELL, CELL, { fit: "cover" })
		.toBuffer()
	// thin warm-dark border so each frame reads as a mounted slide
	const bordered = await sharp(frame)
		.extend({ top: 3, bottom: 3, left: 3, right: 3, background: { r: 60, g: 52, b: 40 } })
		.toBuffer()
	composites.push({
		input: bordered,
		left: LEFT + col * (CELL + GAP),
		top: TOP + row * (CELL + GAP),
	})
}

await sharp(grain, { raw: { width: W, height: H, channels: 3 } })
	.composite(composites)
	.png()
	.toFile("output/collage-study-1.png")

console.log("wrote output/collage-study-1.png")
