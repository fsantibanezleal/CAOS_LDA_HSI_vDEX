# Local Stack

## Why The Stack Is Split

This repository has three different local execution surfaces:

1. `.\.venv` for the FastAPI backend
2. `frontend/` with Node/Vite for the web client
3. `.\.venv-pipeline` for spectral processing, corpus construction,
   topic modelling, validation, and offline artifact generation

That split is deliberate.

The web runtime should stay thin and predictable. It serves already
curated artifacts from `data/derived/` and should not perform heavy
scientific computation on demand.

The pipeline runtime should stay rich and methodologically serious. It is
where spectra are loaded, grouped into documents, quantized, wordified,
fit by topic models, compared against baselines, and evaluated with real
quality metrics.

## Non-Negotiable Rule

The system Python exists only to bootstrap local virtual environments.
It is not the authoritative runtime for scientific builders.

From this point onward the intended execution discipline is:

- web Python commands run through `.\.venv\Scripts\python.exe`
- pipeline commands run through `.\.venv-pipeline\Scripts\python.exe`
- frontend commands run through `npm` or `pnpm` inside `frontend/`
- repo orchestration runs through `scripts/local.ps1` or `scripts/local.sh`

Running a pipeline builder with bare `python` from `PATH` is considered an
operator error, because it breaks reproducibility and can silently bypass
declared dependencies.

## Web Runtime

### Backend Python

The backend runtime is intentionally small:

| Package | Version | Role |
|---|---:|---|
| `fastapi` | `0.115.6` | API surface and backend app wiring |
| `uvicorn` | `0.32.1` | local ASGI dev and preview server |
| `orjson` | `3.10.12` | fast JSON serialization for derived payloads |
| `pydantic-settings` | `2.7.0` | environment-driven backend config |

This runtime exists to:

- expose curated app payloads
- serve the built SPA from `frontend/dist`
- provide stable API contracts for the client
- avoid turning the browser tier into an analysis engine

It does **not** exist to:

- train topic models
- recompute corpora
- estimate embeddings on request
- derive SAM or quantization metrics live

### Frontend Toolchain

The frontend runtime is also focused:

| Package | Version | Role |
|---|---:|---|
| `react` | `18.3.1` | UI runtime |
| `react-dom` | `18.3.1` | DOM binding |
| `vite` | `5.4.10` | dev server and build tool |
| `typescript` | `5.6.3` | typed frontend code |
| `zustand` | `5.0.1` | local state management |
| `i18next` | `23.16.4` | translation layer |
| `react-i18next` | `15.1.1` | React integration for translations |

Observed local JS runtime at the time this document was written:

- `node`: `v24.14.1`
- `npm`: `11.11.0`

The frontend is expected to:

- browse large precomputed artifacts efficiently
- render dense linked scientific views
- honor the `derived/manifests/index.json` contract
- refuse unsupported claims rather than improvise them

### Web Setup Commands

```powershell
.\scripts\local.ps1 setup-web
.\scripts\local.ps1 dev
.\scripts\local.ps1 build
.\scripts\local.ps1 preview
```

