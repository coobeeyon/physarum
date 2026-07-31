import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Result, err, ok } from "#types/result.ts"

export type LiveOperation =
	| "upload-image"
	| "upload-metadata"
	| "upload-imgur"
	| "mint"
	| "post-primary"
	| "post-self-reply"
	| "post-zora"
	| "engage"
	| "update-gallery"
	| "save-state"

export type LiveRunResults = {
	readonly imageCid?: string
	readonly metadataCid?: string
	readonly imgurUrl?: string
	readonly imgurFailed?: boolean
	readonly contractAddress?: string
	readonly tokenId?: string
	readonly txHash?: string
	readonly castHash?: string
	readonly selfReplyHash?: string
	readonly selfReplySkipped?: boolean
	readonly zoraCastHash?: string
	readonly zoraPostSkipped?: boolean
}

export type LiveRunJournal = {
	readonly version: 1
	readonly edition: number
	readonly seed: number
	readonly startedAt: string
	readonly updatedAt: string
	readonly completedAt?: string
	readonly pendingOperation?: LiveOperation
	readonly completedOperations: ReadonlyArray<LiveOperation>
	readonly results: LiveRunResults
}

const defaultJournalPath = join(import.meta.dirname, "../../runtime-private/live-run.json")

const writeJournal = (path: string, journal: LiveRunJournal): Result<LiveRunJournal> => {
	try {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
		const temporaryPath = `${path}.tmp`
		writeFileSync(temporaryPath, JSON.stringify(journal, null, 2), { mode: 0o600 })
		chmodSync(temporaryPath, 0o600)
		renameSync(temporaryPath, path)
		chmodSync(path, 0o600)
		return ok(journal)
	} catch (error) {
		return err(`failed to write live-run journal: ${String(error)}`)
	}
}

export const loadLiveRunJournal = (path = defaultJournalPath): Result<LiveRunJournal | null> => {
	if (!existsSync(path)) return ok(null)
	try {
		const journal = JSON.parse(readFileSync(path, "utf-8")) as LiveRunJournal
		if (journal.version !== 1) return err("unsupported live-run journal version")
		return ok(journal)
	} catch (error) {
		return err(`failed to read live-run journal: ${String(error)}`)
	}
}

export const prepareLiveRun = (
	edition: number,
	seed: number,
	resume: boolean,
	path = defaultJournalPath,
): Result<LiveRunJournal> => {
	const existingResult = loadLiveRunJournal(path)
	if (!existingResult.ok) return existingResult
	const existing = existingResult.value

	if (existing && !existing.completedAt) {
		if (!resume) {
			return err("an incomplete live run exists; inspect it and use --resume-live")
		}
		if (existing.edition !== edition || existing.seed !== seed) {
			return err("the incomplete live run does not match this edition and seed")
		}
		if (existing.pendingOperation) {
			return err(
				`the result of ${existing.pendingOperation} is uncertain; reconcile it before resuming`,
			)
		}
		return ok(existing)
	}

	if (resume) return err("there is no incomplete live run to resume")

	const now = new Date().toISOString()
	return writeJournal(path, {
		version: 1,
		edition,
		seed,
		startedAt: now,
		updatedAt: now,
		completedOperations: [],
		results: {},
	})
}

export const beginLiveOperation = (
	journal: LiveRunJournal,
	operation: LiveOperation,
	path = defaultJournalPath,
): Result<LiveRunJournal> => {
	if (journal.completedAt) return err("the live run is already complete")
	if (journal.pendingOperation) {
		return err(`cannot begin ${operation}; ${journal.pendingOperation} is still pending`)
	}
	if (journal.completedOperations.includes(operation)) return ok(journal)

	return writeJournal(path, {
		...journal,
		pendingOperation: operation,
		updatedAt: new Date().toISOString(),
	})
}

export const completeLiveOperation = (
	journal: LiveRunJournal,
	operation: LiveOperation,
	results: Partial<LiveRunResults> = {},
	path = defaultJournalPath,
): Result<LiveRunJournal> => {
	if (journal.pendingOperation !== operation) {
		return err(`cannot complete ${operation}; it is not the pending operation`)
	}

	const completedOperations = journal.completedOperations.includes(operation)
		? journal.completedOperations
		: [...journal.completedOperations, operation]
	return writeJournal(path, {
		...journal,
		pendingOperation: undefined,
		completedOperations,
		results: { ...journal.results, ...results },
		updatedAt: new Date().toISOString(),
	})
}

export const completeLiveRun = (
	journal: LiveRunJournal,
	path = defaultJournalPath,
): Result<LiveRunJournal> => {
	if (journal.pendingOperation) {
		return err(`cannot complete run while ${journal.pendingOperation} is pending`)
	}
	const now = new Date().toISOString()
	return writeJournal(path, { ...journal, completedAt: now, updatedAt: now })
}
