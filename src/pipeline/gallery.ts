import { execSync } from "node:child_process"
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { loadState } from "#pipeline/state.ts"
import type { Genome } from "#types/evolution.ts"
import type { HistoryEntry } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

const SITE_DIR = join(import.meta.dirname, "../../../stigmergence-site")
const OUTPUT_DIR = join(import.meta.dirname, "../../output")

/** Fallback params for pre-genome editions (1 & 2) */
const FALLBACK_PARAMS = {
	agents: "300,000",
	populations: "3",
	iterations: "300",
	resolution: "2048 \u00d7 2048",
	food: "mixed",
}

type EditionEntry = {
	readonly edition: number
	readonly seed: number
	readonly image: string
	readonly zora: string | null
	readonly params: {
		readonly agents: string
		readonly populations: string
		readonly iterations: string
		readonly resolution: string
		readonly food: string
	}
}

export type GalleryOptions = {
	readonly edition: number
	readonly seed: number
	readonly width: number
	readonly height: number
	readonly genome: Genome | null
	readonly contractAddress: string
	readonly tokenId: string
}

function formatParams(genome: Genome, width: number, height: number): EditionEntry["params"] {
	return {
		agents: genome.agentCount.toLocaleString(),
		populations: String(genome.populationCount),
		iterations: String(genome.iterations),
		resolution: `${width} \u00d7 ${height}`,
		food: genome.foodPlacement,
	}
}

function buildEntry(entry: HistoryEntry, contractAddress: string): EditionEntry {
	// Edition 1 was pre-Zora
	const zora =
		entry.edition === 1 ? null : `https://zora.co/collect/base:${contractAddress}/${entry.tokenId}`
	return {
		edition: entry.edition,
		seed: entry.seed,
		image: `img/stigmergence-${entry.edition}.webp`,
		zora,
		params: entry.genome ? formatParams(entry.genome, 2048, 2048) : { ...FALLBACK_PARAMS },
	}
}

function buildCurrentEntry(opts: GalleryOptions): EditionEntry {
	const zora = `https://zora.co/collect/base:${opts.contractAddress}/${opts.tokenId}`
	return {
		edition: opts.edition,
		seed: opts.seed,
		image: `img/stigmergence-${opts.edition}.webp`,
		zora,
		params: opts.genome
			? formatParams(opts.genome, opts.width, opts.height)
			: { ...FALLBACK_PARAMS },
	}
}

function generateScriptJs(entries: readonly EditionEntry[]): string {
	const editionsJs = entries
		.map((e) => {
			const paramsLines = Object.entries(e.params)
				.map(([k, v]) => `      ${k}: ${JSON.stringify(v)},`)
				.join("\n")
			return [
				"  {",
				`    edition: ${e.edition},`,
				`    seed: ${e.seed},`,
				`    image: ${JSON.stringify(e.image)},`,
				`    zora: ${e.zora ? JSON.stringify(e.zora) : "null"},`,
				"    params: {",
				paramsLines,
				"    },",
				"  }",
			].join("\n")
		})
		.join(",\n")

	// The renderGallery function uses JS template literals — build as an array of lines
	// to avoid nested template-literal escaping issues
	const renderFn = [
		"function renderGallery() {",
		'  const grid = document.getElementById("gallery");',
		"  if (!grid) return;",
		"",
		"  for (const ed of editions) {",
		'    const link = document.createElement(ed.zora ? "a" : "div");',
		'    link.className = "gallery-item";',
		"    if (ed.zora) {",
		"      link.href = ed.zora;",
		'      link.target = "_blank";',
		'      link.rel = "noopener";',
		"    }",
		"",
		"    const paramRows = Object.entries(ed.params)",
		'      .map(([k, v]) => `<div class="param"><span class="param-key">${k}</span><span class="param-val">${v}</span></div>`)',
		'      .join("");',
		"",
		"    link.innerHTML = `",
		"      <picture>",
		'        <source srcset="${ed.image}" type="image/webp">',
		'        <img src="${ed.image}" alt="stigmergence edition ${ed.edition}" loading="lazy">',
		"      </picture>",
		'      <div class="gallery-meta">',
		'        <span class="gallery-edition">#${ed.edition}</span>',
		'        <span class="gallery-seed">seed ${ed.seed}</span>',
		"      </div>",
		'      <div class="gallery-params">${paramRows}</div>',
		"    `;",
		"",
		"    grid.appendChild(link);",
		"  }",
		"}",
		"",
		"renderGallery();",
	].join("\n")

	return `const editions = [\n${editionsJs},\n];\n\n${renderFn}\n`
}

