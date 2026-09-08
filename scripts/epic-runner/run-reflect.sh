#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"
base_dir="$HOME/repos"
script_dir="$(cd "$(dirname "$0")" && pwd)"

# shellcheck source=gallery-url.sh
source "$script_dir/gallery-url.sh"

# This artist has a dedicated persistent Codex home. Persist refreshed auth;
# copying a rotating refresh token into disposable homes loses its successor.
mkdir -p "$HOME/.codex"
if [ ! -f "$HOME/.codex/auth.json" ]; then
  echo "ERROR: authenticated dedicated Stigmergence Codex home was not mounted"
  exit 1
fi
chmod 700 "$HOME/.codex"
chmod 600 "$HOME/.codex/auth.json"

# --- Clone physarum and stigmergence-site as siblings ---
mkdir -p "$base_dir"
echo "Cloning $repo_url (branch: $branch)..."
git clone --branch "$branch" "$repo_url" "$base_dir/physarum"
git config --global --add safe.directory "$base_dir/physarum"
if [ ! -d /runtime-private ]; then
  echo "ERROR: persistent runtime-private directory is not mounted"
  exit 1
fi
if [ ! -d /runtime-trust ]; then
  echo "ERROR: trusted runtime checkpoint directory is not mounted"
  exit 1
fi
if [ -e "$base_dir/physarum/runtime-private" ]; then
  echo "ERROR: runtime-private path already exists in the fresh clone"
  exit 1
fi
ln -s /runtime-private "$base_dir/physarum/runtime-private"
printf '/runtime-private\n' >> "$base_dir/physarum/.git/info/exclude"

site_url="${GALLERY_REPO_URL:-$(derive_gallery_url "$repo_url")}"
echo "Cloning $site_url..."
git clone "$site_url" "$base_dir/stigmergence-site"
git config --global --add safe.directory "$base_dir/stigmergence-site"

cloned_site_url="$(git -C "$base_dir/stigmergence-site" remote get-url origin)"
if [ "$cloned_site_url" != "$site_url" ]; then
  echo "ERROR: gallery clone origin does not match the requested repository"
  exit 1
fi

cd "$base_dir/physarum"

# --- Materialize project knowledge and enable Claude hooks ---
for project_branch in litebrite trapperkeeper; do
  if ! git show-ref --verify --quiet "refs/heads/$project_branch"; then
    if ! git show-ref --verify --quiet "refs/remotes/origin/$project_branch"; then
      echo "ERROR: required project branch is missing: origin/$project_branch"
      exit 1
    fi
    git branch --track "$project_branch" "origin/$project_branch"
  fi
done
if [ ! -d .trapper_keeper ]; then
  git worktree add .trapper_keeper trapperkeeper
fi
lb setup codex
trk setup codex
lb prime >/dev/null
trk prime >/dev/null
echo "Litebrite, Trapper Keeper, and Codex hooks are ready."

# --- Install dependencies from pre-built cache ---
echo "Installing project dependencies..."
if [ -d /deps/physarum/node_modules ]; then
  cp -a /deps/physarum/node_modules .
else
  bun install --frozen-lockfile
fi
echo "Dependencies installed."

# Refuse to start if a prior direct outside action has no verified result.
unset STIGMERGENCE_OUTSIDE_JOURNAL_ALLOW_UNANCHORED_INITIALIZATION
bun run scripts/outside-action-journal.ts check

# --- Install pre-commit hook (lint) ---
git config core.hooksPath scripts/git-hooks

# Carry only this artist's memory notes across backends, never Claude credentials.
legacy_memory=/claude-source/projects/-home-runner-repos-physarum/memory
memory_dir=/runtime-private/memory/legacy-claude
if [ ! -f "$memory_dir/MEMORY.md" ]; then
  test -s "$legacy_memory/MEMORY.md"
  install -d -m 700 "$memory_dir"
  for memory_file in "$legacy_memory"/*.md; do
    test ! -L "$memory_file"
    install -m 600 "$memory_file" "$memory_dir/$(basename "$memory_file")"
  done
fi
install -d -m 700 /runtime-private/codex-sessions
if [ ! -e "$HOME/.codex/sessions" ]; then
  ln -s /runtime-private/codex-sessions "$HOME/.codex/sessions"
fi
codex login status

# --- Run reflection ---
echo "Starting reflection..."
export CONTAINER=true
bun run src/index.ts --reflect

echo "Reflection run complete."
