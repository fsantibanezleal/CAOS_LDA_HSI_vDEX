"""Build thin-slice LDA K-by-seed sweeps under the master-plan contract."""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from itertools import combinations
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.decomposition import LatentDirichletAllocation
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from research_core.paths import DERIVED_DIR, LOCAL_DIR
from research_core.spectral import best_alignment, cosine_similarity_matrix


LOCAL_WORDIFICATIONS_ROOT = LOCAL_DIR / "wordifications"
LOCAL_LDA_ROOT = LOCAL_DIR / "lda_fits"
DERIVED_LDA_SWEEP_ROOT = DERIVED_DIR / "lda_sweep"
DEFAULT_RECIPE_VARIANT_IDS = ["region-documents__slic_200"]
DEFAULT_QUANT_CONFIG_IDS = ["uniform_per_band_Q16", "quantile_per_band_Q16"]
DEFAULT_K_VALUES = [4, 6, 8, 10, 12, 16]
DEFAULT_SEEDS = [0, 1, 2, 3, 4]
TOP_TOKEN_LIMIT = 50
COHERENCE_TOP_N = 15


@dataclass(frozen=True)
class SweepScope:
    recipe_variant_id: str
    quantization_config_id: str
    variant_id: str = "lda_sklearn_online"


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


def normalize_probability_rows(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=np.float32)
    totals = np.sum(values, axis=1, keepdims=True)
    return values / np.maximum(totals, 1e-8)


def top_index_set(weights: np.ndarray, limit: int = 12) -> set[int]:
    indices = np.argsort(weights)[::-1][:limit]
    return {int(index) for index in indices}


def matched_topic_similarity(reference_components: np.ndarray, candidate_components: np.ndarray) -> dict[str, Any]:
    ref_probs = normalize_probability_rows(reference_components)
    cand_probs = normalize_probability_rows(candidate_components)
    similarity = cosine_similarity_matrix(ref_probs, cand_probs)
    row_ind, col_ind = best_alignment(similarity, maximize=True)
    matched = similarity[row_ind, col_ind]

    overlaps = []
    for ref_index, cand_index in zip(row_ind, col_ind, strict=False):
        ref_set = top_index_set(ref_probs[ref_index])
        cand_set = top_index_set(cand_probs[cand_index])
        union = max(1, len(ref_set | cand_set))
        overlaps.append(len(ref_set & cand_set) / union)

    return {
        "matched_topic_cosine_mean": round_scalar(np.mean(matched)),
        "matched_topic_cosine_min": round_scalar(np.min(matched)),
        "matched_topic_cosine_std": round_scalar(np.std(matched)),
        "matched_top_token_jaccard_mean": round_scalar(np.mean(overlaps)),
        "pairings": [
            {
                "reference_topic_id": int(ref_index + 1),
                "candidate_topic_id": int(cand_index + 1),
                "cosine_similarity": round_scalar(similarity[ref_index, cand_index]),
                "top_token_jaccard": round_scalar(overlap),
            }
            for ref_index, cand_index, overlap in zip(row_ind, col_ind, overlaps, strict=False)
        ],
    }


def fit_lda(counts: sparse.csr_matrix, n_topics: int, seed: int, max_iter: int = 30) -> tuple[LatentDirichletAllocation, np.ndarray]:
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        learning_method="batch",
        max_iter=max_iter,
        random_state=seed,
        doc_topic_prior=0.4,
        topic_word_prior=0.15,
    )
    mixtures = lda.fit_transform(counts)
    return lda, mixtures


def top_words_payload(phi: np.ndarray, vocabulary: list[str], limit: int = TOP_TOKEN_LIMIT) -> list[list[dict[str, Any]]]:
    payload: list[list[dict[str, Any]]] = []
    for topic_weights in phi:
        indices = np.argsort(topic_weights)[::-1][:limit]
        payload.append(
            [
                {
                    "token": vocabulary[int(index)],
                    "weight": round_scalar(topic_weights[int(index)]),
                }
                for index in indices
            ]
        )
    return payload


def local_fit_dir(scope: SweepScope, k_value: int, seed: int, scene_id: str) -> Path:
    return LOCAL_LDA_ROOT / scope.variant_id / f"{scope.recipe_variant_id}__{scope.quantization_config_id}__K{k_value}__s{seed}" / scene_id


