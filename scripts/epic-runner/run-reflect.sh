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

# --- Commit and push any code changes ---
if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "Reflection made code changes — committing..."
  git add -A
  # Exclude state.json (symlink to bind mount, not real file)
  git reset HEAD state.json 2>/dev/null || true
  if ! git diff --cached --quiet; then
    git commit -m "reflect: autonomous changes from reflection run"
    git push origin "$branch"
    echo "Changes pushed to $branch."
  else
    echo "No staged changes after excluding state.json."
  fi
else
  echo "No code changes from reflection."
fi

echo "Reflection run complete."
