# CAOS_LDA_HSI_vDEX

## Important

> This repository is an alternative exploratory analysis.
>
> The official repository is:
> `https://github.com/fsantibanezleal/CAOS_LDA_HSI`
>
> Treat both repositories as parallel workflows. This repo should be
> read and operated independently rather than assuming parity with the
> official line.

CAOS_LDA_HSI_vDEX is a local-first research workspace for probabilistic topic
modelling over multispectral and hyperspectral data.

The project is built around one central hypothesis:

> A spectral sample, patch, or measured support is often better
> represented by a distribution of spectra than by a single cleaned
> signature.

This repository therefore treats spectral variability as a modelling
object, not merely as nuisance noise.

## What This Repo Is

- a FastAPI backend for serving curated local artifacts
- a React + Vite frontend for interactive scientific exploration
- a local data pipeline for acquisition, preprocessing, and compact
  export
- an offline validation layer for PTM/LDA, clustering, unmixing-style
  comparisons, and measured-target benchmarks
- a local-only project memory under `wip/` kept outside Git tracking
- a deep technical wiki under `wiki/`

The canonical repo name is `CAOS_LDA_HSI_vDEX`. The current local folder
name may still differ until a later filesystem rename.

## What This Repo Is Not

- not a static landing page pretending to be a scientific tool
- not a generic dashboard disconnected from the data pipeline
- not a raw-data dump
- not a production prediction system

## Repository Layout

- `app/`: FastAPI application
- `frontend/`: React + Vite client
- `research_core/`: reusable local validation utilities
- `data-pipeline/`: acquisition and derivation scripts
- `data/`: manifests, compact derived assets, and raw-data staging
- `legacy/`: historical notebook and paper material, now explicitly
  audited
- `wip/`: local work-in-progress memory, decisions, and state kept
  outside Git tracking
- `wiki/`: deep Markdown wiki with theory, research, datasets, and
  workspace rationale
- `docs/`: repo-oriented technical documents
- `scripts/`: local setup, run, and smoke-test scripts

## Git Branching

- `develop` is the active integration and development branch
- `main` is kept as the stable branch
- the GitHub default branch is now `develop`

## Frontend Structure

The current web app is intentionally split so the main runtime files do
not become giant again:

- `frontend/src/App.tsx` handles route and shared-state orchestration
- `frontend/src/app/pages/` holds route surfaces and page-local panels
- `frontend/src/app/types.ts`, `constants.ts`, `utils/`, `ui.tsx`,
  and `diagrams.tsx` hold shared app concerns
- `frontend/src/styles/workspace.css` is only the style entrypoint and
  imports smaller partials:
  - `base.css`
  - `pages.css`
  - `workspace-shell.css`
  - `plots.css`

## Current Scientific Scope

The repo currently covers four data families:

1. individual spectra with labels or material groups
2. labeled spectral images
3. unlabeled spectral images
4. regions or samples with external measurements

Current local-first strengths include:

- UPV/EHU benchmark scenes
- Cuprite and compact unmixing ROIs
- MicaSense field MSI examples
- compact USGS spectral-library slices
- HIDSAG-derived measured-target workflows

## Core Working Principle

No topic surface is scientifically meaningful unless it states:

- what the alphabet is
- what a word is
- what a document is
- what corpus produced the model
- what labels or measurements were or were not used
- what caveats still apply

The benchmark surfaces follow the same rule for supervised PTM claims:
flat `theta` models are treated as control baselines, while topic-routed
or support-aggregated models are the intended PTM surfaces for Family D
when those runs exist. If a published benchmark payload predates the
role-metadata refresh, the app falls back to stable model-id inference
instead of presenting every model as equivalent.

## Persistent Project Memory

Planning and state now live in the repository working tree as local-only
memory outside Git tracking:

- [wip/session-start.md](wip/session-start.md)
- [wip/master-plan.md](wip/master-plan.md)
- [wip/README.md](wip/README.md)
- [wip/pending.md](wip/pending.md)
- [wip/state.md](wip/state.md)
- [wip/decisions.md](wip/decisions.md)

## Deep Wiki

The deeper scientific documentation now lives in:

- [wiki/README.md](wiki/README.md)
- [wiki/theory.md](wiki/theory.md)
- [wiki/research-landscape.md](wiki/research-landscape.md)
- [wiki/datasets.md](wiki/datasets.md)
- [wiki/local-stack.md](wiki/local-stack.md)
- [wiki/products-and-quality.md](wiki/products-and-quality.md)
- [wiki/legacy-audit.md](wiki/legacy-audit.md)
- [wiki/workspace-guide.md](wiki/workspace-guide.md)

## Local Setup

### Web environment

```powershell
.\scripts\local.ps1 setup-web
```

```bash
./scripts/local.sh setup-web
```

### Pipeline environment

```powershell
.\scripts\local.ps1 setup-pipeline
```

```bash
./scripts/local.sh setup-pipeline
```

### Full local setup

```powershell
.\scripts\local.ps1 setup-all
```

```bash
./scripts/local.sh setup-all
```

## Common Commands

```powershell
.\scripts\local.ps1 dev
.\scripts\local.ps1 fetch-all
.\scripts\local.ps1 build-local-core
.\scripts\local.ps1 smoke
.\scripts\local.ps1 smoke-dev
```

```bash
./scripts/local.sh dev
./scripts/local.sh fetch-all
./scripts/local.sh build-local-core
./scripts/local.sh smoke
./scripts/local.sh smoke-dev
```

Default local ports:

- frontend dev: `http://127.0.0.1:5437`
- backend / preview: `http://127.0.0.1:8437`

## Legacy

The legacy material remains in the repo because it still matters, but it
is now interpreted explicitly rather than preserved as a vague archive:

- [legacy/README.md](legacy/README.md)
- [wiki/legacy-audit.md](wiki/legacy-audit.md)

## License

This repository is licensed under Apache-2.0. See [LICENSE](LICENSE).

Code, documentation, and original repo structure are covered by that
license. Datasets, curated derived artifacts, papers, and other
third-party materials remain subject to their own upstream licenses,
terms of use, attribution rules, and redistribution limits.

## External Scientific Anchors

- repository:
  `https://github.com/fsantibanezleal/CAOS_LDA_HSI`
- ORCID:
  `https://orcid.org/0000-0002-0150-3246`
- foundational LDA paper:
  `https://jmlr.csail.mit.edu/papers/v3/blei03a.html`
- HIDSAG:
  `https://www.nature.com/articles/s41597-023-02061-x`
- PM-LDA:
  `https://arxiv.org/abs/1609.03500`
