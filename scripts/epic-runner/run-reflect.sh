#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"

# --- Clone and set up ---
echo "Cloning $repo_url (branch: $branch)..."
git clone --branch "$branch" "$repo_url" /workspace
cd /workspace
git config --global --add safe.directory /workspace

# --- Install dependencies from pre-built cache ---
echo "Installing project dependencies..."
if [ -d /deps/physarum/node_modules ]; then
  cp -a /deps/physarum/node_modules .
else
  bun install --frozen-lockfile
fi
echo "Dependencies installed."

# --- Clone stigmergence-site as sibling (for gallery updates) ---
site_url="$(echo "$repo_url" | sed 's|physarum\.git|stigmergence.git|')"
echo "Cloning $site_url..."
git clone "$site_url" /workspace/../stigmergence-site || echo "Warning: could not clone stigmergence-site"
git config --global --add safe.directory /workspace/../stigmergence-site

# --- Symlink bind-mounted state.json if present ---
# Host bind-mounts state.json to /state.json; link it into the repo
if [ -f /state.json ]; then
  ln -sf /state.json state.json
  echo "state.json linked from bind mount."
fi

# --- Run reflection ---
echo "Starting reflection..."
export CONTAINER=true
bun run src/index.ts --reflect

echo "Reflection run complete."
