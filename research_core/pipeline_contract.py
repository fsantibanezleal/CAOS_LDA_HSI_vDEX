"""Helpers for the master-plan pipeline contract."""
from __future__ import annotations

import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from research_core.paths import DERIVED_DIR, MANIFESTS_DIR, ROOT


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def maybe_git_sha() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None

    if result.returncode != 0:
        return None
    value = result.stdout.strip()
    return value or None


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return f"sha256:{digest.hexdigest()}"


def relative_repo_path(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def artifact_format(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".json":
        return "json"
    if suffix == ".png":
        return "png"
    if suffix == ".jpg" or suffix == ".jpeg":
        return "jpeg"
    if suffix == ".npz":
        return "npz"
    if suffix == ".npy":
        return "npy"
    if suffix == ".bin":
        return "binary"
    if suffix == ".parquet":
        return "parquet"
    return suffix.lstrip(".") or "file"


def artifact_id_from_relative_path(relative_path: str) -> str:
    normalized = relative_path.removeprefix("data/").removeprefix("derived/")
    stem = normalized.rsplit(".", 1)[0]
    return stem.replace("/", ".").replace("\\", ".")


def artifact_schema_hint(relative_path: str) -> str | None:
    if relative_path.startswith("data/derived/eda/per_scene/") and relative_path.endswith(".json"):
        return "output-schemas/eda_per_scene.schema.json"
    if relative_path.startswith("data/derived/groupings/") and relative_path.endswith(".json"):
        return "output-schemas/grouping_scene.schema.json"
    if relative_path.startswith("data/derived/quantization/") and relative_path.endswith(".json"):
        return "output-schemas/quantization_scene.schema.json"
    if relative_path.startswith("data/derived/recipes/") and relative_path.endswith(".json"):
        return "output-schemas/recipe_scene.schema.json"
    if relative_path == "data/derived/manifests/index.json":
        return "output-schemas/manifest-index.schema.json"
    return None


def derived_artifact_paths() -> list[Path]:
    files = sorted(path for path in DERIVED_DIR.rglob("*") if path.is_file())
    skip_names = {"README.md", "index.json"}
    return [
        path
        for path in files
        if path.name not in skip_names
        and "node_modules" not in path.parts
    ]


def load_pipeline_builders() -> dict[str, Any]:
    return load_json(MANIFESTS_DIR / "pipeline_builders.json")


def load_web_contract() -> dict[str, Any]:
    return load_json(MANIFESTS_DIR / "web_contract.json")
