#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

load_env_file_without_overrides() {
    local env_file="$1"
    local line
    local variable_name

    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*$ ]] || [[ "$line" =~ ^[[:space:]]*# ]]; then
            continue
        fi

        if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)= ]]; then
            variable_name="${BASH_REMATCH[2]}"

            if [[ -v "$variable_name" ]]; then
                continue
            fi

            if [[ "$line" =~ ^[[:space:]]*export[[:space:]]+ ]]; then
                eval "$line"
            else
                eval "export $line"
            fi
        fi
    done < "$env_file"
}

load_env_files() {
    if [[ -f .env ]]; then
        load_env_file_without_overrides .env
    fi

    if [[ -f .env.local ]]; then
        load_env_file_without_overrides .env.local
    fi
}

load_env_files

run() {
    "$@"
}