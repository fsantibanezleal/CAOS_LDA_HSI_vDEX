"""Build thin-slice quantization summaries under the master-plan contract."""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import adjusted_rand_score

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


LOCAL_OUTPUT_DIR = LOCAL_DIR / "wordifications" / "quantization"
DERIVED_OUTPUT_DIR = DERIVED_DIR / "quantization"
SCENE_ID_ALIASES = {
    "cuprite-upv-reflectance": "cuprite-aviris-reflectance",
}
DEFAULT_Q_VALUES = [8, 16]
EPSILON = 1e-6


@dataclass(frozen=True)
class QuantizationConfig:
    scheme: str
    domain: str
    q: int

    @property
    def id(self) -> str:
        return f"{self.scheme}_{self.domain}_Q{self.q}"


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


def round_vector(values: np.ndarray, digits: int = 6) -> list[float]:
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


def entropy_bits_from_counts(counts: np.ndarray) -> float:
    total = float(np.sum(counts))
    if total <= 0:
        return 0.0
    probs = np.asarray(counts, dtype=np.float64) / total
    probs = probs[probs > 0]
    if probs.size == 0:
        return 0.0
    return float(-np.sum(probs * np.log2(probs)))


def stabilize_edges_1d(edges: np.ndarray) -> np.ndarray:
    result = np.asarray(edges, dtype=np.float64).copy()
    if result[-1] <= result[0]:
        result[-1] = result[0] + EPSILON
    for index in range(1, result.shape[0]):
        if result[index] <= result[index - 1]:
            result[index] = result[index - 1] + EPSILON
    return result


def stabilize_edges(edges: np.ndarray, domain: str) -> np.ndarray:
    if domain == "global":
        return stabilize_edges_1d(edges)
    return np.stack([stabilize_edges_1d(row) for row in np.asarray(edges, dtype=np.float64)], axis=0)


def fit_edges(features: np.ndarray, scheme: str, domain: str, q: int) -> np.ndarray:
    probs = np.linspace(0.0, 1.0, q + 1, dtype=np.float64)
    if scheme == "uniform" and domain == "global":
        low = float(np.min(features))
        high = float(np.max(features))
        return stabilize_edges(np.linspace(low, high, q + 1, dtype=np.float64), domain)
    if scheme == "uniform" and domain == "per_band":
        lows = np.min(features.astype(np.float64, copy=False), axis=0)
        highs = np.max(features.astype(np.float64, copy=False), axis=0)
        raw_edges = lows[:, None] + (highs - lows)[:, None] * probs[None, :]
        return stabilize_edges(raw_edges, domain)
    if scheme == "quantile" and domain == "global":
        return stabilize_edges(np.quantile(features, probs), domain)
    if scheme == "quantile" and domain == "per_band":
        raw_edges = np.quantile(features, probs, axis=0).T
        return stabilize_edges(raw_edges, domain)
    raise KeyError(f"Unsupported quantization config: {scheme} / {domain} / Q={q}")


def quantize_from_edges(features: np.ndarray, edges: np.ndarray, domain: str) -> np.ndarray:
    if domain == "global":
        return np.searchsorted(np.asarray(edges)[1:-1], features, side="right").astype(np.int16)

    quantized = np.empty(features.shape, dtype=np.int16)
    band_edges = np.asarray(edges)
    for band_index in range(features.shape[1]):
        quantized[:, band_index] = np.searchsorted(
            band_edges[band_index, 1:-1],
            features[:, band_index],
            side="right",
        ).astype(np.int16)
    return quantized


