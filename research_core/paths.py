"""Shared filesystem paths for the local validation backend."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
LOCAL_DIR = DATA_DIR / "local"
DERIVED_DIR = DATA_DIR / "derived"
DERIVED_MANIFESTS_DIR = DERIVED_DIR / "manifests"
MANIFESTS_DIR = DATA_DIR / "manifests"
OUTPUT_SCHEMAS_DIR = MANIFESTS_DIR / "output-schemas"
PIPELINE_RUNS_DIR = DATA_DIR / "pipeline-runs"
CORE_DERIVED_DIR = DERIVED_DIR / "core"
