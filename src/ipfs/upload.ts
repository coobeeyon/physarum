import { PinataSDK } from "pinata"
import type { NftMetadata } from "#types/metadata.ts"
import { type Result, ok, err } from "#types/result.ts"

export const createPinataClient = (jwt: string) => new PinataSDK({ pinataJwt: jwt })

export const uploadImage = async (
	client: PinataSDK,
	png: Buffer,
	name: string,
): Promise<Result<{ imageCid: string }>> => {
	const file = new File([png], `${name}.png`, { type: "image/png" })
	const result = await client.upload.public.file(file)
	if (!result.cid) return err("Pinata upload returned no CID")
	return ok({ imageCid: result.cid })
}

export const uploadMetadata = async (
	client: PinataSDK,
	metadata: NftMetadata,
	name: string,
): Promise<Result<{ metadataCid: string }>> => {
	const result = await client.upload.public.json(metadata).name(`${name}.json`)
	if (!result.cid) return err("Pinata metadata upload returned no CID")
	return ok({ metadataCid: result.cid })
}
