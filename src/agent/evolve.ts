import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, normalize } from "node:path"
import { type ChangeProposal, runReflection } from "#agent/reflect.ts"
import type { EngagementData, ReflectionRecord } from "#types/evolution.ts"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, err, ok } from "#types/result.ts"

export type FileBackup = {
	readonly path: string
	readonly originalContent: string | null // null = file was newly created
}

export type ReflectionOutcome = {
	readonly record: ReflectionRecord
	readonly applied: boolean
	readonly committed: boolean
	readonly reasoning: string
}

const PROTECTED_FILES = new Set([".env", ".env.example", "bun.lock"])
const PROTECTED_PREFIXES = [".git/", ".git\\", "node_modules/", "node_modules\\"]

export const validateChangePaths = (changes: ReadonlyArray<ChangeProposal>): Result<void> => {
	for (const change of changes) {
		const p = change.file
		if (isAbsolute(p)) {
			return err(`Absolute path rejected: ${p}`)
		}
		const normalized = normalize(p)
		if (normalized.startsWith("..") || normalized.includes("/..") || normalized.includes("\\..")) {
			return err(`Path traversal rejected: ${p}`)
		}
		if (PROTECTED_FILES.has(normalized)) {
			return err(`Protected file rejected: ${p}`)
		}
		if (PROTECTED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
			return err(`Protected directory rejected: ${p}`)
		}
	}
	return ok(undefined)
}

export const applyChanges = (
	changes: ReadonlyArray<ChangeProposal>,
	projectRoot: string,
): Result<FileBackup[]> => {
	const backups: FileBackup[] = []

	for (const change of changes) {
		const fullPath = join(projectRoot, change.file)

		if (change.action === "delete") {
			if (existsSync(fullPath)) {
				backups.push({ path: change.file, originalContent: readFileSync(fullPath, "utf-8") })
				unlinkSync(fullPath)
			}
		} else if (change.action === "edit") {
			if (existsSync(fullPath)) {
				backups.push({ path: change.file, originalContent: readFileSync(fullPath, "utf-8") })
			} else {
				backups.push({ path: change.file, originalContent: null })
			}
			mkdirSync(dirname(fullPath), { recursive: true })
			writeFileSync(fullPath, change.content)
		} else if (change.action === "create") {
			backups.push({
				path: change.file,
				originalContent: existsSync(fullPath) ? readFileSync(fullPath, "utf-8") : null,
			})
			mkdirSync(dirname(fullPath), { recursive: true })
			writeFileSync(fullPath, change.content)
		}
	}

	return ok(backups)
}

export const revertChanges = (backups: ReadonlyArray<FileBackup>, projectRoot: string): void => {
	for (const backup of backups) {
		const fullPath = join(projectRoot, backup.path)
		try {
			if (backup.originalContent === null) {
				// File was newly created — remove it
				if (existsSync(fullPath)) unlinkSync(fullPath)
			} else {
				// Restore original content
				writeFileSync(fullPath, backup.originalContent)
			}
		} catch {
			// Best-effort revert — log but don't throw
			console.error(`warning: failed to revert ${backup.path}`)
		}
	}
}

export const selfTest = async (projectRoot: string): Promise<Result<void>> => {
	const proc = Bun.spawn(["bun", "run", "build"], {
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "pipe",
	})

	const exitCode = await proc.exited

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text()
		return err(`Build failed (exit ${exitCode}): ${stderr.slice(0, 500)}`)
	}

	return ok(undefined)
}

export const gitCommit = async (
	filePaths: ReadonlyArray<string>,
	reasoning: string,
	projectRoot: string,
): Promise<Result<string>> => {
	// Stage files
	const addProc = Bun.spawn(["git", "add", ...filePaths], {
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "pipe",
	})
	const addExit = await addProc.exited
	if (addExit !== 0) {
		const stderr = await new Response(addProc.stderr).text()
		return err(`git add failed: ${stderr.slice(0, 300)}`)
	}

	// Commit
	const summary = reasoning.length > 72 ? `${reasoning.slice(0, 69)}...` : reasoning
	const message = `reflect: ${summary}`
	const commitProc = Bun.spawn(["git", "commit", "-m", message], {
		cwd: projectRoot,
		stdout: "pipe",
		stderr: "pipe",
	})
	const commitExit = await commitProc.exited
	if (commitExit !== 0) {
		const stderr = await new Response(commitProc.stderr).text()
		return err(`git commit failed: ${stderr.slice(0, 300)}`)
	}

	const stdout = await new Response(commitProc.stdout).text()
	return ok(stdout.trim())
}

export const executeReflection = async (
	apiKey: string,
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<ReflectionOutcome>> => {
	// Call Claude for reflection
	const reflectionResult = await runReflection(apiKey, state, engagement, projectRoot)
	if (!reflectionResult.ok) return reflectionResult

	const { reasoning, changes } = reflectionResult.value

	// Build the base record
	const latestWithGenome = [...state.history].reverse().find((h) => h.genome !== null)

	const record: ReflectionRecord = {
		edition: state.lastEdition,
		genome: latestWithGenome?.genome ?? ({} as ReflectionRecord["genome"]),
		engagement: engagement[engagement.length - 1] ?? {
			edition: state.lastEdition,
			castHash: "",
			likes: 0,
			recasts: 0,
			replies: 0,
			ageHours: 0,
		},
		changes: changes.map((c) => c.file),
		reasoning,
	}

	// No changes proposed
	if (changes.length === 0) {
		console.log("Reflection proposed no changes.")
		return ok({ record, applied: false, committed: false, reasoning })
	}

	// Validate paths
	const pathResult = validateChangePaths(changes)
	if (!pathResult.ok) return pathResult as Result<never>

	// Apply changes
	const applyResult = applyChanges(changes, projectRoot)
	if (!applyResult.ok) return applyResult as Result<never>
	const backups = applyResult.value

	// Self-test
	const testResult = await selfTest(projectRoot)
	if (!testResult.ok) {
		console.error(`Self-test failed: ${testResult.error}`)
		console.log("Reverting changes...")
		revertChanges(backups, projectRoot)
		const revertedRecord: ReflectionRecord = {
			...record,
			changes: [],
			reasoning: `[REVERTED] ${reasoning}`,
		}
		return ok({ record: revertedRecord, applied: false, committed: false, reasoning })
	}

	// Git commit
	const filePaths = changes.map((c) => c.file)
	const commitResult = await gitCommit(filePaths, reasoning, projectRoot)
	if (!commitResult.ok) {
		console.error(`Git commit failed: ${commitResult.error}`)
		return ok({ record, applied: true, committed: false, reasoning })
	}

	console.log(`Committed: ${commitResult.value}`)
	return ok({ record, applied: true, committed: true, reasoning })
}
