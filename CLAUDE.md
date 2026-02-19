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

- `src/agent/` — reflection system (prompt, evolution, reflect)
- `src/engine/` — physarum simulation
- `src/pipeline/` — orchestration, gallery updates
- `src/social/` — Farcaster posting, engagement reading, narrative
- `src/config/` — default params (genome)
- `state.json` — edition history, reflections
- `../stigmergence-site/` — public website repo
