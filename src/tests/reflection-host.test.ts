import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const projectRoot = join(import.meta.dir, "../..")
const hostScript = readFileSync(join(projectRoot, "scripts/run-reflect.sh"), "utf-8")
const containerScript = readFileSync(
	join(projectRoot, "scripts/epic-runner/run-reflect.sh"),
	"utf-8",
)

describe("reflection host recovery", () => {
	test("persists private live-action journals outside the disposable clone", () => {
		expect(hostScript).toContain("STIGMERGENCE_RUNTIME_PRIVATE_DIR")
		expect(hostScript).toContain("$runtime_private_dir:/runtime-private")
		expect(containerScript).toContain('ln -s /runtime-private "$base_dir/physarum/runtime-private"')
	})

	test("requires an owner-only host journal directory", () => {
		expect(hostScript).toContain('install -d -m 700 "$runtime_private_dir"')
		expect(hostScript).toContain('chmod 700 "$runtime_private_dir"')
	})
})
