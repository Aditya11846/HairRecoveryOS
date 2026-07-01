#!/usr/bin/env bash
# Dev-only tool: spoof today's check-in state on the booted iOS Simulator so all
# three Overview states (nothing/partial/fully logged) can be screenshotted and
# reviewed without touching the real Supabase-synced data on a physical device.
#
# This only ever writes to the simulator's local sandboxed AsyncStorage file —
# it never calls saveCheckin/pushToSupabase, so nothing is pushed to the shared
# backend. Safe to run against a simulator that shares a Supabase account with
# your real device.
#
# Usage:
#   scripts/dev-spoof-checkin.sh backup     # save the current real local state
#   scripts/dev-spoof-checkin.sh nothing    # spoof "nothing logged" (null trick)
#   scripts/dev-spoof-checkin.sh partial    # spoof "1 of 3 done"
#   scripts/dev-spoof-checkin.sh full       # spoof "all done" + a streak/cigs sample
#   scripts/dev-spoof-checkin.sh restore    # restore what `backup` saved
#
# Typical flow: backup -> nothing -> screenshot -> partial -> screenshot ->
# full -> screenshot -> restore.

set -euo pipefail

BUNDLE_ID="com.adityasingh.hairrecoveryos"
BACKUP_FILE="/tmp/hairos_checkin_manifest_backup.json"
TODAY="$(date +%F)"
KEY="hair_os_checkin_${TODAY}"

manifest_path() {
  local data_dir
  data_dir=$(xcrun simctl get_app_container booted "$BUNDLE_ID" data 2>/dev/null) || {
    echo "error: no booted simulator has $BUNDLE_ID installed. Boot the simulator and install the app first." >&2
    exit 1
  }
  echo "$data_dir/Library/Application Support/$BUNDLE_ID/RCTAsyncLocalStorage_V1/manifest.json"
}

reload_app() {
  xcrun simctl terminate booted "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch booted "$BUNDLE_ID" >/dev/null
  sleep 4
}

write_value() {
  local value="$1"
  local manifest
  manifest=$(manifest_path)
  python3 -c "
import json
manifest = json.load(open('$manifest'))
manifest['$KEY'] = '''$value'''
json.dump(manifest, open('$manifest', 'w'))
"
  reload_app
}

cmd="${1:-}"
case "$cmd" in
  backup)
    manifest=$(manifest_path)
    cp "$manifest" "$BACKUP_FILE"
    echo "backed up $manifest -> $BACKUP_FILE"
    ;;
  restore)
    if [ ! -f "$BACKUP_FILE" ]; then
      echo "error: no backup found at $BACKUP_FILE — run 'backup' first" >&2
      exit 1
    fi
    manifest=$(manifest_path)
    cp "$BACKUP_FILE" "$manifest"
    reload_app
    echo "restored real state from $BACKUP_FILE"
    ;;
  nothing)
    # Literal JSON "null" string: AsyncStorage.getItem returns a truthy
    # non-empty string so the app's Supabase fallback never fires, but
    # JSON.parse("null") still evaluates to null -> genuine empty state.
    write_value 'null'
    echo "spoofed: nothing logged"
    ;;
  partial)
    json_value=$(python3 -c "
import json
print(json.dumps({
  'oralMinoxidil': True, 'topicalMinoxidil': None, 'dutasteride': None,
  'cigarettes': 0, 'sleep': 7, 'stress': 3, 'redLightComb': None,
  'sheddingNoticed': None, 'notes': '', 'customValues': {},
  'date': '$TODAY', 'savedAt': '${TODAY}T00:00:00.000Z', 'synced': True
}))
")
    write_value "$json_value"
    echo "spoofed: partial (1 of 3 done)"
    ;;
  full)
    json_value=$(python3 -c "
import json
print(json.dumps({
  'oralMinoxidil': True, 'topicalMinoxidil': True, 'dutasteride': True,
  'cigarettes': 2, 'sleep': 7, 'stress': 3, 'redLightComb': True,
  'sheddingNoticed': None, 'notes': '', 'customValues': {},
  'date': '$TODAY', 'savedAt': '${TODAY}T00:00:00.000Z', 'synced': True
}))
")
    write_value "$json_value"
    echo "spoofed: fully logged (all done)"
    ;;
  *)
    echo "usage: $0 {backup|nothing|partial|full|restore}" >&2
    exit 1
    ;;
esac