def derived_sweep_path(scope: SweepScope, scene_id: str) -> Path:
    return DERIVED_LDA_SWEEP_ROOT / f"{scope.recipe_variant_id}__{scope.quantization_config_id}" / f"{scene_id}.json"


def load_corpus(scope: SweepScope, scene_id: str) -> tuple[sparse.csr_matrix, list[str], list[dict[str, Any]], dict[str, Any]]:
    parquet_path = LOCAL_WORDIFICATIONS_ROOT / scope.recipe_variant_id / scope.quantization_config_id / f"{scene_id}.parquet"
    docs_path = LOCAL_WORDIFICATIONS_ROOT / scope.recipe_variant_id / scope.quantization_config_id / f"{scene_id}.docs.json"
    vocab_path = LOCAL_WORDIFICATIONS_ROOT / scope.recipe_variant_id / scope.quantization_config_id / f"{scene_id}.vocab.json"
    summary_path = LOCAL_WORDIFICATIONS_ROOT / scope.recipe_variant_id / scope.quantization_config_id / f"{scene_id}.json"

    rows = pd.read_parquet(parquet_path, columns=["document_id", "token", "count"])
    docs_payload = load_json(docs_path)
    vocab_payload = load_json(vocab_path)
    summary_payload = load_json(summary_path)

    vocabulary = [str(token) for token in vocab_payload.get("tokens", [])]
    token_to_index = {token: idx for idx, token in enumerate(vocabulary)}
    token_codes = rows["token"].astype(str).map(token_to_index).to_numpy(dtype=np.int32, copy=False)
    doc_ids = rows["document_id"].to_numpy(dtype=np.int32, copy=False)
    counts = rows["count"].to_numpy(dtype=np.float32, copy=False)
    document_count = int(summary_payload["document_count"])
    matrix = sparse.coo_matrix(
        (counts, (doc_ids, token_codes)),
        shape=(document_count, len(vocabulary)),
        dtype=np.float32,
    ).tocsr()
    documents = list(docs_payload.get("documents", []))
    return matrix, vocabulary, documents, summary_payload


def train_test_doc_indices(documents: list[dict[str, Any]], random_state: int = 42) -> tuple[np.ndarray, np.ndarray]:
    doc_ids = np.asarray([int(document["document_id"]) for document in documents], dtype=np.int32)
    labels = np.asarray(
        [int(document["label_id"]) if document.get("label_id") is not None else -1 for document in documents],
        dtype=np.int32,
    )
    positive_mask = labels > 0
    stratify = None
    if np.any(positive_mask):
        label_counts = np.bincount(labels[positive_mask])
        valid_counts = label_counts[label_counts > 0]
        if valid_counts.size > 0 and int(np.min(valid_counts)) >= 2:
            stratify = labels

    if doc_ids.shape[0] < 6:
        return doc_ids, doc_ids

    train_ids, test_ids = train_test_split(
        doc_ids,
        test_size=0.2,
        random_state=random_state,
        shuffle=True,
        stratify=stratify if stratify is not None else None,
    )
    return np.sort(train_ids), np.sort(test_ids)


def topic_diversity(phi: np.ndarray, top_n: int = COHERENCE_TOP_N) -> float:
    top_indices = []
    for row in phi:
        top_indices.extend(np.argsort(row)[::-1][:top_n].tolist())
    denominator = max(1, phi.shape[0] * top_n)
    return float(len(set(int(index) for index in top_indices)) / denominator)


def cooccurrence_stats(counts: sparse.csr_matrix) -> tuple[np.ndarray, np.ndarray]:
    binary = counts.copy()
    binary.data = np.ones_like(binary.data)
    presence = np.asarray(binary.sum(axis=0)).ravel().astype(np.float64)
    co = (binary.T @ binary).toarray().astype(np.float64)
    return presence, co


