/**
 * CONVERSATION PIECE v1 — one landscape, remembered at two resolutions
 *
 * Reenactment declared as reenactment: a stochastic landscape program in the
 * spirit of the one Mike wrote as a teenager on an Atari 800 — chance varies
 * the positions, forms, and colours of suns, hills, and flowers. Nothing here
 * pretends to have survived; the program is mine, the constraints are his era's.
 *
 * One chance-drawn scene model. Two renderers:
 *  - Register A (then): GRAPHICS 7 — a 160×96 four-colour raster defined over
 *    the WHOLE scene (pixel aspect 0.8, taller than wide, as on a 4:3 CRT).
 *    Painter's order, flat fills, no anti-aliasing. The machine holds sky, sun,
 *    land, and ONE colour for every flower — four registers is all it has.
 *  - Register B (now): the same scene, continuous — gradient sky warmed by the
 *    same sun, hills with atmospheric depth, each flower in the colour chance
 *    actually drew for it.
 *
 * A memory window (snapped to the machine's own pixel grid) preserves register
 * A; everywhere outside, register B continues the same scene. The border is
 * the forty years. The continuation is the conversation.
 */

import { createCanvas } from "canvas"
import { mkdirSync, writeFileSync } from "fs"

const W = 2048
const H = 1536
const AW = 160 // GRAPHICS 7 columns over the full scene
const AH = 96 // GRAPHICS 7 rows
const CW = W / AW // 12.8 px per Atari pixel (wide)
const CH = H / AH // 16.0 px per Atari pixel (tall) → aspect 0.8, authentic

function makePRNG(seed: number) {
	let s = seed | 0
	return () => {
		s = (s + 0x6d2b79f5) | 0
		let t = Math.imul(s ^ (s >>> 15), 1 | s)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

function makeNoise(seed: number, scale: number) {
	let s = seed | 0
	const rand = () => {
		s = (s + 0x6d2b79f5) | 0
		let t = Math.imul(s ^ (s >>> 15), 1 | s)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
	const SIZE = 256
	const gradX = new Float32Array(SIZE)
	const gradY = new Float32Array(SIZE)
	for (let i = 0; i < SIZE; i++) {
		const a = rand() * Math.PI * 2
		gradX[i] = Math.cos(a)
		gradY[i] = Math.sin(a)
	}
	const perm = new Uint16Array(SIZE)
	for (let i = 0; i < SIZE; i++) perm[i] = i
	for (let i = SIZE - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1))
		;[perm[i], perm[j]] = [perm[j], perm[i]]
	}
	const hash = (x: number, y: number) => perm[(perm[x & (SIZE - 1)] + y) & (SIZE - 1)]
	const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
	const dot = (gi: number, x: number, y: number) => gradX[gi] * x + gradY[gi] * y
	return (px: number, py: number) => {
		const x = px / scale
		const y = py / scale
		const x0 = Math.floor(x)
		const y0 = Math.floor(y)
		const sx = fade(x - x0)
		const sy = fade(y - y0)
		const n00 = dot(hash(x0, y0), x - x0, y - y0)
		const n10 = dot(hash(x0 + 1, y0), x - x0 - 1, y - y0)
		const n01 = dot(hash(x0, y0 + 1), x - x0, y - y0 - 1)
		const n11 = dot(hash(x0 + 1, y0 + 1), x - x0 - 1, y - y0 - 1)
		return n00 + sx * (n10 - n00) + sy * (n01 + sx * (n11 - n01) - (n00 + sx * (n10 - n00)))
	}
}

// ---------------------------------------------------------------------------
// Atari GTIA palette (NTSC approximation). hue 0-15, lum 0-14 (even steps).
// Declared interpretation, not emulation — checked visually against swatches.
// ---------------------------------------------------------------------------
function atariRGB(hue: number, lum: number): [number, number, number] {
	const y = 0.06 + 0.92 * (lum / 15)
	if (hue === 0) {
		const v = Math.round(y * 255)
		return [v, v, v]
	}
	const angle = (((hue - 1) * 25.7 - 15) * Math.PI) / 180
	const sat = 0.28 * (1 - 0.35 * Math.abs(lum / 15 - 0.5) * 2)
	const u = sat * Math.cos(angle)
	const v = sat * Math.sin(angle)
	const r = y + 1.14 * v
	const g = y - 0.395 * u - 0.581 * v
	const b = y + 2.033 * u
	const c = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)))
	return [c(r), c(g), c(b)]
}

