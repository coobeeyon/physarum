import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { HistoryEntry, PipelineState } from "#types/metadata.ts"
import { type Result, ok } from "#types/result.ts"

const STATE_PATH = join(import.meta.dirname, "../../state.json")

const DEFAULT_STATE: PipelineState = {
	contractAddress: null,
	lastEdition: 0,
	history: [],
	reflections: [],
}

const migrateState = (raw: unknown): PipelineState => {
	const obj = raw as Record<string, unknown>
	const history = ((obj.history as Record<string, unknown>[]) ?? []).map(
		(entry): HistoryEntry => ({
			edition: entry.edition as number,
			seed: entry.seed as number,
			tokenId: entry.tokenId as string,
			txHash: entry.txHash as string,
			castHash: entry.castHash as string,
			...(entry.zoraCastHash ? { zoraCastHash: entry.zoraCastHash as string } : {}),
			...(entry.selfReplyHash ? { selfReplyHash: entry.selfReplyHash as string } : {}),
			...(entry.replyCastHashes ? { replyCastHashes: entry.replyCastHashes as string[] } : {}),
			imageCid: entry.imageCid as string,
			metadataCid: entry.metadataCid as string,
			timestamp: entry.timestamp as string,
			genome: (entry.genome as HistoryEntry["genome"]) ?? null,
		}),
	)
	return {
		contractAddress: (obj.contractAddress as string | null) ?? null,
		lastEdition: (obj.lastEdition as number) ?? 0,
		history,
		reflections: (obj.reflections as PipelineState["reflections"]) ?? [],
	}
}

export const loadState = (): Result<PipelineState> => {
	if (!existsSync(STATE_PATH)) return ok(DEFAULT_STATE)
	const raw = readFileSync(STATE_PATH, "utf-8")
	const parsed = JSON.parse(raw) as unknown
	return ok(migrateState(parsed))
}

export const saveState = (state: PipelineState): Result<void> => {
	writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
	return ok(undefined)
}
