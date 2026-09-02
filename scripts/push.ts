#!/usr/bin/env bun
// Journaled git push. Fixes the session-8 slip where mid-session pushes went
// unjournaled: this is now the only way I push.
//
// Usage: bun run scripts/push.ts [remote] [refspec]
// Defaults: origin, current branch.

import { execSync, spawnSync } from "node:child_process"

const remote = process.argv[2] ?? "origin"
const branch =
	process.argv[3] ?? execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim()
const head = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim()
const subject = execSync("git log -1 --format=%s", { encoding: "utf-8" }).trim()

const id = `push-${branch.replace(/[^a-zA-Z0-9]+/g, "-")}-${head}`
const summary = `git push ${remote} ${branch} @ ${head}: ${subject}`.slice(0, 200)

const journal = (args: string[]): void => {
	const result = spawnSync("bun", ["run", `${import.meta.dir}/outside-action-journal.ts`, ...args], {
		stdio: "inherit",
	})
	if (result.status !== 0) {
		console.error("journal command failed; aborting push")
		process.exit(1)
	}
}

journal(["begin", id, "git-push", summary])

const push = spawnSync("git", ["push", remote, branch], { stdio: "inherit" })

if (push.status === 0) {
	journal(["complete", id, "git-push", summary])
	console.log(`pushed and journaled: ${id}`)
} else if (push.status === null) {
	// Process failed to spawn or was killed — result uncertain. Leave pending.
	console.error(`push result UNCERTAIN — journal entry ${id} left pending; reconcile before retrying`)
	process.exit(1)
} else {
	journal(["failed", id, "git-push", summary])
	console.error(`push failed and journaled: ${id}`)
	process.exit(1)
}
