#!/usr/bin/env bun

import { createHash } from "node:crypto"
import {
	appendFileSync,
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

type JournalStatus = "pending" | "completed" | "failed"
type JournalEntry = {
	readonly version: 1
	readonly id: string
	readonly kind: string
	readonly status: JournalStatus
	readonly summary: string
	readonly time: string
}
type HistoryCheckpoint = {
	readonly version: 1
	readonly entryCount: number
	readonly sha256: string
}
type JournalHistory = {
	readonly entries: JournalEntry[]
	readonly lines: string[]
}

const defaultJournalPath = join(import.meta.dir, "../runtime-private/outside-actions.jsonl")
const journalPath = process.env.STIGMERGENCE_OUTSIDE_JOURNAL_PATH?.trim() || defaultJournalPath
const checkpointPath =
	process.env.STIGMERGENCE_OUTSIDE_JOURNAL_CHECKPOINT_PATH?.trim() ||
	join(dirname(journalPath), "outside-actions.checkpoint.json")
const anchorPath = join(import.meta.dir, "outside-action-history-anchor.json")
const allowUnanchoredInitialization =
	process.env.STIGMERGENCE_OUTSIDE_JOURNAL_ALLOW_UNANCHORED_INITIALIZATION === "1"

const fail = (message: string): never => {
	console.error(`ERROR: ${message}`)
	process.exit(1)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value)

const parseCheckpoint = (raw: string, label: string): HistoryCheckpoint => {
	const value: unknown = JSON.parse(raw)
	if (
		!isObject(value) ||
		value.version !== 1 ||
		!Number.isSafeInteger(value.entryCount) ||
		(value.entryCount as number) < 0 ||
		typeof value.sha256 !== "string" ||
		!/^[a-f0-9]{64}$/.test(value.sha256)
	) {
		throw new Error(`${label} is invalid`)
	}
	return value as HistoryCheckpoint
}

const parseEntry = (line: string): JournalEntry => {
	const value: unknown = JSON.parse(line)
	if (
		!isObject(value) ||
		value.version !== 1 ||
		typeof value.id !== "string" ||
		!/^[a-zA-Z0-9._-]+$/.test(value.id) ||
		typeof value.kind !== "string" ||
		value.kind.length === 0 ||
		!(["pending", "completed", "failed"] as const).includes(value.status as JournalStatus) ||
		typeof value.summary !== "string" ||
		value.summary.length === 0 ||
		typeof value.time !== "string" ||
		Number.isNaN(Date.parse(value.time))
	) {
		throw new Error("outside-action journal contains an invalid record")
	}
	return value as JournalEntry
}

const validateSequence = (entries: JournalEntry[]): void => {
	const seen = new Map<string, JournalEntry>()
	for (const entry of entries) {
		const previous = seen.get(entry.id)
		if (!previous) {
			if (entry.status !== "pending") {
				throw new Error("outside-action journal contains a result without a pending record")
			}
			seen.set(entry.id, entry)
			continue
		}
		if (previous.status !== "pending" || entry.status === "pending") {
			throw new Error("outside-action journal contains an invalid action transition")
		}
		if (entry.kind !== previous.kind) {
			throw new Error("outside-action journal changes an action kind")
		}
		seen.set(entry.id, entry)
	}
}

const readHistory = (): JournalHistory => {
	if (!existsSync(journalPath)) return { entries: [], lines: [] }
	const raw = readFileSync(journalPath, "utf-8")
	if (raw.length === 0) return { entries: [], lines: [] }
	if (!raw.endsWith("\n")) throw new Error("outside-action journal has a partial final record")
	const lines = raw.slice(0, -1).split("\n")
	if (lines.some((line) => line.length === 0)) {
		throw new Error("outside-action journal contains a blank record")
	}
	const entries = lines.map(parseEntry)
	validateSequence(entries)
	return { entries, lines }
}

const prefixDigest = (lines: string[], entryCount: number): string => {
	const bytes = entryCount === 0 ? "" : `${lines.slice(0, entryCount).join("\n")}\n`
	return createHash("sha256").update(bytes).digest("hex")
}

const validatePrefix = (
	history: JournalHistory,
	checkpoint: HistoryCheckpoint,
	label: string,
): void => {
	if (history.lines.length < checkpoint.entryCount) {
		throw new Error(`${label} is missing from the outside-action journal`)
	}
	if (prefixDigest(history.lines, checkpoint.entryCount) !== checkpoint.sha256) {
		throw new Error(`${label} was altered in the outside-action journal`)
	}
}

const readCheckpoint = (): HistoryCheckpoint | undefined => {
	if (!existsSync(checkpointPath)) return undefined
	return parseCheckpoint(readFileSync(checkpointPath, "utf-8"), "outside-action checkpoint")
}

const validateContinuity = (history: JournalHistory): void => {
	const anchor = parseCheckpoint(
		readFileSync(anchorPath, "utf-8"),
		"built-in outside-action history anchor",
	)
	if (!allowUnanchoredInitialization)
		validatePrefix(history, anchor, "accepted outside-action history")

	const checkpoint = readCheckpoint()
	if (!checkpoint) {
		if (!allowUnanchoredInitialization && history.lines.length !== anchor.entryCount) {
			throw new Error("trusted outside-action checkpoint is missing for history beyond the anchor")
		}
		return
	}
	if (!allowUnanchoredInitialization && checkpoint.entryCount < anchor.entryCount) {
		throw new Error("outside-action checkpoint predates the accepted history anchor")
	}
	validatePrefix(history, checkpoint, "previously accepted outside-action history")
}

const latestStates = (entries: JournalEntry[]): Map<string, JournalStatus> => {
	const states = new Map<string, JournalStatus>()
	for (const entry of entries) states.set(entry.id, entry.status)
	return states
}

const appendEntry = (entry: JournalEntry): void => {
	mkdirSync(dirname(journalPath), { recursive: true, mode: 0o700 })
	appendFileSync(journalPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 })
	chmodSync(journalPath, 0o600)
}

