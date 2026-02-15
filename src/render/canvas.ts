import { createCanvas, type ImageData as CanvasImageData } from "canvas"
import { applyColormap } from "#engine/colormap.ts"
import type { ColormapName } from "#types/physarum.ts"
import { type Result, ok, err } from "#types/result.ts"

export const renderPng = (
	trailMap: Float32Array,
	width: number,
	height: number,
	colormap: ColormapName,
): Result<{ png: Buffer }> => {
	const rgba = applyColormap(trailMap, width, height, colormap)
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext("2d")
	const imageData = ctx.createImageData(width, height)
	imageData.data.set(rgba)
	ctx.putImageData(imageData as unknown as CanvasImageData, 0, 0)
	const png = canvas.toBuffer("image/png")
	return ok({ png })
}