def topic_npmi_umass(phi: np.ndarray, presence: np.ndarray, co: np.ndarray, doc_count: int, top_n: int = COHERENCE_TOP_N) -> tuple[float, float]:
    if doc_count <= 1:
        return 0.0, 0.0

    topic_npmis: list[float] = []
    topic_umass: list[float] = []
    for row in phi:
        indices = np.argsort(row)[::-1][:top_n]
        npmi_values: list[float] = []
        umass_values: list[float] = []
        for left in range(len(indices)):
            for right in range(left + 1, len(indices)):
                i = int(indices[left])
                j = int(indices[right])
                p_i = presence[i] / doc_count
                p_j = presence[j] / doc_count
                p_ij = co[i, j] / doc_count
                if p_i > 0 and p_j > 0 and p_ij > 0:
                    pmi = np.log(p_ij / (p_i * p_j))
                    npmi = pmi / (-np.log(p_ij))
                    npmi_values.append(float(npmi))
                denom = max(presence[j], 1.0)
                umass_values.append(float(np.log((co[i, j] + 1.0) / denom)))
        topic_npmis.append(float(np.mean(npmi_values)) if npmi_values else 0.0)
        topic_umass.append(float(np.mean(umass_values)) if umass_values else 0.0)
    return float(np.mean(topic_npmis)), float(np.mean(topic_umass))


def label_alignment(documents: list[dict[str, Any]], theta: np.ndarray) -> dict[str, float | None]:
    labels = np.asarray(
        [int(document["label_id"]) if document.get("label_id") is not None else -1 for document in documents],
        dtype=np.int32,
    )
    mask = labels > 0
    if not np.any(mask):
        return {"ari": None, "nmi": None}
    dominant = np.argmax(theta[mask], axis=1)
    truth = labels[mask]
    return {
        "ari": round_scalar(adjusted_rand_score(truth, dominant)),
        "nmi": round_scalar(normalized_mutual_info_score(truth, dominant)),
    }


def fit_payload(
    *,
    scope: SweepScope,
    scene_id: str,
    k_value: int,
    seed: int,
    counts: sparse.csr_matrix,
    vocabulary: list[str],
    documents: list[dict[str, Any]],
    train_ids: np.ndarray,
    test_ids: np.ndarray,
) -> dict[str, Any]:
    fit_dir = local_fit_dir(scope, k_value, seed, scene_id)
    fit_dir.mkdir(parents=True, exist_ok=True)
    train_counts = counts[train_ids]
    test_counts = counts[test_ids]

    start = time.perf_counter()
    lda, theta = fit_lda(train_counts, n_topics=k_value, seed=seed, max_iter=30)
    runtime_s = time.perf_counter() - start
    theta_all = lda.transform(counts)
    phi = normalize_probability_rows(lda.components_).astype(np.float32)
    top_words = top_words_payload(phi, vocabulary)
    train_perplexity = float(lda.perplexity(train_counts))
    test_perplexity = float(lda.perplexity(test_counts))
    presence, co = cooccurrence_stats(train_counts)
    npmi_value, umass_value = topic_npmi_umass(phi, presence, co, int(train_counts.shape[0]))
    diversity = topic_diversity(phi)
    prevalence = normalize_probability_rows(theta_all).mean(axis=0)
    alignment = label_alignment(documents, theta_all)

    np.save(fit_dir / "phi.npy", phi.astype(np.float32))
    np.save(fit_dir / "theta.npy", theta_all.astype(np.float32))
    write_json(fit_dir / "vocab.json", {"vocabulary": vocabulary})
    write_json(fit_dir / "topic_prevalence.json", {"prevalence": [round_scalar(value) for value in prevalence.tolist()]})
    write_json(fit_dir / "top_words.json", {"topics": top_words})
    metrics_payload = {
        "variant_id": scope.variant_id,
        "recipe_variant_id": scope.recipe_variant_id,
        "quantization_config_id": scope.quantization_config_id,
        "scene_id": scene_id,
        "K": int(k_value),
        "seed": int(seed),
        "train_document_count": int(train_counts.shape[0]),
        "test_document_count": int(test_counts.shape[0]),
        "vocabulary_size": int(len(vocabulary)),
        "train_perplexity": round_scalar(train_perplexity),
        "test_perplexity": round_scalar(test_perplexity),
        "npmi": round_scalar(npmi_value),
        "umass": round_scalar(umass_value),
        "topic_diversity": round_scalar(diversity),
        "label_alignment": alignment,
    }
    write_json(fit_dir / "metrics.json", metrics_payload)
    write_json(
        fit_dir / "runtime.json",
        {
            "runtime_s": round_scalar(runtime_s),
            "python": sys.version.split()[0],
        },
    )

    return {
        "K": int(k_value),
        "seed": int(seed),
        "train_perplexity": round_scalar(train_perplexity),
        "test_perplexity": round_scalar(test_perplexity),
        "npmi": round_scalar(npmi_value),
        "umass": round_scalar(umass_value),
        "topic_diversity": round_scalar(diversity),
        "label_alignment": alignment,
        "local_fit_ref": str(fit_dir.relative_to(ROOT)).replace("\\", "/"),
        "phi": phi,
        "theta": theta_all.astype(np.float32),
        "runtime_s": round_scalar(runtime_s),
        "top_words_preview": top_words[: min(3, len(top_words))],
    }


