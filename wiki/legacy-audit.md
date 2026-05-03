# Legacy Audit

## Why `legacy/` matters

The `legacy/` directory is not dead weight. It contains the earliest
formal expression of the project's core idea:

- treat hyperspectral variability as structured evidence
- map spectral populations into document-like objects
- use topic modelling to derive latent regimes
- route downstream inference through those regimes

But the folder was not documented well enough. This audit fixes that.

## Legacy paper

### File

- `legacy/papers/Article_FASL_A39_final.docx`

### Actual content

The paper formalizes:

- topic modelling as a clustering stage for HSI samples
- three LDA-HSI mappings
- a hierarchical inference stage that uses topic membership to route
  regression/classification
- experiments over two laboratory-style mineral sample datasets
  combining HSI with geometallurgical or mineralogical variables

### Why it is important

This paper is the strongest historical anchor of the repo because it
already states, clearly, that:

- variability across pixels is not disposable
- documents can be built from multiple spectra
- LDA is being used as a robust grouping layer rather than only as a
  visualization trick

### Limits

- the paper predates the current local-first pipeline
- it does not define a reusable software architecture
- the datasets described in the paper are not automatically reproduced by
  the current legacy notebook

## Legacy notebook

### File

- `legacy/notebooks/LDA_Hyper_legacy.ipynb`

### What it actually does

The notebook:

1. loads local `.npz` spectra from `./DB/Example/`
2. computes a global normalization range
3. defines a wavelength vector spanning VNIR and SWIR
4. samples spectra randomly from each file
5. constructs several document definitions
6. tokenizes them into LDA-ready lists
7. runs Gensim LDA
8. exports pyLDAvis output

### The three concrete mappings in the notebook

#### Option A

- words are wavelengths
- the count of each wavelength token is the summed discretized intensity
  across selected spectra

Interpretation:

- wavelength-centric bag of counts over sampled support spectra

#### Option B

- words are discretized intensity bins
- counts record how many band values fall into each bin

Interpretation:

- histogram-style document over spectral magnitude levels

#### Option C

- spectra are concatenated after band reduction
- discretized values are preserved at the individual sampled-spectrum
  level

Interpretation:

- richer but larger document preserving more local individuality

### Why it is useful

- it captures the first practical implementation of the postdoctoral
  analogy
- it shows the project did not start from static conceptual prose only
- it still provides concrete translation logic that can be reimplemented
  cleanly in scripts

### Why it is not enough

- it is notebook-style and ad hoc
- it mixes topic-modelling logic with generic NLP scaffolding
- it depends on local files not described as a reproducible data source
- it does not expose split logic, baseline comparison, or measured-target
  validation in a reusable way

## Actionable interpretation

The correct treatment of `legacy/` is:

- preserve it
- audit it
- document it
- mine it for useful representation ideas
- never confuse it with the production pipeline
