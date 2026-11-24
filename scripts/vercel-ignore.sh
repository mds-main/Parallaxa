#!/bin/sh
# Fail-open Vercel ignore build step: exit 0 = skip build, exit 1 = proceed with build.
if [ "$VERCEL_ENV" != "production" ]; then
  exit 0
fi

BASE="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"
if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  BASE="HEAD^"
fi
if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
  exit 1
fi
if [ "$(git rev-parse "$BASE")" = "$(git rev-parse HEAD)" ]; then
  exit 1
fi

FILES=$(git -c core.quotepath=false diff --name-only "$BASE" HEAD)
if [ -z "$FILES" ]; then
  exit 1
fi

if printf '%s\n' "$FILES" | grep -qEv '^(docs/|e2e/|tests/|\.github/|[^/]+\.md$|LICENSE$|playwright\.config\.ts$|vitest\.config\.ts$|.*\.test\.tsx?$)'; then
  exit 1
fi

exit 0
