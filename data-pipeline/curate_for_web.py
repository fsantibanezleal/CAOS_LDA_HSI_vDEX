"""Write the first master-plan manifest contract for derived web assets."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from research_core.paths import DERIVED_DIR, DERIVED_MANIFESTS_DIR
from research_core.pipeline_contract import (
    artifact_format,
    artifact_id_from_relative_path,
    artifact_schema_hint,
    derived_artifact_paths,
    load_json,
    load_pipeline_builders,
    load_web_contract,
    maybe_git_sha,
    relative_repo_path,
    sha256_file,
    utc_now_iso,
    write_json,
)


REAL_SCENES_PATH = DERIVED_DIR / "real" / "real_samples.json"
BUILDER_INVENTORY_PATH = DERIVED_MANIFESTS_DIR / "builder_inventory.json"
WEB_CONTRACT_PATH = DERIVED_MANIFESTS_DIR / "web_contract.json"
INDEX_PATH = DERIVED_MANIFESTS_DIR / "index.json"


def scene_summaries() -> list[dict[str, Any]]:
    if not REAL_SCENES_PATH.exists():
        return []

    payload = load_json(REAL_SCENES_PATH)
    summaries: list[dict[str, Any]] = []
    for scene in payload.get("scenes", []):
        cube_shape = scene.get("cube_shape") or []
        n_pixels = None
        if len(cube_shape) >= 2:
            n_pixels = int(cube_shape[0]) * int(cube_shape[1])

        labeled_pixels = scene.get("labeled_pixels")
        summaries.append(
            {
                "id": scene["id"],
                "n_pixels": n_pixels,
                "n_labelled": int(labeled_pixels) if labeled_pixels is not None else None,
                "wavelengths_present": bool(scene.get("approximate_wavelengths_nm")),
            }
        )
    return summaries


def builder_index(now_iso: str) -> dict[str, dict[str, Any]]:
    spec = load_pipeline_builders()
    version = str(spec.get("version", "0.1.0"))
    builders: dict[str, dict[str, Any]] = {}
    for item in spec.get("builders", []):
        builder_id = str(item["id"])
        builders[builder_id] = {
            "version": version,
            "status": str(item.get("status", "planned")),
            "script_path": item.get("script"),
            "ran_at": now_iso if builder_id == "curate_for_web" else None,
            "duration_s": 0.0 if builder_id == "curate_for_web" else None,
        }
    return builders


def artifact_entries() -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in derived_artifact_paths():
        relative_path = relative_repo_path(path)
        entries.append(
            {
                "id": artifact_id_from_relative_path(relative_path),
                "path": relative_path,
                "format": artifact_format(path),
                "bytes": int(path.stat().st_size),
                "schema": artifact_schema_hint(relative_path),
                "input_hash": sha256_file(path),
            }
        )
    return entries


def build_index(now_iso: str) -> dict[str, Any]:
    web_contract = load_web_contract()
    return {
        "generated_at": now_iso,
        "git_sha": maybe_git_sha(),
        "builders": builder_index(now_iso),
        "scenes": scene_summaries(),
        "artifacts": artifact_entries(),
        "claims_allowed": list(web_contract.get("claims_allowed", [])),
    }


def write_supporting_manifests(now_iso: str) -> None:
    builders_payload = load_pipeline_builders()
    builders_snapshot = {
        "generated_at": now_iso,
        **builders_payload,
    }
    write_json(BUILDER_INVENTORY_PATH, builders_snapshot)

    web_contract_payload = load_web_contract()
    web_contract_snapshot = {
        "generated_at": now_iso,
        **web_contract_payload,
    }
    write_json(WEB_CONTRACT_PATH, web_contract_snapshot)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Build the manifest payload without writing files.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    now_iso = utc_now_iso()
    if args.dry_run:
        payload = build_index(now_iso)
        print(
            f"Dry run: {len(payload['builders'])} builders, "
            f"{len(payload['scenes'])} scenes, "
            f"{len(payload['artifacts'])} artifacts"
        )
        return

    write_supporting_manifests(now_iso)
    index_payload = build_index(now_iso)
    write_json(INDEX_PATH, index_payload)
    print(f"Wrote manifest index to {INDEX_PATH}")


if __name__ == "__main__":
    main()
