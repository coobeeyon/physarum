#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"
base_dir="$HOME/repos"

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
