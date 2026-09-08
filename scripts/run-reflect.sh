#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/.." && pwd)"
runner_dir="$script_dir/epic-runner"
history_file="${STIGMERGENCE_HISTORY_PATH:-/home/mdaum/.mybuddy/memory/managed-peer-briefs/stigmergence-autobiography.md}"
codex_volume="${STIGMERGENCE_CODEX_HOME_VOLUME:-mrmouth-codex-home}"
archived_env="/home/mdaum/workspace/physarum-data/private/secrets/whimzee-physarum.env"
if [ -r "$archived_env" ]; then
  default_env="$archived_env"
else
  default_env="$project_dir/.env"
fi
environment_file="${STIGMERGENCE_ENV_PATH:-$default_env}"
runtime_private_dir="${STIGMERGENCE_RUNTIME_PRIVATE_DIR:-$project_dir/runtime-private}"
runtime_trust_dir="${STIGMERGENCE_RUNTIME_TRUST_DIR:-${runtime_private_dir}-trust}"

# --- Parse flags ---
raw_mode=false
for arg in "$@"; do
  case "$arg" in
    --raw) raw_mode=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# --- Set up logging ---
log_dir="$project_dir/logs"
mkdir -p "$log_dir"
log_file="$log_dir/reflect-$(date +%Y%m%d-%H%M%S).jsonl"

echo "Log file: $log_file"

if [ ! -r "$history_file" ]; then
  echo "ERROR: Stigmergence history is not readable: $history_file"
  exit 1
fi
if [ ! -r "$environment_file" ]; then
  echo "ERROR: Stigmergence environment is not readable: $environment_file"
  exit 1
fi
if ! docker volume inspect "$codex_volume" >/dev/null 2>&1; then
  echo "ERROR: Codex home volume does not exist: $codex_volume"
  echo "Set STIGMERGENCE_CODEX_HOME_VOLUME to an authenticated Codex volume."
  exit 1
fi

install -d -m 700 "$runtime_private_dir"
chmod 700 "$runtime_private_dir"
install -d -m 700 "$runtime_trust_dir"
chmod 700 "$runtime_trust_dir"

# --- Preflight: clean working tree ---
if ! git -C "$project_dir" diff --quiet || ! git -C "$project_dir" diff --cached --quiet; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first."
  exit 1
fi

repo_url="$(git -C "$project_dir" remote get-url origin)"
branch="$(git -C "$project_dir" branch --show-current)"

# --- Build container image (reuses epic-runner Dockerfile) ---
echo "Building epic-runner container..."
docker build -q -t epic-runner \
  --build-arg HOST_UID="$(id -u)" \
  --build-arg HOST_GID="$(id -g)" \
  -f "$runner_dir/Dockerfile" "$project_dir"

container_name="reflect-$(date +%Y%m%d-%H%M%S)"

# SSH agent is required for git access inside the container
if [ -z "${SSH_AUTH_SOCK:-}" ]; then
  echo "ERROR: SSH_AUTH_SOCK is not set. Start an ssh-agent first:"
  echo '  eval "$(ssh-agent -s)" && ssh-add'
  exit 1
fi

echo "Running reflection on branch $branch..."
echo "Container name: $container_name"

# Remove stale container with same name if it exists
docker rm "$container_name" 2>/dev/null || true

# Persistent volume for Claude Code memory across runs
docker volume create reflect-claude-home 2>/dev/null || true
# Fix ownership so container user (runner) can write to it
docker run --rm -v reflect-claude-home:/data alpine chown "$(id -u):$(id -g)" /data

if [ "$raw_mode" = true ]; then
  docker run --name "$container_name" \
    --env-file "$environment_file" \
    -e REFLECT_MODEL="${REFLECT_MODEL:-gpt-6-astra}" \
    -e REFLECT_MAX_STEPS="${REFLECT_MAX_STEPS:-100}" \
    -e STIGMERGENCE_HISTORY_PATH=/runtime/stigmergence-history.md \
    -e STIGMERGENCE_OUTSIDE_JOURNAL_CHECKPOINT_PATH=/runtime-trust/outside-actions.checkpoint.json \
    -e CODEX_HOME=/home/runner/.codex \
    -e CONTAINER=true \
    -e REPO_URL="$repo_url" \
    -e BRANCH="$branch" \
    -v "${SSH_AUTH_SOCK}:/ssh-agent" \
    -e SSH_AUTH_SOCK=/ssh-agent \
    -v "$runner_dir/run-reflect.sh:/run-reflect.sh:ro" \
    -v "$runner_dir/gallery-url.sh:/gallery-url.sh:ro" \
    -v "$history_file:/runtime/stigmergence-history.md:ro" \
    -v "$runtime_private_dir:/runtime-private" \
    -v "$runtime_trust_dir:/runtime-trust" \
    -v "reflect-claude-home:/claude-source:ro" \
    -v "$codex_volume:/codex-source:ro" \
    epic-runner /run-reflect.sh 2>&1 | tee "$log_file"
else
  docker run --name "$container_name" \
    --env-file "$environment_file" \
    -e REFLECT_MODEL="${REFLECT_MODEL:-gpt-6-astra}" \
    -e REFLECT_MAX_STEPS="${REFLECT_MAX_STEPS:-100}" \
    -e STIGMERGENCE_HISTORY_PATH=/runtime/stigmergence-history.md \
    -e STIGMERGENCE_OUTSIDE_JOURNAL_CHECKPOINT_PATH=/runtime-trust/outside-actions.checkpoint.json \
    -e CODEX_HOME=/home/runner/.codex \
    -e CONTAINER=true \
    -e REPO_URL="$repo_url" \
    -e BRANCH="$branch" \
    -v "${SSH_AUTH_SOCK}:/ssh-agent" \
    -e SSH_AUTH_SOCK=/ssh-agent \
    -v "$runner_dir/run-reflect.sh:/run-reflect.sh:ro" \
    -v "$runner_dir/gallery-url.sh:/gallery-url.sh:ro" \
    -v "$history_file:/runtime/stigmergence-history.md:ro" \
    -v "$runtime_private_dir:/runtime-private" \
    -v "$runtime_trust_dir:/runtime-trust" \
    -v "reflect-claude-home:/claude-source:ro" \
    -v "$codex_volume:/codex-source:ro" \
    epic-runner /run-reflect.sh 2>&1 | tee "$log_file" | bun run "$script_dir/reflect-stream-fmt.ts"
fi

# Update latest symlink
ln -sf "$(basename "$log_file")" "$log_dir/latest.jsonl"

echo ""
echo "Container $container_name finished. Cleaning up..."
docker rm "$container_name"

# --- Pull any code changes the reflection pushed ---
echo "Pulling code changes from remote..."
git -C "$project_dir" pull --ff-only || echo "No new commits to pull."

echo "Done. Code changes (if any) pulled."
echo "Log saved: $log_file"
