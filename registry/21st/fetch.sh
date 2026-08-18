#!/usr/bin/env bash
# Fetch a component's source straight from the registry using the saved CLI session.
# Usage: ./fetch.sh <author>/<slug>        e.g. ./fetch.sh shadcnspace/footer-01
# NOTE: this still consumes the account's daily retrieval quota (server-side metered).
set -euo pipefail
T=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.config/21st/auth.json')))['token'])")
curl -s --max-time 30 "https://21st.dev/r/$1?api_key=$T"
