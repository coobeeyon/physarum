#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
delay="${1:-900}"
run=0

echo "=== Reflection loop: run every ${delay}s (Ctrl-C to stop) ==="

while true; do
  run=$((run + 1))
  echo ""
  echo "--- Run $run starting at $(date) ---"
  "$script_dir/run-reflect.sh" || echo "Run $run exited with status $?"

  echo ""
  echo "--- Waiting ${delay}s until next run ---"
  sleep "$delay"
done
