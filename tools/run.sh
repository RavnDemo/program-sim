#!/usr/bin/env bash
# One sim command, then save the ledger. With LOOP_MINUTES set (scheduled runs), keep ticking every
# TICK_EVERY_MINUTES until the budget runs out: GitHub fires scheduled workflows only a few times a day on a quiet
# repo, so each run stays alive and does the ticking itself.
set -euo pipefail
ledger=".ledger/$([ "${LIVE:-false}" = true ] && echo ledger.json || echo dry-run.json)"
flags=(--ledger "$ledger")
[ "${LIVE:-false}" = true ] && flags+=(--live)

save() {
  ( cd .ledger
    git add -A
    git diff --cached --quiet && exit 0
    git -c user.name='program-sim[bot]' -c user.email='program-sim@users.noreply.github.com' \
      commit -q -m "ledger: ${COMMAND} ${ARG:-} ($([ "${LIVE:-false}" = true ] && echo live || echo dry run))"
    git pull -q --rebase origin ledger 2>/dev/null || true
    git push -q origin ledger )
}

once() {
  node src/cli.ts "$COMMAND" ${ARG:+"$ARG"} "${flags[@]}" | tee -a run.log
  # Keep the calibration page current on the ledger branch (cheap: reads the ledger only).
  [ "$COMMAND" = tick ] && node src/cli.ts calibrate "${flags[@]}" > /dev/null || true
  save
}

once
if [ -n "${LOOP_MINUTES:-}" ]; then
  deadline=$(( $(date +%s) + LOOP_MINUTES * 60 ))
  every=$(( ${TICK_EVERY_MINUTES:-15} * 60 ))
  while [ $(( $(date +%s) + every )) -lt "$deadline" ]; do
    sleep "$every"
    once
  done
fi