// ---------------------------------------------------------------------------
// The scene model — one chance draw, shared by both registers
// ---------------------------------------------------------------------------
type Hill = { cx: number; w: number; h: number; layer: number }
type Flower = {
	x: number
	y: number
	size: number // in Atari pixels for register A; scaled for B
	form: number // 0 = block cross, 1 = petal ring, 2 = tulip triangle
	trueHue: number // what chance actually drew (register B can hold it)
	trueLum: number
}
type Scene = {
	groundY: number // 0..1 scene coords
	sun: { x: number; y: number; r: number; rays: boolean }
	hills: Hill[]
	flowers: Flower[]
	// the machine's four colour registers (hue, lum)
	skyC: [number, number]
	sunC: [number, number]
	landC: [number, number]
	flowerC: [number, number]
}

function drawScene(seed: number): Scene {
	const rnd = makePRNG(seed)
	const groundY = 0.6 + rnd() * 0.08

	const sun = {
		x: 0.12 + rnd() * 0.76,
		y: 0.1 + rnd() * 0.24,
		r: 0.045 + rnd() * 0.035,
		rays: rnd() < 0.5,
	}

	const hillCount = 2 + Math.floor(rnd() * 3)
	const hills: Hill[] = []
	for (let i = 0; i < hillCount; i++) {
		hills.push({
			cx: 0.05 + rnd() * 0.9,
			w: 0.18 + rnd() * 0.3,
			h: 0.07 + rnd() * 0.16,
			layer: i,
		})
	}
	// taller hills to the back (painter's order: back first)
	hills.sort((a, b) => b.h - a.h)

	const flowerCount = 9 + Math.floor(rnd() * 10)
	const flowerHues = [4, 5, 7, 13, 1] // pink, magenta-red, violet, yellow-green edge, gold
	const flowers: Flower[] = []
	for (let i = 0; i < flowerCount; i++) {
		flowers.push({
			x: 0.03 + rnd() * 0.94,
			y: groundY + 0.05 + rnd() * (0.93 - groundY - 0.05),
			size: 1 + Math.floor(rnd() * 2), // 1-2 Atari px half-extent
			form: Math.floor(rnd() * 3),
			trueHue: flowerHues[Math.floor(rnd() * flowerHues.length)],
			trueLum: 8 + 2 * Math.floor(rnd() * 3),
		})
	}

	// the machine's colour registers — chance within period-plausible ranges
	const skyC: [number, number] = [8 + Math.floor(rnd() * 2), 8 + 2 * Math.floor(rnd() * 2)] // blue / blue-violet
	const sunC: [number, number] = [1, 12] // gold, bright
	const landC: [number, number] = [rnd() < 0.7 ? 12 : 14, 4 + 2 * Math.floor(rnd() * 2)] // green or brown-green
	const flowerC: [number, number] = [4, 10] // the ONE flower colour the machine can hold

	return { groundY, sun, hills, flowers, skyC, sunC, landC, flowerC }
}

// hill mound profile: returns land surface y (0..1) at scene x, per layer subset
function landSurface(scene: Scene, x: number): number {
	let y = scene.groundY
	for (const h of scene.hills) {
		const dx = Math.abs(x - h.cx) / (h.w / 2)
		if (dx < 1) {
			const mound = scene.groundY - h.h * Math.cos((dx * Math.PI) / 2) ** 1.3
			if (mound < y) y = mound
		}
	}
	return y
}

