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

# --- Install dependencies from pre-built cache ---
echo "Installing project dependencies..."
if [ -d /deps/physarum/node_modules ]; then
  cp -a /deps/physarum/node_modules .
else
  bun install --frozen-lockfile
fi
echo "Dependencies installed."

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

# Verify the epic exists before starting
if ! lb show "$epic" > /dev/null 2>&1; then
  echo "ERROR: Epic $epic not found in Litebrite"
  echo "Available issues:"
  lb list --all --tree
  exit 1
fi

# --- Create feature branch from item title ---
item_title="$(lb show "$epic" | sed -n 's/^  Title: //p')"
slug="$(echo "$item_title" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' | cut -c1-50)"
feature_branch="${epic}-${slug}"

echo "Creating feature branch: $feature_branch"
git checkout -b "$feature_branch"

# --- Task loop ---
remaining() {
  lb list --parent "$epic" | awk 'NR > 2 && ($3 == "open" || $3 == "in_progress") { count++ } END { print count + 0 }'
}

sync_and_push() {
  lb sync
  git push -u origin "$feature_branch"
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
    "Run 'lb list --parent $epic' to see tasks. Pick ONE open child, read it with lb show, claim it, and complete it. Do NOT work on tasks outside this epic. Commit your changes and close the Litebrite item when done. Do NOT push source changes — the runner handles pushing." \
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
    sync_and_push
  fi

  if [ "$failures" -ge "$max_failures" ]; then
    echo "ERROR: $max_failures consecutive failures — aborting"
    break
  fi

  echo ""
  lb list --parent "$epic"
  echo ""
done

echo ""
echo "All tasks in $epic complete."
echo "Final push to remote..."
sync_and_push
echo "Done. Merge branch '$feature_branch' into '$branch' when ready."
