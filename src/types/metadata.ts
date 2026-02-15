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

export type PipelineState = {
	readonly contractAddress: string | null
	readonly lastEdition: number
	readonly history: ReadonlyArray<{
		readonly edition: number
		readonly seed: number
		readonly tokenId: string
		readonly txHash: string
		readonly castHash: string
		readonly imageCid: string
		readonly metadataCid: string
		readonly timestamp: string
	}>
}