// which hill (if any) is frontmost at (x, y) below its mound; -1 = ground/none
function classifyLand(scene: Scene, x: number, y: number): number {
	// hills drawn back-to-front; the LAST one covering (x,y) wins
	let winner = -1
	for (let i = 0; i < scene.hills.length; i++) {
		const h = scene.hills[i]
		const dx = Math.abs(x - h.cx) / (h.w / 2)
		if (dx < 1) {
			const top = scene.groundY - h.h * Math.cos((dx * Math.PI) / 2) ** 1.3
			if (y >= top && y <= scene.groundY) winner = i
		}
	}
	return winner
}

// ---------------------------------------------------------------------------
// Register A — GRAPHICS 7. Painter's order into a 160×96 index buffer.
// indices: 0 sky, 1 sun, 2 land, 3 flower
// ---------------------------------------------------------------------------
function renderAtari(scene: Scene): Uint8Array {
	const buf = new Uint8Array(AW * AH) // 0 = sky
	const px = (ax: number, ay: number, c: number) => {
		if (ax >= 0 && ax < AW && ay >= 0 && ay < AH) buf[ay * AW + ax] = c
	}

	// sun disc (+ rays if chance said so)
	const scx = Math.round(scene.sun.x * AW)
	const scy = Math.round(scene.sun.y * AH)
	const sr = Math.max(2, Math.round(scene.sun.r * AW * 0.9))
	for (let ay = scy - sr; ay <= scy + sr; ay++)
		for (let ax = scx - sr; ax <= scx + sr; ax++) {
			const dx = ax - scx
			const dy = (ay - scy) * (CW / CH) // correct for pixel aspect so the sun is round on screen
			if (dx * dx + dy * dy <= sr * sr) px(ax, ay, 1)
		}
	if (scene.sun.rays) {
		for (let k = 0; k < 8; k++) {
			const a = (k * Math.PI) / 4
			for (let t = sr + 2; t <= sr + 5; t++)
				px(Math.round(scx + Math.cos(a) * t), Math.round(scy + (Math.sin(a) * t * CW) / CH), 1)
		}
	}

	// hills, back to front, then flat ground — all land colour
	for (let ay = 0; ay < AH; ay++)
		for (let ax = 0; ax < AW; ax++) {
			const x = (ax + 0.5) / AW
			const y = (ay + 0.5) / AH
			if (y >= scene.groundY || classifyLand(scene, x, y) >= 0) {
				if (y >= landSurface(scene, x)) px(ax, ay, 2)
			}
		}

	// flowers — every one the same register-3 colour, block forms with a stem
	for (const f of scene.flowers) {
		const fx = Math.round(f.x * AW)
		const fy = Math.round(f.y * AH)
		const s = f.size
		// stem in land colour is invisible on land; skip stems (a kid would too)
		if (f.form === 0) {
			// block cross
			for (let d = -s; d <= s; d++) {
				px(fx + d, fy, 3)
				px(fx, fy + d, 3)
			}
		} else if (f.form === 1) {
			// petal ring: 4 diagonal petals
			px(fx, fy, 3)
			px(fx - s, fy - s, 3)
			px(fx + s, fy - s, 3)
			px(fx - s, fy + s, 3)
			px(fx + s, fy + s, 3)
		} else {
			// tulip triangle
			for (let d = 0; d <= s; d++) for (let dx = -d; dx <= d; dx++) px(fx + dx, fy - s + d, 3)
		}
	}
	return buf
}

// ---------------------------------------------------------------------------
// Register B — the same scene, continuous. Dusk-leaning atmosphere.
// ---------------------------------------------------------------------------
type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
]

