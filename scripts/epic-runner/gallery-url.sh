#!/usr/bin/env bash

derive_gallery_url() {
  local source_url="${1:?source repository URL required}"

  case "$source_url" in
    */physarum.git)
      printf '%s/stigmergence.git\n' "${source_url%/physarum.git}"
      ;;
    */physarum)
      printf '%s/stigmergence.git\n' "${source_url%/physarum}"
      ;;
    *)
      echo "ERROR: cannot derive gallery repository from source URL" >&2
      return 1
      ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  derive_gallery_url "${1:?source repository URL required}"
fi
