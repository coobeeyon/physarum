#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
runner_dir="$script_dir/epic-runner"

# --- Preflight: clean working tree ---
if ! git -C "$project_dir" diff --quiet || ! git -C "$project_dir" diff --cached --quiet; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

repo_url="$(git -C "$project_dir" remote get-url origin)"
branch="$(git -C "$project_dir" branch --show-current)"

# --- Ensure state.json exists (container needs a file to bind-mount) ---
state_file="$project_dir/state.json"
if [ ! -f "$state_file" ]; then
  echo '{}' > "$state_file"
fi

# --- Build container image (reuses epic-runner Dockerfile) ---
echo "Building epic-runner container..."
docker build -q -t epic-runner \
  --build-arg HOST_UID="$(id -u)" \
  --build-arg HOST_GID="$(id -g)" \
  -f "$runner_dir/Dockerfile" "$project_dir"

container_name="reflect-$(date +%Y%m%d-%H%M%S)"

echo "Running reflection on branch $branch..."
echo "Container name: $container_name"

# Remove stale container with same name if it exists
docker rm "$container_name" 2>/dev/null || true

# Persistent volume for Claude Code memory across runs
docker volume create reflect-claude-home 2>/dev/null || true

docker run --name "$container_name" \
  --env-file "$project_dir/.env" \
  -e REFLECT_MODEL="${REFLECT_MODEL:-}" \
  -e REFLECT_MAX_TURNS="${REFLECT_MAX_TURNS:-}" \
  -e CONTAINER=true \
  -e REPO_URL="$repo_url" \
  -e BRANCH="$branch" \
  -v "${SSH_AUTH_SOCK}:/ssh-agent" \
  -e SSH_AUTH_SOCK=/ssh-agent \
  -v "$runner_dir/run-reflect.sh:/run-reflect.sh:ro" \
  -v "$state_file:/state.json" \
  -v "reflect-claude-home:/home/runner/.claude" \
  epic-runner /run-reflect.sh

echo "Container $container_name finished. Cleaning up..."
docker rm "$container_name"

# --- Pull any code changes the reflection pushed ---
echo "Pulling code changes from remote..."
git -C "$project_dir" pull --ff-only || echo "No new commits to pull."

echo "Done. state.json updated in-place, code changes (if any) pulled."
