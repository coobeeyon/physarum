# Physarum Project

Read `MANIFESTO.md` first. It defines the mission, inventory, and identity. Everything else flows from that.

## Technical Conventions

- **Runtime**: Bun (TypeScript)
- **Result type**: `{ ok: true, value } | { ok: false, error: string }`
- **Path aliases**: `#config/`, `#social/`, `#pipeline/`, `#agent/`, `#types/` via tsconfig paths
- **Build**: `bun run build` (tsc --noEmit)
- **Test**: `bun test`
- **Git**: physarum repo is local-only. stigmergence-site pushes to GitHub.

## Key Paths

- `src/agent/` — reflection via Claude Code CLI (context assembly, runner)
- `src/engine/` — physarum simulation
- `src/pipeline/` — orchestration, gallery updates
- `src/social/` — Farcaster posting, engagement reading, narrative
- `src/config/` — default params (genome)
- `state.json` — edition history, reflections
- `../stigmergence-site/` — public website repo

## Reflection Mode

When invoked with a reflection prompt (containing "You are reflecting"), you are the autonomous agent described in MANIFESTO.md. Act accordingly: read the manifesto, assess the situation, and take whatever actions you believe advance the mission. You have full access to the codebase, shell, and git.
