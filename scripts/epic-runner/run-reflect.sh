#!/usr/bin/env bash
set -euo pipefail

repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"
base_dir="$HOME/repos"
script_dir="$(cd "$(dirname "$0")" && pwd)"

# shellcheck source=gallery-url.sh
source "$script_dir/gallery-url.sh"

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
lb setup claude
trk setup claude
lb prime >/dev/null
trk prime >/dev/null
echo "Litebrite, Trapper Keeper, and Claude hooks are ready."

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
