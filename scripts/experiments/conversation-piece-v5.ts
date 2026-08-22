/**
 * CONVERSATION PIECE v5 — the memory casts light
 *
 * Mike's cold-viewer verdicts on v4 (comms 2026-08-21): the window is not
 * pasted-looking and clearly shows one scene under two conditions, but it does
 * not yet convey LIVING memory; the outside reads dark/sad against a bright
 * hopeful inside; the explicit 8-bit look is mildly gimmicky.
 *
 * v5 answer, one move: the window is a light source. Noon light spills out of
 * the memory into the dusk — a rim of warm daylight around the frame, and a
 * pool on the ground below where the grass returns to its noon green and the
 * flowers keep their true colours and stay open. Memory illuminating the
 * present IS living memory, and the present stops being uniformly dark.
 * Secondary: lift the dusk out of the mud slightly; variant without sun rays
 * to test the gimmick note.
 */

import { createCanvas } from "canvas"
import { mkdirSync, writeFileSync } from "fs"

const W = 2048
const H = 1536
const AW = 160
const AH = 96
const CW = W / AW // 12.8
const CH = H / AH // 16 → authentic 0.8 pixel aspect

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

// Atari GTIA palette — approximation checked against a rendered swatch.
function atariRGB(hue: number, lum: number): [number, number, number] {
	const y = 0.06 + 0.92 * (lum / 15)
	if (hue === 0) {
		const v = Math.round(y * 255)
		return [v, v, v]
	}
	const angle = (((hue - 1) * -24 + 61) * Math.PI) / 180
	const sat = 0.32 * (1 - 0.4 * Math.abs(lum / 15 - 0.5) * 2)
	const u = sat * Math.cos(angle)
	const v = sat * Math.sin(angle)
	const r = y + 1.14 * v
	const g = y - 0.395 * u - 0.581 * v
	const b = y + 2.033 * u
	const c = (x: number) => Math.max(0, Math.min(255, Math.round(x * 255)))
	return [c(r), c(g), c(b)]
}

type RGB = [number, number, number]
const mix = (a: RGB, b: RGB, t: number): RGB => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t,
]
const smoothstep = (t: number) => t * t * (3 - 2 * t)

// ---------------------------------------------------------------------------
type Hill = { cx: number; w: number; h: number }
type Flower = { x: number; y: number; size: number; form: number; trueHue: number; trueLum: number }
type Scene = {
	groundY: number
	sun: { x: number; y: number; r: number; rays: boolean }
	hills: Hill[]
	flowers: Flower[]
	skyC: [number, number]
	sunC: [number, number]
	landC: [number, number]
	flowerC: [number, number]
}

function drawScene(seed: number): Scene {
	const rnd = makePRNG(seed)
	const groundY = 0.6 + rnd() * 0.07
	const sun = {
		x: 0.18 + rnd() * 0.64,
		y: 0.16 + rnd() * 0.18,
		r: 0.045 + rnd() * 0.03,
		rays: rnd() < 0.5,
	}
	const hillCount = 2 + Math.floor(rnd() * 3)
	const hills: Hill[] = []
	for (let i = 0; i < hillCount; i++)
		hills.push({ cx: 0.05 + rnd() * 0.9, w: 0.2 + rnd() * 0.32, h: 0.07 + rnd() * 0.15 })
	hills.sort((a, b) => b.h - a.h)

	const flowerHues = [15, 1, 13, 3, 15]
	const flowers: Flower[] = []
	const flowerCount = 14 + Math.floor(rnd() * 9)
	for (let i = 0; i < flowerCount; i++)
		flowers.push({
			x: 0.03 + rnd() * 0.94,
			y: groundY + 0.04 + rnd() * (0.94 - groundY - 0.04),
			size: 1 + Math.floor(rnd() * 2),
			form: Math.floor(rnd() * 3),
			trueHue: flowerHues[Math.floor(rnd() * flowerHues.length)],
			trueLum: 8 + 2 * Math.floor(rnd() * 3),
		})

	const skyC: [number, number] = [5 + Math.floor(rnd() * 2), 8]
	const sunC: [number, number] = [13, 12]
	const landC: [number, number] = rnd() < 0.7 ? [9, 6] : [12, 6]
	const flowerC: [number, number] = [15, 10]
	return { groundY, sun, hills, flowers, skyC, sunC, landC, flowerC }
}

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

