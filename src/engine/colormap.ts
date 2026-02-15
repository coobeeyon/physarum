import type { ColormapName } from "#types/physarum.ts"

type LUT = ReadonlyArray<readonly [number, number, number]>

// 16-stop colormaps interpolated to 256 entries at runtime
const MAGMA_STOPS: LUT = [
	[0, 0, 4], [1, 0, 11], [4, 3, 30], [14, 8, 57],
	[32, 12, 86], [56, 15, 110], [82, 18, 124], [110, 27, 128],
	[139, 38, 125], [167, 51, 115], [192, 68, 99], [215, 90, 78],
	[233, 118, 56], [247, 152, 42], [254, 194, 58], [252, 253, 191],
]

const VIRIDIS_STOPS: LUT = [
	[68, 1, 84], [72, 20, 103], [71, 38, 117], [65, 55, 124],
	[57, 70, 125], [48, 84, 124], [40, 97, 120], [33, 110, 114],
	[28, 123, 106], [25, 136, 96], [32, 149, 83], [53, 161, 66],
	[86, 173, 44], [127, 183, 22], [177, 191, 10], [253, 231, 37],
]

const INFERNO_STOPS: LUT = [
	[0, 0, 4], [2, 1, 15], [10, 5, 40], [26, 10, 72],
	[49, 11, 99], [74, 12, 113], [101, 17, 115], [129, 27, 107],
	[156, 40, 91], [181, 56, 72], [203, 77, 50], [222, 103, 30],
	[237, 134, 14], [247, 170, 9], [250, 209, 33], [252, 255, 164],
]

const PLASMA_STOPS: LUT = [
	[13, 8, 135], [38, 6, 149], [63, 4, 156], [88, 1, 155],
	[110, 3, 148], [130, 15, 137], [148, 30, 123], [163, 47, 108],
	[177, 63, 92], [189, 79, 76], [200, 96, 60], [210, 114, 44],
	[220, 135, 27], [229, 160, 10], [237, 189, 4], [240, 249, 33],
]

const CIVIDIS_STOPS: LUT = [
	[0, 32, 77], [0, 42, 93], [0, 52, 105], [18, 63, 108],
	[46, 73, 106], [65, 83, 103], [82, 93, 100], [98, 103, 99],
	[114, 113, 98], [131, 124, 95], [149, 135, 88], [168, 146, 78],
	[187, 157, 63], [207, 170, 43], [228, 183, 15], [253, 232, 37],
]

const ALL_STOPS: Record<ColormapName, LUT> = {
	magma: MAGMA_STOPS,
	viridis: VIRIDIS_STOPS,
	inferno: INFERNO_STOPS,
	plasma: PLASMA_STOPS,
	cividis: CIVIDIS_STOPS,
}

const buildLut = (stops: LUT) => {
	const lut = new Uint8Array(256 * 3)
	const n = stops.length - 1
	for (let i = 0; i < 256; i++) {
		const t = i / 255
		const idx = Math.min(Math.floor(t * n), n - 1)
		const frac = t * n - idx
		const [r0, g0, b0] = stops[idx]
		const [r1, g1, b1] = stops[idx + 1]
		lut[i * 3] = Math.round(r0 + (r1 - r0) * frac)
		lut[i * 3 + 1] = Math.round(g0 + (g1 - g0) * frac)
		lut[i * 3 + 2] = Math.round(b0 + (b1 - b0) * frac)
	}
	return lut
}

const LUT_CACHE = new Map<ColormapName, Uint8Array>()

const getLut = (name: ColormapName) => {
	const cached = LUT_CACHE.get(name)
	if (cached) return cached
	const lut = buildLut(ALL_STOPS[name])
	LUT_CACHE.set(name, lut)
	return lut
}

/** Apply colormap to normalized [0,1] trail map, producing RGBA Uint8ClampedArray */
export const applyColormap = (
	trailMap: Float32Array,
	width: number,
	height: number,
	name: ColormapName,
) => {
	const lut = getLut(name)
	const size = width * height
	const rgba = new Uint8ClampedArray(size * 4)

	for (let i = 0; i < size; i++) {
		const idx = Math.min(Math.floor(trailMap[i] * 255), 255)
		const lutIdx = idx * 3
		const outIdx = i * 4
		rgba[outIdx] = lut[lutIdx]
		rgba[outIdx + 1] = lut[lutIdx + 1]
		rgba[outIdx + 2] = lut[lutIdx + 2]
		rgba[outIdx + 3] = 255
	}

	return rgba
}
