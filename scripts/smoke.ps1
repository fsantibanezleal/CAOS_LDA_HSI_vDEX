# CAOS LDA HSI smoke-test runner.

[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:8437"
)

$ErrorActionPreference = "Stop"

$checks = @(
    @{ Path = "/healthz"; ExpectedContentType = "text/plain" },
    @{ Path = "/api/app-data"; ExpectedContentType = "application/json" },
    @{ Path = "/api/data-families"; ExpectedContentType = "application/json" },
    @{ Path = "/api/corpus-recipes"; ExpectedContentType = "application/json" },
    @{ Path = "/api/interactive-subsets"; ExpectedContentType = "application/json" },
    @{ Path = "/api/corpus-previews"; ExpectedContentType = "application/json" },
    @{ Path = "/api/segmentation-baselines"; ExpectedContentType = "application/json" },
    @{ Path = "/api/local-validation-matrix"; ExpectedContentType = "application/json" },
    @{ Path = "/api/local-dataset-inventory"; ExpectedContentType = "application/json" },
    @{ Path = "/api/local-core-benchmarks"; ExpectedContentType = "application/json" },
    @{ Path = "/api/hidsag-subset-inventory"; ExpectedContentType = "application/json" },
    @{ Path = "/api/hidsag-region-documents"; ExpectedContentType = "application/json" },
    @{ Path = "/api/hidsag-band-quality"; ExpectedContentType = "application/json" },
    @{ Path = "/api/hidsag-preprocessing-sensitivity"; ExpectedContentType = "application/json" },
    @{ Path = "/api/spectral-library"; ExpectedContentType = "application/json" },
    @{ Path = "/api/analysis"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/real/previews/cuprite-aviris-reflectance-rgb.png"; ExpectedContentType = "image/png" },
    @{ Path = "/generated/spectral/library_samples.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/analysis/analysis.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/corpus/corpus_previews.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/baselines/segmentation_baselines.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/local_dataset_inventory.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/local_core_benchmarks.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/hidsag_subset_inventory.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/hidsag_region_documents.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/hidsag_band_quality.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/core/hidsag_preprocessing_sensitivity.json"; ExpectedContentType = "application/json" },
    @{ Path = "/generated/baselines/previews/cuprite-aviris-reflectance-slic.png"; ExpectedContentType = "image/png" },
    @{ Path = "/"; ExpectedContentType = "text/html" }
)

foreach ($check in $checks) {
    $url = "$($BaseUrl.TrimEnd('/'))$($check.Path)"
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "Smoke check failed for $url with status $($response.StatusCode)"
    }
    $contentType = "$($response.Headers["Content-Type"])"
    if (-not $contentType.StartsWith($check.ExpectedContentType, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Smoke check failed for $url with unexpected content type '$contentType' (expected prefix '$($check.ExpectedContentType)')"
    }
    Write-Host "OK $($response.StatusCode) $contentType $url"
}

Write-Host "Smoke checks passed for $BaseUrl"
