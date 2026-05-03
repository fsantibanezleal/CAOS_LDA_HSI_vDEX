"""Build thin-slice document groupings under the master-plan contract."""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from scipy.io import loadmat
from sklearn.decomposition import PCA
from sklearn.metrics import (
    adjusted_rand_score,
    davies_bouldin_score,
    normalized_mutual_info_score,
    silhouette_score,
    v_measure_score,
)
from sklearn.preprocessing import StandardScaler
from skimage.segmentation import slic

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
LOCAL_OUTPUT_DIR = LOCAL_DIR / "groupings"
DERIVED_OUTPUT_DIR = DERIVED_DIR / "groupings"
PREVIEW_DIR = DERIVED_OUTPUT_DIR / "previews"
SCENE_ID_ALIASES = {
    "cuprite-upv-reflectance": "cuprite-aviris-reflectance",
}


@dataclass(frozen=True)
class GroupingMethod:
    id: str
    role: str
    preview_kind: str


METHODS = {
    "patch_15": GroupingMethod(id="patch_15", role="document_constructor", preview_kind="patch"),
    "slic_200": GroupingMethod(id="slic_200", role="document_constructor", preview_kind="slic"),
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def write_binary_f32(path: Path, values: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    np.asarray(values, dtype=np.float32).tofile(path)


def round_scalar(value: float, digits: int = 6) -> float:
    return round(float(value), digits)


def round_vector(values: np.ndarray, digits: int = 6) -> list[float]:
    return [round_scalar(value, digits) for value in np.asarray(values, dtype=np.float64).tolist()]


def round_matrix(values: np.ndarray, digits: int = 6) -> list[list[float]]:
    return [[round_scalar(value, digits) for value in row] for row in np.asarray(values, dtype=np.float64).tolist()]


def stats_summary(values: np.ndarray) -> dict[str, float | int]:
    array = np.asarray(values, dtype=np.float64)
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


def normalize01(values: np.ndarray) -> np.ndarray:
    low = np.nanpercentile(values, 2, axis=(0, 1))
    high = np.nanpercentile(values, 98, axis=(0, 1))
    return np.clip((values - low) / np.maximum(high - low, 1e-6), 0.0, 1.0)


def rgb_features(cube: np.ndarray, wavelengths: np.ndarray) -> np.ndarray:
    targets = np.array([650.0, 550.0, 450.0], dtype=np.float32)
    indices = [int(np.abs(wavelengths - target).argmin()) for target in targets]
    return normalize01(cube[..., indices]).astype(np.float32)


def colorize_segments(segments: np.ndarray) -> np.ndarray:
    image = np.zeros((*segments.shape, 3), dtype=np.uint8)
    for segment_id in np.unique(segments):
        value = int(segment_id)
        color = (
            (37 * value + 41) % 255,
            (67 * value + 97) % 255,
            (109 * value + 17) % 255,
        )
        image[segments == segment_id] = color
    return image


def save_preview(scene_id: str, method_id: str, segments: np.ndarray) -> str:
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    image = Image.fromarray(colorize_segments(segments))
    if image.width > 960:
        height = int(round((960 / image.width) * image.height))
        image = image.resize((960, height), Image.Resampling.NEAREST)
    path = PREVIEW_DIR / f"{scene_id}-{method_id}.png"
    image.save(path)
    return f"/generated/groupings/previews/{path.name}"


def build_patch_assignments(rows: int, cols: int, width: int) -> np.ndarray:
    assignments = np.zeros((rows, cols), dtype=np.int32)
    group_id = 1
    for row_start in range(0, rows, width):
        for col_start in range(0, cols, width):
            row_end = min(row_start + width, rows)
            col_end = min(col_start + width, cols)
            assignments[row_start:row_end, col_start:col_end] = group_id
            group_id += 1
    return assignments


def build_slic_assignments(cube: np.ndarray, wavelengths: np.ndarray, n_segments: int) -> np.ndarray:
    features = rgb_features(cube, wavelengths)
    return slic(
        features,
        n_segments=n_segments,
        compactness=10.0,
        start_label=1,
        channel_axis=-1,
        convert2lab=False,
        enforce_connectivity=True,
    ).astype(np.int32)


def scene_payload(scene_id: str) -> tuple[str, np.ndarray, np.ndarray | None, np.ndarray]:
    if scene_id in RAW_SCENES:
        cube, gt, config = load_raw_scene(scene_id)
        public_scene_id = SCENE_ID_ALIASES.get(scene_id, scene_id)
        wavelengths = approximate_scene_wavelengths(config, cube.shape[-1])
        return public_scene_id, cube, gt, wavelengths

    if scene_id in UNMIXING_SCENES:
        spectra, _, _, config = load_unmixing_scene(scene_id)
        rows, cols, _ = load_unmixing_cube_shape(scene_id)
        band_count = int(spectra.shape[1])
        cube = spectra.reshape(rows, cols, band_count).astype(np.float32)
        wavelengths = approximate_unmixing_wavelengths(config, band_count)
        return scene_id, cube, None, wavelengths

    raise KeyError(f"Unknown scene id: {scene_id}")


def group_statistics(cube: np.ndarray, assignments: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    flat_cube = cube.reshape(-1, cube.shape[-1])
    flat_assignments = assignments.reshape(-1)
    valid_mask = valid_spectra_mask(flat_cube)
    group_ids = np.unique(flat_assignments)
    means = []
    stds = []
    sizes = []
    for group_id in group_ids:
        mask = flat_assignments == group_id
        sizes.append(int(np.sum(mask)))
        group_features = flat_cube[mask & valid_mask]
        if group_features.shape[0] == 0:
            means.append(np.zeros(cube.shape[-1], dtype=np.float32))
            stds.append(np.zeros(cube.shape[-1], dtype=np.float32))
        else:
            means.append(np.mean(group_features, axis=0).astype(np.float32))
            stds.append(np.std(group_features, axis=0).astype(np.float32))
    return group_ids.astype(np.int32), np.stack(means, axis=0), np.stack(stds, axis=0), np.asarray(sizes, dtype=np.int32)


def between_within_ratio(cube: np.ndarray, assignments: np.ndarray, group_ids: np.ndarray, group_means: np.ndarray) -> float:
    flat_cube = cube.reshape(-1, cube.shape[-1])
    flat_assignments = assignments.reshape(-1)
    valid_mask = valid_spectra_mask(flat_cube)
    features = flat_cube[valid_mask]
    labels = flat_assignments[valid_mask]
    global_mean = np.mean(features, axis=0)
    between = 0.0
    within = 0.0
    mean_lookup = {int(group_id): group_means[index] for index, group_id in enumerate(group_ids)}
    for group_id in group_ids:
        group_features = features[labels == group_id]
        if group_features.shape[0] == 0:
            continue
        group_mean = mean_lookup[int(group_id)]
        between += float(group_features.shape[0]) * float(np.sum((group_mean - global_mean) ** 2))
        within += float(np.sum((group_features - group_mean) ** 2))
    return round_scalar(between / max(within, 1e-12))


def spatial_compactness(assignments: np.ndarray) -> dict[str, float]:
    rows, cols = assignments.shape
    yy, xx = np.indices((rows, cols))
    diag = float(np.sqrt(rows**2 + cols**2))
    values = []
    for group_id in np.unique(assignments):
        mask = assignments == group_id
        group_y = yy[mask].astype(np.float64)
        group_x = xx[mask].astype(np.float64)
        centroid_y = float(np.mean(group_y))
        centroid_x = float(np.mean(group_x))
        radius = np.sqrt((group_y - centroid_y) ** 2 + (group_x - centroid_x) ** 2)
        values.append(float(np.mean(radius) / max(diag, 1.0)))
    array = np.asarray(values, dtype=np.float64)
    return {
        "mean": round_scalar(np.mean(array)),
        "median": round_scalar(np.median(array)),
        "max": round_scalar(np.max(array)),
    }


def reduced_group_embeddings(group_means: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    if group_means.shape[0] == 1:
        return np.zeros((1, 2), dtype=np.float32), np.zeros((1, 3), dtype=np.float32)
    scaled = StandardScaler().fit_transform(group_means)
    components = min(3, scaled.shape[0], scaled.shape[1])
    pca = PCA(n_components=components, random_state=42)
    coords = pca.fit_transform(scaled).astype(np.float32)
    coords2 = np.zeros((coords.shape[0], 2), dtype=np.float32)
    coords3 = np.zeros((coords.shape[0], 3), dtype=np.float32)
    coords2[:, : min(2, coords.shape[1])] = coords[:, : min(2, coords.shape[1])]
    coords3[:, : coords.shape[1]] = coords[:, : coords.shape[1]]
    return coords2, coords3


def label_agreement(assignments: np.ndarray, gt: np.ndarray | None) -> dict[str, float | None]:
    if gt is None:
        return {"ari": None, "nmi": None, "v_measure": None}
    labels = gt.reshape(-1)
    mask = labels > 0
    if not np.any(mask):
        return {"ari": None, "nmi": None, "v_measure": None}
    predicted = assignments.reshape(-1)[mask]
    truth = labels[mask]
    return {
        "ari": round_scalar(adjusted_rand_score(truth, predicted)),
        "nmi": round_scalar(normalized_mutual_info_score(truth, predicted)),
        "v_measure": round_scalar(v_measure_score(truth, predicted)),
    }


def sampled_internal_metrics(cube: np.ndarray, assignments: np.ndarray) -> dict[str, float | None]:
    flat_cube = cube.reshape(-1, cube.shape[-1])
    flat_assignments = assignments.reshape(-1)
    valid_mask = valid_spectra_mask(flat_cube)
    features = flat_cube[valid_mask]
    labels = flat_assignments[valid_mask]
    if np.unique(labels).shape[0] < 2:
        return {"silhouette": None, "davies_bouldin": None}
    rng = np.random.default_rng(42)
    if features.shape[0] > 5000:
        sample_idx = rng.choice(np.arange(features.shape[0]), size=5000, replace=False)
        features = features[sample_idx]
        labels = labels[sample_idx]
    scaled = StandardScaler().fit_transform(features)
    if scaled.shape[1] > 12:
        components = min(12, scaled.shape[0] - 1, scaled.shape[1])
        if components >= 2:
            scaled = PCA(n_components=components, random_state=42).fit_transform(scaled)
    return {
        "silhouette": round_scalar(silhouette_score(scaled, labels)),
        "davies_bouldin": round_scalar(davies_bouldin_score(scaled, labels)),
    }


def agreement_with_methods(
    method_id: str,
    assignments: dict[str, np.ndarray],
) -> dict[str, dict[str, float]]:
    current = assignments[method_id].reshape(-1)
    result: dict[str, dict[str, float]] = {}
    for other_id, other_assignments in assignments.items():
        if other_id == method_id:
            continue
        other = other_assignments.reshape(-1)
        result[other_id] = {
            "ari": round_scalar(adjusted_rand_score(current, other)),
            "nmi": round_scalar(normalized_mutual_info_score(current, other)),
            "v_measure": round_scalar(v_measure_score(current, other)),
        }
    return result


def local_paths(method_id: str, scene_id: str) -> tuple[Path, Path]:
    base = LOCAL_OUTPUT_DIR / method_id
    return base / f"{scene_id}.npy", base / f"{scene_id}.json"


def derived_path(method_id: str, scene_id: str) -> Path:
    return DERIVED_OUTPUT_DIR / method_id / f"{scene_id}.json"


def derived_binary_paths(method_id: str, scene_id: str) -> tuple[Path, Path]:
    base = DERIVED_OUTPUT_DIR / method_id
    return base / f"{scene_id}.mean.bin", base / f"{scene_id}.std.bin"


def build_scene_groupings(
    scene_key: str,
    method_ids: list[str],
    force: bool,
) -> None:
    public_scene_id, cube, gt, wavelengths = scene_payload(scene_key)
    rows, cols, _ = cube.shape

    assignments_by_method: dict[str, np.ndarray] = {}
    for method_id in method_ids:
        if method_id == "patch_15":
            assignments_by_method[method_id] = build_patch_assignments(rows, cols, width=15)
        elif method_id == "slic_200":
            assignments_by_method[method_id] = build_slic_assignments(cube, wavelengths, n_segments=200)
        else:
            raise KeyError(f"Unknown method id: {method_id}")

    for method_id, assignments in assignments_by_method.items():
        assignment_path, metadata_path = local_paths(method_id, public_scene_id)
        summary_path = derived_path(method_id, public_scene_id)
        mean_bin_path, std_bin_path = derived_binary_paths(method_id, public_scene_id)
        if (
            assignment_path.exists()
            and metadata_path.exists()
            and summary_path.exists()
            and mean_bin_path.exists()
            and std_bin_path.exists()
            and not force
        ):
            print(f"Skipping existing {public_scene_id} / {method_id}")
            continue

        group_ids, group_means, group_stds, group_sizes = group_statistics(cube, assignments)
        ratio = between_within_ratio(cube, assignments, group_ids, group_means)
        compactness = spatial_compactness(assignments)
        internal = sampled_internal_metrics(cube, assignments)
        coords2, coords3 = reduced_group_embeddings(group_means)
        preview_path = save_preview(public_scene_id, method_id, assignments)

        assignment_path.parent.mkdir(parents=True, exist_ok=True)
        np.save(assignment_path, assignments.astype(np.int32))
        write_binary_f32(mean_bin_path, group_means)
        write_binary_f32(std_bin_path, group_stds)
        local_payload = {
            "scene_id": public_scene_id,
            "method_id": method_id,
            "role": METHODS[method_id].role,
            "assignment_path": str(assignment_path.relative_to(ROOT)).replace("\\", "/"),
            "shape": [int(rows), int(cols)],
            "group_ids": [int(group_id) for group_id in group_ids.tolist()],
            "group_sizes": [int(value) for value in group_sizes.tolist()],
            "mean_spectra": [round_vector(row) for row in group_means],
            "std_spectra": [round_vector(row) for row in group_stds],
            "spatial_compactness": compactness,
            "between_within_ratio": ratio,
            "silhouette": internal["silhouette"],
            "davies_bouldin": internal["davies_bouldin"],
        }
        write_json(metadata_path, local_payload)

        derived_payload = {
            "scene_id": public_scene_id,
            "method_id": method_id,
            "role": METHODS[method_id].role,
            "n_groups": int(group_ids.shape[0]),
            "group_size_distribution": stats_summary(group_sizes),
            "between_within_ratio": ratio,
            "group_ids": [int(group_id) for group_id in group_ids.tolist()],
            "mean_spectrum_per_group": {
                "format": "binary_f32",
                "shape": [int(group_means.shape[0]), int(group_means.shape[1])],
                "path": str(mean_bin_path.relative_to(ROOT)).replace("\\", "/"),
            },
            "std_spectrum_per_group": {
                "format": "binary_f32",
                "shape": [int(group_stds.shape[0]), int(group_stds.shape[1])],
                "path": str(std_bin_path.relative_to(ROOT)).replace("\\", "/"),
            },
            "agreement_with_label": label_agreement(assignments, gt),
            "agreement_with_methods": agreement_with_methods(method_id, assignments_by_method),
            "centroid_embedding_2d": [
                {"group_id": int(group_ids[index]), "coords": round_vector(coords2[index])}
                for index in range(group_ids.shape[0])
            ],
            "centroid_embedding_3d": [
                {"group_id": int(group_ids[index]), "coords": round_vector(coords3[index])}
                for index in range(group_ids.shape[0])
            ],
            "preview_path": preview_path,
        }
        write_json(summary_path, derived_payload)
        print(f"Wrote {public_scene_id} / {method_id}")


def all_scene_keys() -> list[str]:
    return list(RAW_SCENES.keys()) + list(UNMIXING_SCENES.keys())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene", action="append", dest="scenes", help="Scene key to build. Repeatable.")
    parser.add_argument("--method", action="append", dest="methods", help="Method id to build. Repeatable.")
    parser.add_argument("--force", action="store_true", help="Rewrite outputs even if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show selected scenes and methods without writing outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    scene_keys = args.scenes or all_scene_keys()
    method_ids = args.methods or list(METHODS.keys())

    if args.dry_run:
        print(f"Dry run: {len(scene_keys)} scenes, {len(method_ids)} methods")
        for scene_key in scene_keys:
            print(f"- {scene_key}")
        for method_id in method_ids:
            print(f"  * {method_id}")
        return

    for scene_key in scene_keys:
        build_scene_groupings(scene_key, method_ids, force=args.force)


if __name__ == "__main__":
    main()
