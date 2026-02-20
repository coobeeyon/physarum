#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
delay="${1:-900}"

echo "=== Reflection loop: run, wait ${delay}s, run again ==="

echo ""
echo "--- Run 1 starting at $(date) ---"
"$script_dir/run-reflect.sh" || echo "Run 1 exited with status $?"

echo ""
echo "--- Waiting ${delay}s until next run ---"
sleep "$delay"

echo ""
echo "--- Run 2 starting at $(date) ---"
"$script_dir/run-reflect.sh" || echo "Run 2 exited with status $?"

echo ""
echo "=== Loop complete at $(date) ==="