const acceptHistory = (history: JournalHistory): void => {
	const checkpoint: HistoryCheckpoint = {
		version: 1,
		entryCount: history.lines.length,
		sha256: prefixDigest(history.lines, history.lines.length),
	}
	const checkpointDir = dirname(checkpointPath)
	mkdirSync(checkpointDir, { recursive: true, mode: 0o700 })
	chmodSync(checkpointDir, 0o700)
	const temporaryPath = `${checkpointPath}.tmp-${process.pid}-${Date.now()}`
	writeFileSync(temporaryPath, `${JSON.stringify(checkpoint)}\n`, { mode: 0o600 })
	chmodSync(temporaryPath, 0o600)
	renameSync(temporaryPath, checkpointPath)
	chmodSync(checkpointPath, 0o600)
}

const main = (): void => {
	const command = process.argv[2]
	const history = readHistory()
	validateContinuity(history)
	const states = latestStates(history.entries)

	if (command === "check") {
		const pending = [...states.entries()].filter(([, status]) => status === "pending")
		if (pending.length > 0) {
			fail(
				`uncertain outside action requires reconciliation: ${pending.map(([id]) => id).join(", ")}`,
			)
		}
		acceptHistory(history)
		console.log("outside-action journal history is continuous and reconciled")
		return
	}

	const id = process.argv[3]?.trim()
	const kind = process.argv[4]?.trim()
	const summary = process.argv.slice(5).join(" ").trim()
	if (!id || !/^[a-zA-Z0-9._-]+$/.test(id)) fail("a safe action id is required")
	if (!allowUnanchoredInitialization && !existsSync(checkpointPath)) {
		fail("run check once to initialize the trusted outside-action checkpoint")
	}

	if (command === "begin") {
		if (!kind || !summary) fail("begin requires an action kind and secret-free summary")
		if (states.has(id)) fail(`action id already exists: ${id}`)
		appendEntry({
			version: 1,
			id,
			kind,
			status: "pending",
			summary,
			time: new Date().toISOString(),
		})
		console.log(`outside action recorded as pending: ${id}`)
		return
	}

	if (command === "complete" || command === "failed") {
		if (!kind || !summary) fail(`${command} requires an action kind and secret-free summary`)
		if (states.get(id) !== "pending") fail(`action is not pending: ${id}`)
		const pendingEntry = history.entries.findLast((entry) => entry.id === id)
		if (pendingEntry?.kind !== kind) fail(`action kind does not match pending record: ${id}`)
		appendEntry({
			version: 1,
			id,
			kind,
			status: command === "complete" ? "completed" : "failed",
			summary,
			time: new Date().toISOString(),
		})
		console.log(`outside action recorded as ${command}: ${id}`)
		return
	}

	fail("use check, begin, complete, or failed")
}

try {
	main()
} catch (error) {
	fail(error instanceof Error ? error.message : String(error))
}
