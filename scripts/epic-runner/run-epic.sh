#!/usr/bin/env bash
set -euo pipefail

epic="${1:?Usage: run-epic <epic-id> [timeout-minutes]}"
timeout_mins="${2:-15}"
repo_url="${REPO_URL:?REPO_URL required}"
branch="${BRANCH:?BRANCH required}"

# --- Clone and set up ---
echo "Cloning $repo_url (branch: $branch)..."
git clone --branch "$branch" "$repo_url" /workspace
cd /workspace
git config --global --add safe.directory /workspace

logdir="/workspace/logs/epic-runs"
mkdir -p "$logdir"

# --- Initialize and start beads ---
echo "Initializing beads..."
bd init
bd config set beads.role maintainer
bd setup claude
yes | bd doctor --fix || true
bd sync --import-only || true
bd daemon start || true
sleep 1

# Verify the epic exists before starting
if ! bd show "$epic" > /dev/null 2>&1; then
  echo "ERROR: Epic $epic not found in beads database"
  echo "Available issues:"
  bd list --pretty
  exit 1
fi

# --- Create feature branch from bead title ---
bead_id="$(bd show "$epic" --json 2>/dev/null | grep '"id"' | head -1 | sed 's/.*"id": *"//; s/".*//')"
bead_title="$(bd show "$epic" --json 2>/dev/null | grep '"title"' | head -1 | sed 's/.*"title": *"//; s/".*//')"
slug="$(echo "$bead_title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' | cut -c1-50)"
feature_branch="${bead_id}-${slug}"

echo "Creating feature branch: $feature_branch"
git checkout -b "$feature_branch"

# --- Install project dependencies ---
echo "Installing project dependencies..."
if [ -f bun.lock ] || [ -f bun.lockb ]; then
  bun install --frozen-lockfile
fi
echo "Dependencies installed."
echo ""

# --- Beads sync helper ---
beads_worktree=".git/beads-worktrees/beads-sync"
sync_beads() {
  bd sync  # export JSONL
  if git -C "$beads_worktree" diff --quiet .beads/issues.jsonl 2>/dev/null; then
    echo "  beads: no changes to sync"
    return 0
  fi
  git -C "$beads_worktree" add .beads/issues.jsonl
  git -C "$beads_worktree" commit -m "bd sync: $epic task $task_num"
  git -C "$beads_worktree" push origin beads-sync
  echo "  beads: synced to remote"
}

# --- Task loop ---
remaining() {
  bd show --children "$epic" | grep -c '○' || true
}

task_num=0
failures=0
max_failures=3
while [ "$(remaining)" -gt 0 ]; do
  task_num=$((task_num + 1))
  logfile="$logdir/${epic}-task-${task_num}-$(date +%H%M%S).log"

  echo "=== Task $task_num | $(remaining) remaining | log: $logfile ==="

  set +e
  timeout "${timeout_mins}m" claude \
    "Run 'bd show --children $epic' to see tasks. Pick ONE open child task (marked ○) and complete it. Do NOT work on tasks outside this epic. Commit your changes and close the bead when done. Do NOT push — the runner handles pushing." \
    --dangerously-skip-permissions \
    -p --verbose 2>&1 | tee "$logfile"
  exit_code=${PIPESTATUS[0]}
  set -e

  if [ "$exit_code" -eq 124 ]; then
    echo "--- Task $task_num timed out after ${timeout_mins}m — skipping"
    failures=$((failures + 1))
  elif [ "$exit_code" -ne 0 ]; then
    echo "--- Task $task_num exited with code $exit_code"
    failures=$((failures + 1))
  else
    failures=0
    echo "--- Task $task_num succeeded, pushing to remote..."
    git push -u origin "$feature_branch"
    sync_beads
  fi

  if [ "$failures" -ge "$max_failures" ]; then
    echo "ERROR: $max_failures consecutive failures — aborting"
    break
  fi

  echo ""
  bd list --pretty
  echo ""
done

echo ""
echo "All tasks in $epic complete."
echo "Final push to remote..."
sync_beads
git push origin "$feature_branch"
echo "Done. Merge branch '$feature_branch' into '$branch' when ready."
