import { describe, expect, test } from "bun:test"
import { parseReflectionResponse } from "#agent/reflect.ts"

describe("parseReflectionResponse", () => {
	test("parses valid JSON response", () => {
		const json = JSON.stringify({
			reasoning: "The trails are thinning. More agents needed.",
			changes: [
				{
					file: "src/config/params.ts",
					action: "edit",
					content: "export const DEFAULT_PARAMS = { agentCount: 400000 }",
				},
			],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.reasoning).toBe("The trails are thinning. More agents needed.")
		expect(result.value.changes).toHaveLength(1)
		expect(result.value.changes[0].file).toBe("src/config/params.ts")
		expect(result.value.changes[0].action).toBe("edit")
		expect(result.value.changes[0].content).toContain("400000")
	})

	test("strips markdown JSON fences", () => {
		const json = '```json\n{"reasoning":"test","changes":[]}\n```'
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.reasoning).toBe("test")
		expect(result.value.changes).toHaveLength(0)
	})

	test("strips plain markdown fences", () => {
		const json = '```\n{"reasoning":"test","changes":[]}\n```'
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.reasoning).toBe("test")
	})

	test("handles empty changes array", () => {
		const json = JSON.stringify({
			reasoning: "No changes needed. The current form resonates.",
			changes: [],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.changes).toHaveLength(0)
	})

	test("handles multiple changes", () => {
		const json = JSON.stringify({
			reasoning: "Evolving both form and voice.",
			changes: [
				{ file: "src/config/params.ts", action: "edit", content: "new params" },
				{ file: "src/social/narrative.ts", action: "edit", content: "new narrative" },
			],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.changes).toHaveLength(2)
		expect(result.value.changes[0].file).toBe("src/config/params.ts")
		expect(result.value.changes[1].file).toBe("src/social/narrative.ts")
	})

	test("handles delete action without content", () => {
		const json = JSON.stringify({
			reasoning: "Pruning.",
			changes: [{ file: "src/old.ts", action: "delete" }],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.changes[0].action).toBe("delete")
		expect(result.value.changes[0].content).toBe("")
	})

	test("handles create action", () => {
		const json = JSON.stringify({
			reasoning: "Extending.",
			changes: [{ file: "src/new.ts", action: "create", content: "export const x = 1" }],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(true)
		if (!result.ok) return
		expect(result.value.changes[0].action).toBe("create")
	})

	test("rejects non-JSON input", () => {
		const result = parseReflectionResponse("this is not json at all")

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Failed to parse")
	})

	test("rejects missing reasoning field", () => {
		const json = JSON.stringify({ changes: [] })
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("reasoning")
	})

	test("rejects missing changes field", () => {
		const json = JSON.stringify({ reasoning: "test" })
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("changes")
	})

	test("rejects invalid action", () => {
		const json = JSON.stringify({
			reasoning: "test",
			changes: [{ file: "x.ts", action: "destroy", content: "" }],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("invalid \"action\"")
	})

	test("rejects change missing file field", () => {
		const json = JSON.stringify({
			reasoning: "test",
			changes: [{ action: "edit", content: "x" }],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("file")
	})

	test("rejects edit without content", () => {
		const json = JSON.stringify({
			reasoning: "test",
			changes: [{ file: "x.ts", action: "edit" }],
		})
		const result = parseReflectionResponse(json)

		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("content")
	})
})
