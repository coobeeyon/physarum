#!/usr/bin/env bun

import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs"
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

const journalPath =
	process.env.STIGMERGENCE_OUTSIDE_JOURNAL_PATH?.trim() ||
	join(import.meta.dir, "../runtime-private/outside-actions.jsonl")

const readEntries = (): JournalEntry[] => {
	if (!existsSync(journalPath)) return []
	return readFileSync(journalPath, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as JournalEntry)
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

const fail = (message: string): never => {
	console.error(`ERROR: ${message}`)
	process.exit(1)
}

const command = process.argv[2]
const entries = readEntries()
const states = latestStates(entries)

if (command === "check") {
	const pending = [...states.entries()].filter(([, status]) => status === "pending")
	if (pending.length > 0) {
		fail(`uncertain outside action requires reconciliation: ${pending.map(([id]) => id).join(", ")}`)
	}
	console.log("outside-action journal is reconciled")
	process.exit(0)
}

const id = process.argv[3]?.trim()
const kind = process.argv[4]?.trim()
const summary = process.argv.slice(5).join(" ").trim()
if (!id || !/^[a-zA-Z0-9._-]+$/.test(id)) fail("a safe action id is required")

if (command === "begin") {
	if (!kind || !summary) fail("begin requires an action kind and secret-free summary")
	if (states.has(id)) fail(`action id already exists: ${id}`)
	appendEntry({ version: 1, id, kind, status: "pending", summary, time: new Date().toISOString() })
	console.log(`outside action recorded as pending: ${id}`)
	process.exit(0)
}

if (command === "complete" || command === "failed") {
	if (!kind || !summary) fail(`${command} requires an action kind and secret-free summary`)
	if (states.get(id) !== "pending") fail(`action is not pending: ${id}`)
	appendEntry({
		version: 1,
		id,
		kind,
		status: command === "complete" ? "completed" : "failed",
		summary,
		time: new Date().toISOString(),
	})
	console.log(`outside action recorded as ${command}: ${id}`)
	process.exit(0)
}

fail("use check, begin, complete, or failed")
