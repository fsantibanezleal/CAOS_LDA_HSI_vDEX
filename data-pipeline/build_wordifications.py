"""Build thin-slice wordified corpora under the master-plan contract."""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.io import loadmat

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from research_core.paths import DERIVED_DIR, LOCAL_DIR
from research_core.raw_scenes import SCENES as RAW_SCENES
from research_core.raw_scenes import approximate_wavelengths as approximate_scene_wavelengths
from research_core.raw_scenes import load_scene as load_raw_scene
from research_core.raw_scenes import valid_spectra_mask
from research_core.unmixing import SCENES as UNMIXING_SCENES
from research_core.unmixing import approximate_wavelengths as approximate_unmixing_wavelengths
from research_core.unmixing import load_unmixing_cube_shape, load_unmixing_scene


REAL_SAMPLES_PATH = DERIVED_DIR / "real" / "real_samples.json"
LOCAL_ROOT = LOCAL_DIR / "wordifications"
DERIVED_ROOT = DERIVED_DIR / "recipes"
GROUPINGS_LOCAL_ROOT = LOCAL_DIR / "groupings"
QUANT_LOCAL_ROOT = LOCAL_ROOT / "quantization"
SCENE_ID_ALIASES = {
    "cuprite-upv-reflectance": "cuprite-aviris-reflectance",
}
DEFAULT_PIXEL_MAX_DOCS = 10000
DEFAULT_QUANT_CONFIG_IDS = ["uniform_per_band_Q16", "quantile_per_band_Q16"]
EPSILON = 1e-6


@dataclass(frozen=True)
class RecipeVariant:
    id: str
    base_recipe_id: str
    document_constructor_id: str
    mode: str
    summary: str


