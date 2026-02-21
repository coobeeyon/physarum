import type { Genome, ReflectionRecord } from "#types/evolution.ts"

export type NftMetadata = {
	readonly name: string
	readonly description: string
	readonly image: string
	readonly external_url: string
	readonly attributes: ReadonlyArray<{
		readonly trait_type: string
		readonly value: string | number
	}>
}

export type HistoryEntry = {
	readonly edition: number
	readonly seed: number
	readonly tokenId: string
	readonly txHash: string
	readonly castHash: string
	readonly zoraCastHash?: string
	readonly replyCastHashes?: string[]
	readonly imageCid: string
	readonly metadataCid: string
	readonly timestamp: string
	readonly genome: Genome | null
}

export type PipelineState = {
	readonly contractAddress: string | null
	readonly lastEdition: number
	readonly history: ReadonlyArray<HistoryEntry>
	readonly reflections: ReadonlyArray<ReflectionRecord>
}
