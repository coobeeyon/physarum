#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"
base_dir="$HOME/repos"

# Give this disposable runner its own writable Codex home while reusing only
# the authenticated configuration and installed skills from the shared volume.
mkdir -p "$HOME/.codex"
for codex_file in auth.json config.toml; do
  if [ -f "/codex-source/$codex_file" ]; then
    cp "/codex-source/$codex_file" "$HOME/.codex/$codex_file"
  fi
done
if [ -d /codex-source/skills ]; then
  cp -a /codex-source/skills "$HOME/.codex/skills"
fi
if [ ! -f "$HOME/.codex/auth.json" ]; then
  echo "ERROR: authenticated Codex config was not found in /codex-source"
  exit 1
fi
chmod 700 "$HOME/.codex"
chmod 600 "$HOME/.codex/auth.json"

# --- Clone physarum and stigmergence-site as siblings ---
mkdir -p "$base_dir"
echo "Cloning $repo_url (branch: $branch)..."
git clone --branch "$branch" "$repo_url" "$base_dir/physarum"
git config --global --add safe.directory "$base_dir/physarum"

site_url="$(echo "$repo_url" | sed 's|physarum\.git|stigmergence.git|')"
echo "Cloning $site_url..."
git clone "$site_url" "$base_dir/stigmergence-site" || echo "Warning: could not clone stigmergence-site"
git config --global --add safe.directory "$base_dir/stigmergence-site"

cd "$base_dir/physarum"

# --- Install dependencies from pre-built cache ---
echo "Installing project dependencies..."
if [ -d /deps/physarum/node_modules ]; then
  cp -a /deps/physarum/node_modules .
else
  bun install --frozen-lockfile
fi
echo "Dependencies installed."

# --- Install pre-commit hook (lint + beads) ---
git config core.hooksPath scripts/git-hooks

# --- Restore .claude.json from persisted backup if missing ---
claude_config="$HOME/.claude.json"
if [ ! -f "$claude_config" ] && [ -d "$HOME/.claude/backups" ]; then
  latest_backup=$(ls -t "$HOME/.claude/backups/.claude.json.backup."* 2>/dev/null | head -1)
  if [ -n "$latest_backup" ]; then
    cp "$latest_backup" "$claude_config"
    echo "Restored .claude.json from backup: $(basename "$latest_backup")"
  fi
fi

# --- Run reflection ---
echo "Starting reflection..."
export CONTAINER=true
bun run src/index.ts --reflect

echo "Reflection run complete."
