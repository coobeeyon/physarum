import { type ImageData as CanvasImageData, createCanvas } from "canvas"
import { applyColorTrail, applyColormap, applyMultiPopulationColors } from "#engine/colormap.ts"
import type { ColormapName, FoodImageData, SimulationResult } from "#types/physarum.ts"
import { type Result, ok } from "#types/result.ts"

export const renderPng = (
	result: SimulationResult,
	colormap?: ColormapName,
	foodImageRgb?: FoodImageData,
): Result<{ png: Buffer }> => {
	const {
		trailMaps,
		populations,
		populationCount,
		width,
		height,
		colorTrailR,
		colorTrailG,
		colorTrailB,
	} = result

	// When foodImageRgb is provided AND we have color trails, use image-derived colors.
	// When foodImageRgb is not passed to the renderer (even if the simulation used it),
	// fall through to population coloring or colormap — this lets image-food simulations
	// be rendered with standard colormaps for better visibility of connecting trails.
	const useColorTrails = foodImageRgb && colorTrailR && colorTrailG && colorTrailB
	const rgba = useColorTrails
		? applyColorTrail(colorTrailR, colorTrailG, colorTrailB, width, height, foodImageRgb)
		: populationCount > 1
			? applyMultiPopulationColors(trailMaps, populations, width, height)
			: applyColormap(trailMaps[0], width, height, colormap ?? "magma")

	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext("2d")
	const imageData = ctx.createImageData(width, height)
	imageData.data.set(rgba)
	ctx.putImageData(imageData as unknown as CanvasImageData, 0, 0)
	const png = canvas.toBuffer("image/png")
	return ok({ png })
}
