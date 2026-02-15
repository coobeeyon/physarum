import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import type { PipelineState } from "#types/metadata.ts"
import { type Result, ok, err } from "#types/result.ts"

const STATE_PATH = join(import.meta.dirname, "../../state.json")

const DEFAULT_STATE: PipelineState = {
	contractAddress: null,
	lastEdition: 0,
	history: [],
}

export const loadState = (): Result<PipelineState> => {
	if (!existsSync(STATE_PATH)) return ok(DEFAULT_STATE)
	const raw = readFileSync(STATE_PATH, "utf-8")
	const parsed = JSON.parse(raw) as PipelineState
	return ok(parsed)
}

export const saveState = (state: PipelineState): Result<void> => {
	writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
	return ok(undefined)
}
