#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

strict="${PAPPICE_CHECK_STRICT:-0}"
case "$strict" in
  0|1) ;;
  *)
    echo "PAPPICE_CHECK_STRICT must be 0 or 1" >&2
    exit 2
    ;;
esac

skip_or_fail() {
  local message="$1"
  if [[ "$strict" == "1" ]]; then
    echo "Required check unavailable: $message" >&2
    exit 1
  fi
  echo "Skipping optional check: $message" >&2
}

find_chromium() {
  local configured="${PAPPICE_E2E_CHROMIUM:-${CHROMIUM:-}}"
  local candidates=()
  local candidate resolved

  if [[ -n "$configured" ]]; then
    candidates=("$configured")
  else
    candidates=(chromium chromium-browser google-chrome-stable google-chrome)
    if [[ "$(uname -s)" == "Darwin" ]]; then
      candidates+=(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
        "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        "$HOME/Applications/Chromium.app/Contents/MacOS/Chromium"
      )
    fi
  fi

  for candidate in "${candidates[@]}"; do
    if resolved="$(command -v "$candidate" 2>/dev/null)"; then
      printf '%s\n' "$resolved"
      return 0
    fi
    if [[ "$candidate" == */* && -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  if [[ -n "$configured" ]]; then
    echo "Configured Chromium executable was not found: $configured" >&2
    return 2
  fi
  return 1
}

unformatted="$(find cmd internal -type f -name '*.go' -exec gofmt -l {} +)"
if [[ -n "$unformatted" ]]; then
  printf 'Run gofmt on:\n%s\n' "$unformatted" >&2
  exit 1
fi

for script in scripts/*.sh; do
  bash -n "$script"
done

go vet ./...

race_errors="$(mktemp "${TMPDIR:-/tmp}/pappice-race.XXXXXX")"
trap 'rm -f "$race_errors"' EXIT
if go test -race ./... 2>"$race_errors"; then
  cat "$race_errors" >&2
elif grep -Eq -- '-race (is not supported|requires cgo)' "$race_errors"; then
  race_reason="$(tr '\n' ' ' < "$race_errors")"
  skip_or_fail "${race_reason% }"
  go test ./...
else
  cat "$race_errors" >&2
  exit 1
fi
rm -f "$race_errors"
trap - EXIT

go test -tags debug ./cmd/pappice

if ! command -v npm >/dev/null 2>&1; then
  skip_or_fail "npm is unavailable"
elif chromium="$(find_chromium)"; then
  PAPPICE_E2E_CHROMIUM="$chromium" npm run test:e2e
else
  chromium_status=$?
  if ((chromium_status == 2)); then
    exit 1
  fi
  skip_or_fail "Chromium was not found; set PAPPICE_E2E_CHROMIUM to its executable"
fi