def aggregate_k_summary(k_value: int, fit_rows: list[dict[str, Any]]) -> dict[str, Any]:
    metrics = {
        "train_perplexity_mean": round_scalar(np.mean([row["train_perplexity"] for row in fit_rows])),
        "test_perplexity_mean": round_scalar(np.mean([row["test_perplexity"] for row in fit_rows])),
        "npmi_mean": round_scalar(np.mean([row["npmi"] for row in fit_rows])),
        "umass_mean": round_scalar(np.mean([row["umass"] for row in fit_rows])),
        "topic_diversity_mean": round_scalar(np.mean([row["topic_diversity"] for row in fit_rows])),
        "runtime_s_mean": round_scalar(np.mean([row["runtime_s"] for row in fit_rows])),
    }

    if fit_rows and fit_rows[0]["label_alignment"]["ari"] is not None:
        metrics["label_alignment_ari_mean"] = round_scalar(
            np.mean([row["label_alignment"]["ari"] for row in fit_rows if row["label_alignment"]["ari"] is not None])
        )
        metrics["label_alignment_nmi_mean"] = round_scalar(
            np.mean([row["label_alignment"]["nmi"] for row in fit_rows if row["label_alignment"]["nmi"] is not None])
        )
    else:
        metrics["label_alignment_ari_mean"] = None
        metrics["label_alignment_nmi_mean"] = None

    stability_rows = []
    for left, right in combinations(fit_rows, 2):
        comparison = matched_topic_similarity(left["phi"], right["phi"])
        stability_rows.append(
            {
                "seed_a": int(left["seed"]),
                "seed_b": int(right["seed"]),
                **comparison,
            }
        )

    if stability_rows:
        metrics["stability_cosine_mean"] = round_scalar(
            np.mean([row["matched_topic_cosine_mean"] for row in stability_rows])
        )
        metrics["stability_cosine_min"] = round_scalar(
            np.min([row["matched_topic_cosine_mean"] for row in stability_rows])
        )
        metrics["stability_jaccard_mean"] = round_scalar(
            np.mean([row["matched_top_token_jaccard_mean"] for row in stability_rows])
        )
    else:
        metrics["stability_cosine_mean"] = None
        metrics["stability_cosine_min"] = None
        metrics["stability_jaccard_mean"] = None

    return {
        "K": int(k_value),
        **metrics,
        "seed_comparisons": stability_rows,
    }


