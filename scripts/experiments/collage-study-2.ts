// Collage study 2 — "the record, with the gap made legible."
// 36 editions as mounted frames; then two rows of EMPTY mounts — photo corners
// with no photo between them, faint discoloration where an image should sit.
// The gap is not missing content; it is prepared space that never got filled.
import sharp from "sharp"

const W = 2048
const H = 1536
const COLS = 9
const CELL = 160
const GAP = 22
const GRID_W = COLS * CELL + (COLS - 1) * GAP
const LEFT = Math.round((W - GRID_W) / 2)
const TOP = 150
const ROWS_TOTAL = 6 // 4 filled (36) + 2 empty

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

const cellPos = (n: number) => ({
	left: LEFT + ((n - 1) % COLS) * (CELL + GAP),
	top: TOP + Math.floor((n - 1) / COLS) * (CELL + GAP),
})

const composites: sharp.OverlayOptions[] = []
for (let n = 1; n <= 36; n++) {
	const frame = await sharp(`output/archive/stigmergence-${n}.webp`)
		.resize(CELL, CELL, { fit: "cover" })
		.toBuffer()
	const bordered = await sharp(frame)
		.extend({ top: 3, bottom: 3, left: 3, right: 3, background: { r: 60, g: 52, b: 40 } })
		.toBuffer()
	composites.push({ input: bordered, ...cellPos(n) })
}

// Empty mounts for cells 37..54: faint discoloration + four photo-corner triangles
const svgParts: string[] = []
for (let n = 37; n <= ROWS_TOTAL * COLS; n++) {
	const { left, top } = cellPos(n)
	const jx = (rand() - 0.5) * 3
	const jy = (rand() - 0.5) * 3
	const x = left + jx
	const y = top + jy
	const c = CELL + 6
	// discoloration: the paper is slightly lighter where a photo would have shielded it
	svgParts.push(
		`<rect x="${x}" y="${y}" width="${c}" height="${c}" fill="rgb(240,233,218)" fill-opacity="0.55"/>`,
	)
	const t = 26 // corner triangle size
	const corner = (cx: number, cy: number, sx: number, sy: number) =>
		`<path d="M ${cx} ${cy} l ${t * sx} 0 l ${-t * sx} ${t * sy} z" fill="rgb(205,195,175)" stroke="rgb(178,167,145)" stroke-width="1"/>`
	svgParts.push(corner(x, y, 1, 1))
	svgParts.push(corner(x + c, y, -1, 1))
	svgParts.push(corner(x, y + c, 1, -1))
	svgParts.push(corner(x + c, y + c, -1, -1))
}
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${svgParts.join("")}</svg>`
composites.push({ input: Buffer.from(svg), left: 0, top: 0 })

await sharp(grain, { raw: { width: W, height: H, channels: 3 } })
	.composite(composites)
	.png()
	.toFile("output/collage-study-2.png")

console.log("wrote output/collage-study-2.png")
