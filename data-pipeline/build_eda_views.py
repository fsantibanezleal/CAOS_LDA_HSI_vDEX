"""Build per-scene EDA summaries under the master-plan contract."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
from scipy.stats import f_oneway
from sklearn.decomposition import PCA
from sklearn.feature_selection import f_classif, mutual_info_classif
from sklearn.metrics import silhouette_samples
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from research_core.paths import DERIVED_DIR
from research_core.raw_scenes import SCENES as RAW_SCENES
from research_core.raw_scenes import approximate_wavelengths as approximate_scene_wavelengths
from research_core.raw_scenes import load_scene, valid_spectra_mask
from research_core.spectral import cosine_similarity_matrix, spectral_angle_matrix
from research_core.unmixing import SCENES as UNMIXING_SCENES
from research_core.unmixing import approximate_wavelengths as approximate_unmixing_wavelengths
from research_core.unmixing import load_unmixing_cube_shape, load_unmixing_scene


REAL_SAMPLES_PATH = DERIVED_DIR / "real" / "real_samples.json"
OUTPUT_DIR = DERIVED_DIR / "eda" / "per_scene"
SCENE_ID_ALIASES = {
    "cuprite-upv-reflectance": "cuprite-aviris-reflectance",
}
PALETTE = [
    "#000000",
    "#3876c4",
    "#06b6d4",
    "#84cc16",
    "#f59e0b",
    "#ef4444",
    "#a855f7",
    "#14b8a6",
    "#6366f1",
    "#d97706",
    "#0ea5e9",
    "#22c55e",
    "#ec4899",
    "#64748b",
    "#eab308",
    "#f87171",
    "#2dd4bf",
]


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def round_scalar(value: float, digits: int = 6) -> float:
    return round(float(value), digits)


def round_vector(values: np.ndarray, digits: int = 6) -> list[float]:
    array = np.asarray(values, dtype=np.float64)
    return [round_scalar(value, digits) for value in array.tolist()]


def round_matrix(values: np.ndarray, digits: int = 6) -> list[list[float]]:
    array = np.asarray(values, dtype=np.float64)
    return [[round_scalar(value, digits) for value in row] for row in array.tolist()]


def quantile_summary(values: np.ndarray) -> dict[str, list[float]]:
    return {
        "mean": round_vector(np.mean(values, axis=0)),
        "std": round_vector(np.std(values, axis=0)),
        "p5": round_vector(np.percentile(values, 5, axis=0)),
        "p25": round_vector(np.percentile(values, 25, axis=0)),
        "p50": round_vector(np.percentile(values, 50, axis=0)),
        "p75": round_vector(np.percentile(values, 75, axis=0)),
        "p95": round_vector(np.percentile(values, 95, axis=0)),
    }


def gini_impurity(counts: np.ndarray) -> float:
    total = float(np.sum(counts))
    if total <= 0:
        return 0.0
    probabilities = counts.astype(np.float64) / total
    return round_scalar(1.0 - float(np.sum(probabilities**2)), 6)


def fisher_ratio_per_band(features: np.ndarray, labels: np.ndarray) -> np.ndarray:
    classes = np.unique(labels)
    overall_mean = np.mean(features, axis=0)
    between = np.zeros(features.shape[1], dtype=np.float64)
    within = np.zeros(features.shape[1], dtype=np.float64)
    for class_id in classes:
        class_features = features[labels == class_id]
        class_mean = np.mean(class_features, axis=0)
        between += class_features.shape[0] * (class_mean - overall_mean) ** 2
        within += np.sum((class_features - class_mean) ** 2, axis=0)
    return between / np.maximum(within, 1e-12)


def sample_indices_per_class(labels: np.ndarray, max_per_class: int, random_state: int = 42) -> np.ndarray:
    rng = np.random.default_rng(random_state)
    chosen: list[np.ndarray] = []
    for class_id in np.unique(labels):
        indices = np.flatnonzero(labels == class_id)
        take = min(max_per_class, int(indices.size))
        chosen.append(rng.choice(indices, size=take, replace=False))
    return np.concatenate(chosen) if chosen else np.array([], dtype=np.int64)


def silhouette_by_class(features: np.ndarray, labels: np.ndarray) -> dict[str, float]:
    if np.unique(labels).shape[0] < 2:
        return {}
    sample_idx = sample_indices_per_class(labels, max_per_class=250)
    sampled_features = features[sample_idx]
    sampled_labels = labels[sample_idx]
    scaled = StandardScaler().fit_transform(sampled_features)
    if scaled.shape[1] > 12:
        components = min(12, scaled.shape[0] - 1, scaled.shape[1])
        if components >= 2:
            scaled = PCA(n_components=components, random_state=42).fit_transform(scaled)
    values = silhouette_samples(scaled, sampled_labels, metric="euclidean")
    result: dict[str, float] = {}
    for class_id in np.unique(sampled_labels):
        result[str(int(class_id))] = round_scalar(np.mean(values[sampled_labels == class_id]), 6)
    return result


def mahalanobis_pairwise(features: np.ndarray, labels: np.ndarray) -> np.ndarray:
    classes = np.unique(labels)
    means = np.stack([np.mean(features[labels == class_id], axis=0) for class_id in classes], axis=0)
    sample_idx = sample_indices_per_class(labels, max_per_class=350)
    sampled = features[sample_idx]
    scaled = StandardScaler().fit_transform(sampled)
    scaled_means = StandardScaler().fit(sampled).transform(means)
    covariance = np.cov(scaled, rowvar=False)
    covariance += np.eye(covariance.shape[0], dtype=np.float64) * 1e-4
    inverse = np.linalg.pinv(covariance)

    pairwise = np.zeros((classes.shape[0], classes.shape[0]), dtype=np.float64)
    for left in range(classes.shape[0]):
        for right in range(classes.shape[0]):
            diff = scaled_means[left] - scaled_means[right]
            pairwise[left, right] = np.sqrt(max(float(diff @ inverse @ diff.T), 0.0))
    return pairwise


def class_name_lookup() -> dict[str, dict[int, str]]:
    payload = load_json(REAL_SAMPLES_PATH)
    lookup: dict[str, dict[int, str]] = {}
    for scene in payload.get("scenes", []):
        mapping = {
            int(summary["label_id"]): str(summary["name"])
            for summary in scene.get("class_summaries", [])
        }
        lookup[str(scene["id"])] = mapping
    return lookup


def color_for_label(label_id: int) -> str:
    return PALETTE[label_id % len(PALETTE)]


def build_labeled_scene_payload(
    scene_id: str,
    cube: np.ndarray,
    gt: np.ndarray,
    wavelengths_nm: np.ndarray,
    label_names: dict[int, str],
) -> dict[str, Any]:
    flat_cube = cube.reshape(-1, cube.shape[-1])
    flat_labels = gt.reshape(-1)
    mask = (flat_labels > 0) & valid_spectra_mask(flat_cube)
    features = flat_cube[mask]
    labels = flat_labels[mask].astype(np.int32)

    unique_labels = np.array(sorted(int(value) for value in np.unique(labels)), dtype=np.int32)
    counts = np.array([int(np.sum(labels == label_id)) for label_id in unique_labels], dtype=np.int64)

    class_distribution = [
        {
            "label_id": int(label_id),
            "name": label_names.get(int(label_id), f"Label {int(label_id)}"),
            "count": int(count),
            "rel_freq": round_scalar(count / max(int(features.shape[0]), 1), 6),
            "color": color_for_label(int(label_id)),
        }
        for label_id, count in zip(unique_labels, counts, strict=False)
    ]

    class_mean_spectra = {
        str(int(label_id)): quantile_summary(features[labels == label_id])
        for label_id in unique_labels
    }

    class_means = np.stack(
        [np.asarray(class_mean_spectra[str(int(label_id))]["mean"], dtype=np.float32) for label_id in unique_labels],
        axis=0,
    )
    cosine = cosine_similarity_matrix(class_means, class_means)
    sam = spectral_angle_matrix(class_means, class_means)

    fisher_ratio = fisher_ratio_per_band(features, labels)
    f_stat, p_value = f_classif(features, labels)
    mi = mutual_info_classif(features, labels, discrete_features=False, random_state=42)
    band_discriminative = [
        {
            "band": int(index),
            "wavelength_nm": round_scalar(wavelengths_nm[index], 4),
            "fisher_ratio": round_scalar(fisher_ratio[index]),
            "f_stat": round_scalar(f_stat[index]),
            "mi_vs_label": round_scalar(mi[index]),
            "p_value": round_scalar(p_value[index]),
        }
        for index in range(features.shape[1])
    ]

    silhouette_per_class = silhouette_by_class(features, labels)
    mahalanobis = mahalanobis_pairwise(features, labels)

    return {
        "scene_id": scene_id,
        "n_pixels": int(cube.shape[0] * cube.shape[1]),
        "n_labelled_pixels": int(features.shape[0]),
        "wavelengths_nm": round_vector(wavelengths_nm, 4),
        "class_distribution": class_distribution,
        "imbalance_gini": gini_impurity(counts),
        "class_mean_spectra": class_mean_spectra,
        "class_distance_matrix_cosine": round_matrix(cosine),
        "class_distance_matrix_sam": round_matrix(sam),
        "band_discriminative": band_discriminative,
        "class_separability": {
            "silhouette_per_class": silhouette_per_class,
            "mahalanobis_pairwise": round_matrix(mahalanobis),
        },
    }


def safe_global_quantile_summary(values: np.ndarray) -> dict[str, list[float]]:
    return quantile_summary(values)


def per_band_variance_rows(features: np.ndarray, wavelengths_nm: np.ndarray) -> list[dict[str, float | int]]:
    variance = np.var(features, axis=0)
    return [
        {
            "band": int(index),
            "wavelength_nm": round_scalar(wavelengths_nm[index], 4),
            "variance": round_scalar(variance[index]),
        }
        for index in range(features.shape[1])
    ]


def build_unlabeled_scene_payload(
    scene_id: str,
    features: np.ndarray,
    n_pixels: int,
    wavelengths_nm: np.ndarray,
) -> dict[str, Any]:
    return {
        "scene_id": scene_id,
        "n_pixels": int(n_pixels),
        "n_labelled_pixels": 0,
        "wavelengths_nm": round_vector(wavelengths_nm, 4),
        "class_distribution": [],
        "imbalance_gini": 0.0,
        "class_mean_spectra": {
            "global": safe_global_quantile_summary(features)
        },
        "class_distance_matrix_cosine": [],
        "class_distance_matrix_sam": [],
        "band_discriminative": per_band_variance_rows(features, wavelengths_nm),
        "class_separability": {
            "silhouette_per_class": {},
            "mahalanobis_pairwise": [],
        },
    }


def build_raw_scene(scene_id: str, label_lookup: dict[str, dict[int, str]]) -> dict[str, Any]:
    cube, gt, config = load_scene(scene_id)
    wavelengths_nm = approximate_scene_wavelengths(config, cube.shape[-1])
    public_scene_id = SCENE_ID_ALIASES.get(scene_id, scene_id)
    if gt is not None:
        return build_labeled_scene_payload(public_scene_id, cube, gt, wavelengths_nm, label_lookup.get(public_scene_id, {}))

    flat_cube = cube.reshape(-1, cube.shape[-1])
    features = flat_cube[valid_spectra_mask(flat_cube)]
    return build_unlabeled_scene_payload(public_scene_id, features, cube.shape[0] * cube.shape[1], wavelengths_nm)


def build_unmixing(scene_id: str) -> dict[str, Any]:
    spectra, _, _, config = load_unmixing_scene(scene_id)
    rows, cols, _ = load_unmixing_cube_shape(scene_id)
    band_count = int(spectra.shape[1])
    wavelengths_nm = approximate_unmixing_wavelengths(config, band_count)
    features = spectra[np.isfinite(spectra).all(axis=1)]
    return build_unlabeled_scene_payload(scene_id, features, rows * cols, wavelengths_nm)


def all_scene_ids() -> list[str]:
    return list(RAW_SCENES.keys()) + list(UNMIXING_SCENES.keys())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene", action="append", dest="scenes", help="Scene id to build. Repeatable.")
    parser.add_argument("--force", action="store_true", help="Rewrite outputs even if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show selected scenes without writing outputs.")
    return parser.parse_args()


def output_path(scene_id: str) -> Path:
    public_scene_id = SCENE_ID_ALIASES.get(scene_id, scene_id)
    return OUTPUT_DIR / f"{public_scene_id}.json"


def main() -> None:
    args = parse_args()
    selected = args.scenes or all_scene_ids()
    label_lookup = class_name_lookup()

    if args.dry_run:
        print(f"Dry run: {len(selected)} scenes")
        for scene_id in selected:
            print(f"- {scene_id}")
        return

    written = 0
    for scene_id in selected:
        path = output_path(scene_id)
        if path.exists() and not args.force:
            print(f"Skipping existing {scene_id}")
            continue

        if scene_id in RAW_SCENES:
            payload = build_raw_scene(scene_id, label_lookup)
        elif scene_id in UNMIXING_SCENES:
            payload = build_unmixing(scene_id)
        else:
            raise KeyError(f"Unknown scene id: {scene_id}")

        write_json(path, payload)
        written += 1
        print(f"Wrote {path}")

    print(f"Finished build_eda_views: wrote {written} scene files")


if __name__ == "__main__":
    main()