RECIPE_VARIANTS: dict[str, RecipeVariant] = {
    "magnitude-phrase__pixel": RecipeVariant(
        id="magnitude-phrase__pixel",
        base_recipe_id="magnitude-phrase",
        document_constructor_id="pixel",
        mode="pixel",
        summary="One sampled valid spectrum per document; one magnitude token per band position.",
    ),
    "band-frequency__pixel": RecipeVariant(
        id="band-frequency__pixel",
        base_recipe_id="band-frequency",
        document_constructor_id="pixel",
        mode="pixel",
        summary="One sampled valid spectrum per document; one band token weighted by quantized magnitude per band.",
    ),
    "band-magnitude__pixel": RecipeVariant(
        id="band-magnitude__pixel",
        base_recipe_id="band-magnitude",
        document_constructor_id="pixel",
        mode="pixel",
        summary="One sampled valid spectrum per document; one joint band-magnitude token per band position.",
    ),
    "region-documents__patch_15": RecipeVariant(
        id="region-documents__patch_15",
        base_recipe_id="region-documents",
        document_constructor_id="patch_15",
        mode="region",
        summary="One patch_15 grouping per document; counts aggregate joint band-magnitude events over all valid spectra in the region.",
    ),
    "region-documents__slic_200": RecipeVariant(
        id="region-documents__slic_200",
        base_recipe_id="region-documents",
        document_constructor_id="slic_200",
        mode="region",
        summary="One slic_200 grouping per document; counts aggregate joint band-magnitude events over all valid spectra in the region.",
    ),
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def round_scalar(value: float | np.floating[Any] | None, digits: int = 6) -> float | None:
    if value is None:
        return None
    rounded = round(float(value), digits)
    return 0.0 if rounded == 0 else rounded


def round_vector(values: np.ndarray | list[float], digits: int = 6) -> list[float]:
    return [round_scalar(value, digits) for value in np.asarray(values, dtype=np.float64).tolist()]


def stats_summary(values: np.ndarray) -> dict[str, float | int]:
    array = np.asarray(values, dtype=np.float64)
    if array.size == 0:
        return {
            "min": 0,
            "p5": 0.0,
            "p25": 0.0,
            "median": 0.0,
            "p75": 0.0,
            "p95": 0.0,
            "max": 0,
            "mean": 0.0,
        }
    return {
        "min": int(np.min(array)),
        "p5": round_scalar(np.percentile(array, 5)),
        "p25": round_scalar(np.percentile(array, 25)),
        "median": round_scalar(np.percentile(array, 50)),
        "p75": round_scalar(np.percentile(array, 75)),
        "p95": round_scalar(np.percentile(array, 95)),
        "max": int(np.max(array)),
        "mean": round_scalar(np.mean(array)),
    }


def class_name_lookup() -> dict[str, dict[int, str]]:
    payload = load_json(REAL_SAMPLES_PATH)
    lookup: dict[str, dict[int, str]] = {}
    for scene in payload.get("scenes", []):
        lookup[str(scene["id"])] = {
            int(summary["label_id"]): str(summary["name"])
            for summary in scene.get("class_summaries", [])
        }
    return lookup


def stabilize_edges_1d(edges: np.ndarray) -> np.ndarray:
    result = np.asarray(edges, dtype=np.float64).copy()
    if result[-1] <= result[0]:
        result[-1] = result[0] + EPSILON
    for index in range(1, result.shape[0]):
        if result[index] <= result[index - 1]:
            result[index] = result[index - 1] + EPSILON
    return result


def quantize_from_edges(features: np.ndarray, edges: np.ndarray, domain: str) -> np.ndarray:
    if domain == "global":
        return np.searchsorted(np.asarray(edges, dtype=np.float64)[1:-1], features, side="right").astype(np.int16)

    band_edges = np.asarray(edges, dtype=np.float64)
    quantized = np.empty(features.shape, dtype=np.int16)
    for band_index in range(features.shape[1]):
        quantized[:, band_index] = np.searchsorted(
            band_edges[band_index, 1:-1],
            features[:, band_index],
            side="right",
        ).astype(np.int16)
    return quantized


def band_token(wavelength: float) -> str:
    return f"{int(round(float(wavelength))):04d}nm"


def build_band_tokens(wavelengths: np.ndarray) -> np.ndarray:
    return np.asarray([band_token(value) for value in wavelengths], dtype=object)


def build_magnitude_lookup(q: int) -> np.ndarray:
    return np.asarray([f"q{level:02d}" for level in range(q)], dtype=object)


def build_band_magnitude_lookup(wavelengths: np.ndarray, q: int) -> np.ndarray:
    band_tokens = build_band_tokens(wavelengths)
    lookup = np.empty((wavelengths.shape[0], q), dtype=object)
    for band_index, band_name in enumerate(band_tokens.tolist()):
        for level in range(q):
            lookup[band_index, level] = f"{band_name}_q{level:02d}"
    return lookup


def scene_payload(scene_id: str) -> dict[str, Any]:
    if scene_id in RAW_SCENES:
        cube, gt, config = load_raw_scene(scene_id)
        public_scene_id = SCENE_ID_ALIASES.get(scene_id, scene_id)
        return {
            "scene_id": public_scene_id,
            "cube": cube.astype(np.float32, copy=False),
            "gt": gt,
            "wavelengths_nm": approximate_scene_wavelengths(config, cube.shape[-1]),
            "family_id": config.family_id,
        }

    if scene_id in UNMIXING_SCENES:
        spectra, _, _, config = load_unmixing_scene(scene_id)
        rows, cols, _ = load_unmixing_cube_shape(scene_id)
        band_count = int(spectra.shape[1])
        cube = spectra.reshape(rows, cols, band_count).astype(np.float32)
        return {
            "scene_id": scene_id,
            "cube": cube,
            "gt": None,
            "wavelengths_nm": approximate_unmixing_wavelengths(config, band_count),
            "family_id": "unlabeled-spectral-image",
        }

    raise KeyError(f"Unknown scene id: {scene_id}")


def load_quantization_definition(scene_id: str, quantization_config_id: str) -> dict[str, Any]:
    path = QUANT_LOCAL_ROOT / quantization_config_id / f"{scene_id}.json"
    if not path.exists():
        raise FileNotFoundError(f"Quantization config not found: {path}")
    payload = load_json(path)
    payload["__path__"] = str(path.relative_to(ROOT)).replace("\\", "/")
    return payload


def load_grouping_assignments(scene_id: str, grouping_id: str) -> np.ndarray:
    path = GROUPINGS_LOCAL_ROOT / grouping_id / f"{scene_id}.npy"
    if not path.exists():
        raise FileNotFoundError(f"Grouping assignments not found: {path}")
    return np.load(path).astype(np.int32, copy=False)


def sample_pixel_documents(
    flat_valid_indices: np.ndarray,
    flat_labels: np.ndarray | None,
    max_docs: int,
    random_state: int = 42,
) -> np.ndarray:
    if flat_valid_indices.shape[0] <= max_docs:
        return flat_valid_indices.copy()

    rng = np.random.default_rng(random_state)
    if flat_labels is None:
        sample = rng.choice(flat_valid_indices, size=max_docs, replace=False)
        return np.sort(sample.astype(np.int64, copy=False))

    label_lookup = flat_labels[flat_valid_indices]
    positive_mask = label_lookup > 0
    if not np.any(positive_mask):
        sample = rng.choice(flat_valid_indices, size=max_docs, replace=False)
        return np.sort(sample.astype(np.int64, copy=False))

    selected: list[np.ndarray] = []
    positive_indices = flat_valid_indices[positive_mask]
    positive_labels = label_lookup[positive_mask]
    unique_labels = [int(value) for value in np.unique(positive_labels)]
    total_positive = int(positive_indices.shape[0])
    budget_used = 0

    for label_id in unique_labels:
        label_indices = positive_indices[positive_labels == label_id]
        proportional = int(round(max_docs * (label_indices.shape[0] / max(total_positive, 1))))
        take = min(label_indices.shape[0], max(1, proportional))
        chosen = rng.choice(label_indices, size=take, replace=False)
        selected.append(np.asarray(chosen, dtype=np.int64))
        budget_used += int(take)

    selected_flat = np.unique(np.concatenate(selected)) if selected else np.array([], dtype=np.int64)
    if selected_flat.shape[0] >= max_docs:
        if selected_flat.shape[0] > max_docs:
            selected_flat = rng.choice(selected_flat, size=max_docs, replace=False)
        return np.sort(selected_flat.astype(np.int64, copy=False))

    remaining = np.setdiff1d(flat_valid_indices, selected_flat, assume_unique=False)
    remaining_budget = max_docs - selected_flat.shape[0]
    if remaining_budget > 0 and remaining.shape[0] > 0:
        fill = rng.choice(remaining, size=min(remaining_budget, remaining.shape[0]), replace=False)
        selected_flat = np.concatenate([selected_flat, np.asarray(fill, dtype=np.int64)])
    return np.sort(selected_flat.astype(np.int64, copy=False))


def token_band_reverse_map_for_band_tokens(
    band_tokens: np.ndarray,
    wavelengths: np.ndarray,
) -> dict[str, dict[str, int | float]]:
    result: dict[str, dict[str, int | float]] = {}
    for band_index, token in enumerate(band_tokens.tolist()):
        result[str(token)] = {
            "band_index": int(band_index),
            "wavelength_nm": round_scalar(wavelengths[band_index]),
        }
    return result


def token_band_reverse_map_for_band_magnitude(
    band_magnitude_lookup: np.ndarray,
    wavelengths: np.ndarray,
    q: int,
) -> dict[str, dict[str, int | float]]:
    result: dict[str, dict[str, int | float]] = {}
    for band_index in range(wavelengths.shape[0]):
        for level in range(q):
            token = str(band_magnitude_lookup[band_index, level])
            result[token] = {
                "band_index": int(band_index),
                "wavelength_nm": round_scalar(wavelengths[band_index]),
                "bin_id": int(level),
            }
    return result


def label_length_summary(documents: list[dict[str, Any]]) -> dict[str, Any] | None:
    labeled = [document for document in documents if document.get("label_id") is not None]
    if not labeled:
        return None

    per_label: dict[int, list[int]] = {}
    name_lookup: dict[int, str] = {}
    for document in labeled:
        label_id = int(document["label_id"])
        per_label.setdefault(label_id, []).append(int(document["document_length"]))
        label_name = document.get("label_name")
        if label_name:
            name_lookup[label_id] = str(label_name)

    all_lengths = np.asarray([int(document["document_length"]) for document in labeled], dtype=np.float64)
    grand_mean = float(np.mean(all_lengths))
    ss_total = float(np.sum((all_lengths - grand_mean) ** 2))
    ss_between = 0.0
    rows = []
    for label_id in sorted(per_label):
        values = np.asarray(per_label[label_id], dtype=np.float64)
        label_mean = float(np.mean(values))
        ss_between += float(values.shape[0]) * ((label_mean - grand_mean) ** 2)
        rows.append(
            {
                "label_id": int(label_id),
                "label_name": name_lookup.get(label_id),
                "document_count": int(values.shape[0]),
                "mean_length": round_scalar(label_mean),
                "median_length": round_scalar(np.median(values)),
            }
        )
    eta_squared = float(ss_between / ss_total) if ss_total > 0 else 0.0
    return {
        "metric": "eta_squared",
        "eta_squared": round_scalar(eta_squared),
        "per_label": rows,
    }


def top_tokens_summary(rows: pd.DataFrame, document_count: int, limit: int = 200) -> list[dict[str, Any]]:
    grouped = (
        rows.groupby("token", observed=True)
        .agg(global_frequency=("count", "sum"), document_frequency=("document_id", "nunique"))
        .reset_index()
    )
    grouped["idf"] = np.log((1.0 + document_count) / (1.0 + grouped["document_frequency"])) + 1.0
    grouped = grouped.sort_values(["global_frequency", "document_frequency", "token"], ascending=[False, False, True])
    result: list[dict[str, Any]] = []
    for row in grouped.head(limit).itertuples(index=False):
        result.append(
            {
                "token": str(row.token),
                "global_frequency": int(row.global_frequency),
                "document_frequency": int(row.document_frequency),
                "idf": round_scalar(row.idf),
            }
        )
    return result


def write_parquet(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    optimized = frame.copy()
    optimized["document_id"] = optimized["document_id"].astype("int32")
    optimized["position"] = optimized["position"].astype("int16")
    optimized["count"] = optimized["count"].astype("int32")
    optimized["token"] = optimized["token"].astype("category")
    optimized.to_parquet(path, engine="pyarrow", compression="zstd", index=False)


def local_paths(recipe_variant_id: str, quantization_config_id: str, scene_id: str) -> dict[str, Path]:
    base = LOCAL_ROOT / recipe_variant_id / quantization_config_id
    return {
        "corpus": base / f"{scene_id}.parquet",
        "summary": base / f"{scene_id}.json",
        "docs": base / f"{scene_id}.docs.json",
        "vocab": base / f"{scene_id}.vocab.json",
    }


def derived_path(recipe_variant_id: str, quantization_config_id: str, scene_id: str) -> Path:
    return DERIVED_ROOT / f"{recipe_variant_id}__{quantization_config_id}" / f"{scene_id}.json"


def build_pixel_corpus_rows(
    recipe: RecipeVariant,
    quantized_selected: np.ndarray,
    band_tokens: np.ndarray,
    band_magnitude_lookup: np.ndarray,
    magnitude_lookup: np.ndarray,
) -> tuple[pd.DataFrame, np.ndarray]:
    n_docs, band_count = quantized_selected.shape
    doc_lengths: np.ndarray
    if recipe.base_recipe_id == "magnitude-phrase":
        positions = np.tile(np.arange(band_count, dtype=np.int16), n_docs)
        frame = pd.DataFrame(
            {
                "document_id": np.repeat(np.arange(n_docs, dtype=np.int32), band_count),
                "position": positions,
                "token": magnitude_lookup[quantized_selected.reshape(-1)],
                "count": np.ones(n_docs * band_count, dtype=np.int32),
            }
        )
        doc_lengths = np.full(n_docs, band_count, dtype=np.int32)
        return frame, doc_lengths

    if recipe.base_recipe_id == "band-magnitude":
        positions = np.tile(np.arange(band_count, dtype=np.int16), n_docs)
        frame = pd.DataFrame(
            {
                "document_id": np.repeat(np.arange(n_docs, dtype=np.int32), band_count),
                "position": positions,
                "token": band_magnitude_lookup[positions, quantized_selected.reshape(-1)],
                "count": np.ones(n_docs * band_count, dtype=np.int32),
            }
        )
        doc_lengths = np.full(n_docs, band_count, dtype=np.int32)
        return frame, doc_lengths

    if recipe.base_recipe_id == "band-frequency":
        nonzero_mask = quantized_selected > 0
        doc_index, band_index = np.nonzero(nonzero_mask)
        frame = pd.DataFrame(
            {
                "document_id": doc_index.astype(np.int32),
                "position": band_index.astype(np.int16),
                "token": band_tokens[band_index],
                "count": quantized_selected[nonzero_mask].astype(np.int32),
            }
        )
        doc_lengths = np.sum(quantized_selected, axis=1, dtype=np.int32)
        return frame, doc_lengths

    raise KeyError(f"Unsupported pixel recipe: {recipe.id}")


def build_region_corpus_rows(
    recipe: RecipeVariant,
    group_ids: np.ndarray,
    assignments_valid: np.ndarray,
    quantized_valid: np.ndarray,
    band_magnitude_lookup: np.ndarray,
) -> tuple[pd.DataFrame, np.ndarray, dict[int, int]]:
    if recipe.base_recipe_id != "region-documents":
        raise KeyError(f"Unsupported region recipe: {recipe.id}")

    band_count = quantized_valid.shape[1]
    q = band_magnitude_lookup.shape[1]
    frames: list[pd.DataFrame] = []
    doc_lengths = np.zeros(group_ids.shape[0], dtype=np.int32)
    spectra_count_by_group: dict[int, int] = {}

    for doc_index, group_id in enumerate(group_ids.tolist()):
        group_mask = assignments_valid == group_id
        group_quantized = quantized_valid[group_mask]
        spectra_count_by_group[int(group_id)] = int(group_quantized.shape[0])
        if group_quantized.shape[0] == 0:
            continue
        doc_lengths[doc_index] = int(group_quantized.shape[0] * band_count)
        rows: list[dict[str, Any]] = []
        for band_index in range(band_count):
            counts = np.bincount(group_quantized[:, band_index], minlength=q)
            nonzero_levels = np.flatnonzero(counts > 0)
            for level in nonzero_levels.tolist():
                rows.append(
                    {
                        "document_id": int(doc_index),
                        "position": int(band_index),
                        "token": str(band_magnitude_lookup[band_index, level]),
                        "count": int(counts[level]),
                    }
                )
        if rows:
            frames.append(pd.DataFrame(rows))

    if frames:
        combined = pd.concat(frames, ignore_index=True)
    else:
        combined = pd.DataFrame(columns=["document_id", "position", "token", "count"])
    return combined, doc_lengths, spectra_count_by_group


def pixel_document_metadata(
    sampled_indices: np.ndarray,
    rows: int,
    cols: int,
    gt: np.ndarray | None,
    label_names: dict[int, str],
    doc_lengths: np.ndarray,
    recipe: RecipeVariant,
    max_pixel_docs: int,
) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    flat_gt = gt.reshape(-1) if gt is not None else None
    for doc_index, flat_index in enumerate(sampled_indices.tolist()):
        row = int(flat_index // cols)
        col = int(flat_index % cols)
        label_id = None
        label_name = None
        if flat_gt is not None:
            raw_label = int(flat_gt[flat_index])
            if raw_label > 0:
                label_id = raw_label
                label_name = label_names.get(raw_label)
        documents.append(
            {
                "document_id": int(doc_index),
                "source_document_id": f"px_{row:04d}_{col:04d}",
                "source_kind": "pixel",
                "xy": [col, row],
                "label_id": label_id,
                "label_name": label_name,
                "source_spectra_count": 1,
                "document_length": int(doc_lengths[doc_index]),
                "sampling_strategy": {
                    "kind": "deterministic_valid_pixel_sample",
                    "max_docs": int(max_pixel_docs),
                    "random_state": 42,
                },
                "recipe_variant_id": recipe.id,
            }
        )
    return documents


def region_document_metadata(
    group_ids: np.ndarray,
    assignments: np.ndarray,
    assignments_valid: np.ndarray,
    valid_flat_indices: np.ndarray,
    gt: np.ndarray | None,
    label_names: dict[int, str],
    doc_lengths: np.ndarray,
    spectra_count_by_group: dict[int, int],
    recipe: RecipeVariant,
) -> list[dict[str, Any]]:
    rows, cols = assignments.shape
    yy, xx = np.indices((rows, cols))
    flat_gt = gt.reshape(-1) if gt is not None else None
    documents: list[dict[str, Any]] = []

    for doc_index, group_id in enumerate(group_ids.tolist()):
        mask = assignments == group_id
        group_y = yy[mask]
        group_x = xx[mask]
        centroid_x = float(np.mean(group_x)) if group_x.size else 0.0
        centroid_y = float(np.mean(group_y)) if group_y.size else 0.0

        label_id = None
        label_name = None
        if flat_gt is not None:
            label_values = flat_gt.reshape(-1)[mask.reshape(-1)]
            label_values = label_values[label_values > 0]
            if label_values.size > 0:
                counts = Counter(int(value) for value in label_values.tolist())
                label_id = int(counts.most_common(1)[0][0])
                label_name = label_names.get(label_id)

        documents.append(
            {
                "document_id": int(doc_index),
                "source_document_id": f"{recipe.document_constructor_id}_{int(group_id):05d}",
                "source_kind": "region",
                "region_id": int(group_id),
                "xy": [round_scalar(centroid_x), round_scalar(centroid_y)],
                "label_id": label_id,
                "label_name": label_name,
                "source_spectra_count": int(spectra_count_by_group.get(int(group_id), 0)),
                "document_area_pixels": int(np.sum(mask)),
                "document_length": int(doc_lengths[doc_index]),
                "sampling_strategy": {
                    "kind": "full_group_inventory",
                    "grouping_method": recipe.document_constructor_id,
                },
                "recipe_variant_id": recipe.id,
            }
        )
    return documents


def vocabulary_payload(rows: pd.DataFrame, reverse_map: dict[str, Any]) -> dict[str, Any]:
    vocabulary = sorted(str(token) for token in rows["token"].astype(str).unique().tolist()) if not rows.empty else []
    return {
        "vocabulary_size": int(len(vocabulary)),
        "tokens": vocabulary,
        "token_to_band_reverse_map": {token: reverse_map[token] for token in vocabulary if token in reverse_map},
    }


def build_corpus(
    scene_key: str,
    recipe: RecipeVariant,
    quantization_config_id: str,
    force: bool,
    max_pixel_docs: int,
    label_lookup: dict[str, dict[int, str]],
) -> None:
    scene = scene_payload(scene_key)
    scene_id = str(scene["scene_id"])
    local_paths_map = local_paths(recipe.id, quantization_config_id, scene_id)
    derived_summary_path = derived_path(recipe.id, quantization_config_id, scene_id)

    if (
        local_paths_map["corpus"].exists()
        and local_paths_map["summary"].exists()
        and local_paths_map["docs"].exists()
        and local_paths_map["vocab"].exists()
        and derived_summary_path.exists()
        and not force
    ):
        print(f"Skipping existing {scene_id} / {recipe.id} / {quantization_config_id}")
        return

    quantizer = load_quantization_definition(scene_id, quantization_config_id)
    cube = np.asarray(scene["cube"], dtype=np.float32)
    gt = scene["gt"]
    wavelengths = np.asarray(scene["wavelengths_nm"], dtype=np.float32)
    rows, cols, band_count = cube.shape
    flat_cube = cube.reshape(-1, band_count)
    valid_mask = valid_spectra_mask(flat_cube)
    valid_flat_indices = np.flatnonzero(valid_mask)
    features_valid = flat_cube[valid_mask].astype(np.float32, copy=False)

    edges_raw = quantizer["quantizer_edges"]
    if quantizer["domain"] == "global":
        edges = stabilize_edges_1d(np.asarray(edges_raw, dtype=np.float64))
    else:
        edges = np.stack([stabilize_edges_1d(np.asarray(row, dtype=np.float64)) for row in edges_raw], axis=0)
    quantized_valid = quantize_from_edges(features_valid, edges, str(quantizer["domain"]))
    q = int(quantizer["Q"])

    band_tokens = build_band_tokens(wavelengths)
    magnitude_lookup = build_magnitude_lookup(q)
    band_magnitude_lookup = build_band_magnitude_lookup(wavelengths, q)
    scene_label_lookup = label_lookup.get(scene_id, {})

    if recipe.mode == "pixel":
        flat_gt = gt.reshape(-1) if gt is not None else None
        sampled_flat_indices = sample_pixel_documents(valid_flat_indices, flat_gt, max_docs=max_pixel_docs)
        position_lookup = {int(flat_index): idx for idx, flat_index in enumerate(valid_flat_indices.tolist())}
        selected_valid_positions = np.asarray([position_lookup[int(flat_index)] for flat_index in sampled_flat_indices.tolist()], dtype=np.int64)
        quantized_selected = quantized_valid[selected_valid_positions]
        rows_frame, doc_lengths = build_pixel_corpus_rows(
            recipe,
            quantized_selected,
            band_tokens,
            band_magnitude_lookup,
            magnitude_lookup,
        )
        documents = pixel_document_metadata(
            sampled_flat_indices,
            rows,
            cols,
            gt,
            scene_label_lookup,
            doc_lengths,
            recipe,
            max_pixel_docs=max_pixel_docs,
        )
        reverse_map = {}
        if recipe.base_recipe_id == "band-frequency":
            reverse_map = token_band_reverse_map_for_band_tokens(band_tokens, wavelengths)
        elif recipe.base_recipe_id == "band-magnitude":
            reverse_map = token_band_reverse_map_for_band_magnitude(band_magnitude_lookup, wavelengths, q)
    else:
        assignments = load_grouping_assignments(scene_id, recipe.document_constructor_id)
        assignments_valid = assignments.reshape(-1)[valid_flat_indices]
        group_ids = np.unique(assignments)
        rows_frame, doc_lengths, spectra_count_by_group = build_region_corpus_rows(
            recipe,
            group_ids.astype(np.int32),
            assignments_valid,
            quantized_valid,
            band_magnitude_lookup,
        )
        documents = region_document_metadata(
            group_ids.astype(np.int32),
            assignments,
            assignments_valid,
            valid_flat_indices,
            gt,
            scene_label_lookup,
            doc_lengths,
            spectra_count_by_group,
            recipe,
        )
        reverse_map = token_band_reverse_map_for_band_magnitude(band_magnitude_lookup, wavelengths, q)

    rows_frame = rows_frame.sort_values(["document_id", "position", "token"]).reset_index(drop=True)
    write_parquet(local_paths_map["corpus"], rows_frame)

    vocab_payload = vocabulary_payload(rows_frame, reverse_map)
    write_json(local_paths_map["vocab"], vocab_payload)
    write_json(local_paths_map["docs"], {"documents": documents})

    document_lengths = np.asarray([int(document["document_length"]) for document in documents], dtype=np.int32)
    zero_token_rate = float(np.mean(document_lengths == 0)) if documents else 0.0
    example_documents = documents[:10]
    top_tokens = top_tokens_summary(rows_frame, document_count=len(documents))
    label_summary = label_length_summary(documents)

    local_summary = {
        "scene_id": scene_id,
        "recipe_variant_id": recipe.id,
        "recipe_id": recipe.base_recipe_id,
        "document_constructor_id": recipe.document_constructor_id,
        "quantization_config_id": quantization_config_id,
        "preprocessing_id": str(quantizer.get("preprocessing_id", "raw")),
        "family_id": str(scene["family_id"]),
        "document_count": int(len(documents)),
        "vocabulary_size": int(vocab_payload["vocabulary_size"]),
        "document_length_distribution": stats_summary(document_lengths),
        "zero_token_document_rate": round_scalar(zero_token_rate),
        "corpus_path": str(local_paths_map["corpus"].relative_to(ROOT)).replace("\\", "/"),
        "document_metadata_path": str(local_paths_map["docs"].relative_to(ROOT)).replace("\\", "/"),
        "vocabulary_path": str(local_paths_map["vocab"].relative_to(ROOT)).replace("\\", "/"),
        "implementation_scope": {
            "builder_status": "partial",
            "pixel_sampling_cap": int(max_pixel_docs) if recipe.mode == "pixel" else None,
            "notes": "Wordification builder slice implemented over the current canonical quantization outputs and grouping methods.",
        },
    }
    write_json(local_paths_map["summary"], local_summary)

    derived_summary = {
        "scene_id": scene_id,
        "recipe_variant_id": recipe.id,
        "recipe_id": recipe.base_recipe_id,
        "document_constructor_id": recipe.document_constructor_id,
        "quantization_config_id": quantization_config_id,
        "preprocessing_id": str(quantizer.get("preprocessing_id", "raw")),
        "family_id": str(scene["family_id"]),
        "recipe_summary": recipe.summary,
        "document_count": int(len(documents)),
        "vocabulary_size": int(vocab_payload["vocabulary_size"]),
        "document_length_distribution": stats_summary(document_lengths),
        "zero_token_document_rate": round_scalar(zero_token_rate),
        "top_tokens": top_tokens,
        "document_length_vs_label": label_summary,
        "document_length_vs_measurement": None,
        "token_to_band_reverse_map": vocab_payload["token_to_band_reverse_map"],
        "example_documents": example_documents,
        "sampling_strategy": example_documents[0]["sampling_strategy"] if example_documents else None,
        "local_corpus_ref": str(local_paths_map["corpus"].relative_to(ROOT)).replace("\\", "/"),
        "implementation_scope": {
            "builder_status": "partial",
            "pixel_sampling_cap": int(max_pixel_docs) if recipe.mode == "pixel" else None,
            "notes": "This slice supports pixel documents via deterministic sampling and region documents for the implemented grouping methods.",
        },
    }
    write_json(derived_summary_path, derived_summary)
    print(f"Wrote {scene_id} / {recipe.id} / {quantization_config_id}")


def all_scene_keys() -> list[str]:
    return list(RAW_SCENES.keys()) + list(UNMIXING_SCENES.keys())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene", action="append", dest="scenes", help="Scene key to build. Repeatable.")
    parser.add_argument("--recipe", action="append", dest="recipes", help="Recipe variant id to build. Repeatable.")
    parser.add_argument("--quant-cfg", action="append", dest="quant_cfgs", help="Quantization config id. Repeatable.")
    parser.add_argument("--max-pixel-docs", type=int, default=DEFAULT_PIXEL_MAX_DOCS, help="Deterministic cap for sampled pixel documents.")
    parser.add_argument("--force", action="store_true", help="Rewrite outputs even if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show selected scenes, recipes, and quant configs without writing outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    scene_keys = args.scenes or all_scene_keys()
    recipe_ids = args.recipes or list(RECIPE_VARIANTS.keys())
    quant_cfg_ids = args.quant_cfgs or DEFAULT_QUANT_CONFIG_IDS
    missing = [recipe_id for recipe_id in recipe_ids if recipe_id not in RECIPE_VARIANTS]
    if missing:
        raise KeyError(f"Unknown recipe ids: {missing}")

    if args.dry_run:
        print(f"Dry run: {len(scene_keys)} scenes, {len(recipe_ids)} recipes, {len(quant_cfg_ids)} quant configs")
        for scene_key in scene_keys:
            print(f"- {scene_key}")
        for recipe_id in recipe_ids:
            print(f"  * {recipe_id}")
        for quant_cfg_id in quant_cfg_ids:
            print(f"    - {quant_cfg_id}")
        return

    labels = class_name_lookup()
    for scene_key in scene_keys:
        for quant_cfg_id in quant_cfg_ids:
            for recipe_id in recipe_ids:
                build_corpus(
                    scene_key,
                    RECIPE_VARIANTS[recipe_id],
                    quant_cfg_id,
                    force=args.force,
                    max_pixel_docs=args.max_pixel_docs,
                    label_lookup=labels,
                )


if __name__ == "__main__":
    main()