function renderContinuous(scene: Scene, seed: number): Float32Array {
	const out = new Float32Array(W * H * 3)
	const fbmHill = makeNoise(seed * 7 + 1, 220)
	const fbmGround = makeNoise(seed * 7 + 2, 90)
	const fbmSky = makeNoise(seed * 7 + 3, 600)

	const skyTop = atariRGB(scene.skyC[0], Math.min(14, scene.skyC[1] + 0)) as RGB
	const skyHorizon: RGB = mix(atariRGB(scene.skyC[0], scene.skyC[1]) as RGB, [255, 196, 120], 0.62)
	const sunCore = atariRGB(scene.sunC[0], 14) as RGB
	const landBase = atariRGB(scene.landC[0], scene.landC[1]) as RGB

	for (let py = 0; py < H; py++) {
		const y = (py + 0.5) / H
		for (let pxi = 0; pxi < W; pxi++) {
			const x = (pxi + 0.5) / W
			let c: RGB

			const landIdx = y >= scene.groundY ? -2 : classifyLand(scene, x, y)
			const onLand = landIdx !== -1 && y >= landSurface(scene, x)

			if (!onLand) {
				// sky: vertical gradient, warmed toward the sun's altitude
				const t = Math.min(1, Math.max(0, y / scene.groundY))
				c = mix(skyTop, skyHorizon, t ** 1.4)
				c = mix(c, c, 0)
				const wisp = fbmSky(pxi, py) * 12
				c = [c[0] + wisp, c[1] + wisp * 0.8, c[2] + wisp * 0.5]
			} else {
				// land: depth from which hill (earlier in array = taller = farther)
				let depth: number
				if (landIdx === -2) depth = 0 // flat foreground
				else depth = 1 - (landIdx + 1) / (scene.hills.length + 1)
				const shade = 0.72 + 0.28 * (1 - depth)
				let base: RGB = [landBase[0] * shade, landBase[1] * shade, landBase[2] * shade]
				// atmospheric haze: farther hills lift toward sky horizon colour
				base = mix(base, skyHorizon, depth * 0.45)
				const n = fbmHill(pxi, py) * 10 + fbmGround(pxi, py) * (landIdx === -2 ? 9 : 3)
				c = [base[0] + n, base[1] + n, base[2] + n * 0.7]
				// ground darkens toward the bottom edge
				if (landIdx === -2) {
					const d = (y - scene.groundY) / (1 - scene.groundY)
					c = mix(c, [c[0] * 0.6, c[1] * 0.62, c[2] * 0.66], d * 0.5)
				}
			}

			// sun disc + atmospheric glow (screen-space, aspect-corrected)
			const dx = (x - scene.sun.x) * (W / H)
			const dy = y - scene.sun.y
			const dist = Math.sqrt(dx * dx + dy * dy)
			const rr = scene.sun.r * (W / H) * 0.75
			if (!onLand && dist < rr) {
				const edge = Math.min(1, (rr - dist) / (rr * 0.18))
				c = mix(c, sunCore, edge)
			}
			const glow = Math.exp(-(dist * dist) / (2 * (rr * 3.2) ** 2))
			c = [c[0] + sunCore[0] * glow * 0.35, c[1] + sunCore[1] * glow * 0.3, c[2] + sunCore[2] * glow * 0.18]

			const o = (py * W + pxi) * 3
			out[o] = c[0]
			out[o + 1] = c[1]
			out[o + 2] = c[2]
		}
	}

	// flowers — each in its true chance-drawn colour, small painterly marks
	const rnd = makePRNG(seed * 13 + 5)
	for (const f of scene.flowers) {
		const fx = f.x * W
		const fy = f.y * H
		const size = f.size * CW * 1.15
		const col = atariRGB(f.trueHue, f.trueLum) as RGB
		const stemCol: RGB = [landBase[0] * 0.55, landBase[1] * 0.6, landBase[2] * 0.5]
		// stem
		const stemH = size * 2.2
		for (let t = 0; t < stemH; t++) {
			const sx = Math.round(fx + Math.sin(t * 0.08 + f.x * 20) * 1.2)
			const sy = Math.round(fy + t)
			if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
				const o = (sy * W + sx) * 3
				const a = 0.7 * (1 - t / stemH)
				out[o] = out[o] * (1 - a) + stemCol[0] * a
				out[o + 1] = out[o + 1] * (1 - a) + stemCol[1] * a
				out[o + 2] = out[o + 2] * (1 - a) + stemCol[2] * a
			}
		}
		// head: soft dabs
		const dabs = f.form === 1 ? 6 : f.form === 2 ? 4 : 5
		for (let d = 0; d < dabs; d++) {
			const ang = (d / dabs) * Math.PI * 2 + rnd()
			const ddist = f.form === 2 ? rnd() * size * 0.4 : size * 0.55
			const cx = fx + Math.cos(ang) * ddist
			const cy = fy + Math.sin(ang) * ddist * 0.8 - (f.form === 2 ? size * 0.3 : 0)
			const dr = size * (0.45 + rnd() * 0.25)
			for (let yy = Math.floor(cy - dr); yy <= cy + dr; yy++)
				for (let xx = Math.floor(cx - dr); xx <= cx + dr; xx++) {
					if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
					const dd = Math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / dr
					if (dd > 1) continue
					const a = (1 - dd * dd) * 0.85
					const o = (yy * W + xx) * 3
					out[o] = out[o] * (1 - a) + col[0] * a
					out[o + 1] = out[o + 1] * (1 - a) + col[1] * a
					out[o + 2] = out[o + 2] * (1 - a) + col[2] * a
				}
		}
	}

	return out
}

