import { createCanvas, loadImage } from "canvas"
import type { FoodPlacementStrategy } from "#types/physarum.ts"

export type FoodImageData = {
	readonly width: number
	readonly height: number
	readonly luminance: Float32Array
	readonly r: Float32Array
	readonly g: Float32Array
	readonly b: Float32Array
}

type Rng = () => number

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

const generateClusters = (
	rng: Rng,
	w: number,
	h: number,
	density: number,
	clusterCount: number,
): Float32Array => {
	const map = new Float32Array(w * h)
	const minRadius = Math.min(w, h) * 0.02
	const maxRadius = Math.min(w, h) * 0.1

	for (let c = 0; c < clusterCount; c++) {
		const cx = rng() * w
		const cy = rng() * h
		const radius = minRadius + rng() * (maxRadius - minRadius)
		const invR2 = 1 / (radius * radius)
		const strength = 0.5 + rng() * 0.5

		const x0 = Math.max(0, Math.floor(cx - radius * 3))
		const x1 = Math.min(w - 1, Math.ceil(cx + radius * 3))
		const y0 = Math.max(0, Math.floor(cy - radius * 3))
		const y1 = Math.min(h - 1, Math.ceil(cy + radius * 3))

		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx
				const dy = y - cy
				const d2 = dx * dx + dy * dy
				map[y * w + x] += strength * Math.exp(-d2 * invR2) * density
			}
		}
	}

	// Clamp to [0, 1]
	for (let i = 0; i < map.length; i++) map[i] = clamp01(map[i])
	return map
}

const generateRings = (rng: Rng, w: number, h: number, density: number): Float32Array => {
	const map = new Float32Array(w * h)
	const cx = w * (0.3 + rng() * 0.4)
	const cy = h * (0.3 + rng() * 0.4)
	const ringCount = 3 + Math.floor(rng() * 4)
	const maxR = Math.min(w, h) * 0.45

	for (let r = 0; r < ringCount; r++) {
		const radius = maxR * ((r + 1) / ringCount)
		const thickness = maxR * (0.02 + rng() * 0.04)
		const invT2 = 1 / (thickness * thickness)

		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const dx = x - cx
				const dy = y - cy
				const dist = Math.sqrt(dx * dx + dy * dy)
				const diff = dist - radius
				map[y * w + x] += Math.exp(-diff * diff * invT2) * density
			}
		}
	}

	for (let i = 0; i < map.length; i++) map[i] = clamp01(map[i])
	return map
}

const generateGradient = (rng: Rng, w: number, h: number, density: number): Float32Array => {
	const map = new Float32Array(w * h)
	const angle = rng() * Math.PI * 2
	const cos = Math.cos(angle)
	const sin = Math.sin(angle)
	const diag = Math.sqrt(w * w + h * h)

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const proj = (x * cos + y * sin) / diag
			map[y * w + x] = clamp01(proj * density)
		}
	}

	return map
}

const generateGrid = (rng: Rng, w: number, h: number, density: number): Float32Array => {
	const map = new Float32Array(w * h)
	const cols = 3 + Math.floor(rng() * 4)
	const rows = 3 + Math.floor(rng() * 4)
	const radius = Math.min(w, h) * (0.02 + rng() * 0.03)
	const invR2 = 1 / (radius * radius)

	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const cx = (w / (cols + 1)) * (c + 1) + (rng() - 0.5) * (w / cols) * 0.3
			const cy = (h / (rows + 1)) * (r + 1) + (rng() - 0.5) * (h / rows) * 0.3

			const x0 = Math.max(0, Math.floor(cx - radius * 3))
			const x1 = Math.min(w - 1, Math.ceil(cx + radius * 3))
			const y0 = Math.max(0, Math.floor(cy - radius * 3))
			const y1 = Math.min(h - 1, Math.ceil(cy + radius * 3))

			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					const dx = x - cx
					const dy = y - cy
					const d2 = dx * dx + dy * dy
					map[y * w + x] += Math.exp(-d2 * invR2) * density
				}
			}
		}
	}

	for (let i = 0; i < map.length; i++) map[i] = clamp01(map[i])
	return map
}

const STRATEGIES: Record<
	Exclude<FoodPlacementStrategy, "mixed" | "image">,
	(rng: Rng, w: number, h: number, density: number, clusterCount: number) => Float32Array
> = {
	clusters: (rng, w, h, density, clusterCount) =>
		generateClusters(rng, w, h, density, clusterCount),
	rings: (rng, w, h, density) => generateRings(rng, w, h, density),
	gradient: (rng, w, h, density) => generateGradient(rng, w, h, density),
	grid: (rng, w, h, density) => generateGrid(rng, w, h, density),
}

const STRATEGY_NAMES = Object.keys(STRATEGIES) as Exclude<
	FoodPlacementStrategy,
	"mixed" | "image"
>[]

export const generateFoodMap = (
	rng: Rng,
	w: number,
	h: number,
	strategy: FoodPlacementStrategy,
	density: number,
	clusterCount: number,
): Float32Array => {
	if (strategy !== "mixed" && strategy !== "image") {
		return STRATEGIES[strategy](rng, w, h, density, clusterCount)
	}

	if (strategy === "image") {
		throw new Error("Image food strategy requires a preloaded food map")
	}

	// Mixed: combine 2-3 random strategies
	const count = 2 + (rng() > 0.5 ? 1 : 0)
	const picked: Exclude<FoodPlacementStrategy, "mixed" | "image">[] = []
	const available = [...STRATEGY_NAMES]

	for (let i = 0; i < count && available.length > 0; i++) {
		const idx = Math.floor(rng() * available.length)
		picked.push(available[idx])
		available.splice(idx, 1)
	}

	const size = w * h
	const combined = new Float32Array(size)

	for (const strat of picked) {
		const layer = STRATEGIES[strat](rng, w, h, density, clusterCount)
		for (let i = 0; i < size; i++) {
			combined[i] += layer[i] / picked.length
		}
	}

	for (let i = 0; i < size; i++) combined[i] = clamp01(combined[i])
	return combined
}

export const loadFoodImage = async (
	source: string | Buffer,
	maxSide?: number,
): Promise<FoodImageData> => {
	const img = await loadImage(source)
	let w = img.width
	let h = img.height
	if (maxSide) {
		const scale = maxSide / Math.max(w, h)
		w = Math.round(w * scale)
		h = Math.round(h * scale)
	}
	const canvas = createCanvas(w, h)
	const ctx = canvas.getContext("2d")
	ctx.drawImage(img, 0, 0, w, h)
	const { data } = ctx.getImageData(0, 0, w, h)

	const n = w * h
	const luminance = new Float32Array(n)
	const r = new Float32Array(n)
	const g = new Float32Array(n)
	const b = new Float32Array(n)
	for (let i = 0; i < n; i++) {
		const off = i * 4
		const rv = data[off] / 255
		const gv = data[off + 1] / 255
		const bv = data[off + 2] / 255
		r[i] = rv
		g[i] = gv
		b[i] = bv
		luminance[i] = 0.299 * rv + 0.587 * gv + 0.114 * bv
	}
	return { width: w, height: h, luminance, r, g, b }
}
