#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

load_env_files() {
    if [[ -f .env ]]; then
        set -a
        source .env
        set +a
    fi

    if [[ -f .env.local ]]; then
        set -a
        source .env.local
        set +a
    fi
}

load_env_files

run() {
    "$@"
}