function updateHero(indexPath: string, latestEntry: EditionEntry): void {
	let html = readFileSync(indexPath, "utf-8")
	const n = latestEntry.edition
	const imgPath = `img/stigmergence-${n}.webp`
	const absoluteImg = `https://stigmergence.art/${imgPath}`

	// Update hero picture tag
	html = html.replace(
		/<section class="hero">\s*<picture>[\s\S]*?<\/picture>/,
		[
			'<section class="hero">',
			"    <picture>",
			`      <source srcset="${imgPath}" type="image/webp">`,
			`      <img src="${imgPath}" alt="stigmergence edition ${n}" class="hero-img">`,
			"    </picture>",
		].join("\n"),
	)

	// Update hero CTA link
	if (latestEntry.zora) {
		html = html.replace(
			/<a class="hero-cta"[^>]*>[^<]*<\/a>/,
			`<a class="hero-cta" href="${latestEntry.zora}" target="_blank" rel="noopener">collect #${n}</a>`,
		)
	}

	// Update og:image and twitter:image meta tags to latest edition
	html = html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${absoluteImg}$2`)
	html = html.replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${absoluteImg}$2`)

	writeFileSync(indexPath, html)
}

/**
 * Update the stigmergence.art gallery.
 * If `current` is provided, it's added as the latest edition (pipeline mode).
 * If omitted, all data comes from state.json (backfill mode).
 */
export async function updateGallery(current?: GalleryOptions): Promise<Result<void>> {
	const stateResult = loadState()
	if (!stateResult.ok) return stateResult
	const state = stateResult.value

	const contractAddress = current?.contractAddress ?? state.contractAddress
	if (!contractAddress) {
		return err("No contract address in state")
	}

	console.log("updating gallery...")

	// Stub webps are committed as placeholders (< 1000 bytes). Replace them when the real PNG is available.
	const needsConversion = (webpPath: string): boolean =>
		!existsSync(webpPath) || statSync(webpPath).size < 1000

	// 1. Convert PNGs → WebP for all historical editions
	for (const h of state.history) {
		const pngPath = join(OUTPUT_DIR, `stigmergence-${h.edition}.png`)
		const webpPath = join(SITE_DIR, "img", `stigmergence-${h.edition}.webp`)
		if (existsSync(pngPath) && needsConversion(webpPath)) {
			console.log(`  converting edition ${h.edition} to webp...`)
			await sharp(pngPath).webp({ quality: 85 }).toFile(webpPath)
		}
	}

	// Convert current edition's PNG if provided
	if (current) {
		const pngPath = join(OUTPUT_DIR, `stigmergence-${current.edition}.png`)
		const webpPath = join(SITE_DIR, "img", `stigmergence-${current.edition}.webp`)
		if (existsSync(pngPath)) {
			console.log(`  converting edition ${current.edition} to webp...`)
			await sharp(pngPath).webp({ quality: 85 }).toFile(webpPath)
		}
	}

	// 2. Build edition entries (newest first)
	const historicalEntries = state.history.map((h) => buildEntry(h, contractAddress))
	const entries = current
		? [buildCurrentEntry(current), ...historicalEntries]
		: [...historicalEntries]
	entries.sort((a, b) => b.edition - a.edition)

	if (entries.length === 0) {
		return err("No editions to display")
	}

	// 3. Generate script.js
	const scriptPath = join(SITE_DIR, "script.js")
	writeFileSync(scriptPath, generateScriptJs(entries))
	console.log(`  wrote script.js (${entries.length} editions)`)

	// 4. Update hero to latest edition (image, CTA, og/twitter meta tags)
	const latestEntry = entries[0]
	const indexPath = join(SITE_DIR, "index.html")
	updateHero(indexPath, latestEntry)
	console.log(`  updated hero to edition ${latestEntry.edition}`)

	// 5. Git commit + push
	try {
		execSync("git add img/ script.js index.html", { cwd: SITE_DIR, stdio: "pipe" })
		execSync(`git commit -m "gallery: update through edition ${latestEntry.edition}"`, {
			cwd: SITE_DIR,
			stdio: "pipe",
		})
		execSync("git push", { cwd: SITE_DIR, stdio: "pipe" })
		console.log("  pushed to GitHub")
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		if (!msg.includes("nothing to commit")) {
			return err(`gallery git: ${msg}`)
		}
		console.log("  no changes to commit")
	}

	return ok(undefined)
}