def recommended_k(k_rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not k_rows:
        return {"K": None, "rule": "no_rows"}

    ranked_test = sorted(k_rows, key=lambda row: float(row["test_perplexity_mean"]))
    ranked_stability = sorted(k_rows, key=lambda row: float(row["stability_cosine_mean"] or -1.0), reverse=True)
    ranked_npmi = sorted(k_rows, key=lambda row: float(row["npmi_mean"]), reverse=True)

    scores: dict[int, int] = {int(row["K"]): 0 for row in k_rows}
    for rank, row in enumerate(ranked_test):
        scores[int(row["K"])] += rank
    for rank, row in enumerate(ranked_stability):
        scores[int(row["K"])] += rank
    for rank, row in enumerate(ranked_npmi):
        scores[int(row["K"])] += rank

    best = min(scores.items(), key=lambda item: (item[1], item[0]))
    supporting = next(row for row in k_rows if int(row["K"]) == int(best[0]))
    return {
        "K": int(best[0]),
        "rule": "minimum summed rank over test_perplexity, stability_cosine_mean, and npmi_mean",
        "rank_score": int(best[1]),
        "supporting_metrics": {
            "test_perplexity_mean": supporting["test_perplexity_mean"],
            "stability_cosine_mean": supporting["stability_cosine_mean"],
            "npmi_mean": supporting["npmi_mean"],
        },
    }


def build_scene_sweep(
    scene_id: str,
    scope: SweepScope,
    k_values: list[int],
    seeds: list[int],
    force: bool,
) -> None:
    derived_path = derived_sweep_path(scope, scene_id)
    if derived_path.exists() and not force:
        print(f"Skipping existing {scene_id} / {scope.recipe_variant_id} / {scope.quantization_config_id}")
        return

    counts, vocabulary, documents, corpus_summary = load_corpus(scope, scene_id)
    train_ids, test_ids = train_test_doc_indices(documents)
    fit_rows: list[dict[str, Any]] = []
    for k_value in k_values:
        for seed in seeds:
            fit_rows.append(
                fit_payload(
                    scope=scope,
                    scene_id=scene_id,
                    k_value=k_value,
                    seed=seed,
                    counts=counts,
                    vocabulary=vocabulary,
                    documents=documents,
                    train_ids=train_ids,
                    test_ids=test_ids,
                )
            )

    k_summary_rows = [aggregate_k_summary(k_value, [row for row in fit_rows if int(row["K"]) == int(k_value)]) for k_value in k_values]
    derived_payload = {
        "scene_id": scene_id,
        "variant_id": scope.variant_id,
        "recipe_variant_id": scope.recipe_variant_id,
        "quantization_config_id": scope.quantization_config_id,
        "document_count": int(corpus_summary["document_count"]),
        "vocabulary_size": int(corpus_summary["vocabulary_size"]),
        "k_values": [int(value) for value in k_values],
        "seed_values": [int(value) for value in seeds],
        "train_document_count": int(train_ids.shape[0]),
        "test_document_count": int(test_ids.shape[0]),
        "fits": [
            {
                key: value
                for key, value in row.items()
                if key not in {"phi", "theta", "top_words_preview"}
            }
            for row in fit_rows
        ],
        "k_summary": k_summary_rows,
        "recommended_k": recommended_k(k_summary_rows),
        "implementation_scope": {
            "builder_status": "partial",
            "supported_variant": "lda_sklearn_online",
            "notes": "This sweep currently targets the implemented canonical region-document corpus variants and quantization slices.",
        },
    }
    write_json(derived_path, derived_payload)
    print(f"Wrote {scene_id} / {scope.recipe_variant_id} / {scope.quantization_config_id}")


def available_scene_ids(scope: SweepScope) -> list[str]:
    base = LOCAL_WORDIFICATIONS_ROOT / scope.recipe_variant_id / scope.quantization_config_id
    if not base.exists():
        return []
    return sorted(path.stem for path in base.glob("*.parquet"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--scene", action="append", dest="scenes", help="Scene id to build. Repeatable.")
    parser.add_argument("--recipe", action="append", dest="recipes", help="Recipe variant id. Repeatable.")
    parser.add_argument("--quant-cfg", action="append", dest="quant_cfgs", help="Quantization config id. Repeatable.")
    parser.add_argument("--k", action="append", dest="k_values", type=int, help="Topic count. Repeatable.")
    parser.add_argument("--seed", action="append", dest="seeds", type=int, help="Seed. Repeatable.")
    parser.add_argument("--force", action="store_true", help="Rewrite outputs even if they already exist.")
    parser.add_argument("--dry-run", action="store_true", help="Show selected sweep scope without writing outputs.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    recipe_ids = args.recipes or DEFAULT_RECIPE_VARIANT_IDS
    quant_cfg_ids = args.quant_cfgs or DEFAULT_QUANT_CONFIG_IDS
    k_values = args.k_values or DEFAULT_K_VALUES
    seeds = args.seeds or DEFAULT_SEEDS
    scopes = [SweepScope(recipe_variant_id=recipe_id, quantization_config_id=quant_cfg_id) for recipe_id in recipe_ids for quant_cfg_id in quant_cfg_ids]

    if args.dry_run:
        print(f"Dry run: {len(scopes)} scopes, K={k_values}, seeds={seeds}")
        for scope in scopes:
            scenes = args.scenes or available_scene_ids(scope)
            print(f"- {scope.recipe_variant_id} / {scope.quantization_config_id}: {len(scenes)} scenes")
            for scene_id in scenes:
                print(f"  * {scene_id}")
        return

    for scope in scopes:
        scene_ids = args.scenes or available_scene_ids(scope)
        for scene_id in scene_ids:
            build_scene_sweep(scene_id, scope, k_values, seeds, force=args.force)


if __name__ == "__main__":
    main()
