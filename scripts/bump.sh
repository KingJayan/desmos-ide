#!/usr/bin/env bash

set -e

case "$1" in
    patch|minor|major)
        TYPE="$1"
        ARG="$1"
        ;;
    hotfix)
        TYPE="prepatch --preid=hotfix"
        ARG="hotfix"
        ;;
    *)
        echo "usage: $0 <patch|minor|major|hotfix>"
        exit 1
        ;;
esac

bun pm version $TYPE --no-git-tag-version

(cd editors/vscode && bun run bump:$ARG)