def scene_payload(scene_id: str) -> tuple[str, np.ndarray, np.ndarray]:
    if scene_id in RAW_SCENES:
        cube, _, config = load_raw_scene(scene_id)
        public_scene_id = SCENE_ID_ALIASES.get(scene_id, scene_id)
        wavelengths = approximate_scene_wavelengths(config, cube.shape[-1])
        return public_scene_id, cube, wavelengths

    if scene_id in UNMIXING_SCENES:
        spectra, _, _, config = load_unmixing_scene(scene_id)
        rows, cols, _ = load_unmixing_cube_shape(scene_id)
        band_count = int(spectra.shape[1])
        cube = spectra.reshape(rows, cols, band_count).astype(np.float32)
        wavelengths = approximate_unmixing_wavelengths(config, band_count)
        return scene_id, cube, wavelengths

    raise KeyError(f"Unknown scene id: {scene_id}")


def recipe_metrics(
    quantized: np.ndarray,
) -> tuple[
    dict[str, int],
    dict[str, dict[str, float | int]],
    dict[str, float],
    dict[str, float],
]:
    band_count = int(quantized.shape[1])
    nonzero_by_doc = np.count_nonzero(quantized > 0, axis=1).astype(np.int32)
    lengths_v1 = np.sum(quantized, axis=1, dtype=np.int64)
    lengths_v2 = np.full(quantized.shape[0], band_count, dtype=np.int32)
    lengths_v3 = np.full(quantized.shape[0], band_count, dtype=np.int32)

    vocab_band_freq = int(np.sum(np.any(quantized > 0, axis=0)))
    vocab_bin_phrase = int(np.unique(quantized).shape[0])
    vocab_joint = int(sum(np.unique(quantized[:, band_index]).shape[0] for band_index in range(band_count)))

    vocab_size_per_recipe = {
        "V1_band_freq": vocab_band_freq,
        "V2_bin_phrase": vocab_bin_phrase,
        "V3_band_bin_ordered": vocab_joint,
        "V3b_band_bin_bag": vocab_joint,
    }
    doc_length_distribution_per_recipe = {
        "V1_band_freq": stats_summary(lengths_v1),
        "V2_bin_phrase": stats_summary(lengths_v2),
        "V3_band_bin_ordered": stats_summary(lengths_v3),
        "V3b_band_bin_bag": stats_summary(lengths_v3),
    }
    zero_token_doc_rate_per_recipe = {
        "V1_band_freq": round_scalar(np.mean(lengths_v1 == 0)),
        "V2_bin_phrase": 0.0,
        "V3_band_bin_ordered": 0.0,
        "V3b_band_bin_bag": 0.0,
    }

    token_sparsity_per_recipe = {
        "V1_band_freq_nonzero_band_ratio_mean": round_scalar(np.mean(nonzero_by_doc / max(band_count, 1))),
        "V1_band_freq_nonzero_band_ratio_p50": round_scalar(np.percentile(nonzero_by_doc / max(band_count, 1), 50)),
    }
    return (
        vocab_size_per_recipe,
        doc_length_distribution_per_recipe,
        zero_token_doc_rate_per_recipe,
        token_sparsity_per_recipe,
    )