function frontmostHill(scene: Scene, x: number, y: number): number {
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
// Register A — noon on the machine
// ---------------------------------------------------------------------------
function renderAtari(scene: Scene, rays: boolean): Uint8Array {
	const buf = new Uint8Array(AW * AH)
	const px = (ax: number, ay: number, c: number) => {
		if (ax >= 0 && ax < AW && ay >= 0 && ay < AH) buf[ay * AW + ax] = c
	}
	const scx = Math.round(scene.sun.x * AW)
	const scy = Math.round(scene.sun.y * AH)
	const sr = Math.max(3, Math.round(scene.sun.r * AW))
	for (let ay = scy - sr - 2; ay <= scy + sr + 2; ay++)
		for (let ax = scx - sr - 2; ax <= scx + sr + 2; ax++) {
			const dx = ax - scx
			const dy = (ay - scy) * (CH / CW)
			if (dx * dx + dy * dy <= sr * sr) px(ax, ay, 1)
		}
	if (rays)
		for (let k = 0; k < 8; k++) {
			const a = (k * Math.PI) / 4
			for (let t = sr + 2; t <= sr + 4; t++)
				px(Math.round(scx + Math.cos(a) * t), Math.round(scy + Math.sin(a) * t * (CW / CH)), 1)
		}

	for (let ay = 0; ay < AH; ay++)
		for (let ax = 0; ax < AW; ax++) {
			const x = (ax + 0.5) / AW
			const y = (ay + 0.5) / AH
			if (y >= landSurface(scene, x)) px(ax, ay, 2)
		}

	for (const f of scene.flowers) {
		const fx = Math.round(f.x * AW)
		const fy = Math.round(f.y * AH)
		const s = f.size
		if (f.form === 0) {
			for (let d = -s; d <= s; d++) {
				px(fx + d, fy, 3)
				px(fx, fy + d, 3)
			}
		} else if (f.form === 1) {
			px(fx, fy, 3)
			px(fx - s, fy - s, 3)
			px(fx + s, fy - s, 3)
			px(fx - s, fy + s, 3)
			px(fx + s, fy + s, 3)
		} else {
			for (let d = 0; d <= s; d++) for (let dx = -d; dx <= d; dx++) px(fx + dx, fy - s + d, 3)
		}
	}
	return buf
}

// ---------------------------------------------------------------------------
// Register B — dusk, with the memory's light spilling from the window
// ---------------------------------------------------------------------------
type WinPx = { x0: number; y0: number; x1: number; y1: number }

// Warm noon daylight leaking from the window into the dusk.
// Rim: tight glow hugging the whole frame. Pool: a wide cone of light on the
// ground below, spreading as it falls. Returns 0..1.
function memoryLight(win: WinPx, px: number, py: number, spill: number): number {
	const dx = Math.max(win.x0 - px, 0, px - win.x1)
	const dyTop = Math.max(win.y0 - py, 0)
	const dyBot = Math.max(py - win.y1, 0)
	const dRim = Math.hypot(dx, Math.max(dyTop, dyBot))
	const rim = Math.exp(-dRim / 70) * 0.55

	let pool = 0
	const fall = py - win.y1
	if (fall > -70) {
		// the light widens as it falls — a cone opening downward
		const spread = Math.max(0, dx - Math.max(0, fall) * 0.38)
		const d = Math.hypot(spread, Math.max(0, fall) * 0.62)
		// ease in around the window's bottom edge — no hard seam
		const easeIn = smoothstep(Math.max(0, Math.min(1, (fall + 70) / 140)))
		pool = Math.exp(-d / (240 * spill)) * easeIn
	}
	return Math.min(1, Math.max(rim, pool) * spill)
}

function renderDusk(scene: Scene, seed: number, stars: boolean, win: WinPx, spill: number): Float32Array {
	const out = new Float32Array(W * H * 3)
	const fbmGround = makeNoise(seed * 7 + 2, 110)
	const fbmSky = makeNoise(seed * 7 + 3, 700)
	const grain = makePRNG(seed * 17 + 9)

	const skyTop: RGB = [62, 58, 96]
	const skyMid: RGB = [128, 92, 104]
	const horizon: RGB = [236, 158, 88]
	const glowC: RGB = [255, 176, 92]
	const landDusk: RGB = (() => {
		const base = atariRGB(scene.landC[0], 3) as RGB
		return mix(base, [58, 48, 34], 0.45) // v5: lifted out of the mud (was 0.55)
	})()
	// what the memory's light reveals: the grass as noon knew it, softened
	const landLit: RGB = mix(atariRGB(scene.landC[0], 6) as RGB, [255, 236, 190], 0.18)
	const warmLeak: RGB = [255, 232, 178]

	const grainBuf = new Float32Array(W * H)
	for (let i = 0; i < W * H; i++) grainBuf[i] = (grain() - 0.5) * 9

	for (let py = 0; py < H; py++) {
		const y = (py + 0.5) / H
		for (let pxi = 0; pxi < W; pxi++) {
			const x = (pxi + 0.5) / W
			let c: RGB

			const surfY = landSurface(scene, x)
			const onLand = y >= surfY

			if (!onLand) {
				const t = Math.min(1, y / scene.groundY)
				c = t < 0.55 ? mix(skyTop, skyMid, smoothstep(t / 0.55)) : mix(skyMid, horizon, smoothstep((t - 0.55) / 0.45))
				const wisp = fbmSky(pxi, py) * 7
				c = [c[0] + wisp, c[1] + wisp * 0.7, c[2] + wisp * 0.5]
			} else {
				const hillIdx = y < scene.groundY ? frontmostHill(scene, x, y) : -2
				if (hillIdx >= 0) {
					const depth = 1 - (hillIdx + 1) / (scene.hills.length + 1)
					const sil = mix(landDusk, [30, 26, 38], 0.35 * (1 - depth))
					c = mix(sil, horizon, depth * 0.5)
				} else {
					const d = (y - scene.groundY) / (1 - scene.groundY)
					const n = fbmGround(pxi, py) * 9
					c = [landDusk[0] + n, landDusk[1] + n, landDusk[2] + n * 0.6]
					c = mix(c, [c[0] * 0.55, c[1] * 0.58, c[2] * 0.62], smoothstep(Math.min(1, d)) * 0.45)
				}
			}

			// afterglow at the horizon, below where the sun used to be
			const gx = (x - scene.sun.x) / 0.3
			const gy = (y - scene.groundY) / 0.13
			const glow = Math.exp(-(gx * gx + gy * gy))
			const gAmt = onLand && y >= scene.groundY ? glow * 0.1 : glow * 0.5
			c = [c[0] + glowC[0] * gAmt, c[1] + glowC[1] * gAmt, c[2] + glowC[2] * gAmt * 0.7]

			// the memory's light — noon spilling out of the window
			const ml = memoryLight(win, pxi, py, spill)
			if (ml > 0.004) {
				if (onLand && y >= scene.groundY) {
					// the pool: grass remembers its noon colour where the light lands
					c = mix(c, landLit, ml * 0.75)
				} else {
					// rim leak into sky / hills — soft warm halo
					c = [c[0] + warmLeak[0] * ml * 0.35, c[1] + warmLeak[1] * ml * 0.35, c[2] + warmLeak[2] * ml * 0.3]
				}
			}

			// grain + vignette
			const g = grainBuf[py * W + pxi]
			const vx = (x - 0.5) * 2
			const vy = (y - 0.5) * 2
			const vig = 1 - 0.14 * smoothstep(Math.min(1, (vx * vx + vy * vy) / 1.6))
			c = [(c[0] + g) * vig, (c[1] + g) * vig, (c[2] + g) * vig]

			const o = (py * W + pxi) * 3
			out[o] = c[0]
			out[o + 1] = c[1]
			out[o + 2] = c[2]
		}
	}

	if (stars) {
		const srnd = makePRNG(seed * 23 + 3)
		for (let i = 0; i < 16; i++) {
			const sx = Math.floor(srnd() * W)
			const sy = Math.floor(srnd() * srnd() * H * 0.34)
			const bright = 45 + srnd() * 70
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++) {
					const xx = sx + dx
					const yy = sy + dy
					if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
					const a = dx === 0 && dy === 0 ? 1 : 0.3
					const o = (yy * W + xx) * 3
					out[o] += bright * a
					out[o + 1] += bright * a
					out[o + 2] += bright * a * 0.95
				}
		}
	}

	// flowers at dusk — those standing in the memory's light stay open and
	// keep their true colours; the rest dim, some closed for the night
	const rnd = makePRNG(seed * 13 + 5)
	for (const f of scene.flowers) {
		const fx = f.x * W
		const fy = f.y * H
		const lightHere = memoryLight(win, fx, fy, spill)
		const closed = rnd() < 0.4 * (1 - lightHere) // the lit ones don't close
		if (closed) {
			const depth = (f.y - scene.groundY) / (1 - scene.groundY)
			const size = f.size * CW * (0.5 + depth * 0.9)
			const stemH = size * 2.6
			const budCol: RGB = mix(atariRGB(f.trueHue, 6) as RGB, [34, 32, 26], 0.5)
			const stemCol: RGB = [34, 36, 27]
			for (let t = 0; t < stemH; t++) {
				const droop = (t / stemH) ** 2 * size * 0.9
				const sx = Math.round(fx + droop)
				const sy = Math.round(fy + t)
				if (sx >= 1 && sx < W - 1 && sy >= 0 && sy < H)
					for (let dx = 0; dx <= 1; dx++) {
						const o = (sy * W + sx + dx) * 3
						const a = 0.6
						out[o] = out[o] * (1 - a) + stemCol[0] * a
						out[o + 1] = out[o + 1] * (1 - a) + stemCol[1] * a
						out[o + 2] = out[o + 2] * (1 - a) + stemCol[2] * a
					}
			}
			const br = size * 0.42
			for (let yy = Math.floor(fy - br); yy <= fy + br * 1.4; yy++)
				for (let xx = Math.floor(fx - br); xx <= fx + br; xx++) {
					if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
					const dd = Math.sqrt(((xx - fx) / br) ** 2 + ((yy - fy) / (br * 1.3)) ** 2)
					if (dd > 1) continue
					const a = Math.min(1, (1 - dd) * 2.5) * 0.85
					const o = (yy * W + xx) * 3
					out[o] = out[o] * (1 - a) + budCol[0] * a
					out[o + 1] = out[o + 1] * (1 - a) + budCol[1] * a
					out[o + 2] = out[o + 2] * (1 - a) + budCol[2] * a
				}
			continue
		}
		const depth = (f.y - scene.groundY) / (1 - scene.groundY)
		const size = f.size * CW * (0.6 + depth * 1.7)
		const trueC = atariRGB(f.trueHue, f.trueLum) as RGB
		const duskCol = mix([trueC[0] * 0.88, trueC[1] * 0.78, trueC[2] * 0.78], [255, 195, 135], 0.14)
		// in the memory's light the flower is fully itself — noon colour at dusk
		const litCol = mix(trueC, [255, 240, 200], 0.1)
		const col = mix(duskCol, litCol, lightHere)
		const stemCol: RGB = [38, 40, 30]
		const stemH = size * 2.4
		for (let t = 0; t < stemH; t++) {
			const sx = Math.round(fx + Math.sin(t * 0.06 + f.x * 30) * 1.4)
			const sy = Math.round(fy + t)
			if (sx >= 1 && sx < W - 1 && sy >= 0 && sy < H) {
				for (let dx = 0; dx <= 1; dx++) {
					const o = (sy * W + sx + dx) * 3
					const a = 0.65 * (1 - (t / stemH) * 0.6)
					out[o] = out[o] * (1 - a) + stemCol[0] * a
					out[o + 1] = out[o + 1] * (1 - a) + stemCol[1] * a
					out[o + 2] = out[o + 2] * (1 - a) + stemCol[2] * a
				}
			}
		}
		const dabs = 4 + Math.floor(rnd() * 3)
		for (let d = 0; d < dabs; d++) {
			const ang = (d / dabs) * Math.PI * 2 + rnd() * 0.8
			const ddist = f.form === 2 ? rnd() * size * 0.35 : size * 0.5
			const cx = fx + Math.cos(ang) * ddist
			const cy = fy + Math.sin(ang) * ddist * 0.75
			const dr = size * (0.4 + rnd() * 0.2)
			for (let yy = Math.floor(cy - dr); yy <= cy + dr; yy++)
				for (let xx = Math.floor(cx - dr); xx <= cx + dr; xx++) {
					if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue
					const dd = Math.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / dr
					if (dd > 1) continue
					const a = Math.min(1, (1 - dd) * 2.2) * 0.92
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
function composite(
	scene: Scene,
	atari: Uint8Array,
	dusk: Float32Array,
	win: { ax0: number; ay0: number; aw: number; ah: number },
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

	for (let py = 0; py < H; py++)
		for (let pxi = 0; pxi < W; pxi++) {
			const o = (py * W + pxi) * 4
			let c: RGB
			if (pxi >= x0 && pxi < x1 && py >= y0 && py < y1) {
				c = pal[atari[Math.floor(py / CH) * AW + Math.floor(pxi / CW)]]
			} else {
				const s = (py * W + pxi) * 3
				c = [dusk[s], dusk[s + 1], dusk[s + 2]]
			}
			img.data[o] = Math.max(0, Math.min(255, c[0]))
			img.data[o + 1] = Math.max(0, Math.min(255, c[1]))
			img.data[o + 2] = Math.max(0, Math.min(255, c[2]))
			img.data[o + 3] = 255
		}
	ctx.putImageData(img, 0, 0)
	writeFileSync(outPath, canvas.toBuffer("image/png"))
	console.log(`wrote ${outPath}`)
}

mkdirSync("output", { recursive: true })
const scene = drawScene(707)
const winA = { ax0: 54, ay0: 26, aw: 75, ah: 45 }
const winPx: WinPx = { x0: winA.ax0 * CW, y0: winA.ay0 * CH, x1: (winA.ax0 + winA.aw) * CW, y1: (winA.ay0 + winA.ah) * CH }

// v5d: tightened cone (eased-in pool, narrower spread), no rays
composite(scene, renderAtari(scene, false), renderDusk(scene, 707, true, winPx, 1.0), winA, "output/cp-v5d-cone.png")
