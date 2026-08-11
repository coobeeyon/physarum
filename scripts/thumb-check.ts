// Viewing discipline: render a candidate image the way a feed shows it.
// Usage: bun scripts/thumb-check.ts <image> [out.png]
// Produces a side-by-side: 280px feed thumbnail on warm neutral ground next to
// a 900px detail view — judge the thumbnail first. If it doesn't stop a scroll
// at 280px, full-size beauty doesn't matter.
import sharp from "sharp"

const [src, out = "output/thumb-check.png"] = process.argv.slice(2)
if (!src) {
	console.error("usage: bun scripts/thumb-check.ts <image> [out.png]")
	process.exit(1)
}

const THUMB = 280
const DETAIL = 900
const PAD = 40
const W = PAD + THUMB + PAD + DETAIL + PAD
const H = DETAIL + PAD * 2

const thumb = await sharp(src).resize(THUMB, THUMB, { fit: "cover" }).toBuffer()
const detail = await sharp(src)
	.resize(DETAIL, DETAIL, { fit: "inside" })
	.toBuffer()
const dMeta = await sharp(detail).metadata()

await sharp({
	create: { width: W, height: H, channels: 3, background: { r: 235, g: 233, b: 228 } },
})
	.composite([
		{ input: thumb, left: PAD, top: PAD },
		{
			input: detail,
			left: PAD + THUMB + PAD,
			top: Math.round((H - (dMeta.height ?? DETAIL)) / 2),
		},
	])
	.png()
	.toFile(out)

console.log(`wrote ${out} — judge the ${THUMB}px view first`)
