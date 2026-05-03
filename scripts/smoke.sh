#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:8437}"
BASE_URL="${BASE_URL%/}"

checks=(
  "/healthz|text/plain"
  "/api/app-data|application/json"
  "/api/data-families|application/json"
  "/api/corpus-recipes|application/json"
  "/api/interactive-subsets|application/json"
  "/api/corpus-previews|application/json"
  "/api/segmentation-baselines|application/json"
  "/api/local-validation-matrix|application/json"
  "/api/local-dataset-inventory|application/json"
  "/api/local-core-benchmarks|application/json"
  "/api/hidsag-subset-inventory|application/json"
  "/api/hidsag-region-documents|application/json"
  "/api/hidsag-band-quality|application/json"
  "/api/hidsag-preprocessing-sensitivity|application/json"
  "/api/spectral-library|application/json"
  "/api/analysis|application/json"
  "/generated/real/previews/cuprite-aviris-reflectance-rgb.png|image/png"
  "/generated/spectral/library_samples.json|application/json"
  "/generated/analysis/analysis.json|application/json"
  "/generated/corpus/corpus_previews.json|application/json"
  "/generated/baselines/segmentation_baselines.json|application/json"
  "/generated/core/local_dataset_inventory.json|application/json"
  "/generated/core/local_core_benchmarks.json|application/json"
  "/generated/core/hidsag_subset_inventory.json|application/json"
  "/generated/core/hidsag_region_documents.json|application/json"
  "/generated/core/hidsag_band_quality.json|application/json"
  "/generated/core/hidsag_preprocessing_sensitivity.json|application/json"
  "/generated/baselines/previews/cuprite-aviris-reflectance-slic.png|image/png"
  "/|text/html"
)

for check in "${checks[@]}"; do
  path="${check%%|*}"
  expected="${check##*|}"
  url="${BASE_URL}${path}"
  status_and_type="$(curl -L -s -o /dev/null -w "%{http_code}|%{content_type}" "$url")"
  status="${status_and_type%%|*}"
  content_type="${status_and_type#*|}"
  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "Smoke check failed for $url with status $status" >&2
    exit 1
  fi
  if [[ "$content_type" != "$expected"* ]]; then
    echo "Smoke check failed for $url with unexpected content type '$content_type' (expected prefix '$expected')" >&2
    exit 1
  fi
  echo "OK $status $content_type $url"
done

echo "Smoke checks passed for $BASE_URL"
