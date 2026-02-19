import { describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { validateChangePaths, applyChanges, revertChanges, selfTest } from "#agent/evolve.ts"
import type { ChangeProposal } from "#agent/reflect.ts"

const makeTmpDir = (): string => {
	const dir = join(tmpdir(), `evolve-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mkdirSync(dir, { recursive: true })
	return dir
}

describe("validateChangePaths", () => {
	test("accepts src/ paths", () => {
		const result = validateChangePaths([
			{ file: "src/config/params.ts", action: "edit", content: "" },
			{ file: "src/social/narrative.ts", action: "edit", content: "" },
			{ file: "src/new/deep/file.ts", action: "create", content: "" },
		])
		expect(result.ok).toBe(true)
	})

	test("accepts project root files", () => {
		const result = validateChangePaths([
			{ file: "package.json", action: "edit", content: "" },
			{ file: "MANIFESTO.md", action: "edit", content: "" },
			{ file: "state.json", action: "edit", content: "" },
			{ file: "tsconfig.json", action: "edit", content: "" },
		])
		expect(result.ok).toBe(true)
	})

	test("rejects absolute paths", () => {
		const result = validateChangePaths([
			{ file: "/etc/passwd", action: "edit", content: "" },
		])
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Absolute path")
	})

	test("rejects .. traversal", () => {
		const result = validateChangePaths([
			{ file: "src/../.env", action: "edit", content: "" },
		])
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Protected file")
	})

	test("rejects .env", () => {
		const result = validateChangePaths([
			{ file: ".env", action: "edit", content: "" },
		])
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Protected file")
	})

	test("rejects .git/ paths", () => {
		const result = validateChangePaths([
			{ file: ".git/config", action: "edit", content: "" },
		])
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Protected directory")
	})

	test("rejects node_modules/ paths", () => {
		const result = validateChangePaths([
			{ file: "node_modules/foo/index.js", action: "edit", content: "" },
		])
		expect(result.ok).toBe(false)
		if (result.ok) return
		expect(result.error).toContain("Protected directory")
	})

	test("accepts empty changes", () => {
		const result = validateChangePaths([])
		expect(result.ok).toBe(true)
	})
})

describe("applyChanges", () => {
	test("edits existing file and creates backup", () => {
		const dir = makeTmpDir()
		try {
			mkdirSync(join(dir, "src/config"), { recursive: true })
			writeFileSync(join(dir, "src/config/params.ts"), "original content")

			const changes: ChangeProposal[] = [
				{ file: "src/config/params.ts", action: "edit", content: "new content" },
			]
			const result = applyChanges(changes, dir)

			expect(result.ok).toBe(true)
			if (!result.ok) return
			expect(result.value).toHaveLength(1)
			expect(result.value[0].originalContent).toBe("original content")
			expect(readFileSync(join(dir, "src/config/params.ts"), "utf-8")).toBe("new content")
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("creates new file", () => {
		const dir = makeTmpDir()
		try {
			const changes: ChangeProposal[] = [
				{ file: "src/new/file.ts", action: "create", content: "export const x = 1" },
			]
			const result = applyChanges(changes, dir)

			expect(result.ok).toBe(true)
			if (!result.ok) return
			expect(result.value[0].originalContent).toBeNull()
			expect(readFileSync(join(dir, "src/new/file.ts"), "utf-8")).toBe("export const x = 1")
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("deletes existing file", () => {
		const dir = makeTmpDir()
		try {
			mkdirSync(join(dir, "src"), { recursive: true })
			writeFileSync(join(dir, "src/old.ts"), "to be deleted")

			const changes: ChangeProposal[] = [
				{ file: "src/old.ts", action: "delete", content: "" },
			]
			const result = applyChanges(changes, dir)

			expect(result.ok).toBe(true)
			if (!result.ok) return
			expect(result.value[0].originalContent).toBe("to be deleted")
			expect(existsSync(join(dir, "src/old.ts"))).toBe(false)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})
})

describe("revertChanges", () => {
	test("restores edited file", () => {
		const dir = makeTmpDir()
		try {
			mkdirSync(join(dir, "src"), { recursive: true })
			writeFileSync(join(dir, "src/file.ts"), "modified content")

			revertChanges(
				[{ path: "src/file.ts", originalContent: "original content" }],
				dir,
			)

			expect(readFileSync(join(dir, "src/file.ts"), "utf-8")).toBe("original content")
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("removes newly created file", () => {
		const dir = makeTmpDir()
		try {
			mkdirSync(join(dir, "src"), { recursive: true })
			writeFileSync(join(dir, "src/new.ts"), "created by apply")

			revertChanges(
				[{ path: "src/new.ts", originalContent: null }],
				dir,
			)

			expect(existsSync(join(dir, "src/new.ts"))).toBe(false)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})
})

describe("selfTest", () => {
	test("passes with valid TypeScript project", async () => {
		const dir = makeTmpDir()
		try {
			writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "bundler",
					strict: true,
					noEmit: true,
				},
				include: ["src/**/*.ts"],
			}))
			writeFileSync(join(dir, "package.json"), JSON.stringify({
				scripts: { build: "tsc --noEmit" },
			}))
			mkdirSync(join(dir, "src"), { recursive: true })
			writeFileSync(join(dir, "src/valid.ts"), "export const x: number = 42\n")

			const result = await selfTest(dir)
			expect(result.ok).toBe(true)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})

	test("fails with type error", async () => {
		const dir = makeTmpDir()
		try {
			writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({
				compilerOptions: {
					target: "ESNext",
					module: "ESNext",
					moduleResolution: "bundler",
					strict: true,
					noEmit: true,
				},
				include: ["src/**/*.ts"],
			}))
			writeFileSync(join(dir, "package.json"), JSON.stringify({
				scripts: { build: "tsc --noEmit" },
			}))
			mkdirSync(join(dir, "src"), { recursive: true })
			writeFileSync(join(dir, "src/broken.ts"), "export const x: number = 'not a number'\n")

			const result = await selfTest(dir)
			expect(result.ok).toBe(false)
			if (result.ok) return
			expect(result.error).toContain("Build failed")
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	})
})
