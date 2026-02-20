#!/usr/bin/env bash
set -euo pipefail

epic="${1:?Usage: run-epic.sh <epic-id> [timeout-minutes]}"
timeout_mins="${2:-15}"
script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
runner_dir="$script_dir/epic-runner"

repo_url="$(git -C "$project_dir" remote get-url origin)"
branch="$(git -C "$project_dir" branch --show-current)"

# Build the container image (all layers cached unless versions change)
echo "Building epic-runner container..."
docker build -q -t epic-runner \
  --build-arg HOST_UID="$(id -u)" \
  --build-arg HOST_GID="$(id -g)" \
  -f "$runner_dir/Dockerfile" "$project_dir"

# Flush beads state to the beads-sync branch so the container gets current data
beads_wt="$project_dir/.git/beads-worktrees/beads-sync"
if [ -d "$beads_wt" ]; then
  echo "Syncing beads to remote..."
  bd sync
  if ! git -C "$beads_wt" diff --quiet .beads/issues.jsonl 2>/dev/null; then
    git -C "$beads_wt" add .beads/issues.jsonl
    git -C "$beads_wt" commit -m "bd sync: pre-run flush for $epic"
    git -C "$beads_wt" push origin beads-sync
  fi
fi

container_name="epic-${epic}"

echo "Running epic $epic on branch $branch (${timeout_mins}m timeout per task)..."
echo "Container name: $container_name"

# Remove stale container with same name if it exists
docker rm "$container_name" 2>/dev/null || true

docker run --name "$container_name" \
  -e REPO_URL="$repo_url" \
  -e BRANCH="$branch" \
  -v "${SSH_AUTH_SOCK}:/ssh-agent" \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -v "$runner_dir/run-epic.sh:/run-epic.sh:ro" \
  epic-runner /run-epic.sh "$epic" "$timeout_mins"

echo "Container $container_name finished successfully. Cleaning up..."
docker rm "$container_name"

# Pull bead closures from the container's sync into the host
beads_wt="$project_dir/.git/beads-worktrees/beads-sync"
if [ -d "$beads_wt" ]; then
  echo "Pulling bead updates from remote..."
  git -C "$beads_wt" pull origin beads-sync
  bd sync --import-only
  echo "Closing epic $epic..."
  bd close "$epic" --reason="All tasks completed by epic-runner"
  bd sync
  if ! git -C "$beads_wt" diff --quiet .beads/issues.jsonl 2>/dev/null; then
    git -C "$beads_wt" add .beads/issues.jsonl
    git -C "$beads_wt" commit -m "bd sync: close epic $epic"
    git -C "$beads_wt" push origin beads-sync
  fi
fi
