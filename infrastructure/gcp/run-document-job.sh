#!/usr/bin/env sh
set -eu

npm run worker:documents:job --workspace=apps/custom &
customs_pid=$!
npm run worker:documents:job --workspace=apps/tms &
tms_pid=$!

cleanup() {
  kill "${customs_pid}" "${tms_pid}" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

status=0
wait "${customs_pid}" || status=$?
wait "${tms_pid}" || status=$?
exit "${status}"
