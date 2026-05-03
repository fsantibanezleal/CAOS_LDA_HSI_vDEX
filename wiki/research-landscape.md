# Research Landscape

## Why This Project Still Matters

The original idea of spectral topic modelling remains relevant because
it sits at the intersection of four active research concerns:

1. **spectral variability**
2. **mixture-aware representations**
3. **spatial support beyond single pixels**
4. **interpretable latent structure**

The field did not converge to one solution. Instead, it branched into:

- symbolic corpus-style topic modelling
- variability-aware topic-like unmixing
- deep latent Dirichlet models
- broader generative models for hyperspectral structure

## Closest Adjacent Lines

### Partial Membership LDA for hyperspectral unmixing

Why it matters:

- it directly adapts topic-style mixtures to hyperspectral data
- it accounts for spectral variability
- it uses spatial documents such as superpixels

What it contributes relative to this repo:

- strong precedent for Dirichlet latent proportions in hyperspectral
  analysis
- stronger physical link to endmember variability

What this repo still contributes:

- a broader corpus-design agenda
- measured-target support
- explicit comparison between document constructions

### Semi-supervised PM-LDA

Why it matters:

- it shows that partial label information can guide topic-like
  hyperspectral inference
- it supports the idea that topic models need not remain strictly
  unsupervised when domain knowledge exists

Implication for this repo:

- Family B and Family D should eventually compare unsupervised,
  semi-supervised, and routed downstream variants

### Deep Dirichlet latent models

Why they matter:

- they show how the field evolved toward more expressive encoders
- they preserve abundance-like Dirichlet structure while using neural
  latent models

Implication for this repo:

- symbolic LDA/PTM should be treated as the interpretable baseline, not
  as the final ceiling

## Continuous Data And Vocabulary Research

The project's question about infinite or non-finite vocabularies is not
naive. There is direct topic-model precedent for it.

### Online LDA with Infinite Vocabulary

Key idea:

- LDA usually assumes a fixed vocabulary
- this work replaces that assumption with a Dirichlet-process-based
  expansion over strings

Implication:

- in topic modelling, a finite vocabulary is convenient but not
  inevitable
- however, the observations remain symbolic rather than truly continuous

### Continuous-topic variants

In adjacent literatures, topic models with Gaussian or mixture topics
have been used to avoid hard discretization of continuous domains.

Implication:

- future `CAOS_LDA_HSI` work can compare:
  - explicit quantization
  - adaptive vocabularies
  - continuous topic likelihoods
  - mixed discrete/continuous observation models

### Mixed discrete and continuous topic models

Why it matters:

- this line weakens the assumption that every observable must first be
  crushed into a purely discrete bag-of-words representation
- it is directly relevant to spectral data because some descriptors may
  be better preserved as continuous features

Implication for this repo:

- discretized corpora remain the interpretable baseline
- but mixed-observation topic models should be tracked as a serious
  future comparison line

## Dataset Trends That Matter

### Legacy benchmark scenes are still useful

UPV/EHU scenes remain important because they provide:

- low-friction reproducibility
- class labels
- familiar baselines
- compact experiments for topic stability and label alignment

### New HSI work is moving toward scale and diversity

Recent dataset directions include:

- large HSI patch corpora from EnMAP
- open UAV HSI benchmarks
- cross-scene transfer benchmarks
- labeled satellite HSI with global coverage
- measured laboratory HSI collections such as HIDSAG

Important status notes from current source checks:

- as of `2026-05-02`, the official HySpecNet-11k site states that the
  dataset is temporarily unavailable for direct download because of
  EnMAP licensing issues
- the official HYPSO-1 sea-land-cloud dataset page reports `200`
  calibrated images and pixel-level labels for `38` scenes

This supports the repo's decision to organize datasets by *family* and
not by one single benchmark tradition.

## Current Position Of The Repo

The strongest identity for this project is not:

- another generic HSI classifier
- another pure unmixing benchmark
- another static educational web page

It is:

> a local-first scientific workspace for testing whether spectral
> populations can be encoded as corpora, analysed as topic mixtures, and
> exploited for downstream interpretation and inference

## Priority Comparison Matrix

| Line | Why it matters | Priority for repo |
|---|---|---|
| Classical symbolic LDA/PTM | maximally interpretable | critical baseline |
| PM-LDA / semi-supervised PM-LDA | variability-aware, spatial, directly adjacent | critical comparison |
| Deep Dirichlet unmixing | modern latent extension | medium-term comparison |
| Pure clustering baselines | easy sanity check | mandatory |
| NMF / unmixing baselines | physically relevant comparison | mandatory |
| Spectral-library alignment | interpretation support | mandatory |
| Cross-scene transfer | real robustness test | high priority |

## Selected External Sources

- HIDSAG paper:
  `https://www.nature.com/articles/s41597-023-02061-x`
- PM-LDA:
  `https://arxiv.org/abs/1609.03500`
- Semi-supervised PM-LDA:
  `https://arxiv.org/abs/1703.06151`
- SpACNN-LDVAE:
  `https://arxiv.org/abs/2311.10701`
- Infinite-vocabulary topic model:
  `https://proceedings.mlr.press/v28/zhai13.html`
