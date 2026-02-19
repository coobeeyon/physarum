import Anthropic from "@anthropic-ai/sdk"
import { type Result, ok, err } from "#types/result.ts"
import type { PipelineState } from "#types/metadata.ts"
import type { EngagementData } from "#types/evolution.ts"
import { buildSystemPrompt, assembleContext } from "#agent/prompt.ts"

const DEFAULT_MODEL = "claude-sonnet-4-6"

export type ChangeProposal = {
	readonly file: string
	readonly action: "create" | "edit" | "delete"
	readonly content: string
}

export type ReflectionResponse = {
	readonly reasoning: string
	readonly changes: ReadonlyArray<ChangeProposal>
}

export const parseReflectionResponse = (text: string): Result<ReflectionResponse> => {
	// Strip markdown fences if present
	const cleaned = text
		.replace(/^```(?:json)?\s*\n?/m, "")
		.replace(/\n?```\s*$/m, "")
		.trim()

	let parsed: unknown
	try {
		parsed = JSON.parse(cleaned)
	} catch {
		return err(`Failed to parse reflection response as JSON: ${cleaned.slice(0, 200)}`)
	}

	const obj = parsed as Record<string, unknown>
	if (typeof obj.reasoning !== "string") {
		return err('Reflection response missing "reasoning" string field')
	}

	if (!Array.isArray(obj.changes)) {
		return err('Reflection response missing "changes" array field')
	}

	const validActions = new Set(["create", "edit", "delete"])
	const changes: ChangeProposal[] = []
	for (const [i, change] of (obj.changes as unknown[]).entries()) {
		const c = change as Record<string, unknown>
		if (typeof c.file !== "string") {
			return err(`changes[${i}] missing "file" string field`)
		}
		if (typeof c.action !== "string" || !validActions.has(c.action)) {
			return err(`changes[${i}] has invalid "action": ${c.action}`)
		}
		if (typeof c.content !== "string" && c.action !== "delete") {
			return err(`changes[${i}] missing "content" string field`)
		}
		changes.push({
			file: c.file,
			action: c.action as ChangeProposal["action"],
			content: (c.content as string) ?? "",
		})
	}

	return ok({ reasoning: obj.reasoning, changes })
}

export const runReflection = async (
	apiKey: string,
	state: PipelineState,
	engagement: ReadonlyArray<EngagementData>,
	projectRoot: string,
): Promise<Result<ReflectionResponse>> => {
	const systemPrompt = buildSystemPrompt(projectRoot)
	const context = assembleContext(state, engagement, projectRoot)
	const client = new Anthropic({ apiKey })

	const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL

	let message: Anthropic.Message
	try {
		message = await client.messages.create({
			model,
			max_tokens: 16384,
			system: systemPrompt,
			messages: [{ role: "user", content: context }],
		})
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return err(`Anthropic API call failed: ${msg}`)
	}

	const block = message.content[0]
	if (!block || block.type !== "text") {
		return err("Anthropic API returned no text content")
	}

	return parseReflectionResponse(block.text)
}
