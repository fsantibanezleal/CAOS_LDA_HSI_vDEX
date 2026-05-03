#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv-pipeline ]]; then
  python3 -m venv .venv-pipeline
fi

.venv-pipeline/bin/python -m pip install --upgrade pip wheel
.venv-pipeline/bin/python -m pip install -r data-pipeline/requirements.txt
