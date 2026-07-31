import { randomUUID } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { basename, extname, join, relative, resolve } from "node:path"
import { type Result, err, ok } from "#types/result.ts"

type ImageRequestArgs = {
	readonly promptFile: string
	readonly name: string
}

export const parseImageRequestArgs = (args: ReadonlyArray<string>): Result<ImageRequestArgs> => {
	let promptFile: string | undefined
	let name = "stigmergence-image"

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		const value = args[i + 1]
		if (arg === "--prompt-file" && value) {
			promptFile = value
			i++
		} else if (arg === "--name" && value) {
			name = value
			i++
		} else return err(`unknown or incomplete argument: ${arg}`)
	}

	if (!promptFile) return err("--prompt-file is required")
	if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(name)) {
		return err("--name must contain only letters, numbers, and hyphens")
	}
	return ok({ promptFile, name })
}

const listImages = (root: string): string[] => {
	const images: string[] = []
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		const path = join(root, entry.name)
		if (entry.isDirectory()) images.push(...listImages(path))
		else if ([".png", ".jpg", ".jpeg", ".webp"].includes(extname(entry.name).toLowerCase())) {
			images.push(path)
		}
	}
	return images
}

export const runCodexImageRequest = async (args: ImageRequestArgs): Promise<Result<string>> => {
	if (process.env.STIGMERGENCE_CODEX_IMAGEGEN_ENABLED !== "1") {
		return err("Codex image generation is not enabled by the current resource policy")
	}

	const projectRoot = realpathSync(join(import.meta.dirname, "../.."))
	let promptPath: string
	try {
		promptPath = realpathSync(resolve(projectRoot, args.promptFile))
	} catch (error) {
		return err(`failed to read image prompt path: ${String(error)}`)
	}
	const promptRelative = relative(projectRoot, promptPath)
	if (promptRelative.startsWith("..") || promptRelative === "") {
		return err("prompt file must be inside the Physarum project")
	}

	const prompt = readFileSync(promptPath, "utf-8").trim()
	if (!prompt) return err("image prompt is empty")

	const requestId = `${args.name}-${randomUUID()}`
	const requestDir = join(projectRoot, "runtime-private", "imagegen", requestId)
	mkdirSync(requestDir, { recursive: true, mode: 0o700 })
	chmodSync(requestDir, 0o700)
	const resultMessagePath = join(requestDir, "result.txt")

	const agentPrompt = `Use the installed imagegen skill and its built-in image generation tool.
Create one new bitmap image from the request below. This is a project-bound asset.
Inspect the result, then copy the selected final image into this working directory before finishing.
Do not edit source code, contact anyone, post, publish, upload project data, use wallet tools, or perform any task other than this image request.
Return the exact final image path in your last message.

Image request:
${prompt}`

	const proc = Bun.spawn(
		[
			"codex",
			"exec",
			"--sandbox",
			"workspace-write",
			"--ephemeral",
			"--ignore-rules",
			"--skip-git-repo-check",
			"-C",
			requestDir,
			"--output-last-message",
			resultMessagePath,
			"-",
		],
		{
			cwd: requestDir,
			stdin: Buffer.from(agentPrompt),
			stdout: "inherit",
			stderr: "inherit",
		},
	)
	const exitCode = await proc.exited
	if (exitCode !== 0) return err(`Codex image worker exited with code ${exitCode}`)

	const images = listImages(requestDir).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
	if (images.length === 0) {
		const resultMessage = readFileSync(resultMessagePath, "utf-8").trim()
		return err(
			`Codex completed without a project-local image${resultMessage ? `: ${resultMessage}` : ""}`,
		)
	}

	const finalPath = images[0]
	chmodSync(finalPath, 0o600)
	return ok(join("runtime-private", "imagegen", requestId, basename(finalPath)))
}

if (import.meta.main) {
	const parsed = parseImageRequestArgs(process.argv.slice(2))
	if (!parsed.ok) {
		console.error(`Image request error: ${parsed.error}`)
		process.exit(1)
	}
	const result = await runCodexImageRequest(parsed.value)
	if (!result.ok) {
		console.error(`Image request error: ${result.error}`)
		process.exit(1)
	}
	console.log(JSON.stringify({ imagePath: result.value }))
}