def quantization_diagnostics(
    features: np.ndarray,
    quantized: np.ndarray,
    edges: np.ndarray,
    domain: str,
    q: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    band_count = int(features.shape[1])
    rmse = np.zeros(band_count, dtype=np.float32)
    r2 = np.zeros(band_count, dtype=np.float32)
    quantized_entropy = np.zeros(band_count, dtype=np.float32)
    entropy_ratio = np.zeros(band_count, dtype=np.float32)

    reference_bins = min(64, max(8, q * 2))
    if domain == "global":
        band_edges = np.tile(np.asarray(edges, dtype=np.float64), (band_count, 1))
    else:
        band_edges = np.asarray(edges, dtype=np.float64)

    for band_index in range(band_count):
        band_values = features[:, band_index].astype(np.float64, copy=False)
        band_bins = quantized[:, band_index]
        counts = np.bincount(band_bins, minlength=q).astype(np.float64)
        quantized_entropy[band_index] = entropy_bits_from_counts(counts)

        ref_hist = np.histogram(band_values, bins=reference_bins)[0]
        ref_entropy = entropy_bits_from_counts(ref_hist)
        entropy_ratio[band_index] = (
            float(quantized_entropy[band_index] / ref_entropy) if ref_entropy > 0 else 0.0
        )

        representatives = np.zeros(q, dtype=np.float64)
        edge_row = band_edges[band_index]
        for bin_id in range(q):
            mask = band_bins == bin_id
            if np.any(mask):
                representatives[bin_id] = float(np.mean(band_values[mask]))
            else:
                representatives[bin_id] = float((edge_row[bin_id] + edge_row[bin_id + 1]) / 2.0)

        reconstructed = representatives[band_bins]
        errors = band_values - reconstructed
        rmse[band_index] = float(np.sqrt(np.mean(errors**2)))

        baseline = band_values - float(np.mean(band_values))
        denom = float(np.sum(baseline**2))
        r2[band_index] = float(1.0 - (np.sum(errors**2) / denom)) if denom > 0 else 1.0

    return rmse, r2, quantized_entropy, entropy_ratio


def sampled_sensitivity(
    features: np.ndarray,
    current_quantized: np.ndarray,
    scheme: str,
    domain: str,
    q: int,
    random_state: int = 42,
) -> dict[str, float | None]:
    neighbors = {
        "Q-1_ari": q - 1 if q - 1 >= 2 else None,
        "Q+1_ari": q + 1,
        "Q/2_ari": q // 2 if q // 2 >= 2 else None,
        "2Q_ari": q * 2,
    }
    flat_current = current_quantized.reshape(-1)
    if flat_current.size == 0:
        return {key: None for key in neighbors}

    rng = np.random.default_rng(random_state)
    sample_size = min(200_000, flat_current.size)
    sample_indices = rng.choice(flat_current.size, size=sample_size, replace=False)
    sampled_current = flat_current[sample_indices]

    result: dict[str, float | None] = {}
    for key, neighbor_q in neighbors.items():
        if neighbor_q is None:
            result[key] = None
            continue
        neighbor_edges = fit_edges(features, scheme, domain, neighbor_q)
        neighbor_quantized = quantize_from_edges(features, neighbor_edges, domain).reshape(-1)
        result[key] = round_scalar(adjusted_rand_score(sampled_current, neighbor_quantized[sample_indices]))
    return result


def local_quantizer_path(config: QuantizationConfig, scene_id: str) -> Path:
    return LOCAL_OUTPUT_DIR / config.id / f"{scene_id}.json"


def derived_quantization_path(config: QuantizationConfig, scene_id: str) -> Path:
    return DERIVED_OUTPUT_DIR / config.id / f"{scene_id}.json"


def build_scene_quantization(scene_key: str, configs: list[QuantizationConfig], force: bool) -> None:
    public_scene_id, cube, wavelengths = scene_payload(scene_key)
    flat_cube = cube.reshape(-1, cube.shape[-1])
    valid_mask = valid_spectra_mask(flat_cube)
    features = flat_cube[valid_mask].astype(np.float32, copy=False)

    for config in configs:
        local_path = local_quantizer_path(config, public_scene_id)
        derived_path = derived_quantization_path(config, public_scene_id)
        if local_path.exists() and derived_path.exists() and not force:
            print(f"Skipping existing {public_scene_id} / {config.id}")
            continue

        edges = fit_edges(features, config.scheme, config.domain, config.q)
        quantized = quantize_from_edges(features, edges, config.domain)
        (
            vocab_size_per_recipe,
            doc_length_distribution_per_recipe,
            zero_token_doc_rate_per_recipe,
            token_sparsity_per_recipe,
        ) = recipe_metrics(quantized)
        rmse, r2, entropy_bits, entropy_ratio = quantization_diagnostics(
            features,
            quantized,
            edges,
            config.domain,
            config.q,
        )
        bin_population = np.bincount(quantized.reshape(-1), minlength=config.q).astype(np.float64)
        bin_population = bin_population / max(float(np.sum(bin_population)), 1.0)
        sensitivity = sampled_sensitivity(features, quantized, config.scheme, config.domain, config.q)

        local_payload = {
            "scene_id": public_scene_id,
            "scheme": config.scheme,
            "domain": config.domain,
            "Q": config.q,
            "preprocessing_id": "raw",
            "document_count": int(features.shape[0]),
            "band_count": int(features.shape[1]),
            "wavelengths_nm": round_vector(wavelengths),
            "quantizer_edges": round_vector(edges) if config.domain == "global" else [round_vector(row) for row in edges],
            "implementation_scope": {
                "builder_status": "partial",
                "notes": "Thin-slice quantization builder. Downstream LDA metrics remain pending build_lda_sweep.",
            },
        }
        write_json(local_path, local_payload)

        derived_payload = {
            "scheme": config.scheme,
            "domain": config.domain,
            "Q": config.q,
            "scene_id": public_scene_id,
            "preprocessing_id": "raw",
            "document_count": int(features.shape[0]),
            "band_count": int(features.shape[1]),
            "wavelengths_nm": round_vector(wavelengths),
            "vocab_size_per_recipe": vocab_size_per_recipe,
            "doc_length_distribution_per_recipe": doc_length_distribution_per_recipe,
            "zero_token_doc_rate_per_recipe": zero_token_doc_rate_per_recipe,
            "token_sparsity_per_recipe": token_sparsity_per_recipe,
            "bin_population": round_vector(bin_population),
            "info_preserved_bits_per_band": round_vector(entropy_bits),
            "info_preserved_ratio_per_band": round_vector(entropy_ratio),
            "reconstruction_rmse_per_band": round_vector(rmse),
            "reconstruction_r2_per_band": round_vector(r2),
            "sensitivity_to_neighbour_Q": sensitivity,
            "downstream_lda_at_canonical_K": {
                "status": "pending_build_lda_sweep",
                "perplexity": None,
                "npmi": None,
                "topic_stability": None,
                "f1_macro": None,
            },
            "implementation_scope": {
                "schemes": ["uniform", "quantile"],
                "domains": ["global", "per_band"],
                "q_values": DEFAULT_Q_VALUES,
                "notes": "The full master-plan grid is pending. This builder slice surfaces quantizer-level effects only.",
            },
        }
        write_json(derived_path, derived_payload)
        print(f"Wrote {public_scene_id} / {config.id}")


def all_scene_keys() -> list[str]:
    return list(RAW_SCENES.keys()) + list(UNMIXING_SCENES.keys())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene", action="append", dest="scenes", help="Scene key to build. Repeatable.")
    parser.add_argument("--scheme", action="append", dest="schemes", help="Quantization scheme. Repeatable.")
    parser.add_argument("--domain", action="append", dest="domains", help="Quantization domain. Repeatable.")
    parser.add_argument("--q", action="append", dest="q_values", type=int, help="Quantization bin count. Repeatable.")
    parser.add_argument("--force", action="store_true", help="Rewrite outputs even if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show selected scenes/configs without writing outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    scene_keys = args.scenes or all_scene_keys()
    schemes = args.schemes or ["uniform", "quantile"]
    domains = args.domains or ["global", "per_band"]
    q_values = args.q_values or DEFAULT_Q_VALUES
    configs = [QuantizationConfig(scheme=scheme, domain=domain, q=q) for scheme in schemes for domain in domains for q in q_values]

    if args.dry_run:
        print(f"Dry run: {len(scene_keys)} scenes, {len(configs)} quantization configs")
        for scene_key in scene_keys:
            print(f"- {scene_key}")
        for config in configs:
            print(f"  * {config.id}")
        return

    for scene_key in scene_keys:
        build_scene_quantization(scene_key, configs, force=args.force)


if __name__ == "__main__":
    main()