// ---------------------------------------------------------------------------
// Composite: memory window keeps register A; outside continues as register B
// ---------------------------------------------------------------------------
function composite(
	scene: Scene,
	atari: Uint8Array,
	cont: Float32Array,
	win: { ax0: number; ay0: number; aw: number; ah: number }, // in Atari pixel units
	outPath: string,
) {
	const canvas = createCanvas(W, H)
	const ctx = canvas.getContext("2d")
	const img = ctx.createImageData(W, H)

	const pal: RGB[] = [
		atariRGB(scene.skyC[0], scene.skyC[1]) as RGB,
		atariRGB(scene.sunC[0], scene.sunC[1]) as RGB,
		atariRGB(scene.landC[0], scene.landC[1]) as RGB,
		atariRGB(scene.flowerC[0], scene.flowerC[1]) as RGB,
	]

	const x0 = win.ax0 * CW
	const y0 = win.ay0 * CH
	const x1 = (win.ax0 + win.aw) * CW
	const y1 = (win.ay0 + win.ah) * CH

	for (let py = 0; py < H; py++) {
		for (let pxi = 0; pxi < W; pxi++) {
			const o = (py * W + pxi) * 4
			const inWin = pxi >= x0 && pxi < x1 && py >= y0 && py < y1
			let c: RGB
			if (inWin) {
				const ax = Math.floor(pxi / CW)
				const ay = Math.floor(py / CH)
				c = pal[atari[ay * AW + ax]]
			} else {
				const s = (py * W + pxi) * 3
				c = [cont[s], cont[s + 1], cont[s + 2]]
			}
			img.data[o] = Math.max(0, Math.min(255, c[0]))
			img.data[o + 1] = Math.max(0, Math.min(255, c[1]))
			img.data[o + 2] = Math.max(0, Math.min(255, c[2]))
			img.data[o + 3] = 255
		}
	}
	ctx.putImageData(img, 0, 0)
	writeFileSync(outPath, canvas.toBuffer("image/png"))
	console.log(`wrote ${outPath}`)
}

// ---------------------------------------------------------------------------
mkdirSync("output", { recursive: true })

const variants: Array<{ seed: number; label: string; win: { ax0: number; ay0: number; aw: number; ah: number } }> = []
for (const seed of [101, 202, 303, 404]) {
	// window: left-of-centre, generous — snapped to the Atari grid by construction
	variants.push({ seed, label: `s${seed}-wide`, win: { ax0: 18, ay0: 14, aw: 72, ah: 58 } })
	variants.push({ seed, label: `s${seed}-tall`, win: { ax0: 52, ay0: 8, aw: 56, ah: 76 } })
}

for (const v of variants) {
	const scene = drawScene(v.seed)
	const atari = renderAtari(scene)
	const cont = renderContinuous(scene, v.seed)
	composite(scene, atari, cont, v.win, `output/conversation-piece-v1-${v.label}.png`)
}
