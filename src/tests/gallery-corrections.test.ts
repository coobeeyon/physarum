import { expect, test } from "bun:test"
import { runInNewContext } from "node:vm"
import { EDITION_CORRECTIONS } from "#config/edition-corrections.ts"
import { generateScriptJs } from "#pipeline/gallery.ts"

test("a regenerated gallery keeps the maze correction visible outside its collect link", () => {
	type Element = {
		tag: string
		id: string
		textContent: string
		children: Element[]
		appendChild(child: Element): void
	}
	const element = (tag: string): Element => ({
		tag,
		id: "",
		textContent: "",
		children: [],
		appendChild(child: Element) {
			this.children.push(child)
		},
	})
	const grid = element("div")
	const entries = [36, 35].map((edition) => ({
		edition,
		seed: edition,
		image: `img/stigmergence-${edition}.webp`,
		zora: "https://example.org/collect",
		params: {
			agents: "200000",
			populations: "1",
			iterations: "2000",
			resolution: "2048",
			food: "image",
		},
	}))
	runInNewContext(generateScriptJs(entries), {
		document: { getElementById: () => grid, createElement: element },
	})
	expect(grid.children).toHaveLength(2)
	expect(grid.children[0].children).toHaveLength(1)
	const maze = grid.children[1]
	expect(maze.id).toBe("edition-35")
	expect(maze.children.map((child) => child.tag)).toEqual(["a", "p"])
	expect(maze.children[1].textContent).toBe(EDITION_CORRECTIONS[35])
	expect(maze.children[1].textContent).toContain("2026-09-08")
	expect(maze.children[1].textContent).toContain("precomputed solution")
})
