// Blind-viewer protocol runner (see STRATEGY.md, "Blind-viewer protocol").
//
// Asks Codex for a completely cold read of a single image. Blindness is
// structural, not requested: the image is copied under a neutral filename to
// an isolated directory outside the repository, and Codex runs with that
// directory as cwd. Running inside the repo would let it load AGENTS.md /
// CLAUDE.md (which describe the project) or see intent-laden filenames like
// "sadness-v17.png" — either would contaminate the read.
//
// Usage: bun run scripts/blind-read.ts <image-path>
// The verbatim response prints to stdout between BEGIN/END markers. Log it
// verbatim in the committed blind-read record before interpreting it.

import { copyFileSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join, resolve } from "node:path"

const imagePath = process.argv[2]
if (!imagePath) {
	console.error("usage: bun run scripts/blind-read.ts <image-path>")
	process.exit(1)
}

const src = resolve(imagePath)
const dir = mkdtempSync(join(tmpdir(), "blind-"))
const ext = extname(src).toLowerCase() || ".png"
const neutralName = `image${ext}`
copyFileSync(src, join(dir, neutralName))

const prompt = `You are being asked for a completely cold read of a single image. You have been given no context about it, and you must not seek any: do not open, list, or search for anything other than the image named below, and do not use the network.

View the image file ${neutralName} in the current directory and answer, in order:

1. DESCRIPTION: what do you see? Objects, composition, palette, structure. Be concrete.
2. FEELING: what, if anything, does it make you feel? "Nothing in particular" is an acceptable answer.
3. READING: what do you think it is about or trying to communicate, if anything?
4. SCROLL TEST: encountered in a social media feed with no caption, would it stop you? Why or why not?
5. VERDICT: is this a compelling image on its own terms — yes, no, or borderline?

Be honest and specific. Flattery is useless here; a polite false positive costs the person asking far more than a blunt no. Do not modify or create any files. Your entire reply should be the five answers.`

const resultPath = join(dir, "result.txt")
const proc = Bun.spawn(
	[
		"codex",
		"exec",
		"--dangerously-bypass-approvals-and-sandbox",
		"--dangerously-bypass-hook-trust",
		"--ephemeral",
		"-C",
		dir,
		"--output-last-message",
		resultPath,
		"-",
	],
	{ cwd: dir, stdin: Buffer.from(prompt), stdout: "ignore", stderr: "inherit" },
)
const exitCode = await proc.exited
if (exitCode !== 0) {
	console.error(`codex exited with code ${exitCode}`)
	process.exit(1)
}

let result: string
try {
	result = readFileSync(resultPath, "utf-8").trim()
} catch (error) {
	console.error(`codex completed without a result: ${String(error)}`)
	process.exit(1)
}

console.log(`--- BEGIN BLIND READ (${imagePath}) ---`)
console.log(result)
console.log("--- END BLIND READ ---")