Equivalent direct primitives:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd frontend
npm install
npm run dev
```

The scripted entrypoints remain preferred because they preserve the
intended environment split.

## Pipeline Runtime

### Why The Pipeline Needs A Serious Stack

The master plan is not a toy tokenization demo. It requires:

- proper spectral I/O
- robust corpus generation and parquet storage
- multiple topic-modelling engines
- manifold and clustering baselines
- convolutional and variational representation learning
- statistical comparison beyond single-point scores
- Bayesian comparison support
- wavelength-aware spectral similarity and library alignment

Without that stack, the project collapses into an underpowered prototype.

### Pipeline Package Groups

#### Core numerics, tabular, and binary artifact handling

| Package | Version | Why it is here |
|---|---:|---|
| `numpy` | `2.2.0` | array math, spectra matrices, quantization, distances |
| `scipy` | `1.14.1` | sparse matrices, stats, optimization, signal primitives |
| `pandas` | `3.0.2` | document tables, corpus rows, summaries |
| `pyarrow` | `24.0.0` | parquet corpora and compact binary interchange |
| `h5py` | `3.16.0` | HDF5-like scientific file access and HIDSAG handling |
| `xarray` | `2026.4.0` | labeled tensor workflows for multi-axis cubes |
| `tifffile` | `2026.4.11` | TIFF/MSI I/O |
| `ImageIO` | `2.37.3` | image export and preview support |
| `Pillow` | `12.2.0` | lightweight image previews and debug assets |
| `requests` | `2.33.1` | local fetch builders for external sources |

These packages are the minimum needed to build corpora that are not
fragile ad hoc arrays.

#### Spectral and hyperspectral processing

| Package | Version | Why it is here |
|---|---:|---|
| `spectral` | `0.24` | serious HSI-oriented operations, ENVI-style handling, spectral utilities |
| `pysptools` | `0.15.0` | endmember, unmixing, and spectral-analysis helpers |
| `PyWavelets` | `1.9.0` | wavelet-derived recipes and denoising branches |
| `rasterio` | `1.5.0` | real raster I/O when a scene arrives as geospatial raster instead of `.mat` |

This group matters because the project needs to compute real spectral
evidence, not simplified RGB approximations masquerading as HSI analysis.

#### Topic modelling and corpus interpretation

| Package | Version | Why it is here |
|---|---:|---|
| `bertopic` | `0.17.4` | modern modular topic pipeline over embeddings, UMAP, HDBSCAN, and c-TF-IDF |
| `scikit-learn` | `1.6.0` | baseline LDA, PCA, NMF, classical ML baselines |
| `gensim` | `4.4.0` | variational and corpus-native topic workflows |
| `tomotopy` | `0.14.0` | fast serious topic models including HDP-family support |
| `pyLDAvis` | `3.4.1` | relevance-based topic interpretation surfaces |
| `sentence-transformers` | `5.4.1` | dense document embeddings for BERTopic-style and embedding-native topic workflows |
| `plotly` | `6.7.0` | BERTopic-native offline visual diagnostics and topic-geometry plots |
| `tqdm` | `4.67.3` | long-running build visibility and diagnostics |

This group is what turns tokenized spectra into actual PTM/LDA research
objects rather than one-off count matrices.

#### Embeddings, clustering, and manifold geometry

| Package | Version | Why it is here |
|---|---:|---|
| `umap-learn` | `0.5.12` | non-linear document and topic geometry |
| `openTSNE` | `1.0.4` | serious t-SNE alternative with better performance/control |
| `hdbscan` | `0.8.42` | density clustering and non-parametric grouping |
| `scikit-image` | `0.26.0` | SLIC and image-oriented grouping support |
| `imbalanced-learn` | `0.14.1` | safer supervised evaluation under label imbalance |
| `optuna` | `4.8.0` | structured tuning when representation models grow |

This group supports the comparison line that the master plan explicitly
demands: topic models must be compared against non-topic latent spaces
and clustering methods, not presented alone.

#### Deep, convolutional, variational, and probabilistic modelling

| Package | Version | Why it is here |
|---|---:|---|
| `torch` | `2.11.0` | neural representation learning backbone |
| `lightning` | `2.6.1` | training orchestration for CAE/VAE builders |
| `torchmetrics` | `1.9.0` | stable training and validation metrics |
| `einops` | `0.8.2` | readable tensor reshaping in convolutional and sequence models |
| `pyro-ppl` | `1.9.1` | probabilistic deep modelling where needed |

This group is what makes CAE-1D, CAE-2D, CAE-3D, VAE, and neural topic
variants feasible under a disciplined local pipeline.

#### Statistical depth and Bayesian comparison

| Package | Version | Why it is here |
|---|---:|---|
| `statsmodels` | `0.14.6` | classical inference and model diagnostics |
| `scikit-posthocs` | `0.12.0` | post-hoc comparisons for method rankings |
| `pymc` | `5.28.5` | Bayesian hierarchical comparison support |
| `arviz` | `0.23.4` | posterior diagnostics and uncertainty summaries |
| `seaborn` | `0.13.2` | exploratory statistical plotting |
| `matplotlib` | `3.10.9` | offline figures, diagnostics, and validation exports |

This group matters because the plan asks for confidence intervals,
paired tests, effect sizes, dominance matrices, and Bayesian probability
of method superiority. Those claims require dedicated statistical tools.

## What The Pipeline Stack Enables

The stack is not installed for prestige. It is installed to support
specific artifact classes.

### Document construction

We need:

- `scikit-image` for SLIC-style grouping
- `numpy` and `scipy` for region statistics
- `Pillow` and image I/O utilities for previews and overlays

Without these, `document = group of spectra` remains rhetorical.

### Quantization and wordification

We need:

- `numpy` and `scipy` for band-wise and global quantization
- `pandas` and `pyarrow` for parquet corpora
- sparse and vectorized operations for tractable document-term builds

Without these, corpora degrade into fragile JSON blobs or lossy ad hoc
structures.

### Topic modelling

We need:

- `scikit-learn` for the canonical baseline and fast sweeps
- `gensim` for alternative LDA families
- `tomotopy` for more serious topic engines and HDP-style work
- `bertopic` for embedding-driven topic discovery and modern modular PTM
- `pyLDAvis` for interpretable topic views

Without these, "topic modelling" would really mean only one sklearn
baseline and no defensible cross-engine comparison.

### Spectral similarity and library alignment

We need:

- `spectral`
- `pysptools`
- `numpy`/`scipy`
- eventually `rasterio` and `xarray` when raster-native scenes enter

Without these, SAM-style evidence and topic-to-library alignment are
only approximate utilities, not a real methodological pillar.

### Deep representation learning

We need:

- `torch`
- `lightning`
- `torchmetrics`
- `einops`

Without these, CAE/VAE/ProdLDA-like branches remain empty placeholders.

### Statistical quality estimation

We need:

- `statsmodels`
- `scikit-posthocs`
- `pymc`
- `arviz`
- `imbalanced-learn`

Without these, the project can report scores but not robust method
comparison evidence.

## Current Local Caveats

### Torch is CPU-only right now

The currently installed `torch` build is CPU-oriented. That is adequate
for correctness and for smaller thin-slice builders, but large CAE-3D or
hyperparameter-heavy runs will eventually benefit from a GPU-specific
installation path.

### PyMC warns about missing `g++`

The current environment imports `pymc`, but `pytensor` warns that no C++
compiler is present. That means:

- correctness is still available
- performance may degrade for some compiled paths
- the Bayesian layer is usable, but not yet fully optimized

If Bayesian workloads become a hot path, local compiler support should be
added intentionally rather than ignored.

### The stack is now serious, but not every builder is implemented yet

Installing the stack does not magically finish the research pipeline.
What it does is remove the excuse for underpowered builders and give the
repo the toolchain needed to implement the master plan honestly.

## Authoritative Setup Commands

### Web

```powershell
.\scripts\local.ps1 setup-web
.\scripts\local.ps1 dev
.\scripts\local.ps1 preview
```

### Pipeline

```powershell
.\scripts\local.ps1 setup-pipeline
.\scripts\local.ps1 build-real
.\scripts\local.ps1 build-local-core
```

### Direct pipeline execution

```powershell
.\.venv-pipeline\Scripts\python.exe data-pipeline\build_eda_views.py --force
.\.venv-pipeline\Scripts\python.exe data-pipeline\build_wordifications.py --force
.\.venv-pipeline\Scripts\python.exe data-pipeline\build_lda_sweep.py --dry-run
```

## Operational Policy

The repository should follow these rules:

- if a builder needs a package, the package belongs in the relevant
  requirements file before the builder is treated as trustworthy
- if a metric cannot be produced from the declared local stack, the
  corresponding claim should not appear in the web app
- if a command path does not explicitly select `.venv` or
  `.venv-pipeline`, it should be treated with suspicion
- the web app should remain a reader of curated evidence, not a hidden
  computation backend
